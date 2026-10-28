import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
export const condition=(field,op,value)=>({match:'all',conditions:[{field,op,value}]})
export const playConfig=(ownerId,extra={})=>({name:'Reviewed customer follow-up',ownerId,enabled:true,reentryDays:30,failureThreshold:3,trigger:{kind:'manual'},entry:null,exit:null,steps:[{id:'task',kind:'task',title:'Review customer evidence',dueDays:2},{id:'external',kind:'external',title:'Record external webhook work',channel:'webhook'}],...extra})
export async function playFixture(options={}){
 const app=await startWorker(options),api=async(path,method='GET',body,options={})=>{const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body,...options});assert.ok(r.ok,await r.clone().text());return r.json()},ownerId=(await api('/state')).operator.id
 const on=new Date(options.clock?options.clock():Date.now()).toISOString().slice(0,10)
 const customer=(id)=>({id,name:'Playbook customer '+id,renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Confirmed customer notice terms',billing:{observedAt:on,reference:'synthetic-buoy-1500',currency:'USD',totalMinor:120000,creditsMinor:0,allocatedMinor:120000,dueDate:on},support:{observedAt:on,reference:'synthetic-buoy-1501',openTickets:2,urgentTickets:2}})
 const create=async id=>{await api('/accounts','POST',customer(id));return id}
 const update=async(id,extra)=>{const a=(await api('/state')).accounts.find(a=>a.id===id);return api('/accounts/'+id,'PUT',{...customer(id),revision:a.revision,...extra})}
 const state=accountId=>api('/playbooks'+(accountId?'?accountId='+accountId:'')),run=async id=>(await state()).runs.find(r=>r.id===id),action=async(id,body)=>api('/playbook-runs/'+id+'/action','POST',{revision:(await run(id)).revision,...body}),approveTask=async id=>{const r=await run(id);assert.ok(r.proposalId);await api('/proposals/'+r.proposalId+'/approve','POST',{});return run(id)}
 return {app,api,ownerId,customer,create,update,state,run,action,approveTask}
}
