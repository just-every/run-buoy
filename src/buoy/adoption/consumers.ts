import { auditRecord } from '../audit-records'
import { authority, guard, id, insist, now, requirePerson, stmt, text, type Actor } from '../core'
import { adoptionRuleFields, adoptionRuleValues } from './segment-inputs'
import { CONSUMER_OPERATORS, evaluateConsumers, type ConsumerRule } from './consumers-model'

export {CONSUMER_SNAPSHOT,CONSUMER_ADOPTION_SNAPSHOT,consumerImageSql,consumerImage} from './consumers-image'
import {CONSUMER_SNAPSHOT,consumerImage,requestedImageSql,type ConsumerImage} from './consumers-image'
import {snapshot as segmentSnapshot,fence as segmentFence,definitions} from '../segments/snapshot'
import {validateHealthInputs} from '../segments/dependencies'
export function measuredConsumers(image:ConsumerImage,accountIds?:Set<string>){
 const values=adoptionRuleValues(image.adoption)
 return new Map(image.adoption.subjects.filter(subject=>subject.scope==='account'&&(!accountIds||accountIds.has(subject.id))).map(subject=>[subject.id,evaluateConsumers(image.rules,subject.id,image.adoption,values)]))
}
export async function consumerMeasurements(db:D1Database,on?:string){
 const enabled=await db.prepare("SELECT 1 AS enabled FROM buoy_adoption_consumers WHERE json_extract(document,'$.enabled')=1 AND json_extract(document,'$.health')=1 LIMIT 1").first()
 if(!enabled)return new Map<string,ReturnType<typeof evaluateConsumers>>()
 const image=(await segmentSnapshot(db,on)).value
 return measuredConsumers({adoption:image.adoption,rules:image.consumers.filter(rule=>rule.health),owners:[],segments:[]})
}
export async function consumerState(db:D1Database,actor:Actor){
 insist(actor.kind==='person','Adoption measures require a staff session.',403)
 const sql=await requestedImageSql(db,undefined,true)
 const result=await db.batch([authority(db,actor),db.prepare(sql),stmt(db,'DELETE FROM buoy_assertions')])
 const row=result[1].results[0] as {snapshot:string}
 insist(row,'Adoption measures changed. Refresh before reading.',409)
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
 }else insist(input.segmentId===undefined,'Segment selection applies only to a segment aggregate.')
 insist(prior||snapshot.value.rules.length<32,'At most 32 adoption consumers are supported.')
 const rule:ConsumerRule={id:prior?.id??id(),name,scope:input.scope,...(input.scope==='segment'?{segmentId:input.segmentId as string}:{}),metric,op:input.op as ConsumerRule['op'],value:input.value as number|null,health:input.health as boolean,alert:input.alert as boolean,enabled:input.enabled as boolean,revision:id()},at=now()
 const membership=await segmentSnapshot(db)
 validateHealthInputs(definitions(membership.value),[...snapshot.value.rules.filter(r=>r.id!==rule.id),rule])
 await db.batch([authority(db,actor,true),segmentFence(db,membership),guard(db,`(${CONSUMER_SNAPSHOT})=?`,JSON.stringify(snapshot.value.rules)),
  guard(db,"(SELECT json_group_array(json_object('kind',kind,'key',key)) FROM (SELECT kind,key FROM buoy_adoption_definitions ORDER BY kind,key))=?",JSON.stringify(snapshot.value.adoption.definitions)),
  prior?stmt(db,'UPDATE buoy_adoption_consumers SET document=?,revision=?,updated_at=? WHERE id=? AND revision=?',JSON.stringify(rule),rule.revision,at,rule.id,prior.revision)
   :stmt(db,'INSERT INTO buoy_adoption_consumers(id,document,revision,created_at,updated_at) VALUES(?,?,?,?,?)',rule.id,JSON.stringify(rule),rule.revision,at,at),
  stmt(db,'UPDATE buoy_accounts SET revision=lower(hex(randomblob(16)))'),
  auditRecord(db,actor,'adoption.consumer-saved',`adoption-consumer:${rule.id}`),stmt(db,'DELETE FROM buoy_assertions')])
 return rule
}
