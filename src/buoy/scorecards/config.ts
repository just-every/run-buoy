import {insist,object,text} from '../core'
import {healthDependency} from '../segments/dependencies'
import type {Segment} from '../segments/rules'
import type {ScorecardConfig,ScorecardField} from './types'
const keys=(value:Record<string,unknown>,allowed:string[])=>insist(Object.keys(value).every(key=>allowed.includes(key)),'Unsupported scorecard property.')
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)
const positive=(value:unknown):value is number=>finite(value)&&value>0
export function layerOneDependency(segment:Segment,segments:Segment[],seen=new Set<string>()):string[]|null {
 const native=healthDependency(segment,segments);if(native)return native
 if(segment.mode==='static'||seen.has(segment.id))return null
 seen.add(segment.id)
 for(const {field} of segment.rules.conditions){
  if(['health.score','health.recalculatedAt'].includes(field))return [segment.name,field,'weighted health']
  if(field==='tier'||field==='stage')for(const producer of segments.filter(s=>s[field]!==null)){const chain=layerOneDependency(producer,segments,new Set(seen));if(chain)return [segment.name,field,...chain]}
 }
 return null
}
export function scorecardConfig(input:unknown,fields:ScorecardField[],segments:Segment[]):ScorecardConfig {
 const value=object(input);keys(value,['name','measures','bands','segments'])
 insist(Array.isArray(value.measures)&&value.measures.length>0&&value.measures.length<=16,'Choose 1–16 numeric measures.')
 const measures=value.measures.map(raw=>{
  const m=object(raw);keys(m,['key','name','field','min','max','weight','direction','missing'])
  const key=text(m.key,'Measure key',60),field=text(m.field,'Measure field',200)
  insist(/^[a-z][a-z0-9_]*$/.test(key),'Use lowercase measure keys with letters, digits and underscores.')
  insist(!field.startsWith('health.'),'Final health fields cannot be scorecard inputs.')
  insist(fields.some(f=>f.key===field),'Choose a currently available numeric measure.')
  insist(finite(m.min)&&finite(m.max)&&m.min<m.max,'Measure bounds must be finite with min less than max.')
  insist(positive(m.weight),'Measure weights must be finite and positive.')
  insist(m.direction==='higher'||m.direction==='lower','Choose higher or lower scoring direction.')
  insist(m.missing==='unknown'||m.missing==='exclude','Choose unknown or exclude for missing values.')
  return {key,name:text(m.name,'Measure name',100),field,min:m.min,max:m.max,weight:m.weight,direction:m.direction,missing:m.missing}
 }) as ScorecardConfig['measures']
 insist(new Set(measures.map(m=>m.key)).size===measures.length&&new Set(measures.map(m=>m.field)).size===measures.length,'Measure keys and fields must be unique.')
 const bands=object(value.bands);keys(bands,['riskBelow','healthyAt'])
 insist(finite(bands.riskBelow)&&finite(bands.healthyAt)&&bands.riskBelow>=0&&bands.healthyAt<=100&&bands.riskBelow<bands.healthyAt,'Bands must be ordered from 0 to 100, with riskBelow less than healthyAt.')
 insist(Array.isArray(value.segments)&&value.segments.length<=50,'Choose at most 50 ordered segment overrides.')
 const overrides=value.segments.map(raw=>{
  const row=object(raw);keys(row,['segmentId','weights'])
  const segmentId=text(row.segmentId,'Segment id',100),segment=segments.find(s=>s.id===segmentId)
  insist(segment,'Choose an existing layer-1 segment.')
  const dependency=layerOneDependency(segment,segments)
  insist(!dependency,`Scorecard dependency refused: ${dependency?.join(' -> ')}. Choose a layer-1 segment.`)
  const weights=object(row.weights)
  insist(Object.keys(weights).every(key=>measures.some(m=>m.key===key)),'Segment weights must name configured measures.')
  insist(Object.values(weights).every(positive),'Segment weights must be finite and positive.')
  return {segmentId,weights:weights as Record<string,number>}
 })
 insist(new Set(overrides.map(s=>s.segmentId)).size===overrides.length,'Segment overrides must be unique.')
 return {name:text(value.name,'Scorecard name',100),measures,bands:{riskBelow:bands.riskBelow,healthyAt:bands.healthyAt},segments:overrides}
}
