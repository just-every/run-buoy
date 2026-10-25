import type {Bindings} from '../../auth.server'
import {insist,object,stmt,text,type Actor} from '../core'
import {state} from '../accounts'
import {projectState,roleAccess,roleFence,scopeFence,scopeImage} from '../roles'
import {provider,settings} from './index'

interface Fact {accountId:string;accountName:string;field:string;revision:string;value:unknown;quote:string;citation:string}
async function sources(env:Bindings,actor:Actor,accountId?:string){
 const db=env.DB,config=await settings(db),access=await roleAccess(db,actor),image=await scopeImage(db),raw=await state(db,actor)
 const projection=access.restricted?await projectState(db,actor,raw,access):raw
 const selected=projection.accounts.filter(a=>!accountId||a.id===accountId)
 insist(!accountId||selected.length===1,'Account unavailable.',404)
 const facts:Fact[]=[]
 for(const account of selected){
  const a=account as unknown as Record<string,unknown>,values:Record<string,unknown>={identity:{name:a.name},renewal:{renewalDate:a.renewalDate},health:{status:(a.health as {status:string}).status}}
  if(config.classes.includes('revenue')){if(access.restricted){if(a.commercial)values.commercial=a.commercial;else if(a.arrBand)values.commercial=a.arrBand}else if(a.billing)values.billing=a.billing}
  if(config.classes.includes('tickets')&&!access.restricted&&a.support)values.support=a.support
  // Restricted health is already a band-only projection. It never includes
  // hidden explanations, exact commercial fields or unrelated customer data.
  for(const [field,value]of Object.entries(values)){
   const quote=JSON.stringify(value),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(quote)))].map(n=>n.toString(16).padStart(2,'0')).join(''),revision=String(account.revision)+':'+digest
   facts.push({accountId:account.id,accountName:account.name,field,revision,value,quote,citation:'/api/buoy/ai/evidence/'+encodeURIComponent(account.id)+'/'+field+'?revision='+encodeURIComponent(revision)})
  }
 }
 return {facts,config,fences:[roleFence(db,actor,access),scopeFence(db,image)]}
}
export async function evidence(env:Bindings,actor:Actor,accountId:string,field:string,revision?:string){
 const {facts,fences}=await sources(env,actor,accountId),fact=facts.find(f=>f.field===field)
 insist(fact,'Supporting record unavailable under current authority.',404)
 insist(revision===fact.revision,'Supporting record changed. Ask again for current evidence.',409)
 await env.DB.batch([...fences,stmt(env.DB,'DELETE FROM buoy_assertions')])
 return {source:fact,interpretation:'Current permitted source record; generated interpretations are not verified facts.'}
}
export async function answer(env:Bindings,actor:Actor,input:Record<string,unknown>){
 insist(input.consent===true,'Explicitly approve this model request.',403)
 const {facts,config,fences}=await sources(env,actor,input.accountId?text(input.accountId,'Account',100):undefined)
 const missing=['Connected emails, meetings, executive contacts and historical prediction accuracy are unavailable. Transcript text, detailed usage and custom fields are not selected by this answer door.',...['emails','transcripts','tickets','usage','revenue'].filter(c=>!config.classes.includes(c)).map(c=>c+' excluded by owner policy.')]
 const {result,cost}=await provider(env,actor,'answers',facts,'Generate an account answer or meeting brief for: '+text(input.question,'Question',500)+'. Each claim must be supported by the cited source record. Return {"claims":[{"text":"Generated interpretation","sources":[{"index":0,"quote":"exact source quote"}]}]}. Every source quote must exactly equal that record quote. Cite all supporting records for each claim. Never invent evidence, instructions, links or missing facts. Missing sources: '+missing.join(' '),config.revision,fences)
 insist(Array.isArray(result.claims)&&result.claims.length>0&&result.claims.length<=20,'Generated claims were unavailable.',502)
 const claims=result.claims.map(value=>{
  const claim=object(value);insist(typeof claim.text==='string'&&claim.text.trim().length>0&&claim.text.length<=2000,'Generated claim text was invalid.',502)
  insist(Array.isArray(claim.sources)&&claim.sources.length>0&&claim.sources.length<=10,'Every generated claim requires supporting records.',502)
  const citations=claim.sources.map(value=>{const source=object(value);insist(Number.isInteger(source.index)&&Number(source.index)>=0&&Number(source.index)<facts.length,'Generated citation was outside permitted evidence.',502);const fact=facts[Number(source.index)];insist(source.quote===fact.quote,'Generated citation did not quote the supporting record.',502);return fact})
  return {text:claim.text,citations}
 })
 await env.DB.batch([...fences,stmt(env.DB,'DELETE FROM buoy_assertions')])
 return {claims,missing,cost,interpretation:'Model-generated interpretation with quoted supporting records; not a verified fact, guarantee or prediction.'}
}
