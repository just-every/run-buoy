import type {Bindings} from '../../auth.server'
import type {ToolContext,ToolDefinition} from '../../modules/agent-door/index.ts'
import {prepare} from '../work'
import {flushNotifications} from '../notify-mail'
import {nativeActor,nativeCall} from './native'
import {visibleAccount} from './reads'
import {identifier,objectSchema,proposalOutput,string} from './schema'

export function preparationTools(env:Bindings):ToolDefinition[]{return (['playbook','renewal'] as const).map(kind=>{
 const command=`${kind}.prepare` as const
 const current=async(args:Record<string,unknown>,ctx:ToolContext)=>{
  await nativeActor(env,ctx,command,true)
  return visibleAccount(env,ctx,String(args.accountId),command)
 }
 return {
  name:`buoy.${command}`,title:kind==='playbook'?'Prepare a risk playbook':'Prepare renewal evidence',
  description:'Prepare an inert native proposal from current evidence as the sponsor. An agent cannot approve the proposal, change pricing, confirm a customer outcome or send it.',
  scope:command,readOnly:false,classes:['standard'],clauses:kind==='playbook'?['PLAY-001','AGENT-001','SURFACE-002']:['RENEW-001','AGENT-003','SURFACE-003'],untrusted:true,
  inputSchema:objectSchema({accountId:identifier,payload:kind==='playbook'?objectSchema({title:{...string,maxLength:500},dueDate:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}},['title','dueDate']):objectSchema({outcome:{enum:['renewed','churned','deferred']},reason:string,evidence:string},['outcome','reason','evidence'])},['accountId','payload']),
  outputSchema:proposalOutput,revisionType:'string',
  revision:(args,ctx)=>nativeCall(async()=>String((await current(args,ctx)).revision)),
  target:(args,ctx)=>nativeCall(async()=>({kind:'account',id:String((await current(args,ctx)).id)})),
  classify:(args,ctx)=>nativeCall(async()=>{await current(args,ctx);return [{class:'standard',facts:{measure:1}}]}),
  summary:(args,ctx)=>nativeCall(async()=>{const record=await current(args,ctx),payload=args.payload as Record<string,string>;return {target:{id:String(record.id),name:String(record.name??record.id)},items:[kind==='playbook'?payload.title:payload.outcome,...(kind==='renewal'?[payload.reason,payload.evidence]:[payload.dueDate])]}}),
  run:(args,ctx)=>nativeCall(async()=>{
   const {actor}=await nativeActor(env,ctx,command,true)
   await current(args,ctx)
   const result=await prepare(env.DB,actor,{accountId:args.accountId,kind,payload:args.payload})
   await flushNotifications(env)
   return {result}
  }),
 } satisfies ToolDefinition
})}
