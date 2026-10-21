import type {Breakdown,MeasureAggregate,RetainedInputs,ScorecardConfig,ScorecardResult,ScorecardValue} from './types'
import {insist} from '../core'
import {categoryKey} from './categories'
// Scaling before summing keeps all valid finite weights and bounds usable,
// including inputs whose direct difference or sum would overflow.
function linear(value:number,min:number,max:number){
 if(value<=min)return 0
 if(value>=max)return 100
 const scale=Math.max(Math.abs(min),Math.abs(max),Math.abs(value),1)
 return ((value/scale-min/scale)/(max/scale-min/scale))*100
}
function numericValue(raw:ScorecardValue,mapping?:Record<string,number>):number|null {
 const key=categoryKey(raw),mapped=mapping===undefined?raw:key!==null&&Object.hasOwn(mapping,key)?mapping[key]:null
 return typeof mapped==='number'&&Number.isFinite(mapped)?mapped:null
}
function aggregate(values:number[],mode:MeasureAggregate):number {
 if(mode==='min')return values.reduce((result,value)=>Math.min(result,value),Infinity)
 if(mode==='max')return values.reduce((result,value)=>Math.max(result,value),-Infinity)
 const scale=values.reduce((result,value)=>Math.max(result,Math.abs(value)),0)
 if(scale===0)return 0
 const total=values.reduce((result,value)=>result+value/scale,0)
 const value=(mode==='mean'?Math.max(-1,Math.min(1,total/values.length)):total)*scale
 insist(Number.isFinite(value),'Related-person aggregate exceeds finite numeric bounds.')
 return value
}
export function calculate(config:ScorecardConfig,inputs:RetainedInputs,identity:Pick<ScorecardResult,'accountId'|'accountRevision'|'configRevision'|'versionId'|'calculatedAt'>):ScorecardResult {
 const override=config.segments.find(s=>inputs.segments.some(member=>member.id===s.segmentId)),selectedSegment=override?inputs.segments.find(s=>s.id===override.segmentId)!:null
 const breakdown=config.measures.map(measure=>{
  const related=measure.aggregate?inputs.relatedValues?.[measure.field]??[]:undefined
  const mapped=related?.map(row=>numericValue(row.value,measure.categoryValues)),present=mapped?.filter((value):value is number=>value!==null)
  const missing=related!==undefined&&(!related.length||present!.length!==related.length)
  const raw=related===undefined?inputs.values[measure.field]??null:!present!.length||(missing&&measure.missing==='unknown')?null:aggregate(present!,measure.aggregate!)
  const value=related===undefined?numericValue(raw,measure.categoryValues):raw as number|null,weight=override?.weights[measure.key]??measure.weight
  const normalized=value===null?null:linear(value,measure.min,measure.max),score=normalized===null?null:measure.direction==='lower'?100-normalized:normalized
  return {...measure,rawValue:raw,...(related===undefined?{}:{relatedValues:related}),value,score,effectiveWeight:weight,included:value!==null,missingTreatment:value===null?measure.missing:missing?'exclude':'present' as const,sources:inputs.sources[measure.field]??inputs.sources[measure.field.split('.')[0]]??[]}
 })
 return {...identity,inputs,selectedSegment,breakdown,bands:{...config.bands},...summarizeBreakdown(breakdown,config.bands)}
}
export function summarizeBreakdown(breakdown:Breakdown[],bands:ScorecardConfig['bands']){
 const included=breakdown.filter(m=>m.included),unknown=breakdown.some(m=>m.value===null&&m.missing==='unknown')
 const scale=Math.max(...included.map(m=>m.effectiveWeight)),total=included.reduce((sum,m)=>sum+m.effectiveWeight/scale,0)
 const score=unknown||!included.length?null:Math.min(100,Math.max(0,included.reduce((sum,m)=>sum+(m.score!/100)*(m.effectiveWeight/scale),0)/total*100))
 const band=score===null?'unknown':score<bands.riskBelow?'at-risk':score>=bands.healthyAt?'healthy':'watch'
 return {score,band} as Pick<ScorecardResult,'score'|'band'>
}
