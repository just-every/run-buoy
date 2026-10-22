import type {Bindings} from '../../auth.server'
import {authority,date,guard,id,insist,now,requirePerson,stmt,type Actor} from '../core'
import {auditRecord} from '../audit-records'
import {seal,unseal} from '../connectors/vault'
import {stripeCustomer,sourceId} from './stripe'
import type {BillingState,BindingPreview} from './types'
export interface ConnectionRow {id:string;version:number;disconnected_at:string|null;sealed:string|null}
export async function credential(env:Bindings,connectionId:string){
 const row=await stmt(env.DB,'SELECT c.id,c.version,c.disconnected_at,k.sealed FROM buoy_connections c LEFT JOIN buoy_connection_credentials k ON k.connection_id=c.id WHERE c.id=? AND c.provider=\'stripe\'',connectionId).first<ConnectionRow>()
 insist(row,'Stripe connection not found.',404);insist(row.sealed&&!row.disconnected_at,'Reconnect this Stripe source before syncing.',409)
 return {...row,secret:await unseal(env.SESSION_SECRET,connectionId,row.sealed)}
}
export async function settings(db:D1Database,connectionId:string){
 await stmt(db,'INSERT OR IGNORE INTO buoy_billing_settings(connection_id) SELECT id FROM buoy_connections WHERE id=?',connectionId).run()
 const row=await stmt(db,'SELECT * FROM buoy_billing_settings WHERE connection_id=?',connectionId).first<{connection_id:string;version:number;stale_days:number;cursor:string|null;lease_until:number;last_success:string|null;last_error:string|null}>()
 insist(row,'Stripe connection not found.',404);return row
}
export async function previewBinding(env:Bindings,actor:Actor,connectionId:string,input:Record<string,unknown>):Promise<BindingPreview>{
 requirePerson(actor);const customerId=sourceId(input.customerId),accountId=sourceId(input.accountId),connection=await credential(env,connectionId)
 const account=await stmt(env.DB,"SELECT id,revision,json_extract(document,'$.name') AS name FROM buoy_accounts WHERE id=?",accountId).first<{id:string;revision:string;name:string}>()
 insist(account,'Choose an existing account.',404)
 const conflict=await stmt(env.DB,'SELECT id FROM buoy_billing_bindings WHERE account_id=? OR (connection_id=? AND customer_id=?)',accountId,connectionId,customerId).first()
 insist(!conflict,'This account or Stripe customer is already bound. Review and remove its current binding first.',409)
 await stripeCustomer(connection.secret,customerId)
 const config=await settings(env.DB,connectionId),expiresAt=new Date(Date.now()+600000).toISOString()
 const review={connectionId,customerId,accountId,accountRevision:account.revision,connectionVersion:connection.version,settingsVersion:config.version,actorId:actor.id,expiresAt}
 return {...review,accountName:account.name,token:await seal(env.SESSION_SECRET,'billing-binding:'+actor.id,JSON.stringify(review))}
}
export async function applyBinding(env:Bindings,actor:Actor,connectionId:string,input:Record<string,unknown>){
 requirePerson(actor);insist(typeof input.token==='string'&&input.token.length<8192,'Preview the exact customer binding first.')
 let review:Record<string,unknown>
 try{review=JSON.parse(await unseal(env.SESSION_SECRET,'billing-binding:'+actor.id,input.token))}catch{insist(false,'Binding preview is invalid. Review it again.',409)}
 insist(review.connectionId===connectionId&&review.actorId===actor.id&&typeof review.expiresAt==='string'&&Date.parse(review.expiresAt)>Date.now(),'Binding preview expired. Review it again.',409)
 const bindingId=id()
 await env.DB.batch([authority(env.DB,actor,true),guard(env.DB,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)',review.accountId,review.accountRevision),guard(env.DB,'EXISTS(SELECT 1 FROM buoy_connections c JOIN buoy_connection_credentials k ON k.connection_id=c.id JOIN buoy_billing_settings s ON s.connection_id=c.id WHERE c.id=? AND c.version=? AND s.version=? AND c.disconnected_at IS NULL)',connectionId,review.connectionVersion,review.settingsVersion),stmt(env.DB,'INSERT INTO buoy_billing_bindings(id,connection_id,customer_id,account_id,revision,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?)',bindingId,connectionId,review.customerId,review.accountId,id(),actor.id,now()),stmt(env.DB,'UPDATE buoy_billing_settings SET version=version+1,lease_until=0 WHERE connection_id=?',connectionId),stmt(env.DB,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),review.accountId),auditRecord(env.DB,actor,'billing.binding-reviewed',bindingId),stmt(env.DB,'DELETE FROM buoy_assertions')])
 return {id:bindingId,accountId:review.accountId,customerId:review.customerId}
}
export async function removeBinding(env:Bindings,actor:Actor,bindingId:string,input:Record<string,unknown>){
 requirePerson(actor);const binding=await stmt(env.DB,'SELECT * FROM buoy_billing_bindings WHERE id=?',bindingId).first<{connection_id:string;account_id:string;revision:string}>()
 insist(binding,'Binding not found.',404);insist(input.revision===binding.revision,'Binding changed. Review it again.',409)
 await env.DB.batch([authority(env.DB,actor,true),guard(env.DB,'EXISTS(SELECT 1 FROM buoy_billing_bindings WHERE id=? AND revision=?)',bindingId,binding.revision),stmt(env.DB,'DELETE FROM buoy_billing_current WHERE account_id=?',binding.account_id),stmt(env.DB,'DELETE FROM buoy_billing_bindings WHERE id=?',bindingId),stmt(env.DB,'UPDATE buoy_billing_settings SET version=version+1,lease_until=0 WHERE connection_id=?',binding.connection_id),stmt(env.DB,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),binding.account_id),auditRecord(env.DB,actor,'billing.binding-removed',bindingId),stmt(env.DB,'DELETE FROM buoy_assertions')])
 return {status:'Binding removed; retained observations remain historical.'}
}
export function freshness(connection:{disconnected_at:string|null;credential_present:number;last_error:string|null},observedAt:string|null,staleDays:number,on=now()){
 if(connection.disconnected_at)return 'Disconnected'
 if(!connection.credential_present)return 'Reconnect required'
 if(connection.last_error)return 'Failed'
 if(!observedAt)return 'Missing'
 return Date.parse(on.slice(0,10))-Date.parse(observedAt.slice(0,10))>staleDays*86400000?'Stale':'Current'
}
export async function billingState(db:D1Database,actor:Actor,on=now().slice(0,10)):Promise<BillingState>{
 requirePerson(actor);date(on,'Billing freshness measurement date')
 const rows=await db.batch<Record<string,unknown>>([
  db.prepare(`SELECT c.id,c.name,c.disconnected_at,EXISTS(SELECT 1 FROM buoy_connection_credentials k WHERE k.connection_id=c.id) AS credential_present,
   COALESCE(s.stale_days,30) AS stale_days,COALESCE(s.version,1) AS version,s.cursor,s.last_success,s.last_error,
   EXISTS(SELECT 1 FROM buoy_billing_webhook_credentials k WHERE k.connection_id=c.id) AS webhook_present
   FROM buoy_connections c LEFT JOIN buoy_billing_settings s ON s.connection_id=c.id ORDER BY c.created_at,c.id`),
  db.prepare("SELECT id,json_extract(document,'$.name') AS name,revision FROM buoy_accounts ORDER BY name,id"),
  db.prepare('SELECT id,connection_id AS connectionId,customer_id AS customerId,account_id AS accountId,revision,reviewed_by AS reviewedBy,reviewed_at AS reviewedAt FROM buoy_billing_bindings ORDER BY reviewed_at,id'),
  db.prepare('SELECT s.*,EXISTS(SELECT 1 FROM buoy_billing_current c WHERE c.snapshot_id=s.id) AS is_current FROM buoy_billing_snapshots s ORDER BY s.received_at DESC,s.id'),
  db.prepare('SELECT * FROM buoy_billing_changes ORDER BY observed_at DESC,id'),
  db.prepare('SELECT * FROM buoy_billing_runs ORDER BY started_at DESC,id LIMIT 100')
 ])
 const connections=rows[0].results.map(row=>{const c=row as unknown as BillingState['connections'][number];return {...c,freshness:freshness(c,c.last_success,c.stale_days,on)}})
 const observations=rows[3].results.map(row=>{const c=connections.find(c=>c.id===row.connection_id)!,fresh=freshness(c,String(row.observed_at),c.stale_days,on);return {id:String(row.id),accountId:String(row.account_id),bindingId:String(row.binding_id),connectionId:String(row.connection_id),customerId:String(row.customer_id),sourceSystem:String(row.source_system),sourceReference:String(row.source_reference),observedAt:String(row.observed_at),receivedAt:String(row.received_at),accountRevision:String(row.account_revision),document:JSON.parse(String(row.document)),freshness:fresh,confidence:fresh==='Current'?'Source current':'Reduced: Stripe billing '+fresh.toLowerCase()}})
 return {connections,accounts:rows[1].results as unknown as BillingState['accounts'],bindings:rows[2].results as unknown as BillingState['bindings'],observations:observations.filter((_,i)=>rows[3].results[i].is_current),history:observations,changes:rows[4].results.map(row=>({...row,before:row.before_document?JSON.parse(String(row.before_document)):null,after:JSON.parse(String(row.after_document))})) as BillingState['changes'],runs:rows[5].results as unknown as BillingState['runs']}
}
// Internal consumer interface. No auth bypass is exported over HTTP: the root
// mounts this data only inside its existing authenticated account/health doors.
export async function billingAccountSignals(db:D1Database,on=now()){
 const rows=await db.prepare(`SELECT b.account_id,s.document,s.observed_at,c.disconnected_at,
  EXISTS(SELECT 1 FROM buoy_connection_credentials k WHERE k.connection_id=c.id) AS credential_present,
  COALESCE(t.stale_days,30) AS stale_days,t.last_error FROM buoy_billing_bindings b
  JOIN buoy_connections c ON c.id=b.connection_id LEFT JOIN buoy_billing_settings t ON t.connection_id=c.id
  LEFT JOIN buoy_billing_current p ON p.account_id=b.account_id LEFT JOIN buoy_billing_snapshots s ON s.id=p.snapshot_id`).all<{account_id:string;document:string|null;observed_at:string|null;disconnected_at:string|null;credential_present:number;stale_days:number;last_error:string|null}>()
 return new Map(rows.results.map(row=>{const document=row.document?JSON.parse(row.document) as import('./types').BillingDocument:null,fresh=freshness(row,row.observed_at,row.stale_days,on);return [row.account_id,{sourceSystem:'stripe-test' as const,observedAt:row.observed_at,staleDays:row.stale_days,freshness:fresh,confidence:fresh==='Current'?'current':'reduced',revenue:document?.revenue??null,risks:document?.risks??[],reason:fresh==='Current'?null:'Stripe billing '+fresh.toLowerCase()}]}))
}
