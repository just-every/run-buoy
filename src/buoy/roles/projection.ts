import {guard,insist,stmt,type Actor} from '../core'
import {minorUnitDigits} from '../currencies'
import {revenueInputs} from '../revenue/snapshot'
import {commercialFor,readableIds,roleAccess,roleFence,scopeFence,scopeImage,type RoleAccess} from './access'

function arrBand(amount:number|null,currency:string|null){
 if(amount===null||currency===null)return {currency:null,label:'ARR unavailable'}
 const factor=10**(minorUnitDigits(currency)??2)
 return {currency,label:amount<10000*factor?'Under 10,000 '+currency:amount<100000*factor?'10,000 to under 100,000 '+currency:'100,000 or more '+currency}
}
export interface ProjectedAccount {
 id:string;name:string;revision:string;renewalDate:string;ownerId:string|null;
 health:{status:string};commercialAccess:'full'|'band'|'none';
 arrBand?:{currency:string|null;label:string};commercial?:{currency:string|null;arrMinor:number|null;mrrMinor:number|null}
}
export interface ProjectedState {
 operator:{id:string;displayName:string;role:string};
 roleAccess:{restricted:true;roleId:string;name:string;revision:string;scope:RoleAccess['scope'];roleScope:RoleAccess['roleScope'];commercial:RoleAccess['commercial'];roleCommercial:RoleAccess['roleCommercial'];permissions:RoleAccess['permissions'];grants:RoleAccess['grants']};
 accounts:ProjectedAccount[];people:never[];notifications:never[];proposals:never[];tasks:never[];decisions:never[];
 interpretation:string
}
/** Explicit allowlists only: nested health explanations, source text, custom
 * fields, timeline and immutable proposal snapshots are unported and absent. */
export async function projectState(db:D1Database,actor:Actor,raw:{accounts:unknown[]},provided?:RoleAccess):Promise<ProjectedState>{
 const access=provided??await roleAccess(db,actor)
 insist(access.restricted,'Scoped projection requires an assigned profile.',403)
 insist(!access.stale,'Role assignment changed with native identity. An administrator must assign it again.',403)
 const image=await scopeImage(db),visible=new Set(readableIds(image.value,actor,access)),revenue=await revenueInputs(db)
 const accounts:ProjectedAccount[]=raw.accounts.flatMap(value=>{
  const row=value as Record<string,unknown>,accountId=String(row.id);if(!visible.has(accountId))return []
  const source=image.value.accounts.find(account=>account.id===accountId)!
  insist(source.revision===row.revision,'Account evidence changed. Reload before reading.',409)
  const mode=commercialFor(access,actor,source.ownerId),health=row.health as {status?:unknown}|undefined
  const result:ProjectedAccount={id:accountId,name:String(row.name),revision:String(row.revision),renewalDate:String(row.renewalDate),ownerId:source.ownerId,health:{status:['at-risk','unknown','watch','healthy'].includes(String(health?.status))?String(health!.status):'unknown'},commercialAccess:mode}
  const values=revenue.accounts.find(account=>account.accountId===accountId)?.revenue
  if(mode==='band')result.arrBand=arrBand(values?.arrMinor??null,values?.currency??null)
  if(mode==='full')result.commercial={currency:values?.currency??null,arrMinor:values?.arrMinor??null,mrrMinor:values?.mrrMinor??null}
  return [result]
 })
 await db.batch([roleFence(db,actor,access),scopeFence(db,image),guard(db,`(${revenue.sql})=?`,revenue.raw),stmt(db,'DELETE FROM buoy_assertions')])
 return {operator:{id:actor.id,displayName:actor.displayName,role:access.roleId},roleAccess:{restricted:true,roleId:access.roleId,name:access.name,revision:access.revision,scope:access.scope,roleScope:access.roleScope,commercial:access.commercial,roleCommercial:access.roleCommercial,permissions:access.permissions,grants:access.grants},accounts,people:[],notifications:[],proposals:[],tasks:[],decisions:[],interpretation:'Scoped current account reads only. Health exposes its band; underlying explanations, fields and linked records are not available to this profile yet. ARR is contracted recurring revenue in native currency; no invoice total or currency conversion is substituted.'}
}
