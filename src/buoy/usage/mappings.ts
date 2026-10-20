import { auditRecord, accountAudit } from '../audit-records'
import { authority, guard, id, insist, now, requirePerson, stmt, type Actor } from '../core'
import { digest, only } from './model'

export const MAPPED_JOIN=`LEFT JOIN buoy_usage_mappings m ON m.source_id=e.source_id AND m.user_id IS e.user_id AND m.group_id IS e.group_id
 LEFT JOIN buoy_customer_people p ON p.id=m.person_id
 LEFT JOIN buoy_customer_memberships cm ON cm.person_id=m.person_id AND cm.account_id=m.account_id`
export const ATTRIBUTED=`m.account_id IS NOT NULL AND (e.user_id IS NULL OR (p.id IS NOT NULL AND cm.person_id IS NOT NULL))`
export const CLAIM_KEY=(userId:string|null,groupId:string|null)=>JSON.stringify([userId,groupId])
function claimId(value:unknown,label:string){
 insist(value===null||(typeof value==='string'&&value.length>0&&value.length<=500&&!/[\u0000-\u001f]/.test(value)),`${label} must be an exact source ID or null.`)
 return value as string|null
}
async function mappingImage(db:D1Database,input:Record<string,unknown>){
 only(input,['sourceId','userId','groupId','accountId','personId','fingerprint'])
 insist(typeof input.sourceId==='string'&&typeof input.accountId==='string','Choose a source and account.')
 const userId=claimId(input.userId,'User ID'),groupId=claimId(input.groupId,'Group ID')
 insist(userId!==null||groupId!==null,'A source user or group ID is required.')
 const personId=input.personId===null?null:claimId(input.personId,'Customer person ID')
 insist(userId===null?personId===null:personId!==null,'User claims require a customer contact or user; group-only claims map to an account.')
 const source=await stmt(db,'SELECT id,name,kind,reference FROM buoy_usage_sources WHERE id=?',input.sourceId).first()
 const account=await stmt(db,'SELECT id,document,revision FROM buoy_accounts WHERE id=?',input.accountId).first()
 insist(source&&account,'Source or account not found.',404)
 const person=personId?await stmt(db,'SELECT p.id,p.kind,p.name,p.revision FROM buoy_customer_people p JOIN buoy_customer_memberships cm ON cm.person_id=p.id WHERE p.id=? AND cm.account_id=?',personId,input.accountId).first():null
 insist(!personId||person,'The selected customer person must explicitly belong to this account. No membership is inferred.',409)
 const key=CLAIM_KEY(userId,groupId)
 const conflict=await stmt(db,`SELECT 1 AS conflict FROM buoy_usage_mappings WHERE source_id=? AND claim_key<>? AND ((? IS NOT NULL AND user_id=? AND person_id IS NOT ?) OR (? IS NOT NULL AND group_id=? AND account_id<>?)) LIMIT 1`,input.sourceId,key,userId,userId,personId,groupId,groupId,input.accountId).first()
 insist(!conflict,'This source user or group conflicts with an existing reviewed identity. Review the existing mappings; no identity is merged or split.',409)
 const previous=await stmt(db,'SELECT * FROM buoy_usage_mappings WHERE source_id=? AND claim_key=?',input.sourceId,key).first()
 const claims=await stmt(db,'SELECT count(*) AS eventCount,min(observed_at) AS firstObservedAt,max(observed_at) AS lastObservedAt FROM buoy_usage_events WHERE source_id=? AND user_id IS ? AND group_id IS ?',input.sourceId,userId,groupId).first()
 return {sourceId:input.sourceId,userId,groupId,accountId:input.accountId,personId,source,account,person,previous,claims}
}
export async function previewMapping(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor)
 const image=await mappingImage(db,input)
 return {...image,fingerprint:await digest(JSON.stringify(image)),notice:'Only this exact source/user/group claim is reviewed. No other identity, membership or claim is merged.'}
}
export async function approveMapping(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor)
 const image=await mappingImage(db,input)
 insist(typeof input.fingerprint==='string'&&input.fingerprint===await digest(JSON.stringify(image)),'Mapping evidence changed. Preview and review again.',409)
 const {sourceId,userId,groupId,accountId,personId}=image,stamp=now(),key=CLAIM_KEY(userId,groupId)
 const statements=[guard(db,`NOT EXISTS(SELECT 1 FROM buoy_usage_mappings WHERE source_id=? AND claim_key<>? AND ((? IS NOT NULL AND user_id=? AND person_id IS NOT ?) OR (? IS NOT NULL AND group_id=? AND account_id<>?)))`,sourceId,key,userId,userId,personId,groupId,groupId,accountId),guard(db,'(SELECT count(*) FROM buoy_usage_events WHERE source_id=? AND user_id IS ? AND group_id IS ?)=?',sourceId,userId,groupId,image.claims!.eventCount),guard(db,'EXISTS(SELECT 1 FROM buoy_usage_sources WHERE id=? AND kind=? AND reference=?)',sourceId,image.source!.kind,image.source!.reference),authority(db,actor,true),guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)',accountId,image.account!.revision),
  guard(db,'COALESCE((SELECT revision FROM buoy_usage_mappings WHERE source_id=? AND claim_key=?),\'\')=?',sourceId,key,image.previous?.revision??'')]
 if(personId)statements.push(guard(db,'EXISTS(SELECT 1 FROM buoy_customer_people p JOIN buoy_customer_memberships cm ON cm.person_id=p.id WHERE p.id=? AND p.revision=? AND cm.account_id=?)',personId,image.person!.revision,accountId))
 statements.push(stmt(db,`INSERT INTO buoy_usage_mappings(source_id,claim_key,user_id,group_id,account_id,person_id,revision,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,claim_key) DO UPDATE SET account_id=excluded.account_id,person_id=excluded.person_id,revision=excluded.revision,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at`,sourceId,key,userId,groupId,accountId,personId,id(),actor.id,stamp),
  stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),accountId),...accountAudit(db,actor,accountId,'usage.mapping-reviewed'),auditRecord(db,actor,'usage.mapping-reviewed',`usage-source:${sourceId}`),stmt(db,'DELETE FROM buoy_assertions'))
 if(image.previous&&image.previous.account_id!==accountId)statements.splice(-1,0,stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),image.previous.account_id))
 await db.batch(statements)
 return {sourceId,userId,groupId,accountId,personId,reviewedBy:actor.id,reviewedAt:stamp}
}
/** Account evidence is visible through the same session read authority as accounts. */
export async function accountUsage(db:D1Database,actor:Actor,accountId:string){
 insist(actor.kind==='person','Customer usage is available to signed-in staff.',403)
 const result=await db.batch([authority(db,actor),stmt(db,`SELECT e.source_id AS sourceId,s.name,e.source_system AS sourceSystem,e.source_reference AS sourceReference,count(*) AS eventCount,max(e.observed_at) AS observedAt,max(e.received_at) AS receivedAt,s.stale_days AS staleDays FROM buoy_usage_events e ${MAPPED_JOIN} JOIN buoy_usage_sources s ON s.id=e.source_id WHERE ${ATTRIBUTED} AND m.account_id=? GROUP BY e.source_id,e.source_system,e.source_reference,s.stale_days ORDER BY s.name`,accountId),stmt(db,'DELETE FROM buoy_assertions')])
 return {accountId,sources:(result[1].results as Record<string,unknown>[]).map(r=>({...r,freshness:Math.floor(Date.now()/86400000)-Math.floor(Date.parse(String(r.observedAt))/86400000)>Number(r.staleDays)?'stale':'current'}))}
}
