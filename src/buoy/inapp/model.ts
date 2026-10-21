import { guard, insist, stmt } from '../core'
import { digest } from '../usage/model'
export { adminRead, adminWrite, only, source } from '../usage/model'
export { id, insist, now, stmt, text } from '../core'
export interface Campaign {id:string;sourceId:string;segmentId:string;kind:string;title:string;body:string;steps:string[];maxViews:number;windowHours:number;enabled:boolean}
export const CAMPAIGN_COLUMNS='id,source_id AS sourceId,segment_id AS segmentId,kind,title,body,steps,max_views AS maxViews,window_hours AS windowHours,enabled'
export interface Mapping {accountId:string;personId:string;revision:string;claimKey:string}
export async function mapping(db:D1Database,sourceId:string,userId:string,groupId:string|null){
 return stmt(db,`SELECT m.account_id AS accountId,m.person_id AS personId,m.revision,m.claim_key AS claimKey FROM buoy_usage_mappings m JOIN buoy_customer_people p ON p.id=m.person_id JOIN buoy_customer_memberships cm ON cm.person_id=p.id AND cm.account_id=m.account_id WHERE m.source_id=? AND m.user_id=? AND m.group_id IS ?`,sourceId,userId,groupId).first<Mapping>()
}
export function mappingGuard(db:D1Database,sourceId:string,userId:string,groupId:string|null,m:Mapping|null){
 const sql=`SELECT 1 FROM buoy_usage_mappings m JOIN buoy_customer_people p ON p.id=m.person_id JOIN buoy_customer_memberships cm ON cm.person_id=p.id AND cm.account_id=m.account_id WHERE m.source_id=? AND m.user_id=? AND m.group_id IS ?`
 return m?guard(db,`EXISTS(${sql} AND m.revision=? AND m.person_id=? AND m.account_id=?)`,sourceId,userId,groupId,m.revision,m.personId,m.accountId):guard(db,`NOT EXISTS(${sql})`,sourceId,userId,groupId)
}
export function identity(input:Record<string,unknown>){
 const exact=(v:unknown)=>{insist(typeof v==='string'&&v.trim().length>0&&v.length<=200,'An exact product identity is required.');return v}
 return {userId:exact(input.userId),groupId:input.groupId===undefined||input.groupId===null?null:exact(input.groupId)}
}
export async function credentialFor(db:D1Database,sourceId:string,authorization:string|null){
 insist(authorization&&/^Bearer buoy_inapp_[a-f0-9]{64}$/.test(authorization),'A server-only INAPP credential is required.',401)
 const hash=await digest(authorization.slice(7))
 const c=await stmt(db,'SELECT id FROM buoy_inapp_credentials WHERE token_hash=? AND source_id=? AND revoked_at IS NULL',hash,sourceId).first<{id:string}>()
 insist(c,'INAPP credential is invalid or revoked.',401)
 return {id:c.id,guard:guard(db,'EXISTS(SELECT 1 FROM buoy_inapp_credentials WHERE id=? AND token_hash=? AND source_id=? AND revoked_at IS NULL)',c.id,hash,sourceId)}
}
