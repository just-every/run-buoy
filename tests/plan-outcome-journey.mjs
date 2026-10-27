import assert from 'node:assert/strict'
import {planFixture} from './plan-fixture.mjs'
export async function planOutcomeJourney(){
 let instant=Date.UTC(2026,9,27,12)
 const f=await planFixture({clock:()=>instant}),{api,accountId,other}=f
 try{
  await api('/fields','POST',{key:'window_goal',label:'Observed milestone measure',type:'number'})
  const metric={...f.objectives[0],field:'custom.window_goal',target:5},objectives=[metric,f.objectives[1]],put=async(aid,value)=>api('/accounts/'+aid+'/fields','PUT',{revision:(await api('/state')).accounts.find(a=>a.id===aid).revision,values:{window_goal:value},source:'synthetic-buoy-1970'})
  await put(accountId,0);await put(other,0)
  const plan=await f.save({objectives}),champion=await api('/customer-people','POST',{kind:'contact',name:'Control champion',accountIds:[other],source:'synthetic-buoy-1971'})
  const control=await api('/accounts/'+other+'/plans','POST',{accountRevision:(await api('/state')).accounts.find(a=>a.id===other).revision,name:'Comparison plan',staffOwnerId:f.ownerId,customerOwnerId:champion.id,objectives})
  const segmentBody={name:'Frozen milestone comparison',mode:'static',rules:{match:'all',conditions:[]},accountIds:[accountId,other],tier:null,stage:null,playbook:null},segment=await api('/segments','POST',segmentBody)
  const body={name:'Metric milestone',segmentId:segment.id,kind:'plan-objective',windowDays:1,planIds:[plan.id],objectiveId:'usage',operationKey:'synthetic-buoy-1972'},report=await api('/outcomes','POST',body)
  assert.deepEqual(await api('/outcomes','POST',body),report,'Starting the same observation is idempotent')
  let data=await api('/outcomes/'+report.id+'/report');assert.deepEqual(data.enrolled.map(a=>a.accountId),[accountId]);assert.deepEqual(data.comparison.map(a=>a.accountId),[other]);assert.equal(data.rate,0);assert.equal(data.comparisonRate,0)
  assert.equal(Date.parse(data.deadline)-Date.parse(data.startedAt),86400000)
  const current=(await f.plans()).plans[0]
  await f.save({id:plan.id,revision:current.revision,objectives,milestones:[{id:'metric',title:'Agreed metric target',objectiveId:'usage',outcomeId:report.id}]})
  const seg=(await api('/segments')).segments.find(s=>s.id===segment.id);await api('/segments','POST',{...segmentBody,id:segment.id,revision:seg.revision,accountIds:[]})
  instant+=6*3600000;await put(accountId,5)
  data=await api('/outcomes/'+report.id+'/report');assert.equal(data.rate,1);assert.equal(data.comparisonRate,0);assert.equal(data.enrolled[0].elapsedHours,6);assert.equal(data.meanHours,6);assert.equal(data.enrolled[0].reachedAt,'2026-10-27T18:00:00.000Z');assert.deepEqual(data.comparison.map(a=>a.accountId),[other]);assert.equal((await f.plans()).plans[0].milestoneEvidence[0].status,'reached')
  instant+=19*3600000;await put(other,5)
  data=await api('/outcomes/'+report.id+'/report');assert.equal(data.comparison[0].status,'missed');assert.equal(data.comparison[0].reachedAt,null);assert.equal(data.comparisonRate,0);assert.equal(data.enrolled[0].elapsedHours,6,'Late evidence cannot move the first observed outcome')
  const csv=await f.app.request('/api/buoy/outcomes/'+report.id+'/report.csv',{cookie:f.app.cookie});assert.equal(csv.status,200);const text=await csv.text();assert.match(text,/2026-10-27T18:00:00.000Z/);assert.ok(text.includes('"6"'))
  const revision=(await f.plans()).plans[0].revision
  const latestSegment=(await api('/segments')).segments.find(s=>s.id===segment.id);await api('/segments','POST',{...segmentBody,id:segment.id,revision:latestSegment.revision})
  const rejected=await f.app.request('/api/buoy/outcomes',{cookie:f.app.cookie,method:'POST',body:{...body,operationKey:'synthetic-buoy-1973'}});assert.equal(rejected.status,400,'Satisfied baselines are refused')
  await api('/accounts/'+accountId,'DELETE',{confirmation:f.customer(accountId).name})
  data=await api('/outcomes/'+report.id+'/report');assert.deepEqual(data.enrolled,[],'Erasure removes the milestone subject and its evidence')
  console.log('PLAN-001 objective milestones: public definition, stable linkage, frozen comparison, exact UTC clock, six-hour first evidence, CSV, late recovery refusal, baseline refusal and erasure passed.')
 }finally{await f.app.close()}
}
