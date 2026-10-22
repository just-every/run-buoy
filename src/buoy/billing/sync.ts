import type {Bindings} from '../../auth.server'
import {authority,guard,id,insist,now,requirePerson,stmt,type Actor} from '../core'
import {credential,settings} from './storage'
import {readStripeBilling} from './stripe'
import type {BillingDocument} from './types'
interface Binding {id:string;customer_id:string;account_id:string;revision:string;account_revision:string}
export async function syncBilling(env:Bindings,connectionId:string,actor?:Actor,customerId?:string,eventId?:string){
 if(actor)requirePerson(actor)
 const db=env.DB,connection=await credential(env,connectionId),config=await settings(db,connectionId),runId=id(),started=now(),lease=Date.now()+300000
 const bindings=(await stmt(db,'SELECT b.*,a.revision AS account_revision FROM buoy_billing_bindings b JOIN buoy_accounts a ON a.id=b.account_id WHERE b.connection_id=? ORDER BY b.customer_id',connectionId).all<Binding>()).results
 const binding=customerId?bindings.find(b=>b.customer_id===customerId):bindings.find(b=>!config.cursor||b.customer_id>config.cursor)||bindings[0]
 insist(binding,'Review a Stripe customer binding to an existing account first.',409)
 const locked=await db.batch([...(actor?[authority(db,actor,true)]:[]),stmt(db,'UPDATE buoy_billing_settings SET lease_until=? WHERE connection_id=? AND version=? AND lease_until<?',lease,connectionId,config.version,Date.now())])
 insist(locked.at(-1)!.meta.changes===1,'A billing sync is running. Retry after it finishes.',409)
 await stmt(db,"INSERT INTO buoy_billing_runs(id,connection_id,customer_id,started_at,status,cursor_before,trigger_kind) VALUES(?,?,?,?,'running',?,?)",runId,connectionId,binding.customer_id,started,config.cursor,eventId?'webhook':actor?'manual':'scheduled').run()
 try{
  const observedAt=now(),{document,readCount}=await readStripeBilling(connection.secret,binding.customer_id,observedAt),receivedAt=now()
  const prior=await stmt(db,'SELECT s.document FROM buoy_billing_current c JOIN buoy_billing_snapshots s ON s.id=c.snapshot_id WHERE c.account_id=?',binding.account_id).first<{document:string}>()
  const snapshotId=id(),revision=id(),reference='stripe-test:'+binding.customer_id+':'+(eventId?'event:'+eventId:'reconciliation:'+runId),cursor=customerId?config.cursor:(bindings.at(-1)!.id===binding.id?null:binding.customer_id)
  const previous=prior?JSON.parse(prior.document) as BillingDocument:null,changed=JSON.stringify(previous?.subscriptions)!==JSON.stringify(document.subscriptions)
  await db.batch([
   ...(actor?[authority(db,actor,true)]:[]),
   guard(db,'EXISTS(SELECT 1 FROM buoy_connections c JOIN buoy_connection_credentials k ON k.connection_id=c.id JOIN buoy_billing_settings s ON s.connection_id=c.id WHERE c.id=? AND c.version=? AND s.version=? AND s.lease_until=? AND c.disconnected_at IS NULL)',connectionId,connection.version,config.version,lease),
   guard(db,'EXISTS(SELECT 1 FROM buoy_billing_bindings b JOIN buoy_accounts a ON a.id=b.account_id WHERE b.id=? AND b.revision=? AND a.revision=?)',binding.id,binding.revision,binding.account_revision),
   stmt(db,'INSERT INTO buoy_billing_snapshots(id,binding_id,account_id,connection_id,customer_id,source_system,source_reference,observed_at,received_at,document,account_revision,run_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',snapshotId,binding.id,binding.account_id,connectionId,binding.customer_id,'stripe-test',reference,observedAt,receivedAt,JSON.stringify(document),revision,runId),
   stmt(db,'INSERT INTO buoy_billing_current(account_id,snapshot_id) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET snapshot_id=excluded.snapshot_id',binding.account_id,snapshotId),
   ...(changed?[stmt(db,'INSERT INTO buoy_billing_changes(id,account_id,snapshot_id,source_reference,observed_at,before_document,after_document) VALUES(?,?,?,?,?,?,?)',id(),binding.account_id,snapshotId,reference,observedAt,previous?JSON.stringify(previous.subscriptions):null,JSON.stringify(document.subscriptions))]:[]),
   stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',revision,binding.account_id),
   stmt(db,"UPDATE buoy_billing_runs SET finished_at=?,status='succeeded',read_count=?,snapshot_count=1,cursor_after=? WHERE id=?",receivedAt,readCount,cursor,runId),
   stmt(db,'UPDATE buoy_billing_settings SET cursor=?,last_success=?,last_error=NULL,lease_until=0 WHERE connection_id=?',cursor,receivedAt,connectionId),
   stmt(db,"UPDATE buoy_billing_webhook_events SET status='processed',processed_at=? WHERE connection_id=? AND customer_id=? AND status='pending' AND received_at<=?",receivedAt,connectionId,binding.customer_id,started),
   stmt(db,'DELETE FROM buoy_assertions')
  ])
 }catch(error){
  const message=error instanceof Error&&/^(Stripe billing |Invalid Stripe )/.test(error.message)?error.message:'Stripe billing sync could not complete. Recheck the credential, binding and account revision.'
  const failedAt=now()
  await db.batch([
   stmt(db,"UPDATE buoy_billing_runs SET finished_at=?,status='failed',error=? WHERE id=?",failedAt,message,runId),
   stmt(db,'UPDATE buoy_billing_settings SET last_error=?,lease_until=0 WHERE connection_id=? AND version=? AND lease_until=?',message,connectionId,config.version,lease),
   stmt(db,`INSERT OR IGNORE INTO buoy_inbox(id,person_id,account_id,type,source,title,body,created_at)
    SELECT lower(hex(randomblob(16))),o.id,b.account_id,'signal',?||':'||b.account_id||':'||o.id,'Reconnect Stripe billing','Stripe billing failed. Review its connection; dependent evidence has reduced confidence.',?
    FROM buoy_billing_bindings b CROSS JOIN oa_operators o WHERE b.connection_id=? AND o.status='active' AND o.role IN ('owner','admin')`,
    'billing-failure:'+connectionId+':'+(config.last_success??'never'),failedAt,connectionId)
  ])
 }
 return stmt(db,'SELECT * FROM buoy_billing_runs WHERE id=?',runId).first()
}
export async function reconcileBilling(env:Bindings){
 // A periodic customer read always advances the durable cursor. One additional
 // pending event read may follow, so a busy webhook source cannot starve it.
 const connections=(await env.DB.prepare(`SELECT DISTINCT b.connection_id AS id FROM buoy_billing_bindings b JOIN buoy_connections c ON c.id=b.connection_id
  JOIN buoy_connection_credentials k ON k.connection_id=c.id LEFT JOIN buoy_billing_settings s ON s.connection_id=c.id
  WHERE c.disconnected_at IS NULL AND COALESCE(s.lease_until,0)<? ORDER BY COALESCE(s.last_success,''),b.connection_id LIMIT 20`).bind(Date.now()).all<{id:string}>()).results
 for(const connection of connections){
  try{
   const pending=await stmt(env.DB,"SELECT e.customer_id,e.event_id FROM buoy_billing_webhook_events e JOIN buoy_billing_bindings b ON b.connection_id=e.connection_id AND b.customer_id=e.customer_id WHERE e.connection_id=? AND e.status='pending' ORDER BY e.received_at,e.event_id LIMIT 1",connection.id).first<{customer_id:string;event_id:string}>()
   await syncBilling(env,connection.id)
   if(pending){const remaining=await stmt(env.DB,"SELECT status FROM buoy_billing_webhook_events WHERE connection_id=? AND event_id=?",connection.id,pending.event_id).first<{status:string}>();if(remaining?.status==='pending')await syncBilling(env,connection.id,undefined,pending.customer_id,pending.event_id)}
  }catch{/* A live manual sync or concurrent disconnect owns its own result. */}
 }
}
