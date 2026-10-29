import type {Bindings} from '../../auth.server'
import {actorFor,digest,jsonBody} from '../access'
import {COMMANDS} from '../agent-policy/policy'
import {beginRequest,checkRequest,finishRequest,refuseRequest} from '../agent-policy/requests'
import {Problem} from '../core'
import {buoyDoor} from './index'
import {finalizeLocalDoorResponse} from './credentials'

/** Compatibility transport only: authentication, policy and execution stay MCP. */
export async function legacyCommands(request:Request,env:Bindings):Promise<Response|null>{
 if(new URL(request.url).pathname!=='/api/buoy/commands'||!request.headers.has('authorization'))return null
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}})
 if(!['GET','POST'].includes(request.method))return reply({code:'method_not_allowed'},405)
 let accounted=false
 try{
  const body=request.method==='POST'?await jsonBody(request):{}
  const command=String(body.command??'')
  if(request.method==='POST'&&!COMMANDS.includes(command as typeof COMMANDS[number])){accounted=true;await refusedInput(request,env,`command ${command}`,'Unknown command. Agents can prepare; people approve.',400)}
  const input=body.input&&typeof body.input==='object'&&!Array.isArray(body.input)?body.input as Record<string,unknown>:{}
  const params=request.method==='GET'?{}:{name:`buoy.${command}`,arguments:{...input,
   ...(body.idempotency_key!==undefined?{idempotency_key:body.idempotency_key}:request.headers.has('idempotency-key')?{idempotency_key:request.headers.get('idempotency-key')}:{}),
   ...(body.expected_revision===undefined?{}:{expected_revision:body.expected_revision}),
  }}
  const headers=new Headers(request.headers)
  headers.set('content-type','application/json');headers.set('accept','application/json');headers.set('MCP-Protocol-Version','2026-07-28')
  headers.set('Mcp-Method',request.method==='GET'?'tools/list':'tools/call')
  if(request.method==='POST')headers.set('Mcp-Name',`buoy.${command}`)
  headers.delete('content-length')
  const mcp=new Request(new URL('/mcp',request.url),{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:request.method==='GET'?'tools/list':'tools/call',params:{...params,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}})})
  const handled=await buoyDoor(env).handle(mcp)
  const response=handled?await finalizeLocalDoorResponse(mcp,handled):null
  if(!response)return reply({code:'door_unavailable'},503)
  const value=await response.json() as {result?:{tools?:Array<{name:string}>;structuredContent?:unknown;isError?:boolean;_meta?:Record<string,unknown>;resultType?:string};error?:{data?:{code?:string}}}
  const code=(value.result?._meta?.['com.runeditrun/error'] as {code?:string}|undefined)?.code??value.error?.data?.code
  const status=response.status>=400?response.status:value.result?.isError||value.error?code==='rate_limited'?429:code==='unauthenticated'?401:code==='idempotency_conflict'||code==='revision_conflict'||code==='native_conflict'?409:403:value.result?.resultType==='input_required'?202:200
  if(status>=400)return reply({code:code??'unauthenticated',...value},status)
  if(request.method==='GET'){
   const bearer=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
   const grant=bearer?await env.DB.prepare('SELECT scopes FROM buoy_agent_tokens WHERE token_hash=?').bind(await digest(bearer)).first<{scopes:string}>():null
   return reply({commands:grant?JSON.parse(grant.scopes):value.result?.tools?.map(tool=>tool.name.slice('buoy.'.length)).filter(name=>COMMANDS.includes(name as typeof COMMANDS[number])),approval:'Company policy governs every call; native business approval remains a person’s act.'})
  }
  return reply(status===202?value.result:value.result?.structuredContent??{},status===200&&['playbook.prepare','renewal.prepare','experiment.prepare'].includes(command)?201:status)
 }catch(error){
  if(error instanceof Problem){
   if(!request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/))return reply({code:'unauthenticated'},401)
   if(!accounted){
    try{await refusedInput(request,env,'commands',error.message,error.status)}catch(refusal){if(refusal instanceof Problem)return reply({code:'invalid_arguments',error:refusal.message},refusal.status);throw refusal}
   }
   return reply({code:'invalid_arguments',error:error.message},error.status)
  }
  throw error
 }
}

/** Malformed legacy input retains native refusal accounting and never dispatches. */
async function refusedInput(request:Request,env:Bindings,subject:string,message:string,status:number):Promise<never>{
 const actor=await actorFor(request,env),reservation=await beginRequest(env.DB,actor,request)
 let outcome=status
 try{await checkRequest(env.DB,actor,reservation,request);return await refuseRequest(env.DB,actor,subject,message,status)}
 catch(error){outcome=error instanceof Problem?error.status:500;throw error}
 finally{await finishRequest(env.DB,actor,outcome)}
}
