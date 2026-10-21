import type {ScorecardResult,SourceEvidence} from './scorecards'
import {summarizeBreakdown} from './scorecards/calculate'
export type ScorecardHealth=Pick<ScorecardResult,'accountId'|'score'|'band'|'bands'|'configRevision'|'calculatedAt'|'versionId'|'selectedSegment'|'breakdown'>
const DAY=86400000
const details=(source:SourceEvidence):Record<string,unknown>=>source.details&&typeof source.details==='object'&&!Array.isArray(source.details)?source.details as Record<string,unknown>:{}
const expires=(source:SourceEvidence)=>source.kind==='sentiment'&&typeof details(source).expiresOn==='string'?details(source).expiresOn as string:null
const staleDays=(source:SourceEvidence)=>['billing','support'].includes(source.kind)&&typeof details(source).staleAfterDays==='number'?details(source).staleAfterDays as number:null
/** Deterministic changes in retained observations only. Adoption values and
 * segment selection stay at their recorded calculation; no activity is forecast. */
export function scorecardProjectionDates(card?:ScorecardHealth):string[]{
 if(!card)return []
 return card.breakdown.flatMap(measure=>measure.sources.flatMap(source=>{
  const expiry=expires(source),days=staleDays(source),observed=source.observedAt
  const edge=expiry?Date.parse(expiry)+DAY:days!==null&&observed?Date.parse(observed.slice(0,10))+(days+1)*DAY:NaN
  return Number.isFinite(edge)?[new Date(edge).toISOString().slice(0,10)]:[]
 }))
}
export function projectScorecard(card:ScorecardHealth,on:string):ScorecardHealth {
 const breakdown=card.breakdown.map(measure=>{
  const expired=measure.field==='sentiment.score'&&measure.sources.some(source=>{const expiry=expires(source);return expiry!==null&&on>expiry})
  const sources=measure.sources.map(source=>{
   const expiry=expires(source),days=staleDays(source),observed=source.observedAt
   if(expiry&&on>expiry)return {...source,freshness:'stale' as const,details:{...details(source),expired:true}}
   if(days!==null&&observed&&Number.isFinite(Date.parse(observed)))return {...source,freshness:Date.parse(on)-Date.parse(observed.slice(0,10))>days*DAY?'stale' as const:'current' as const}
   return source
  })
  return expired?{...measure,value:null,score:null,included:false,missingTreatment:measure.missing,sources}:{...measure,sources}
 })
 return {...card,breakdown,...summarizeBreakdown(breakdown,card.bands)}
}
/** A published numeric card determines its band. Manual red sentiment and
 * explicitly configured adoption consumers keep their separate risk duties. */
export function weightedHealth<T extends {evaluatedOn:string;status:string;reasons:string[];sentiment:{rating:string;expired:boolean}|null}>(base:T,recorded?:ScorecardHealth){
 if(!recorded)return base
 const card=projectScorecard(recorded,base.evaluatedOn),status=base.sentiment?.rating==='red'&&!base.sentiment.expired?'at-risk':card.band
 const projected=base.evaluatedOn>card.calculatedAt.slice(0,10)?` Projected on ${base.evaluatedOn} from retained observations; adoption values remain at their recorded measurement.`:''
 const selection=card.selectedSegment?` Weights selected by segment ${card.selectedSegment.name??card.selectedSegment.id} (${card.selectedSegment.id}), revision ${card.selectedSegment.revision}; membership was evaluated before aggregate health.`:' Default measure weights apply.'
 const line=`Published weighted health: ${card.score===null?'unknown':card.score+' / 100'} (${card.band}); version ${card.configRevision}; recalculated ${card.calculatedAt}.${projected}${selection} The configured measure weights and missing-source treatment determine this band. Native observations remain listed as inputs. This is not a churn prediction.`
 const inputs=card.breakdown.map(m=>`${m.name}: ${m.value===null?'missing':m.value}; contribution ${m.score===null?'unknown':m.score}, weight ${m.effectiveWeight}, ${m.missingTreatment}. ${m.sources.map(s=>`${s.label}: ${s.freshness}; ${s.reference??'reference missing'}; observed ${s.observedAt??'unknown'}`).join('; ')}`)
 return {...base,status,reasons:[line,...inputs,...base.reasons],score:card.score,recalculatedAt:card.calculatedAt,scorecard:card}
}
