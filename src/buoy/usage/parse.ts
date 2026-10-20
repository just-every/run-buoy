import { object } from '../core'
import { id, insist, only, text, TYPES, type UsageType } from './model'
export interface EventInput {id:string;messageId:string;type:UsageType;event:string|null;userId:string|null;groupId:string|null;observedAt:string;payload:string}
const exactId=(value:unknown,label:string)=>{insist(typeof value==='string'&&value.trim().length>0&&value.length<=200,`${label} is required (up to 200 characters).`);return value}
const optionalId=(value:unknown,label:string)=>value===undefined||value===null?null:exactId(value,label)
function timestamp(value:unknown,stamp:string){
 if(value===undefined)return stamp
 const raw=text(value,'Event timestamp',40)
 insist(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)&&Number.isFinite(Date.parse(raw)),'Event timestamp must be an ISO timestamp with timezone.')
 // Date.parse normalizes impossible dates; validate the supplied date itself.
 const day=raw.slice(0,10);insist(new Date(`${day}T00:00:00Z`).toISOString().slice(0,10)===day,'Event timestamp has an impossible calendar date.')
 return new Date(raw).toISOString()
}
export function parseEvents(input:Record<string,unknown>,kind:'segment'|'native',stamp:string):EventInput[]{
 if('batch' in input)only(input,['batch','sentAt'])
 const batch='batch' in input?input.batch:[input]
 insist(Array.isArray(batch)&&batch.length>0&&batch.length<=500,'Send between 1 and 500 events per batch.')
 return batch.map(raw=>{
  const value=object(raw)
  only(value,['type','messageId','event','userId','groupId','timestamp','originalTimestamp','sentAt','receivedAt','properties','traits','context','integrations','anonymousId','version','channel'])
  const type=(value.type??(kind==='native'?'event':undefined)) as UsageType
  insist(TYPES.includes(type)&&(kind!=='segment'||type!=='event'),'Unsupported event type for this source.')
  const context=value.context===undefined?{}:object(value.context)
  if(value.properties!==undefined)object(value.properties)
  if(value.traits!==undefined)object(value.traits)
  if(value.integrations!==undefined)object(value.integrations)
  const userId=optionalId(value.userId,'User ID'),groupId=optionalId(value.groupId??context.groupId,'Group ID')
  insist(userId||groupId,'An explicit userId or groupId is required; anonymous IDs are never matched to staff or contacts.')
  insist(type!=='identify'||userId,'Identify requires a userId.')
  insist(type!=='group'||(userId&&groupId),'Group requires userId and groupId.')
  const messageId=exactId(value.messageId,'Message ID'),event=type==='track'||type==='event'?text(value.event,'Event name',200):null
  const payload=JSON.stringify(value)
  insist(new TextEncoder().encode(payload).length<=16000,'Each event must be at most 16 KB.')
  return {id:id(),messageId,type,event,userId,groupId,observedAt:timestamp(value.timestamp,stamp),payload}
 })
}
