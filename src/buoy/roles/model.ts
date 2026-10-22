import {insist,object,text} from '../core'

/** These are declarations of the contract rows, not a promise that each door ships. */
export const PERMISSION_VALUES = {
 read:['all','own-shared','crm','scope','none'],
 home:['yes','read-only','none'],
 edit:['all','team','own','prepare','none'],
 scorecards:['publish','draft','none'],
 playbooks:['publish','team-segments','draft','none'],
 export:['data-reports','team','own-reports','reports','none'],
 commercialRead:['full','own','band','classes','none'],
 commercialEdit:['all','team','none'],
 concessions:['yes','granted','none'],
 renewals:['yes','team','granted','none'],
 connectors:['yes','none'], agents:['yes','none'], users:['yes','except-owner','none'],
 audit:['yes','none'], erase:['yes','none'],
} as const
export type Permission = keyof typeof PERMISSION_VALUES
export type Permissions = {[K in Permission]: (typeof PERMISSION_VALUES)[K][number]}
export interface Scope {kind:'all'|'team'|'own'|'segment';segmentId?:string}
export type Commercial = 'full'|'band'|'none'
export interface RoleDefinition {id:string;name:string;permissions:Permissions;scope:Scope;commercial:Commercial;builtin:boolean}
export interface Grants {concessionLimitMinor:number|null;renewalOutcome:boolean}
export interface Assignment {roleId:string;scope:Scope;commercial:Commercial;sharedAccountIds:string[];grants:Grants}
export const NO_GRANTS:Grants={concessionLimitMinor:null,renewalOutcome:false}
export const NO_PERMISSIONS = Object.fromEntries(Object.keys(PERMISSION_VALUES).map(key=>[key,'none'])) as Permissions
const make=(id:string,name:string,permissions:Partial<Permissions>,scope:Scope,commercial:Commercial):RoleDefinition=>({id,name,permissions:{...NO_PERMISSIONS,...permissions},scope,commercial,builtin:true})
const administrator:Partial<Permissions>={read:'all',home:'yes',edit:'all',scorecards:'publish',playbooks:'publish',export:'data-reports',commercialRead:'full',commercialEdit:'all',concessions:'yes',renewals:'yes',connectors:'yes',agents:'yes',users:'yes',audit:'yes',erase:'yes'}
export const DEFAULT_ROLES:RoleDefinition[]=[
 make('owner','Owner',administrator,{kind:'all'},'full'),
 make('admin','Admin',{...administrator,users:'except-owner',erase:'none'},{kind:'all'},'full'),
 make('cs-manager','CS manager',{read:'all',home:'yes',edit:'team',scorecards:'draft',playbooks:'team-segments',export:'team',commercialRead:'full',commercialEdit:'team',concessions:'granted',renewals:'team'},{kind:'all'},'full'),
 make('csm','CSM',{read:'own-shared',edit:'own',playbooks:'draft',export:'own-reports',commercialRead:'own',concessions:'granted',renewals:'granted'},{kind:'all'},'full'),
 make('sales','Read-only: sales',{read:'crm',commercialRead:'band'},{kind:'all'},'band'),
 make('support','Read-only: support',{read:'all',commercialRead:'band'},{kind:'all'},'band'),
 make('finance','Read-only: finance and executive',{read:'all',home:'read-only',export:'reports',commercialRead:'full'},{kind:'all'},'full'),
]
export const keys=(value:Record<string,unknown>,allowed:readonly string[])=>insist(Object.keys(value).every(key=>allowed.includes(key)),'Unsupported role property.')
export function scopeInput(value:unknown):Scope {
 const row=object(value);keys(row,['kind','segmentId'])
 insist(['all','team','own','segment'].includes(String(row.kind)),'Choose all, team, own or segment scope.')
 if(row.kind==='segment')return {kind:'segment',segmentId:text(row.segmentId,'Scope segment',100)}
 insist(row.segmentId===undefined,'Only segment scope accepts a segment ID.');return {kind:row.kind as Scope['kind']}
}
export function commercialInput(value:unknown):Commercial {insist(['full','band','none'].includes(String(value)),'Choose full, band or no commercial fields.');return value as Commercial}
export function permissionInput(value:unknown):Permissions {
 const row=object(value);keys(row,Object.keys(PERMISSION_VALUES));const result={...NO_PERMISSIONS}
 for(const key of Object.keys(row) as Permission[]){insist((PERMISSION_VALUES[key] as readonly unknown[]).includes(row[key]),'Invalid permission value for '+key+'.');(result as Record<string,unknown>)[key]=row[key]}
 // The current matrix reserves erasure to the native owner, even for custom profiles.
 insist(result.erase==='none','Erasure remains reserved to the native owner.',403)
 return result
}
export function grantsInput(value:unknown):Grants {
 const row=object(value);keys(row,['concessionLimitMinor','renewalOutcome'])
 insist(row.concessionLimitMinor===null||(typeof row.concessionLimitMinor==='number'&&Number.isSafeInteger(row.concessionLimitMinor)&&row.concessionLimitMinor>=0),'Concession limit is null or safe whole USD cents.')
 insist(typeof row.renewalOutcome==='boolean','Choose whether renewal outcomes are granted.')
 return {concessionLimitMinor:row.concessionLimitMinor as number|null,renewalOutcome:row.renewalOutcome}
}
