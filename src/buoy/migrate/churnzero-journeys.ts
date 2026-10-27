import {parseJson} from '../../modules/import-kit/src/readers/json.ts'
import {sha256} from '../../modules/import-kit/src/provenance/identity.ts'
import type {Json} from '../../modules/import-kit/src/types.ts'
import {churnzeroStructure} from './churnzero-structure'

export interface JourneyColumns {column:string;id:string;name:string;steps:string;stepId:string;schema?:'churnzero-journey-v1'}
export interface PausedJourneyDraft {
 id:string;source:'churnzero';sourceAccountId:string;sourceId:string;name:string;state:'paused'
 sourceColumn:string;mapping:JourneyColumns;definition:Record<string,Json>
 steps:{sourceId:string;position:number;definition:Record<string,Json>}[]
 unmapped:{pointer:string;reason:string}[]
 structure?:import('./churnzero-structure').PausedJourneyStructure
}
const object=(value:unknown):Record<string,Json>=>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('A journey definition and each step must be objects; a label is not a definition.')
 return value as Record<string,Json>
}
const identity=(value:unknown)=>{
 if(typeof value!=='string'||!value.trim()||value.length>200||/[\u0000-\u001f]/.test(value))throw Error('Journey identities and names must be nonempty text of at most 200 characters.')
 return value
}
export function journeyColumns(value:unknown):JourneyColumns{
 const mapping=object(value),keys=['column','id','name','steps','stepId']
 if(keys.some(key=>!(key in mapping))||Object.keys(mapping).some(key=>!keys.includes(key)&&key!=='schema'))throw Error('Map the journey column, identity, name, steps and step identity explicitly.')
 if(mapping.schema!==undefined&&(mapping.schema!=='churnzero-journey-v1'||mapping.id!=='Id'||mapping.name!=='Name'||mapping.steps!=='Milestones'||mapping.stepId!=='Id'))throw Error('The ChurnZero structure schema requires Id, Name, Milestones and milestone Id mappings.')
 keys.forEach(key=>identity(mapping[key]))
 if(new Set([mapping.id,mapping.name,mapping.steps]).size!==3)throw Error('Journey identity, name and steps must use different source fields.')
 return mapping as unknown as JourneyColumns
}
/** Native review drafts have no execution state, credentials or runtime enrollment.
 * All source behavior remains explicitly unmapped until its semantics are supported. */
export function churnzeroJourneys(row:Record<string,unknown>,value:unknown,accountId:string):PausedJourneyDraft[]|undefined{
 if(value===undefined)return undefined
 const mapping=journeyColumns(value),raw=row[mapping.column]
 if(typeof raw!=='string')throw Error('Journey definitions must be a JSON array in the explicitly mapped source column.')
 const definitions=parseJson(raw,{artifact:'ChurnZero journey definitions',pointer:''})
 if(!Array.isArray(definitions)||definitions.length>32)throw Error('Supply an explicit JSON array of at most 32 journey definitions; use [] when none are supplied.')
 const seen=new Set<string>();let elements=0
 return definitions.map(raw=>{
  const definition=object(raw),sourceIdentity=(value:unknown)=>identity(typeof value==='number'&&Number.isSafeInteger(value)?String(value):value),sourceId=sourceIdentity(definition[mapping.id]),name=identity(definition[mapping.name]),steps=definition[mapping.steps]
  const semantic=mapping.schema?churnzeroStructure(definition):undefined
  if(seen.has(sourceId))throw Error('Duplicate journey identity; no definition may be discarded.')
  seen.add(sourceId)
  if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw Error('Each journey needs 1 to 100 supplied steps; a label cannot establish steps.')
  const stepIds=new Set<string>(),nativeSteps=steps.map((raw,position)=>{
   const definition=object(raw),sourceId=sourceIdentity(definition[mapping.stepId])
   if(stepIds.has(sourceId))throw Error('Duplicate journey step identity; no step may be discarded.')
   stepIds.add(sourceId);return {sourceId,position,definition}
  })
  const unmapped:PausedJourneyDraft['unmapped']=[]
  const visit=(value:Json,pointer:string,depth:number)=>{
   if(depth>24||++elements>2000)throw Error('Journey definitions exceed the bounded review size.')
   // Include containers and empty values so an empty condition never disappears.
   if(!semantic?.mapped.has(pointer))unmapped.push({pointer,reason:'Source configuration retained for review; execution semantics are unmapped. This draft cannot run.'})
   if(value&&typeof value==='object')for(const [key,child]of Object.entries(value))visit(child,pointer+'/'+key.replaceAll('~','~0').replaceAll('/','~1'),depth+1)
  }
  visit(definition,'',0)
  return {id:'journey_'+sha256(JSON.stringify(['churnzero',accountId,sourceId])).slice(0,40),source:'churnzero',sourceAccountId:accountId,sourceId,name,state:'paused',sourceColumn:mapping.column,mapping,definition,steps:nativeSteps,unmapped,...(semantic?{structure:semantic.structure}:{})}
 })
}
