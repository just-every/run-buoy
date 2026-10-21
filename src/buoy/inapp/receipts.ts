import { guard } from '../core'
import { id, insist, now, stmt, text, type Mapping } from './model'
export async function receipt(db:D1Database,sourceId:string,userId:string,groupId:string|null,m:Mapping|null,input:Record<string,unknown>,credentialGuard:D1PreparedStatement,mappingGuard:D1PreparedStatement,credentialId:string){
 const campaignId=text(input.campaignId,'Campaign ID',200),messageId=input.messageId,kind=input.kind
 insist(typeof messageId==='string'&&messageId.trim().length>0&&messageId.length<=200,'An exact receipt message ID is required (up to 200 characters).')
 insist(['view','completion','dismissal'].includes(String(kind)),'Choose a view, completion or dismissal receipt.')
 const campaign=await stmt(db,'SELECT id FROM buoy_inapp_campaigns WHERE id=? AND source_id=?',campaignId,sourceId).first()
 insist(campaign,'Message not found for this source.',404)
 const existing=await stmt(db,'SELECT id FROM buoy_usage_events WHERE source_id=? AND message_id=?',sourceId,messageId).first()
 const stamp=now(),eventId=id(),deliveryId=m?text(input.deliveryId,'Delivery ID',200):null
 const statements=[credentialGuard,mappingGuard]
 if(m&&!existing){
  statements.push(guard(db,`EXISTS(SELECT 1 FROM buoy_inapp_deliveries d JOIN buoy_inapp_campaigns c ON c.id=d.campaign_id JOIN buoy_segment_entries se ON se.segment_id=c.segment_id AND se.account_id=d.account_id AND se.exited_at IS NULL WHERE d.id=? AND d.campaign_id=? AND d.source_id=? AND d.claim_key=? AND d.person_id=? AND d.account_id=? AND c.enabled=1 AND (?<>'view' OR d.expires_at>?) AND (?='view' OR EXISTS(SELECT 1 FROM buoy_inapp_receipts r WHERE r.delivery_id=d.id AND r.kind='view')))`,deliveryId,campaignId,sourceId,m.claimKey,m.personId,m.accountId,kind,stamp,kind))
 }
 // The original source/message payload wins even if another intake door used it.
 // A second receipt kind for the same delivery is also an idempotent no-op.
 statements.push(stmt(db,`INSERT OR IGNORE INTO buoy_usage_events(id,source_id,message_id,type,event,user_id,group_id,observed_at,received_at,source_reference,source_system,payload)
 SELECT ?,s.id,?,'event',?,?,?,?,?,s.reference,s.kind,? FROM buoy_usage_sources s WHERE s.id=? AND (? IS NULL OR NOT EXISTS(SELECT 1 FROM buoy_inapp_receipts WHERE delivery_id=? AND kind=?))`,eventId,messageId,'In-app '+kind,userId,groupId,stamp,stamp,JSON.stringify({type:'event',event:'In-app '+kind,messageId,userId,groupId,properties:{campaignId,deliveryId,kind}}),sourceId,deliveryId,deliveryId,kind),
 stmt(db,'INSERT INTO buoy_inapp_receipts(event_id,campaign_id,delivery_id,kind) SELECT id,?,?,? FROM buoy_usage_events WHERE id=?',campaignId,deliveryId,kind,eventId))
 const insertIndex=statements.length-2
 if(m)statements.push(stmt(db,'UPDATE buoy_accounts SET revision=lower(hex(randomblob(16))) WHERE id=? AND EXISTS(SELECT 1 FROM buoy_usage_events WHERE id=?)',m.accountId,eventId),stmt(db,`INSERT OR IGNORE INTO buoy_audit_subjects(account_id,subject) SELECT ?,lower(hex(randomblob(16))) WHERE EXISTS(SELECT 1 FROM buoy_usage_events WHERE id=?)`,m.accountId,eventId),stmt(db,`INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) SELECT lower(hex(randomblob(16))),?,'account.usage-refreshed',subject,'',? FROM buoy_audit_subjects WHERE account_id=? AND EXISTS(SELECT 1 FROM buoy_usage_events WHERE id=?)`,'inapp-source:'+sourceId,stamp,m.accountId,eventId))
 statements.push(stmt(db,'UPDATE buoy_inapp_credentials SET last_used_at=? WHERE id=?',stamp,credentialId),stmt(db,'DELETE FROM buoy_assertions'))
 const results=await db.batch(statements),accepted=results[insertIndex].meta.changes
 return {received:1,accepted,duplicates:1-accepted,stored:accepted}
}
