import {evaluatePeople} from '../people/model'
import type {PeopleImage} from '../people/snapshot'
import type {Definition} from '../fields/model'
import {insist} from '../core'
import type {ScorecardField,ScorecardValue,SourceEvidence,RelatedScorecardValue} from './types'
export const scalar=(raw:unknown):ScorecardValue=>typeof raw==='number'&&Number.isFinite(raw)||typeof raw==='string'||typeof raw==='boolean'||Array.isArray(raw)&&raw.every(v=>typeof v==='string')?raw as ScorecardValue:null
export function customFields(definitions:Definition[],prefix='custom.',related=false):ScorecardField[]{
 return definitions.flatMap(d=>d.type==='currency'?[
  {key:prefix+d.key+'.amountMinor',name:d.label+' amount',kind:'custom' as const,valueType:'number' as const,unit:'minor currency units',...(related?{related}: {})},
  {key:prefix+d.key+'.currency',name:d.label+' currency',kind:'custom' as const,valueType:'text' as const,...(related?{related}: {})}]:[
  {key:prefix+d.key,name:d.label,kind:d.type==='formula'?'calculated' as const:'custom' as const,valueType:(['number','formula'].includes(d.type)?'number':['boolean','multi-select','date'].includes(d.type)?d.type:'text') as ScorecardField['valueType'],...(related?{related}: {})}
 ])
}
const SOURCES=`SELECT json_group_array(json_object('personId',person_id,'key',field_key,'source',source,'recordedAt',recorded_at)) AS snapshot FROM (
 SELECT h.*,row_number() OVER(PARTITION BY person_id,field_key ORDER BY recorded_at DESC,id DESC) AS latest FROM buoy_customer_history h
 ) WHERE latest=1`
export async function relatedInputs(db:D1Database,image:PeopleImage){
 const row=await db.prepare(SOURCES).first<{snapshot:string}>();insist(row,'Related measure sources unavailable.',503)
 const sources=JSON.parse(row.snapshot) as {personId:string;key:string;source:string;recordedAt:string}[],people=evaluatePeople(image)
 return {fence:{sql:SOURCES,raw:row.snapshot},fields:(['contact','user'] as const).flatMap(kind=>customFields(image.definitions,`people.${kind}.custom.`,true).map(field=>({...field,name:kind+' · '+field.name}))),
  account(accountId:string,field:ScorecardField){
   const [,kind,,key,part]=field.key.split('.'),definition=image.definitions.find(d=>d.key===key)!
   const members=people.filter(p=>p.kind===kind&&p.accountIds.includes(accountId))
   const values:RelatedScorecardValue[]=members.map(p=>{const raw=p.values[key],value=part&&raw&&typeof raw==='object'&&!Array.isArray(raw)?(raw as Record<string,unknown>)[part]:raw;return {personId:p.id,revision:p.revision,value:scalar(value)}})
   const evidence:SourceEvidence[]=members.map(p=>{
    const raw=values.find(v=>v.personId===p.id)!.value,source=sources.find(s=>s.personId===p.id&&s.key===key),currency=p.values[key]
    return {kind:'customer-field',label:p.name+' · '+definition.label,freshness:raw===null?'missing':'untracked',observedAt:source?.recordedAt??null,reference:source?.source??null,details:{personId:p.id,revision:p.revision,rawValue:raw,definition,explanation:p.explanations[key]??null,...(definition.type==='currency'&&currency&&typeof currency==='object'&&!Array.isArray(currency)?{currency:(currency as {currency?:string}).currency}: {})}}
   })
   if(!members.length)evidence.push({kind:'customer-field',label:'No current explicitly linked '+kind+' values',freshness:'missing',observedAt:null,reference:null})
   return {values,evidence}
  }
 }
}
