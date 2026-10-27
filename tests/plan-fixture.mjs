import assert from 'node:assert/strict'
import {playFixture,playConfig} from './play-fixture.mjs'
export async function planFixture(){
 const f=await playFixture(),{api,create,ownerId}=f,accountId=await create('synthetic-buoy-1900'),other=await create('synthetic-buoy-1901')
 const champion=await api('/customer-people','POST',{kind:'contact',name:'synthetic-buoy-1902',accountIds:[accountId],source:'synthetic-buoy-1903'})
 const objectives=[{id:'usage',title:'Use the agreed feature',kind:'metric',field:'adoption.current.eventCount',target:1,direction:'at-least',dueOn:'2027-03-01'},{id:'statement',title:'Customer confirms the business result',kind:'customer-statement',dueOn:'2027-03-01'}]
 const body=async(extra={})=>({accountRevision:(await api('/state')).accounts.find(a=>a.id===accountId).revision,name:'Customer success draft',staffOwnerId:ownerId,customerOwnerId:champion.id,objectives,...extra})
 const plans=()=>api('/accounts/'+accountId+'/plans'),save=async(extra={})=>api('/accounts/'+accountId+'/plans','POST',await body(extra))
 const post=(body,options={})=>f.app.request('/api/buoy/accounts/'+accountId+'/plans',{cookie:f.app.cookie,method:'POST',body,...options})
 const invited=async(email,name)=>{const response=await f.app.request('/auth/invite',{method:'POST',cookie:f.app.cookie,body:{email,displayName:name,role:'member'}});assert.equal(response.status,202);const cookie=await f.app.signIn(email),person=(await api('/state')).people.find(p=>p.displayName===name);return{...person,cookie}}
 return {...f,accountId,other,champion,objectives,body,save,plans,post,invited}
}

// Native dependencies are prepared and approved through their existing doors.
export async function planDependencies(f){
 const {api,accountId,other}=f
 const book=await api('/playbooks','POST',{config:playConfig(f.ownerId,{steps:[{id:'task',kind:'task',title:'Agreed plan follow-up',dueDays:2}]})})
 const task=async aid=>{const run=await api('/playbooks/'+book.id+'/enroll','POST',{accountId:aid,operationKey:crypto.randomUUID()}),current=await f.run(run.id);await api('/proposals/'+current.proposalId+'/approve','POST',{});return (await api('/state')).tasks.find(t=>t.proposalId===current.proposalId).id}
 const taskId=await task(accountId),foreignTaskId=await task(other)
 const segmentInput={name:'Plan comparison',mode:'static',rules:{match:'all',conditions:[]},accountIds:[accountId,other],tier:null,stage:null,playbook:null},segment=await api('/segments','POST',segmentInput)
 const report=await api('/outcomes','POST',{name:'Agreed health milestone',segmentId:segment.id,kind:'healthy',windowDays:2,taskIds:[taskId],operationKey:'synthetic-buoy-1950'})
 const foreignReport=await api('/outcomes','POST',{name:'Other account milestone',segmentId:segment.id,kind:'healthy',windowDays:2,taskIds:[foreignTaskId],operationKey:'synthetic-buoy-1955'})
 return {foreignOutcomeId:foreignReport.id,taskId,foreignTaskId,segment,segmentInput,outcomeId:report.id,milestones:[{id:'recovery',title:'Reach healthy evidence',objectiveId:'usage',outcomeId:report.id}]}
}

export async function planRenewal(f){
 const {api,accountId}=f,settings=(await api('/renewals')).settings
 await api('/renewals/settings','PUT',{revision:settings.revision,leadDays:730,stages:settings.stages})
 await api('/accounts/'+accountId+'/contract','POST',{revision:(await api('/state')).accounts.find(a=>a.id===accountId).revision,contract:{currency:'USD',contractStart:'2026-01-01',contractEnd:'2027-03-31',lines:[{id:'synthetic-buoy-1952',product:'Workspace',quantity:1,amountMinor:120000,frequency:'annual',entitlements:'One workspace'}],source:{reference:'synthetic-buoy-1953',confirmedOn:new Date().toISOString().slice(0,10)}}})
 return (await api('/renewals')).records.find(r=>r.accountId===accountId)
}
