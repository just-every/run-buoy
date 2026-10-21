import type {Breakdown,RetainedInputs,ScorecardConfig,ScorecardResult} from './types'
import {categoryKey} from './categories'
// Scaling before summing keeps all valid finite weights and bounds usable,
// including inputs whose direct difference or sum would overflow.
function linear(value:number,min:number,max:number){
 if(value<=min)return 0
 if(value>=max)return 100
 const scale=Math.max(Math.abs(min),Math.abs(max),Math.abs(value),1)
 return ((value/scale-min/scale)/(max/scale-min/scale))*100
}
export function calculate(config:ScorecardConfig,inputs:RetainedInputs,identity:Pick<ScorecardResult,'accountId'|'accountRevision'|'configRevision'|'versionId'|'calculatedAt'>):ScorecardResult {
 const override=config.segments.find(s=>inputs.segments.some(member=>member.id===s.segmentId)),selectedSegment=override?inputs.segments.find(s=>s.id===override.segmentId)!:null
 const breakdown=config.measures.map(measure=>{
  const raw=inputs.values[measure.field]??null,key=categoryKey(raw)
  const mapped=measure.categoryValues===undefined?raw:key!==null&&Object.hasOwn(measure.categoryValues,key)?measure.categoryValues[key]:null
  const value=typeof mapped==='number'&&Number.isFinite(mapped)?mapped:null,weight=override?.weights[measure.key]??measure.weight
  const normalized=value===null?null:linear(value,measure.min,measure.max),score=normalized===null?null:measure.direction==='lower'?100-normalized:normalized
  return {...measure,rawValue:raw,value,score,effectiveWeight:weight,included:value!==null,missingTreatment:value===null?measure.missing:'present' as const,sources:inputs.sources[measure.field]??inputs.sources[measure.field.split('.')[0]]??[]}
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
