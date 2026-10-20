import { auditIfChanged, auditRecord } from '../audit-records'
import { requirePerson, type Actor } from '../core'
import { adminWrite, digest, id, insist, now, only, source, sourceInput, stmt, text, TYPES } from './model'

export async function saveSource(db:D1Database,actor:Actor,input:Record<string,unknown>,sourceId?:string){
 requirePerson(actor)
 const values=sourceInput(input),stamp=now(),key=sourceId??id()
 if(sourceId) await source(db,key)
 await adminWrite(db,actor,[
  sourceId?stmt(db,'UPDATE buoy_usage_sources SET name=?,kind=?,reference=?,stale_days=?,updated_at=? WHERE id=?',values.name,values.kind,values.reference,values.staleDays,stamp,key)
   :stmt(db,'INSERT INTO buoy_usage_sources(id,name,kind,reference,stale_days,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',key,values.name,values.kind,values.reference,values.staleDays,stamp,stamp),
  auditIfChanged(db,actor,sourceId?'usage.source-updated':'usage.source-created',`usage-source:${key}`)
 ])
 return {id:key}
}
export async function issueCredential(db:D1Database,actor:Actor,sourceId:string,input:Record<string,unknown>){
 requirePerson(actor);only(input,['label','scope']);await source(db,sourceId)
 const scopes=input.scope??[...TYPES]
 insist(Array.isArray(scopes)&&scopes.length>0&&scopes.length<=TYPES.length&&scopes.every(x=>TYPES.includes(x))&&new Set(scopes).size===scopes.length,'Select one or more distinct intake scopes: track, identify, group, event.')
 const label=input.label===undefined?'Server intake':text(input.label,'Credential label',100),key=id(),stamp=now()
 const secret=`buoy_usage_${[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('')}`
 await adminWrite(db,actor,[stmt(db,'INSERT INTO buoy_usage_credentials(id,source_id,token_hash,label,scope,creator_id,created_at) VALUES(?,?,?,?,?,?,?)',key,sourceId,await digest(secret),label,JSON.stringify(scopes),actor.id,stamp),auditRecord(db,actor,'usage.credential-issued',`usage-credential:${key}`)])
 return {credential:{id:key,sourceId,label,scope:scopes,creatorId:actor.id,createdAt:stamp,lastUsedAt:null,revokedAt:null},secret}
}
export async function revokeCredential(db:D1Database,actor:Actor,key:string){
 await adminWrite(db,actor,[stmt(db,'UPDATE buoy_usage_credentials SET revoked_at=? WHERE id=? AND revoked_at IS NULL',now(),key),auditIfChanged(db,actor,'usage.credential-revoked',`usage-credential:${key}`)])
 return {status:'revoked'}
}
