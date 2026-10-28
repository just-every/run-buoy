import {insist,stmt} from '../core'

const format='buoy-privacy-snapshot-chunks-v1'
export function holdSnapshot(db:D1Database,personId:string,raw:string){
 const chunks:string[]=[]
 for(let offset=0;offset<raw.length;){
  let end=Math.min(offset+250_000,raw.length)
  // Keep surrogate pairs intact across database text bindings.
  if(end<raw.length&&raw.charCodeAt(end-1)>=0xd800&&raw.charCodeAt(end-1)<=0xdbff)end--
  chunks.push(raw.slice(offset,end));offset=end
 }
 return {manifest:JSON.stringify({format,chunks:chunks.length}),statements:chunks.map((document,position)=>stmt(db,'INSERT INTO buoy_privacy_hold_chunks(person_id,position,document) VALUES(?,?,?)',personId,position,document))}
}
export function restoreHoldSnapshot(raw:string,rows:Record<string,unknown>[]){
 const manifest=JSON.parse(raw) as {format?:string;chunks?:number}
 // Existing inline baselines remain readable without changing their custody.
 if(manifest.format!==format)return raw
 const chunks=[...rows].sort((a,b)=>Number(a.position)-Number(b.position))
 insist(chunks.length===manifest.chunks&&chunks.every((row,i)=>row.position===i),'Held customer snapshot unavailable.',503)
 return chunks.map(row=>String(row.document)).join('')
}
