import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'

export async function roleAccountEditJourney(){
 const app=await startWorker(),cookie=app.cookie
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie,method,body,...options})
 const json=async response=>{assert.ok(response.ok,await response.clone().text());return response.json()}
 const api=async(...args)=>json(await request(...args))
 const invite=async n=>{const email='synthetic-buoy-'+n+'@example.test';await json(await app.request('/auth/invite',{method:'POST',cookie,body:{email,displayName:'synthetic-buoy-'+n,role:'member'}}));const as=await app.signIn(email);return {id:(await api('/state','GET',undefined,{cookie:as})).operator.id,cookie:as}}
 const assign=async(person,roleId,extra={})=>api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId,...extra})
 const raw=async id=>(await api('/state')).accounts.find(row=>row.id===id)
 const patch=(person,id,body)=>request('/accounts/'+id,'PATCH',body,{cookie:person.cookie})
 const on=new Date().toISOString().slice(0,10),end=new Date(Date.parse(on)+120*86400000).toISOString().slice(0,10)
 const own='synthetic-buoy-2500',shared='synthetic-buoy-2501',outside='synthetic-buoy-2502'
 try{
  const csm=await invite(2510),peer=await invite(2511),manager=await invite(2512),support=await invite(2513)
  for(const [id,owner]of [[own,csm],[shared,peer],[outside,peer]]){
   await api('/accounts','POST',{id,name:id+' account',renewalDate:end,noticeDays:30,renewalEvidence:'synthetic-buoy-2590 private renewal source',billing:{observedAt:on,reference:'synthetic-buoy-2591 private invoice source',currency:'USD',totalMinor:98765432,creditsMinor:12345,allocatedMinor:200,dueDate:on},support:{observedAt:on,reference:'synthetic-buoy-2592 private support source',openTickets:4,urgentTickets:1}})
   await api('/accounts/'+id+'/owner','PUT',{ownerId:owner.id})
  }
  const baseline=await raw(own)
  await assign(csm,'csm',{sharedAccountIds:[shared]});await assign(manager,'cs-manager');await assign(support,'support')
  const scoped=(await api('/state','GET',undefined,{cookie:csm.cookie})).accounts
  assert.equal(scoped.find(row=>row.id===own).canEdit,true);assert.equal(scoped.find(row=>row.id===shared).canEdit,false)
  const beforeAudit=(await api('/audit?action=account.updated&actor='+csm.id)).entries.length
  const update={revision:baseline.revision,name:own+' renamed',renewalDate:new Date(Date.parse(end)+86400000).toISOString().slice(0,10),noticeDays:17,renewalEvidence:'synthetic-buoy-2514 explicit new confirmation'}
  const saved=await json(await patch(csm,own,update))
  assert.equal(saved.id,own);assert.notEqual(saved.revision,baseline.revision)
  let current=await raw(own)
  for(const key of ['name','renewalDate','noticeDays','renewalEvidence'])assert.equal(current[key],update[key])
  assert.deepEqual(current.billing,baseline.billing);assert.deepEqual(current.support,baseline.support)
  assert.deepEqual(Object.keys(saved).sort(),['id','revision'],'The PATCH response exposes only opaque identity and revision, never retained snapshots')
  const updatedAudit=await api('/audit?action=account.updated&actor='+csm.id)
  assert.equal(updatedAudit.entries.length,beforeAudit+1);assert.equal(updatedAudit.entries[0].actor,'person:'+csm.id);assert.ok(updatedAudit.entries[0].subject);assert.doesNotMatch(JSON.stringify(updatedAudit.entries),/renamed|synthetic-buoy-2590|synthetic-buoy-2591|synthetic-buoy-2514|example\.test/,'The update audit contains opaque identities rather than field or source contents')
  assert.equal((await patch(csm,own,{revision:baseline.revision,name:'synthetic-buoy-2515 stale overwrite'})).status,409)
  const refusalRevision=current.revision
  for(const extra of [{billing:null},{support:null},{arrMinor:1},{contract:{amountMinor:1}},{ownerId:csm.id},{id:'synthetic-buoy-2516'}]){
   assert.equal((await patch(csm,own,{revision:refusalRevision,name:'synthetic-buoy-2517 forbidden mixed change',...extra})).status,403,'An unsupported field refuses the entire mixed PATCH')
   const unchanged=await raw(own);assert.equal(unchanged.name,current.name);assert.equal(unchanged.revision,refusalRevision);assert.deepEqual(unchanged.billing,baseline.billing);assert.deepEqual(unchanged.support,baseline.support)
  }
  assert.equal((await patch(csm,own,{revision:refusalRevision,noticeDays:-1})).status,400,'Native account validation remains authoritative')
  assert.equal((await patch(csm,own,{name:'synthetic-buoy-2518 missing revision'})).status,400)
  assert.equal((await api('/audit?action=account.updated&actor='+csm.id)).entries.length,beforeAudit+1,'Refused or invalid changes add no success audit')
  for(const id of [shared,outside])assert.equal((await patch(csm,id,{revision:(await raw(id)).revision,name:'synthetic-buoy-2519 denied change'})).status,403,'A CSM cannot write through a share or outside the book')
  assert.equal((await patch(support,own,{revision:(await raw(own)).revision,name:'synthetic-buoy-2520 denied support change'})).status,403)
  // Two independent clients with the same reviewed revision cannot lose a write.
  const concurrentRevision=(await raw(own)).revision,responses=await Promise.all([
   patch(csm,own,{revision:concurrentRevision,name:'synthetic-buoy-2521 concurrent first'}),
   patch(csm,own,{revision:concurrentRevision,name:'synthetic-buoy-2522 concurrent second'}),
  ])
  assert.equal(responses.filter(response=>response.ok).length,1);assert.equal(responses.filter(response=>response.status===409).length,1)
  current=await raw(own);assert.deepEqual(current.billing,baseline.billing);assert.deepEqual(current.support,baseline.support)
  await api('/people/'+csm.id+'/manager','PUT',{managerId:manager.id})
  await json(await patch(manager,own,{revision:current.revision,name:'synthetic-buoy-2523 manager update'}))
  assert.equal((await patch(manager,outside,{revision:(await raw(outside)).revision,name:'synthetic-buoy-2524 outside team'})).status,403)
  await api('/people/'+csm.id+'/manager','PUT',{managerId:null})
  assert.equal((await patch(manager,own,{revision:(await raw(own)).revision,name:'synthetic-buoy-2525 revoked manager'})).status,403,'A manager change withdraws write authority immediately')
  const segment=await api('/segments','POST',{name:'synthetic-buoy-2526',mode:'static',accountIds:[own],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
  const custom=await api('/roles/definitions','POST',{revision:(await api('/roles')).revision,name:'synthetic-buoy-2527',permissions:{read:'scope',edit:'all'},scope:{kind:'segment',segmentId:segment.id},commercial:'none'})
  await assign(csm,custom.id);current=await raw(own)
  await json(await patch(csm,own,{revision:current.revision,name:'synthetic-buoy-2528 custom update'}))
  assert.equal((await patch(csm,outside,{revision:(await raw(outside)).revision,name:'synthetic-buoy-2529 outside custom scope'})).status,403,'A custom all-edit row remains bounded by its role scope')
  await api('/roles/definitions','POST',{revision:(await api('/roles')).revision,id:custom.id,name:'synthetic-buoy-2527',permissions:{read:'scope',edit:'none'},scope:{kind:'segment',segmentId:segment.id},commercial:'none'})
  current=await raw(own)
  assert.equal((await patch(csm,own,{revision:current.revision,name:'synthetic-buoy-2530 revoked custom right'})).status,403,'Changing the definition immediately withdraws edit rights')
  const final=await raw(own);assert.equal(final.revision,current.revision);assert.deepEqual(final.billing,baseline.billing);assert.deepEqual(final.support,baseline.support)
 }finally{await app.close()}
}
