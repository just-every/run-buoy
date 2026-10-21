import {usesPortfolio} from './custody'
import {customFields,relatedInputs,scalar} from './related'
import {parseSurveyImage} from '../surveys/snapshot'
import {parseRevenueImage} from '../revenue/snapshot'
import {consumerImage} from '../adoption/consumers-image'
import {adoptionRuleFields,adoptionRuleValues} from '../adoption/segment-inputs'
import {evaluate} from '../fields/model'
import {insist} from '../core'
import {definitions,evaluated,snapshot} from '../segments/snapshot'
import {includes} from '../segments/rules'
import {layerOneDependency} from './config'
import type {RetainedInputs,ScorecardField,SourceEvidence} from './types'

// Keep independently fenced images separate: embedding the metric CTE in the
// segment CTE again exceeds SQLite/D1's expression-depth budget.
const SOURCES=`SELECT json_group_array(json_object('accountId',account_id,'key',field_key,'source',source,'sourceAccountId',source_account_id,'recordedAt',recorded_at)) AS snapshot FROM (
 SELECT h.*,row_number() OVER(PARTITION BY account_id,field_key ORDER BY recorded_at DESC,id DESC) AS latest FROM buoy_field_history h
 ) WHERE latest=1`
interface CustomSource {accountId:string;key:string;source:string;sourceAccountId:string|null;recordedAt:string}
export async function inputImage(db:D1Database,at:Date){
 const on=at.toISOString().slice(0,10)
 const [segmentImage,numericImage,sourceRow]=await Promise.all([snapshot(db,on),consumerImage(db,on,true),db.prepare(SOURCES).first<{snapshot:string}>()])
 insist(sourceRow,'Scorecard source evidence unavailable.',503)
 const sourceImage={sql:SOURCES,raw:sourceRow.snapshot},customSources=JSON.parse(sourceRow.snapshot) as CustomSource[]
 const image={...segmentImage.value,adoption:numericImage.value.adoption},segments=definitions(image),adoption=adoptionRuleValues(image.adoption),computed=evaluate(image.custom)
 const related=await relatedInputs(db,image.people)
 const surveys=parseSurveyImage(JSON.stringify(image.surveys),on)
 const revenues=parseRevenueImage(JSON.stringify(image.revenue),on)
 const fields:ScorecardField[]=[
  ...['arrMinor','mrrMinor','seats'].map(key=>({key:`revenue.${key}`,name:`Confirmed recurring ${key}`,kind:'billing' as const,unit:key==='seats'?'purchased units':'native currency minor units'})),
  ...['totalMinor','creditsMinor','allocatedMinor','balanceMinor'].map(key=>({key:`billing.${key}`,name:`Recorded billing ${key} (minor currency units)`,kind:'billing' as const,unit:'minor currency units'})),
  ...['openTickets','urgentTickets'].map(key=>({key:`support.${key}`,name:`Recorded support ${key}`,kind:'support' as const,unit:'tickets'})),
  ...customFields(image.custom.definitions),...related.fields,
  ...['nps','csat','npsResponses','csatResponses'].map(key=>({key:`survey.${key}`,name:`Recorded survey ${key}`,kind:'survey' as const,unit:key==='nps'?'−100 to 100':key==='csat'?'1 to 5':'respondents'})),
  ...Object.keys(adoptionRuleFields(image.adoption)).map(key=>({key,name:`Recorded ${key}`,kind:'adoption' as const})),
  {key:'sentiment.score',name:'Current CSM sentiment (red 0, amber 50, green 100)',kind:'sentiment',unit:'0–100 judgment'}
 ]
 const accounts=evaluated(image,on,false).map(account=>{
  const relatedValues:NonNullable<RetainedInputs['relatedValues']>={},values:RetainedInputs['values']={},sources:RetainedInputs['sources']={}
  const usage=image.adoption.sources??[],hasUsageEvidence=usage.some(s=>s.lastObservedAt!==null)
  for(const field of fields){
   let raw:unknown=field.kind==='adoption'?adoption.get(`account:${account.account.id}`)?.[field.key]:account.values[field.key]
   let evidence:SourceEvidence[]=[]
   if(field.related){
    const value=related.account(account.account.id,field);relatedValues[field.key]=value.values;evidence=value.evidence;raw=null
   }else if(field.kind==='survey'){
    const survey=surveys.find(a=>a.accountId===account.account.id)!,assessment=survey.assessments[field.key.startsWith('survey.nps')?'nps':'csat']
    evidence=[{kind:'survey',label:'Staff-recorded '+assessment.kind.toUpperCase()+' responses',freshness:assessment.freshness,observedAt:assessment.latestDatum?.observedAt??null,reference:assessment.latestDatum?.reference??null,details:{respondentCount:assessment.respondentCount,responses:assessment.responses,windowDays:90}}]
   }else if(field.key.startsWith('revenue.')){
    const row=revenues.find(r=>r.accountId===account.account.id)!,revenue=row.revenue
    evidence=[{kind:'recurring-contract',label:'Person-confirmed recurring contract',freshness:revenue.freshness,observedAt:revenue.confirmedOn,reference:revenue.reference,details:{sourceKind:revenue.sourceKind,currency:revenue.currency,status:revenue.status,versionId:row.versionId,contractRevision:row.contractRevision,recordedBy:row.recordedBy,recordedAt:row.recordedAt,contract:row.contract}}]
   }else if(field.kind==='billing'||field.kind==='support'){
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
    const current=computed.find(a=>a.id===account.account.id)?.values[key]
    raw=definition.type==='currency'&&current&&typeof current==='object'?(current as Record<string,unknown>)[field.key.endsWith('.currency')?'currency':'amountMinor']:current
    evidence=[{kind:field.kind,label:definition.label,freshness:raw===null||raw===undefined?'missing':'untracked',observedAt:source?.recordedAt??null,reference:source?.source??null,details:{definition,explanation:computed.find(a=>a.id===account.account.id)?.explanations[key]??null,...(definition.type==='currency'?{currency:account.values[`custom.${key}.currency`]??null}:{})}}]
   }
   values[field.key]=scalar(raw);sources[field.kind==='adoption'?'adoption':field.key]=evidence
  }
  const sourceAccountIds=new Set<string>([account.account.id,...customSources.filter(s=>s.accountId===account.account.id).flatMap(s=>s.sourceAccountId?[s.sourceAccountId]:[])])
  if(usesPortfolio([...image.custom.definitions,...image.people.definitions]))image.accounts.forEach(a=>sourceAccountIds.add(a.id))
  const relevantPeople=image.people.records.filter(p=>p.accountIds.includes(account.account.id))
  for(const p of relevantPeople)for(const ids of [...Object.values(p.valueAccounts??{}),...Object.values(p.previousAccounts??{})])ids.forEach(id=>sourceAccountIds.add(id))
  const sourcePersonIds=[...new Set([...relevantPeople.map(p=>p.id),...image.surveys.responses.filter(r=>r.accountId===account.account.id).map(r=>r.personId)])].sort()
  const inputs:RetainedInputs={values,relatedValues,sources,fields,sourceAccountIds:[...sourceAccountIds].sort(),sourcePersonIds,segments:segments.filter(s=>!layerOneDependency(s,segments)&&includes(s,account.account.id,account.values,account.people)).map(s=>({id:s.id,revision:s.revision,name:s.name})),measuredOn:on}
  return {accountId:account.account.id,accountRevision:account.account.revision,inputs}
 })
 return {accounts,fields,segments,consumers:image.consumers,fences:[segmentImage,numericImage,sourceImage,related.fence]}
}
