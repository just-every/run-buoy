import {insist} from '../core'
import type {ConsumerRule} from '../adoption/consumers-model'
import type {Segment} from './rules'

/** Health inputs may depend on layer-1 classification producers, but never on
 * final health, including an indirect dependency through tier or stage. */
export function healthDependency(segment:Segment,segments:Segment[],path:string[]=[]):string[]|null {
 if(path.includes(segment.id))return [...path.map(id=>segments.find(s=>s.id===id)!.name),segment.name,'classification cycle']
 if(segment.mode==='static')return null
 const chain=[...path,segment.id]
 for(const {field} of segment.rules.conditions){
  if(field==='health.status'||field==='health.reasons')return [segment.name,field,'aggregate health']
  if(field==='tier'||field==='stage')for(const producer of segments.filter(s=>s[field]!==null)){
   const dependency=healthDependency(producer,segments,chain)
   if(dependency)return [segment.name,field,...dependency]
  }
 }
 return null
}
export function validateHealthInputs(segments:Segment[],rules:ConsumerRule[]) {
 for(const rule of rules.filter(r=>r.health&&r.scope==='segment')){
  const segment=segments.find(s=>s.id===rule.segmentId)
  insist(segment,'Choose an existing segment for aggregate health.')
  const chain=healthDependency(segment,segments)
  insist(!chain,`Aggregate health dependency refused: ${rule.name} -> ${chain?.join(' -> ')}. Choose a layer-1 segment; health.nativeStatus and health.nativeReasons exclude aggregate effects.`)
 }
}
