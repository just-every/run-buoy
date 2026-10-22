import {auditRecord} from '../audit-records'
import {guard,id,insist,now,object,stmt,text,type Actor} from '../core'
import {nativePerson,roleAccess,roleFence} from './access'
import {commercialInput,DEFAULT_ROLES,grantsInput,keys,NO_GRANTS,PERMISSION_VALUES,permissionInput,scopeInput,type Assignment,type RoleDefinition,type Scope} from './model'

async function administrator(db:D1Database,actor:Actor){const person=await nativePerson(db,actor);insist(['owner','admin'].includes(person.role),'Only a native owner or admin manages role configuration.',403);return roleAccess(db,actor)}
async function checkScope(db:D1Database,scope:Scope){if(scope.kind==='segment')insist(await stmt(db,'SELECT 1 FROM buoy_segments WHERE id=?',scope.segmentId).first(),'Scope segment not found.',404)}
async function definitions(db:D1Database){return (await db.prepare('SELECT id,name,document,revision FROM buoy_role_definitions ORDER BY name,id').all<{id:string;name:string;document:string;revision:string}>()).results.map(row=>({id:row.id,name:row.name,...JSON.parse(row.document),revision:row.revision,builtin:false} as RoleDefinition&{revision:string}))}
export async function rolesState(db:D1Database,actor:Actor){
 const access=await administrator(db,actor)
 const result=await db.batch<Record<string,unknown>>([roleFence(db,actor,access),db.prepare('SELECT person_id AS personId,native_version AS nativeVersion,document,revision FROM buoy_role_assignments ORDER BY person_id'),db.prepare("SELECT id,display_name AS displayName,role,status,version FROM oa_operators WHERE status='active' ORDER BY display_name,id"),db.prepare("SELECT id,json_extract(document,'$.name') AS name FROM buoy_accounts ORDER BY id"),db.prepare("SELECT id,json_extract(document,'$.name') AS name FROM buoy_segments ORDER BY id"),stmt(db,'DELETE FROM buoy_assertions')])
 const assignments=result[1].results.map(row=>({personId:String(row.personId),nativeVersion:Number(row.nativeVersion),...JSON.parse(String(row.document)) as Assignment,revision:String(row.revision)}))
 const people=result[2].results as unknown as {id:string;displayName:string;role:string;status:string;version:number}[]
 const accounts=result[3].results as unknown as {id:string;name:string}[],segments=result[4].results as unknown as {id:string;name:string}[]
 return {revision:access.revision,defaults:DEFAULT_ROLES,roles:await definitions(db),permissions:PERMISSION_VALUES,assignments,people,accounts,segments,interpretation:'Assigned profiles currently port only account/state and account search reads. Other assigned-profile product endpoints refuse access. Permission declarations do not enable unported matrix actions. Native unassigned members retain their existing authority.'}
}
async function commitConfiguration(db:D1Database,actor:Actor,revision:unknown,statements:D1PreparedStatement[],action:string,subject:string){
 const access=await administrator(db,actor);insist(revision===access.revision,'Role configuration changed. Reload before saving.',409)
 const next=id();await db.batch([roleFence(db,actor,access),...statements,stmt(db,'UPDATE buoy_role_settings SET revision=? WHERE singleton=1',next),auditRecord(db,actor,action,subject),stmt(db,'DELETE FROM buoy_assertions')]);return {revision:next}
}
export async function saveRole(db:D1Database,actor:Actor,input:Record<string,unknown>){
 await administrator(db,actor);keys(input,['revision','id','name','permissions','scope','commercial'])
 const key=input.id===undefined?id():text(input.id,'Role ID',100);insist(!DEFAULT_ROLES.some(role=>role.id===key),'Default role definitions cannot be overwritten.',403)
 const name=text(input.name,'Role name',100),permissions=permissionInput(input.permissions),scope=scopeInput(input.scope),commercial=commercialInput(input.commercial);await checkScope(db,scope)
 const result=await commitConfiguration(db,actor,input.revision,[stmt(db,'INSERT INTO buoy_role_definitions(id,name,document,revision,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,document=excluded.document,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at',key,name,JSON.stringify({permissions,scope,commercial}),id(),actor.id,now())],'role.definition-saved','role:'+key)
 return {...result,id:key}
}
export async function assignRole(db:D1Database,actor:Actor,input:Record<string,unknown>){
 await administrator(db,actor);keys(input,['revision','personId','roleId','scope','commercial','sharedAccountIds','grants'])
 const personId=text(input.personId,'Person',100),roleId=text(input.roleId,'Role',100)
 const target=await stmt(db,'SELECT role,status,version FROM oa_operators WHERE id=?',personId).first<{role:string;status:string;version:number}>()
 insist(target?.status==='active'&&target.role==='member','Product profiles can be assigned only to active native members; owner and admin stay native.',403)
 const role=DEFAULT_ROLES.find(role=>role.id===roleId)??(await definitions(db)).find(role=>role.id===roleId)
 insist(role&&!['owner','admin'].includes(roleId),'Choose a default staff profile or custom role; native owner/admin cannot be assigned here.',403)
 const scope=input.scope===undefined?role.scope:scopeInput(input.scope),commercial=input.commercial===undefined?role.commercial:commercialInput(input.commercial);await checkScope(db,scope)
 const shared=input.sharedAccountIds??[];insist(Array.isArray(shared)&&shared.length<=500&&shared.every(key=>typeof key==='string'&&key.length>0&&key.length<=100)&&new Set(shared).size===shared.length,'Choose unique current shared account IDs.')
 const ids=(await db.prepare('SELECT id FROM buoy_accounts').all<{id:string}>()).results.map(row=>row.id);insist(shared.every(key=>ids.includes(key)),'Shared account not found.',404)
 const document:Assignment={roleId,scope,commercial,sharedAccountIds:[...shared].sort(),grants:input.grants===undefined?{...NO_GRANTS}:grantsInput(input.grants)}
 const definitionFence=DEFAULT_ROLES.some(role=>role.id===roleId)?[]:[guard(db,'EXISTS(SELECT 1 FROM buoy_role_definitions WHERE id=?)',roleId)]
 const scopeGuards=[...(scope.kind==='segment'?[guard(db,'EXISTS(SELECT 1 FROM buoy_segments WHERE id=?)',scope.segmentId)]:[]),...shared.map(key=>guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=?)',key))]
 return commitConfiguration(db,actor,input.revision,[guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='member' AND status='active' AND version=?)",personId,target.version),...definitionFence,...scopeGuards,stmt(db,'INSERT INTO buoy_role_assignments(person_id,native_version,document,revision,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(person_id) DO UPDATE SET native_version=excluded.native_version,document=excluded.document,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at',personId,target.version,JSON.stringify(document),id(),actor.id,now())],'role.assigned','person:'+personId)
}
export async function clearAssignment(db:D1Database,actor:Actor,personId:string,input:Record<string,unknown>){
 await administrator(db,actor);keys(input,['revision'])
 const target=await stmt(db,'SELECT role,status,version FROM oa_operators WHERE id=?',personId).first<{role:string;status:string;version:number}>()
 insist(target?.status==='active'&&target.role==='member','Only active native member assignments can be removed.',403)
 return commitConfiguration(db,actor,input.revision,[guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='member' AND status='active' AND version=?)",personId,target.version),stmt(db,'DELETE FROM buoy_role_assignments WHERE person_id=?',personId)],'role.assignment-cleared','person:'+personId)
}
