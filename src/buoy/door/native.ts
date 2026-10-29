import type {Bindings} from '../../auth.server'
import {ToolRefusal,type ToolContext} from '../../modules/agent-door/index.ts'
import {Problem,type Actor} from '../core'
import {roleAccess, type RoleAccess} from '../roles/access'
import {requireCommand,type AgentCommand} from '../agent-policy/policy'
import {localAgentGrant} from './credentials'

/** The sponsor is used for authorization, never substituted as the effect actor. */
export async function nativeActor(env:Bindings,ctx:ToolContext,command:AgentCommand,write=false):Promise<{actor:Actor;person:Actor;access:RoleAccess}> {
 const person:Actor={id:ctx.person.id,role:ctx.person.role,displayName:ctx.person.name,kind:'person'}
 const access=await roleAccess(env.DB,person)
 if(access.stale || write && access.restricted || command.startsWith('experiment.') && (access.restricted || !['owner','admin'].includes(person.role))) throw new ToolRefusal('native_authority_refused')
 const current=await env.DB.prepare('SELECT version FROM oa_operators WHERE id=? AND status=\'active\'').bind(person.id).first<{version:number}>()
 if(!current)throw new ToolRefusal('unauthenticated')
 const state=await env.DB.prepare('SELECT envelope,local_document,local_revision FROM agent_door_state WHERE id=1').first<{envelope:string|null;local_document:string|null;local_revision:number}>()
 const paused=await env.DB.prepare('SELECT disabled FROM buoy_agent_settings WHERE singleton=1').first<{disabled:number}>()
 if(paused?.disabled)throw new ToolRefusal('agents_paused')
 const grant=ctx.consent?null:await localAgentGrant(env,ctx.agent.id)
 if(!ctx.consent && (!grant||grant.ownerId!==person.id))throw new ToolRefusal('unauthenticated')
 if(grant && grant.requests>grant.policy.requestsPerMinute)throw new ToolRefusal('rate_limited')
 if(grant)requireCommand(grant.policy,command)
 const actor:Actor={...person,kind:'agent',...(grant?{tokenId:grant.id,agentPolicy:grant.policy}:{}),door:{
  sponsorId:person.id,sponsorRole:person.role,sponsorVersion:current.version,agentId:ctx.agent.id,
  clientId:ctx.clientId,consent:ctx.consent,operationId:ctx.operationId,scopes:ctx.scopes,label:ctx.actor.label,
  envelope:state?.envelope??null,document:state?.local_document??null,localRevision:state?.local_revision??0,roleRevision:access.revision,
 }}
 return {actor,person,access}
}

export async function nativeCall<T>(call:()=>Promise<T>):Promise<T>{
 try{return await call()}catch(error){
  if(error instanceof Problem)throw new ToolRefusal(error.status===404?'resource_unavailable':error.status===409?'native_conflict':error.status===403?'native_authority_refused':'invalid_arguments')
  if(error instanceof Error && /constraint|SQLITE_CONSTRAINT/i.test(error.message))throw new ToolRefusal('native_conflict')
  throw error
 }
}
