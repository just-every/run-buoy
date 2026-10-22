import {guard,insist,stmt,type Actor} from '../core'
import {DEFAULT_ROLES,NO_GRANTS,NO_PERMISSIONS,type Assignment,type Commercial,type Permissions,type RoleDefinition,type Scope} from './model'

export interface RoleAccess extends Assignment {
 restricted:boolean;stale:boolean;revision:string;assignmentRevision:string|null;nativeVersion:number;
 permissions:Permissions;name:string;roleScope:Scope;roleCommercial:Commercial
}
export interface NativePerson {id:string;role:string;status:string;version:number}
export async function nativePerson(db:D1Database,actor:Actor):Promise<NativePerson>{
 insist(actor.kind==='person','A staff session is required.',403)
 const person=await stmt(db,'SELECT id,role,status,version FROM oa_operators WHERE id=?',actor.id).first<NativePerson>()
 insist(person?.status==='active','Active staff authority is required.',403)
 insist(person.role===actor.role,'Staff authority changed. Sign in again.',403)
 return person
}
export async function roleAccess(db:D1Database,actor:Actor):Promise<RoleAccess>{
 const person=await nativePerson(db,actor)
 const [settings,assignment,definitions]=await Promise.all([
  db.prepare('SELECT revision FROM buoy_role_settings WHERE singleton=1').first<{revision:string}>(),
  stmt(db,'SELECT document,revision,native_version FROM buoy_role_assignments WHERE person_id=?',actor.id).first<{document:string;revision:string;native_version:number}>(),
  db.prepare('SELECT id,name,document FROM buoy_role_definitions ORDER BY id').all<{id:string;name:string;document:string}>(),
 ])
 insist(settings,'Role configuration is unavailable.',503)
 const nativeRole=DEFAULT_ROLES.find(role=>role.id===person.role)
 const base={roleId:person.role,name:nativeRole?.name??'Native member',scope:{kind:'all'} as Scope,roleScope:{kind:'all'} as Scope,commercial:'full' as Commercial,roleCommercial:'full' as Commercial,sharedAccountIds:[],grants:{...NO_GRANTS},permissions:nativeRole?.permissions??{...NO_PERMISSIONS},revision:settings.revision,nativeVersion:person.version,assignmentRevision:null,restricted:false,stale:false}
 // Overlay profiles never promote or demote Base's owner/admin identity.
 if(person.role==='owner'||person.role==='admin'||!assignment)return base
 const assigned=JSON.parse(assignment.document) as Assignment
 const custom=definitions.results.find(role=>role.id===assigned.roleId)
 const role=DEFAULT_ROLES.find(role=>role.id===assigned.roleId)??(custom?{id:custom.id,name:custom.name,...JSON.parse(custom.document)} as RoleDefinition:undefined)
 const stale=assignment.native_version!==person.version||!role||['owner','admin'].includes(assigned.roleId)
 return {...assigned,roleScope:role?.scope??{kind:'own'},roleCommercial:role?.commercial??'none',revision:settings.revision,nativeVersion:person.version,assignmentRevision:assignment.revision,restricted:true,stale,permissions:stale?{...NO_PERMISSIONS}:role!.permissions,name:role?.name??'Unavailable role'}
}
/** Include this fence in the same transaction as each future role-authorized write. */
export function roleFence(db:D1Database,actor:Actor,access:RoleAccess){
 return guard(db,`EXISTS(SELECT 1 FROM oa_operators o,buoy_role_settings s WHERE o.id=? AND o.status='active' AND o.role=? AND o.version=? AND s.singleton=1 AND s.revision=?
 AND ${access.restricted?"EXISTS(SELECT 1 FROM buoy_role_assignments a WHERE a.person_id=o.id AND a.native_version=o.version AND a.revision=?)":"(o.role IN ('owner','admin') OR NOT EXISTS(SELECT 1 FROM buoy_role_assignments a WHERE a.person_id=o.id))"})`,actor.id,actor.role,access.nativeVersion,access.revision,...(access.restricted?[access.assignmentRevision]:[]))
}
// Ordered live scope inputs also fence a projection against concurrent ownership,
// manager, segment, account revision or native-status changes.
export const SCOPE_SQL=`SELECT json_object(
 'accounts',json((SELECT json_group_array(json_object('id',id,'revision',revision,'ownerId',owner_id)) FROM(SELECT a.id,a.revision,o.owner_id FROM buoy_accounts a LEFT JOIN buoy_account_owners o ON o.account_id=a.id ORDER BY a.id))),
 'people',json((SELECT json_group_array(json_object('id',id,'status',status,'managerId',manager_id)) FROM(SELECT o.id,o.status,p.manager_id FROM oa_operators o LEFT JOIN buoy_people p ON p.person_id=o.id ORDER BY o.id))),
 'segments',json((SELECT json_group_array(json_object('accountId',account_id,'segmentId',segment_id)) FROM(SELECT account_id,segment_id FROM buoy_segment_entries WHERE exited_at IS NULL ORDER BY account_id,segment_id))))`
interface ScopeImage {accounts:{id:string;revision:string;ownerId:string|null}[];people:{id:string;status:string;managerId:string|null}[];segments:{accountId:string;segmentId:string}[]}
export async function scopeImage(db:D1Database){const row=await db.prepare(SCOPE_SQL+' AS snapshot').first<{snapshot:string}>();insist(row,'Account scopes are unavailable.',503);return {raw:row.snapshot,value:JSON.parse(row.snapshot) as ScopeImage}}
export function scopeFence(db:D1Database,image:{raw:string}){return guard(db,`(${SCOPE_SQL})=?`,image.raw)}
export function inScope(image:ScopeImage,actor:Actor,scope:Scope,accountId:string){
 const account=image.accounts.find(row=>row.id===accountId);if(!account)return false
 if(scope.kind==='all')return true
 if(scope.kind==='own')return account.ownerId===actor.id
 if(scope.kind==='segment')return image.segments.some(row=>row.accountId===accountId&&row.segmentId===scope.segmentId)
 return image.people.some(person=>person.id===account.ownerId&&person.status==='active'&&person.managerId===actor.id)
}
export function readableIds(image:ScopeImage,actor:Actor,access:RoleAccess){
 if(!access.restricted)return image.accounts.map(row=>row.id)
 if(access.stale||access.permissions.read==='none')return []
 return image.accounts.filter(account=>inScope(image,actor,access.scope,account.id)&&inScope(image,actor,access.roleScope,account.id)&&(
  access.permissions.read==='all'||access.permissions.read==='scope'||
  (access.permissions.read==='own-shared'&&(account.ownerId===actor.id||access.sharedAccountIds.includes(account.id)))
  // CRM identities do not ship; a native owner or share never invents CRM ownership.
 )).map(row=>row.id)
}
export async function visibleAccountIds(db:D1Database,actor:Actor,access?:RoleAccess){return readableIds((await scopeImage(db)).value,actor,access??await roleAccess(db,actor))}
export function commercialFor(access:RoleAccess,actor:Actor,ownerId:string|null):Commercial {
 if(!access.restricted)return 'full'
 if(access.stale||['none','classes'].includes(access.permissions.commercialRead)||access.commercial==='none'||access.roleCommercial==='none')return 'none'
 if(access.permissions.commercialRead==='own'&&ownerId!==actor.id)return 'none'
 return access.permissions.commercialRead==='band'||access.commercial==='band'||access.roleCommercial==='band'?'band':'full'
}
