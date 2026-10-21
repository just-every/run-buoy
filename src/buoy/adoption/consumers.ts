import { auditRecord } from '../audit-records'
import { authority, date, guard, id, insist, now, requirePerson, stmt, text, type Actor } from '../core'
import { ATTRIBUTED, MAPPED_JOIN } from '../usage/mappings'
import { adoptionRuleFields, adoptionRuleValues, measuredSnapshot, aggregateMeasuredSnapshot } from './segment-inputs'
import { CONSUMER_OPERATORS, evaluateConsumers, type ConsumerAdoptionImage, type ConsumerRule } from './consumers-model'

export const CONSUMER_SNAPSHOT=`SELECT json_group_array(json_patch(json(document),json_object('id',id,'revision',revision))) FROM (SELECT * FROM buoy_adoption_consumers ORDER BY created_at,id)`
// This embeds the report's metric image. Added metadata describes its sources
// and manual denominators; it does not calculate a second version of a metric.
export const CONSUMER_ADOPTION_SNAPSHOT=`SELECT json_patch(json((SELECT CASE WHEN EXISTS(SELECT 1 FROM buoy_adoption_consumers WHERE json_extract(document,'$.enabled')=1 AND json_extract(document,'$.scope')='segment') THEN (${aggregateMeasuredSnapshot}) ELSE (${measuredSnapshot}) END)),json_object(
 'sources',json((SELECT json_group_array(json_object('id',id,'name',name,'kind',kind,'reference',reference,'eventCount',eventCount,'attributedEventCount',attributedEventCount,'lastObservedAt',lastObservedAt,'staleDays',staleDays,'freshness',CASE WHEN lastObservedAt IS NULL THEN 'missing' WHEN julianday(date('now'))-julianday(substr(lastObservedAt,1,10))>staleDays THEN 'stale' ELSE 'current' END)) FROM (
  SELECT s.id,s.name,s.kind,s.reference,s.stale_days AS staleDays,count(e.id) AS eventCount,max(e.observed_at) AS lastObservedAt,
   count(CASE WHEN ${ATTRIBUTED} AND e.user_id IS NOT NULL AND m.person_id IS NOT NULL THEN 1 END) AS attributedEventCount
  FROM buoy_usage_sources s LEFT JOIN buoy_usage_events e ON e.source_id=s.id AND julianday(e.observed_at)>=julianday(date('now','+1 day'))-60 AND julianday(e.observed_at)<julianday(date('now','+1 day'))
  ${MAPPED_JOIN} GROUP BY s.id ORDER BY s.name,s.id))),
 'seatEvidence',json((SELECT json_group_array(json_object('accountId',account_id,'seats',seats,'sourceSystem',source_system,'reference',reference,'observedAt',observed_at,'staleDays',stale_days,'freshness',CASE WHEN julianday(date('now'))-julianday(observed_at)>stale_days THEN 'stale' ELSE 'current' END)) FROM (SELECT * FROM buoy_adoption_seats ORDER BY account_id))),
 'personLicenses',json((SELECT json_group_array(json_object('accountId',account_id,'personId',person_id,'licensed',json(CASE WHEN licensed=1 THEN 'true' ELSE 'false' END),'sourceSystem',source_system,'reference',reference,'observedAt',observed_at,'staleDays',stale_days,'freshness',CASE WHEN julianday(date('now'))-julianday(observed_at)>stale_days THEN 'stale' ELSE 'current' END)) FROM (SELECT * FROM buoy_adoption_person_licenses ORDER BY account_id,person_id)))
 ))`
const IMAGE=`SELECT json_object('rules',json((${CONSUMER_SNAPSHOT})),'adoption',json((${CONSUMER_ADOPTION_SNAPSHOT})),
 'segments',json((SELECT json_group_array(json_object('id',s.id,'name',json_extract(s.document,'$.name'),'accountIds',json((SELECT json_group_array(account_id) FROM (SELECT account_id FROM buoy_segment_entries WHERE segment_id=s.id AND exited_at IS NULL ORDER BY account_id))))) FROM (SELECT * FROM buoy_segments ORDER BY created_at,id) s)),
 'owners',json((SELECT json_group_array(json_object('accountId',a.account_id,'personId',a.owner_id)) FROM buoy_account_owners a JOIN oa_operators o ON o.id=a.owner_id AND o.status='active' ORDER BY a.account_id))) AS snapshot`
export function consumerImageSql(on?:string){
 if(on===undefined)return IMAGE
 const day=date(on,'Adoption measurement date')
 return IMAGE.replaceAll("date('now','+1 day')",`date('${day}','+1 day')`).replaceAll("date('now')",`date('${day}')`)
}
export interface ConsumerImage {rules:ConsumerRule[];adoption:ConsumerAdoptionImage;owners:{accountId:string;personId:string}[];segments:{id:string;name:string;accountIds:string[]}[]}
export async function consumerImage(db:D1Database,on?:string){
 const sql=consumerImageSql(on),row=await db.prepare(sql).first<{snapshot:string}>()
 insist(row,'Adoption measures unavailable.',503)
 return {raw:row.snapshot,value:JSON.parse(row.snapshot) as ConsumerImage,sql}
}
export function measuredConsumers(image:ConsumerImage,accountIds?:Set<string>){
 const values=adoptionRuleValues(image.adoption)
 return new Map(image.adoption.subjects.filter(subject=>subject.scope==='account'&&(!accountIds||accountIds.has(subject.id))).map(subject=>[subject.id,evaluateConsumers(image.rules,subject.id,image.adoption,values)]))
}
export async function consumerMeasurements(db:D1Database,on?:string){
 const enabled=await db.prepare("SELECT 1 AS enabled FROM buoy_adoption_consumers WHERE json_extract(document,'$.enabled')=1 AND json_extract(document,'$.health')=1 LIMIT 1").first()
 if(!enabled)return new Map<string,ReturnType<typeof evaluateConsumers>>()
 const image=(await consumerImage(db,on)).value
 return measuredConsumers({...image,rules:image.rules.filter(rule=>rule.health)})
}
export async function consumerState(db:D1Database,actor:Actor){
 insist(actor.kind==='person','Adoption measures require a staff session.',403)
 const result=await db.batch([authority(db,actor),db.prepare(IMAGE),stmt(db,'DELETE FROM buoy_assertions')])
 const row=result[1].results[0] as {snapshot:string}
 const image=JSON.parse(row.snapshot) as ConsumerImage
 return {on:image.adoption.on,rules:image.rules,fields:adoptionRuleFields(image.adoption),segments:image.segments,evaluations:[...measuredConsumers(image)].map(([accountId,measures])=>({accountId,measures}))}
}
export async function saveConsumer(db:D1Database,actor:Actor,input:Record<string,unknown>):Promise<ConsumerRule>{
 requirePerson(actor)
 insist(Object.keys(input).every(key=>['id','revision','name','scope','segmentId','metric','op','value','health','alert','enabled'].includes(key)),'Unsupported adoption consumer property.')
 const snapshot=await consumerImage(db),prior=input.id===undefined?undefined:snapshot.value.rules.find(rule=>rule.id===input.id)
 if(input.id!==undefined){
  text(input.id,'Consumer ID',200);insist(prior,'Adoption consumer not found.',404)
  insist(input.revision===prior.revision,'Adoption consumer changed. Refresh before saving.',409)
 }else insist(input.revision===undefined,'New adoption consumers do not have a revision.')
 const name=text(input.name,'Consumer name',100),metric=text(input.metric,'Adoption metric',250)
 insist(input.scope==='account'||input.scope==='user'||input.scope==='contact'||input.scope==='segment','Choose account, user, contact or segment scope.')
 insist(Object.hasOwn(adoptionRuleFields(snapshot.value.adoption),metric),'Choose an available numeric adoption report metric.')
 insist(CONSUMER_OPERATORS.includes(input.op as ConsumerRule['op']),'Choose a supported threshold operator.')
 insist(input.op==='is-missing'?input.value===null:typeof input.value==='number'&&Number.isFinite(input.value),'Threshold must be a finite number, or null for is-missing.')
 for(const key of ['health','alert','enabled'])insist(typeof input[key]==='boolean',`${key} must be a boolean.`)
 insist(input.health||input.alert,'Choose health, alert or both effects.')
 if(input.scope==='segment'){
  insist(typeof input.segmentId==='string'&&snapshot.value.segments.some(segment=>segment.id===input.segmentId),'Choose an existing segment for the aggregate.')
  insist(input.health===false,'Segment aggregate health is not available yet. Choose an alert without a health effect.')
 }else insist(input.segmentId===undefined,'Segment selection applies only to a segment aggregate.')
 insist(prior||snapshot.value.rules.length<32,'At most 32 adoption consumers are supported.')
 const rule:ConsumerRule={id:prior?.id??id(),name,scope:input.scope,...(input.scope==='segment'?{segmentId:input.segmentId as string}:{}),metric,op:input.op as ConsumerRule['op'],value:input.value as number|null,health:input.health as boolean,alert:input.alert as boolean,enabled:input.enabled as boolean,revision:id()},at=now()
 await db.batch([authority(db,actor,true),guard(db,`(${CONSUMER_SNAPSHOT})=?`,JSON.stringify(snapshot.value.rules)),
  guard(db,"(SELECT json_group_array(json_object('kind',kind,'key',key)) FROM (SELECT kind,key FROM buoy_adoption_definitions ORDER BY kind,key))=?",JSON.stringify(snapshot.value.adoption.definitions)),
  prior?stmt(db,'UPDATE buoy_adoption_consumers SET document=?,revision=?,updated_at=? WHERE id=? AND revision=?',JSON.stringify(rule),rule.revision,at,rule.id,prior.revision)
   :stmt(db,'INSERT INTO buoy_adoption_consumers(id,document,revision,created_at,updated_at) VALUES(?,?,?,?,?)',rule.id,JSON.stringify(rule),rule.revision,at,at),
  stmt(db,'UPDATE buoy_accounts SET revision=lower(hex(randomblob(16)))'),
  auditRecord(db,actor,'adoption.consumer-saved',`adoption-consumer:${rule.id}`),stmt(db,'DELETE FROM buoy_assertions')])
 return rule
}
