import {guard,insist,stmt} from '../core'
import {privacyFingerprint} from './replay'
export interface Match {id:string;recordId:string;path:string;before:string;after:string;held:boolean}
interface UsageRow {id:string;payload:string;held:number;linked:number}
// These are free-text containers, not identity/routing fields. Structural IDs,
// event names and JSON property names are never rewritten as a side effect.
const containers=['properties','traits','context']
function redact(value:string,terms:string[]){
 let result=value
 for(const term of terms){
  const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  result=result.replace(new RegExp('(?<![\\p{L}\\p{N}_@.-])'+escaped+'(?![\\p{L}\\p{N}_@.-])','gu'),'[redacted]')
 }
 return result
}
export const DISCOVERY_SQL=`SELECT json_group_array(json_object('id',e.id,'payload',e.payload,
 'held',EXISTS(SELECT 1 FROM buoy_usage_mappings m JOIN buoy_privacy_holds h ON h.person_id=m.person_id WHERE m.source_id=e.source_id AND m.user_id=e.user_id),
 'linked',EXISTS(SELECT 1 FROM buoy_usage_mappings m WHERE m.person_id=? AND m.source_id=e.source_id AND m.user_id=e.user_id))) AS snapshot
 FROM (SELECT * FROM buoy_usage_events ORDER BY id) e`
export async function discover(db:D1Database,key:CryptoKey,person:{id:string;name:string},emails:unknown){
 insist(Array.isArray(emails)&&emails.length<=10&&emails.every(x=>typeof x==='string'&&x.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)),'List up to ten exact customer email addresses.')
 const terms=[...new Set([person.name,...emails as string[]])].sort((a,b)=>b.length-a.length||a.localeCompare(b))
 const row=await stmt(db,DISCOVERY_SQL,person.id).first<{snapshot:string}>()
 const raw=row?.snapshot??'[]',rows=JSON.parse(raw) as UsageRow[],matches:Match[]=[]
 const patches=new Map<string,{payload:string;changes:{path:(string|number)[];id:string;after:string}[]}>()
 for(const row of rows){
  if(row.linked&&!row.held)continue // already disclosed as a linked deletion
  const document=JSON.parse(row.payload),changes:{path:(string|number)[];id:string;after:string}[]=[]
  async function visit(value:unknown,path:(string|number)[]):Promise<void>{
   if(typeof value==='string'){
    const after=redact(value,terms)
    if(after!==value){
     insist(matches.length<500,'More than 500 free-text matches. Review a smaller source before erasure; no matches were silently omitted.',409)
     const id=await privacyFingerprint(key,[row.id,path,value])
     matches.push({id,recordId:row.id,path:JSON.stringify(path),before:value,after,held:!!row.held});changes.push({path,id,after})
    }
   }else if(Array.isArray(value)){for(let i=0;i<value.length;i++)await visit(value[i],[...path,i])}
   else if(value&&typeof value==='object'){for(const key of Object.keys(value).sort())await visit((value as Record<string,unknown>)[key],[...path,key])}
  }
  for(const container of containers)await visit(document[container],[container])
  if(changes.length)patches.set(row.id,{payload:row.payload,changes})
 }
 return {raw,matches,terms,guard:()=>guard(db,`(${DISCOVERY_SQL.replace(' AS snapshot','')})=?`,person.id,raw),
  statements(selected:string[]){
   insist(new Set(selected).size===selected.length&&selected.every(id=>matches.some(m=>m.id===id&&!m.held)),'Select only current, unheld preview matches.')
   const statements=[]
   for(const [id,patch] of patches){
    const changes=patch.changes.filter(c=>selected.includes(c.id));if(!changes.length)continue
    const document=JSON.parse(patch.payload)
    for(const change of changes){let target=document;for(const key of change.path.slice(0,-1))target=target[key];target[change.path.at(-1)!]=change.after}
    statements.push(stmt(db,'UPDATE buoy_usage_events SET payload=? WHERE id=? AND payload=?',JSON.stringify(document),id,patch.payload))
   }
   return statements
  }
 }
}
