import {consumerImage} from '../adoption/consumers-image'
import {adoptionRuleFields,adoptionRuleValues} from '../adoption/segment-inputs'
import {evaluate,ruleFields} from '../fields/model'
import {insist} from '../core'
import {definitions,evaluated,snapshot} from '../segments/snapshot'
import {includes} from '../segments/rules'
import {layerOneDependency} from './config'
import type {RetainedInputs,ScorecardField,SourceEvidence} from './types'

// Keep independently fenced images separate: embedding the metric CTE in the
// segment CTE again exceeds SQLite/D1's expression-depth budget.
const SOURCES=`SELECT json_group_array(json_object('accountId',account_id,'key',field_key,'source',source,'recordedAt',recorded_at)) AS snapshot FROM (
 SELECT h.*,row_number() OVER(PARTITION BY account_id,field_key ORDER BY recorded_at DESC,id DESC) AS latest FROM buoy_field_history h
 ) WHERE latest=1`
interface CustomSource {accountId:string;key:string;source:string;recordedAt:string}
export async function inputImage(db:D1Database,at:Date){
 const on=at.toISOString().slice(0,10)
 const [segmentImage,numericImage,sourceRow]=await Promise.all([snapshot(db,on),consumerImage(db,on,true),db.prepare(SOURCES).first<{snapshot:string}>()])
 insist(sourceRow,'Scorecard source evidence unavailable.',503)
 const sourceImage={sql:SOURCES,raw:sourceRow.snapshot},customSources=JSON.parse(sourceRow.snapshot) as CustomSource[]
 const image={...segmentImage.value,adoption:numericImage.value.adoption},segments=definitions(image),adoption=adoptionRuleValues(image.adoption),computed=evaluate(image.custom)
 const fields:ScorecardField[]=[
  ...['totalMinor','creditsMinor','allocatedMinor','balanceMinor'].map(key=>({key:`billing.${key}`,name:`Recorded billing ${key} (minor currency units)`,kind:'billing' as const,unit:'minor currency units'})),
  ...['openTickets','urgentTickets'].map(key=>({key:`support.${key}`,name:`Recorded support ${key}`,kind:'support' as const,unit:'tickets'})),
  ...Object.entries(ruleFields(image.custom.definitions)).filter(([,type])=>type==='number').map(([key])=>{
   const d=image.custom.definitions.find(d=>key===`custom.${d.key}`||key===`custom.${d.key}.amountMinor`)!
   return {key,name:d.label,kind:d.type==='formula'?'calculated' as const:'custom' as const,...(d.type==='currency'?{unit:'minor currency units'}:{})}
  }),
  ...Object.keys(adoptionRuleFields(image.adoption)).map(key=>({key,name:`Recorded ${key}`,kind:'adoption' as const})),
  {key:'sentiment.score',name:'Current CSM sentiment (red 0, amber 50, green 100)',kind:'sentiment',unit:'0–100 judgment'}
 ]
 const accounts=evaluated(image,on,false).map(account=>{
  const values:RetainedInputs['values']={},sources:RetainedInputs['sources']={}
  const usage=image.adoption.sources??[],hasUsageEvidence=usage.some(s=>s.lastObservedAt!==null)
  for(const field of fields){
   let raw:unknown=field.kind==='adoption'?adoption.get(`account:${account.account.id}`)?.[field.key]:account.values[field.key]
   let evidence:SourceEvidence[]=[]
   if(field.kind==='billing'||field.kind==='support'){
    const kind=field.kind,record=account.account[kind],coverage=account.assessment.evidence.find(e=>e.kind===kind)!
    evidence=[{kind,label:`Manual ${kind} snapshot`,freshness:!record?'missing':coverage.stale?'stale':'current',observedAt:record?.observedAt??null,reference:record?.reference??null,details:{sourceSystem:'manual',staleAfterDays:coverage.staleAfterDays,...(kind==='billing'?{currency:account.account.billing?.currency??null}:{})}}]
   }else if(field.kind==='adoption'){
    if(!hasUsageEvidence)raw=null
    evidence=[...usage.map(s=>({kind:'usage',label:s.name,freshness:s.freshness,observedAt:s.lastObservedAt,reference:s.reference,details:{id:s.id,kind:s.kind,eventCount:s.eventCount,attributedEventCount:s.attributedEventCount,staleDays:s.staleDays}})),
     ...(image.adoption.seatEvidence??[]).filter(s=>s.accountId===account.account.id).map(s=>({kind:'manual-seat-evidence',label:'Recorded account seats',freshness:s.freshness,observedAt:s.observedAt,reference:s.reference,details:{seats:s.seats,sourceSystem:s.sourceSystem,staleDays:s.staleDays}}))]
    if(!usage.length)evidence.push({kind:'usage',label:'Usage source evidence unavailable',freshness:'missing',observedAt:null,reference:null})
   }else if(field.kind==='sentiment'){
    const sentiment=image.sentiments.findLast(s=>s.accountId===account.account.id),expired=!!sentiment&&on>sentiment.expiresOn
    raw=!sentiment||expired?null:({red:0,amber:50,green:100} as const)[sentiment.rating]
    evidence=[{kind:'sentiment',label:'Recorded CSM judgment',freshness:!sentiment?'missing':expired?'stale':'current',observedAt:sentiment?.recordedAt??null,reference:null,details:sentiment?{rating:sentiment.rating,expiresOn:sentiment.expiresOn,recordedBy:sentiment.recordedBy,reason:sentiment.reason,scale:{red:0,amber:50,green:100}}:null}]
   }else{
    const key=field.key.split('.')[1],definition=image.custom.definitions.find(d=>d.key===key)!,source=customSources.find(s=>s.accountId===account.account.id&&s.key===key)
    evidence=[{kind:field.kind,label:definition.label,freshness:raw===null||raw===undefined?'missing':'untracked',observedAt:source?.recordedAt??null,reference:source?.source??null,details:{definition,explanation:computed.find(a=>a.id===account.account.id)?.explanations[key]??null,...(definition.type==='currency'?{currency:account.values[`custom.${key}.currency`]??null}:{})}}]
   }
   values[field.key]=typeof raw==='number'&&Number.isFinite(raw)?raw:null;sources[field.kind==='adoption'?'adoption':field.key]=evidence
  }
  const inputs:RetainedInputs={values,sources,fields,segments:segments.filter(s=>!layerOneDependency(s,segments)&&includes(s,account.account.id,account.values,account.people)).map(s=>({id:s.id,revision:s.revision})),measuredOn:on}
  return {accountId:account.account.id,accountRevision:account.account.revision,inputs}
 })
 return {accounts,fields,segments,consumers:image.consumers,fences:[segmentImage,numericImage,sourceImage]}
}
