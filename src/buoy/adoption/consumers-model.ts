import { adoptionRuleValues, type AdoptionImage } from './segment-inputs'
import type { AdoptionSource } from './read'
import type { AdoptionPersonLicense, AdoptionSeatEvidence } from './types'

export const CONSUMER_OPERATORS = ['lt','lte','eq','gte','gt','is-missing'] as const
export interface ConsumerRule {
 id:string;name:string;scope:'account'|'user'|'contact'|'segment';segmentId?:string;metric:string;
 op:typeof CONSUMER_OPERATORS[number];value:number|null;health:boolean;alert:boolean;enabled:boolean;revision:string
}
export interface ConsumerAdoptionImage extends AdoptionImage {
 sources?:(AdoptionSource & {staleDays:number;freshness:'missing'|'stale'|'current'})[];
 seatEvidence?:AdoptionSeatEvidence[];personLicenses?:AdoptionPersonLicense[]
}
export interface ConsumerSubjectMeasure {id:string;name:string;value:number|null;matched:boolean;missing:boolean}
export interface ConsumerEvaluation extends ConsumerRule {
 ruleId:string;accountId:string;on:string;matched:boolean;missing:boolean;reason:string;
 subjects:ConsumerSubjectMeasure[];sources:NonNullable<ConsumerAdoptionImage['sources']>;
 seatEvidence:AdoptionSeatEvidence[];personLicenses:AdoptionPersonLicense[]
}
export function consumerEvidence(measure:ConsumerEvaluation){
 const sources=measure.sources.map(s=>`${s.name}: ${s.reference}; ${s.freshness}`).join('; ')||'missing'
 const seats=measure.seatEvidence.map(s=>`${s.reference}, observed ${s.observedAt}, ${s.freshness}`).join('; ')||'missing'
 const licenses=measure.personLicenses.map(s=>`${s.personId}: ${s.reference}, observed ${s.observedAt}, ${s.freshness}`).join('; ')||'missing'
 return `${measure.reason} Measured ${measure.on} UTC. Installation source coverage: ${sources}. Selected account manual seat evidence: ${seats}. Related-person manual license evidence: ${licenses}. Current reviewed mappings, memberships and definitions apply; source completeness, billing verification and a verified signup baseline are not inferred.`
}
const comparisons={lt:(a:number,b:number)=>a<b,lte:(a:number,b:number)=>a<=b,eq:(a:number,b:number)=>a===b,gte:(a:number,b:number)=>a>=b,gt:(a:number,b:number)=>a>b}
const membership=(value:string)=>JSON.parse(value) as string[]
export function evaluateConsumers(rules:ConsumerRule[],accountId:string,image:ConsumerAdoptionImage,values?:ReturnType<typeof adoptionRuleValues>):ConsumerEvaluation[]{
 if(!rules.some(rule=>rule.enabled))return []
 values??=adoptionRuleValues(image)
 return rules.filter(rule=>rule.enabled&&(rule.scope!=='segment'||image.subjects.some(subject=>subject.scope==='segment'&&subject.id===rule.segmentId&&membership(subject.accountIds).includes(accountId)))).map(rule=>{
  const subjects=image.subjects.filter(subject=>rule.scope==='segment'
   ?subject.scope==='segment'&&subject.id===rule.segmentId
   :rule.scope==='account'
   ?subject.scope==='account'&&subject.id===accountId
   :subject.scope==='person'&&subject.kind===rule.scope&&membership(subject.accountIds).includes(accountId))
   .map(subject=>{
    const raw=values.get(`${subject.scope}:${subject.id}`)?.[rule.metric],value=typeof raw==='number'&&Number.isFinite(raw)?raw:null,missing=value===null
    return {id:subject.id,name:subject.name,value,missing,matched:rule.op==='is-missing'?missing:!missing&&comparisons[rule.op](value,rule.value!)}
   })
  // No related person is missing evidence, rather than an invented person whose
  // value satisfies an is-missing predicate. Related-person matching is ANY.
  const matched=subjects.some(subject=>subject.matched),missing=subjects.length===0||(!matched&&rule.op!=='is-missing'&&subjects.some(subject=>subject.missing))
  const details=subjects.map(subject=>`${subject.name} (${subject.id}): ${subject.value===null?'missing':subject.value}${subject.matched?' (matches)':''}`).join('; ')
  const input=image.healthInputs?.find(s=>s.id===rule.segmentId)
  const layer=input?` Selected segment ${input.name} (${input.id}), revision ${input.revision}; membership evaluated before aggregate health.`:''
  const predicate=rule.op==='is-missing'?'is missing':`${rule.op} ${rule.value}`
  const evidenceAccounts=rule.scope==='segment'?image.subjects.find(subject=>subject.scope==='segment'&&subject.id===rule.segmentId)!.accountIds:null
  return {...rule,ruleId:rule.id,accountId,on:image.on,matched,missing,subjects,
   reason:`${layer}${rule.name}: ${rule.metric} ${predicate}; ${details||`no current related ${rule.scope} subject`}. ${matched?'Threshold matched.':missing?'Required adoption measure is unknown.':'Threshold did not match.'}`,
   sources:image.sources??[],seatEvidence:(image.seatEvidence??[]).filter(e=>evidenceAccounts?membership(evidenceAccounts).includes(e.accountId):e.accountId===accountId),
   personLicenses:(image.personLicenses??[]).filter(e=>subjects.some(subject=>subject.id===e.personId))}
 })
}
export function applyConsumerHealth<T extends {status:string;reasons:string[]}>(base:T,evaluations:ConsumerEvaluation[]):Omit<T,'status'>&{status:string;adoptionMeasures?:ConsumerEvaluation[]}{
 if(!evaluations.length)return base
 const required=evaluations.filter(measure=>measure.enabled&&measure.health),risk=required.some(measure=>measure.matched),missing=required.some(measure=>measure.missing)
 const status=base.status==='at-risk'||risk?'at-risk':base.status==='unknown'||missing?'unknown':base.status
 return {...base,status,reasons:[...base.reasons,...required.map(consumerEvidence)],adoptionMeasures:evaluations}
}
