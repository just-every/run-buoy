import {guard,insist,stmt} from '../core'
import {digest} from '../usage/model'
const bytes=new TextEncoder()
const hex=(value:ArrayBuffer)=>[...new Uint8Array(value)].map(x=>x.toString(16).padStart(2,'0')).join('')
async function sign(key:CryptoKey,value:string){return hex(await crypto.subtle.sign('HMAC',key,bytes.encode(value)))}
export async function replayKey(db:D1Database){
 const row=await stmt(db,'SELECT secret FROM buoy_privacy_key WHERE singleton=1').first<{secret:string}>()
 insist(row&&/^[a-f0-9]{64}$/.test(row.secret),'Privacy replay key unavailable; restore the complete installation archive.',503)
 const key=await crypto.subtle.importKey('raw',Uint8Array.from(row.secret.match(/../g)!,x=>parseInt(x,16)),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 // Previously erased raw IDs cannot be recovered. Wrap their old digests with
 // the installation HMAC key, preserving fences without keeping guessable SHA.
 const old=await stmt(db,"SELECT source_id,identity_hash FROM buoy_erased_usage_identities WHERE length(identity_hash)=64").all<{source_id:string;identity_hash:string}>()
 if(old.results.length){
  const changes=[]
  for(const r of old.results)changes.push(stmt(db,'UPDATE buoy_erased_usage_identities SET identity_hash=? WHERE source_id=? AND identity_hash=?','legacy-hmac:'+await sign(key,JSON.stringify([r.source_id,r.identity_hash])),r.source_id,r.identity_hash))
  await db.batch([guard(db,'EXISTS(SELECT 1 FROM buoy_privacy_key WHERE singleton=1 AND secret=?)',row.secret),...changes,stmt(db,'DELETE FROM buoy_assertions')])
 }
 return {key,guard:()=>guard(db,'EXISTS(SELECT 1 FROM buoy_privacy_key WHERE singleton=1 AND secret=?)',row.secret)}
}
export async function erasedIdentity(key:CryptoKey,sourceId:string,userId:string){return 'hmac:'+await sign(key,JSON.stringify([sourceId,userId]))}
export async function replayIdentities(key:CryptoKey,sourceId:string,userId:string){return [await erasedIdentity(key,sourceId,userId),'legacy-hmac:'+await sign(key,JSON.stringify([sourceId,await digest(userId)]))]}
export async function privacyFingerprint(key:CryptoKey,value:unknown){return sign(key,JSON.stringify(value))}
