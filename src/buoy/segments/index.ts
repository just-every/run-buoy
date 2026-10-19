import { observeOutcomes } from '../outcomes/observe'
import { accountAudit } from '../audit-records'
import { auditRecord } from '../audit-records'
import { authority, guard, id, insist, now, requirePerson, stmt, type Actor } from '../core'
import type { Values } from './rules'
import { FIELDS, classify, includes, segmentInput } from './rules'
import { snapshot, fence, definitions, accountValues, type Image } from './snapshot'

export function evaluated(image:Image,on:string) {
 const segments=definitions(image)
 return accountValues(image,on).map(item=>{
  const tiers=segments.find(s=>s.tier&&includes(s,item.account.id,item.values)),stages=segments.find(s=>s.stage&&includes(s,item.account.id,item.values))
  const tier=item.classification?.tierManual?item.classification.tier:tiers?.tier??null,stage=item.classification?.stageManual?item.classification.stage:stages?.stage??null
  return {...item,tier,stage,values:{...item.values,tier,stage} as Values}
 })
}
/** Reconciliation is fenced against every source input and membership interval.
 * No external call; a concurrent mutation refuses the batch and a later request
 * evaluates the new image. An entry and its proposal always commit together. */
export async function reconcile(db:D1Database,actor:Actor,at=new Date()) {
 const image=await snapshot(db),segments=definitions(image.value)
 if(!segments.length)return
 const accounts=evaluated(image.value,at.toISOString().slice(0,10)),statements:D1PreparedStatement[]=[],stamp=at.toISOString()
 for(const a of accounts) {
  if((a.classification?.tier??null)!==a.tier||(a.classification?.stage??null)!==a.stage)
   statements.push(stmt(db,'INSERT INTO buoy_classifications(account_id,tier,stage) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET tier=excluded.tier,stage=excluded.stage',a.account.id,a.tier,a.stage))
  for(const segment of segments){
   const prior=image.value.entries.find(e=>e.segmentId===segment.id&&e.accountId===a.account.id&&!e.exitedAt),member=includes(segment,a.account.id,a.values)
   if(prior&&!member)statements.push(stmt(db,'UPDATE buoy_segment_entries SET exited_at=? WHERE id=? AND exited_at IS NULL',stamp,prior.id))
   if(!prior&&member){
    const entryId=id(),proposalId=segment.playbook?id():null
    statements.push(stmt(db,'INSERT INTO buoy_segment_entries(id,segment_id,account_id,entered_at,proposal_id) VALUES(?,?,?,?,?)',entryId,segment.id,a.account.id,stamp,proposalId))
    if(segment.playbook) {
     const dueDate=new Date(Date.parse(stamp.slice(0,10))+segment.playbook.dueDays*86400000).toISOString().slice(0,10)
     const payload={title:segment.playbook.title,dueDate,priority:'medium',type:'general',segmentEntry:entryId,segmentRevision:segment.revision}
     statements.push(stmt(db,"INSERT INTO buoy_proposals(id,account_id,kind,account_revision,snapshot,payload,status,prepared_by,prepared_at) VALUES(?,?,'playbook',?,?,?,'prepared',?,?)",proposalId,a.account.id,a.account.revision,JSON.stringify(a.account),JSON.stringify(payload),`${actor.kind}:${actor.id}:${actor.displayName}`,stamp))
    }
   }
  }
 }
 if(statements.length)await db.batch([authority(db,actor),fence(db,image.raw),...statements,auditRecord(db,actor,'segments.evaluated','installation:segments'),stmt(db,'DELETE FROM buoy_assertions')])
}
export async function segmentState(db:D1Database) {
 const image=(await snapshot(db)).value,accounts=evaluated(image,new Date().toISOString().slice(0,10))
 return {fields:FIELDS,segments:definitions(image).map(s=>({...s,
  members:image.entries.filter(e=>e.segmentId===s.id&&!e.exitedAt).map(e=>{const a=accounts.find(a=>a.account.id===e.accountId)!;return {accountId:e.accountId,name:a.account.name,health:a.values['health.status'] as string,tier:a.tier,stage:a.stage,enteredAt:e.enteredAt}}),
  history:image.entries.filter(e=>e.segmentId===s.id).map(e=>({accountId:e.accountId,enteredAt:e.enteredAt,exitedAt:e.exitedAt,proposalId:e.proposalId}))})),
  classifications:accounts.map(a=>({accountId:a.account.id,tier:a.tier,stage:a.stage,tierManual:!!a.classification?.tierManual,stageManual:!!a.classification?.stageManual}))}
}
export async function saveSegment(db:D1Database,actor:Actor,input:Record<string,unknown>) {
 requirePerson(actor)
 const image=await snapshot(db),existing=input.id?image.value.segments.find(s=>s.id===input.id):undefined
 if(input.id)insist(existing&&input.revision===existing.revision,'Segment changed. Reload before saving.',409)
 else insist(image.value.segments.length<50,'At most 50 segments are supported.')
 const value=segmentInput(input,new Set(image.value.accounts.map(a=>a.id))),segmentId=existing?.id??id()
 await db.batch([authority(db,actor,true),fence(db,image.raw),stmt(db,'INSERT INTO buoy_segments(id,document,revision,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document,revision=excluded.revision',segmentId,JSON.stringify(value),id(),existing?.createdAt??now()),auditRecord(db,actor,'segment.saved',`segment:${segmentId}`),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:segmentId}
}
export async function setClassification(db:D1Database,actor:Actor,accountId:string,input:Record<string,unknown>) {
 requirePerson(actor)
 insist(Object.keys(input).every(k=>['tier','stage'].includes(k)),'Only tier and stage can be classified.')
 const tier=input.tier==='__rules__'?null:classify(input.tier??null,'tier'),stage=input.stage==='__rules__'?null:classify(input.stage??null,'stage')
 await db.batch([authority(db,actor,true),guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=?)',accountId),stmt(db,'INSERT INTO buoy_classifications(account_id,tier,stage,tier_manual,stage_manual) VALUES(?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET tier=excluded.tier,stage=excluded.stage,tier_manual=excluded.tier_manual,stage_manual=excluded.stage_manual',accountId,tier,stage,Number(input.tier!=='__rules__'),Number(input.stage!=='__rules__')),...accountAudit(db,actor,accountId,'account.classified'),stmt(db,'DELETE FROM buoy_assertions')])
 return {accountId}
}
export async function segmentReport(db:D1Database,segmentId:string) {
 const segment=(await segmentState(db)).segments.find(s=>s.id===segmentId);insist(segment,'Segment not found.',404)
 return {id:segment.id,name:segment.name,count:segment.members.length,health:Object.fromEntries(['at-risk','healthy','unknown'].map(status=>[status,segment.members.filter(a=>a.health===status).length])),accounts:segment.members}
}
export function reportCsv(report:Awaited<ReturnType<typeof segmentReport>>) {
 const cell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"'
 return [['Account id','Account','Health','Tier','Stage','Entered at'],...report.accounts.map(a=>[a.accountId,a.name,a.health,a.tier,a.stage,a.enteredAt])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
}
export async function scheduledSegments(db:D1Database,at:Date) {
 const owner=await db.prepare("SELECT id,display_name AS displayName,role FROM oa_operators WHERE role='owner' AND status='active' ORDER BY id LIMIT 1").first<{id:string;displayName:string;role:string}>()
 if(owner){const actor={...owner,kind:'person' as const};await reconcile(db,actor,at);await observeOutcomes(db,actor,at)}
}
