import { authority, id, insist, now, requirePerson, stmt, text, type Actor } from '../core'
export const TYPES = ['track','identify','group','event'] as const
export type UsageType = typeof TYPES[number]
export interface Source {id:string;name:string;kind:'segment'|'native';reference:string;staleDays:number;createdAt:string;updatedAt:string}
export interface Credential {id:string;sourceId:string;label:string;scope:string[];creatorId:string;createdAt:string;lastUsedAt:string|null;revokedAt:string|null}
export const SOURCE_COLUMNS = 'id,name,kind,reference,stale_days AS staleDays,created_at AS createdAt,updated_at AS updatedAt'
export const CREDENTIAL_COLUMNS = 'id,source_id AS sourceId,label,scope,creator_id AS creatorId,created_at AS createdAt,last_used_at AS lastUsedAt,revoked_at AS revokedAt'
export const credential = (row:Omit<Credential,'scope'> & {scope:string}):Credential => ({...row,scope:JSON.parse(row.scope)})
export function only(input:Record<string,unknown>,keys:string[]) {insist(Object.keys(input).every(k=>keys.includes(k)),'Unsupported usage property.')}
export async function source(db:D1Database,sourceId:string) {const row=await stmt(db,`SELECT ${SOURCE_COLUMNS} FROM buoy_usage_sources WHERE id=?`,sourceId).first<Source>();insist(row,'Usage source not found.',404);return row}
export async function adminRead(db:D1Database,actor:Actor,queries:D1PreparedStatement[]) {
 requirePerson(actor)
 const rows=await db.batch([authority(db,actor,true),...queries,stmt(db,'DELETE FROM buoy_assertions')])
 return rows.slice(1,-1)
}
export async function adminWrite(db:D1Database,actor:Actor,queries:D1PreparedStatement[]) {
 requirePerson(actor)
 await db.batch([authority(db,actor,true),...queries,stmt(db,'DELETE FROM buoy_assertions')])
}
export function freshness(observedAt:string|null,days:number){return !observedAt?'missing':Math.floor(Date.now()/86400000)-Math.floor(Date.parse(observedAt)/86400000)>days?'stale':'current'}
export async function digest(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function sourceInput(input:Record<string,unknown>) {
 only(input,['name','kind','reference','staleDays'])
 insist(input.kind==='segment'||input.kind==='native','Source kind must be segment or native.')
 const staleDays=input.staleDays??30
 insist(Number.isInteger(staleDays)&&Number(staleDays)>=1&&Number(staleDays)<=365,'Staleness must be 1–365 whole days.')
 return {name:text(input.name,'Source name',100),kind:input.kind,reference:text(input.reference,'Source reference',1000),staleDays:Number(staleDays)}
}
export {id,insist,now,stmt,text}
