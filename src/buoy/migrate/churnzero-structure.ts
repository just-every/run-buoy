import type {Json} from '../../modules/import-kit/src/types.ts'

type Row=Record<string,Json>
export interface PausedJourneyStructure {
 schema:'churnzero-journey-v1';description:string|null;expectedDays:number|null
 progress:{behindAfterDays:number|null;stuckAfterDays:number|null}
 milestones:{sourceId:string;name:string;description:string|null;expectedDays:number|null
  progress:{behindAfterDays:number|null;stuckAfterDays:number|null}
  tasks:ReviewStep[];achievements:ReviewStep[]}[]
}
interface ReviewStep {sourceId:string;name:string;conditional:boolean|null;optional:boolean|null;externallyVisible:boolean|null}
const object=(value:Json):Row=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Each ChurnZero definition element must be an object.');return value}
const id=(value:Json)=>{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw Error('ChurnZero entity IDs must be exact nonnegative integers.');return String(value)}
const title=(value:Json)=>{if(typeof value!=='string'||!value.trim()||value.length>500)throw Error('ChurnZero definition titles must be nonempty text of at most 500 characters.');return value}
const text=(value:Json|undefined)=>{if(value===undefined||value===null)return null;if(typeof value!=='string'||value.length>10000)throw Error('ChurnZero descriptions must be text.');return value}
const days=(value:Json|undefined)=>{if(value===undefined||value===null)return null;if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>2147483647)throw Error('ChurnZero durations and progress thresholds must be nonnegative integer days.');return value}
const flag=(value:Json|undefined)=>{if(value===undefined||value===null)return null;if(typeof value!=='boolean')throw Error('ChurnZero step flags must be boolean when supplied.');return value}
const list=(value:Json|undefined)=>{if(!Array.isArray(value)||value.length>100)throw Error('Supply explicit Milestones, Tasks and Achievements arrays of at most 100 elements.');return value}

/** A preparation envelope joins documented entity definitions, never progress
 * records. Source lifecycle and sharing flags confer no native authority. */
export function churnzeroStructure(definition:Row){
 const mapped=new Set<string>(),journeyId=id(definition.Id),seen=new Set<string>()
 const take=<T>(row:Row,key:string,pointer:string,read:(value:Json|undefined)=>T)=>{
  const value=read(row[key]);if(row[key]!==undefined)mapped.add(pointer+'/'+key);return value
 }
 mapped.add('/Id');mapped.add('/Name');mapped.add('/Milestones')
 const progress=(row:Row,pointer:string)=>({behindAfterDays:take(row,'ProgressBottom',pointer,days),stuckAfterDays:take(row,'ProgressTop',pointer,days)})
 const structure:PausedJourneyStructure={schema:'churnzero-journey-v1',description:take(definition,'Description','',text),expectedDays:take(definition,'ExpectedDuration','',days),progress:progress(definition,''),milestones:list(definition.Milestones).map((raw,index)=>{
  const row=object(raw),sourceId=id(row.Id),pointer='/Milestones/'+index
  if(id(row.JourneyId)!==journeyId)throw Error('Milestone JourneyId must match its source journey.')
  if(seen.has('milestone:'+sourceId))throw Error('Duplicate ChurnZero milestone identity.')
  seen.add('milestone:'+sourceId)
  for(const key of ['', '/Id','/JourneyId','/Name','/Tasks','/Achievements'])mapped.add(pointer+key)
  const steps=(key:'Tasks'|'Achievements')=>list(row[key]).map((raw,index)=>{
   const step=object(raw),stepId=id(step.Id),at=pointer+'/'+key+'/'+index,name=key==='Tasks'?'Subject':'Name'
   if(id(step.JourneyMilestoneId)!==sourceId)throw Error('Step JourneyMilestoneId must match its source milestone.')
   if(seen.has(key+':'+stepId))throw Error('Duplicate ChurnZero step identity.')
   seen.add(key+':'+stepId)
   for(const key of ['', '/Id','/JourneyMilestoneId','/'+name])mapped.add(at+key)
   return {sourceId:stepId,name:title(step[name]),conditional:take(step,'IsConditional',at,flag),optional:take(step,'IsOptional',at,flag),externallyVisible:take(step,'IsExternallyVisible',at,flag)}
  })
  return {sourceId,name:title(row.Name),description:take(row,'Description',pointer,text),expectedDays:take(row,'ExpectedDuration',pointer,days),progress:progress(row,pointer),tasks:steps('Tasks'),achievements:steps('Achievements')}
 })}
 return {structure,mapped}
}
