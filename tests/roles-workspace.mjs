import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'

export async function roleWorkspaceJourney(){
 const app=await startWorker(),cookie=app.cookie
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie,method,body,...options})
 const json=async response=>{assert.ok(response.ok,await response.clone().text());return response.json()}
 const api=async(...args)=>json(await request(...args))
 const home=(person,target)=>api('/workspace/home'+(target?'?person='+target.id:''),'GET',undefined,{cookie:person.cookie})
 const invite=async n=>{const email='synthetic-buoy-'+n+'@example.test';await json(await app.request('/auth/invite',{method:'POST',cookie,body:{email,displayName:'synthetic-buoy-'+n,role:'member'}}));const as=await app.signIn(email);return {id:(await api('/state','GET',undefined,{cookie:as})).operator.id,cookie:as}}
 const assign=async(person,roleId,extra={})=>api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId,...extra})
 const on=new Date().toISOString().slice(0,10),end=new Date(Date.parse(on)+60*86400000).toISOString().slice(0,10)
 const a='synthetic-buoy-2400',b='synthetic-buoy-2401',outside='synthetic-buoy-2402',managerAccount='synthetic-buoy-2403'
 try{
  const csm=await invite(2410),manager=await invite(2411),finance=await invite(2412),peer=await invite(2413)
  for(const [id,owner]of [[a,csm],[b,csm],[outside,peer],[managerAccount,manager]]){
   await api('/accounts','POST',{id,name:id+' workspace customer',renewalDate:end,noticeDays:30,renewalEvidence:'synthetic-buoy-2490 private renewal evidence',billing:null,support:{observedAt:on,reference:'synthetic-buoy-2491 private source',openTickets:1,urgentTickets:1}})
   await api('/accounts/'+id+'/owner','PUT',{ownerId:owner.id})
  }
  await api('/people/'+csm.id+'/manager','PUT',{managerId:manager.id})
  await api('/team/settings','PUT',{teams:[{id:'synthetic-buoy-2414',name:'synthetic-buoy-2414',pod:'',personIds:[csm.id,manager.id]}],capacities:[],rules:[],territories:[]})
  await api('/accounts/'+a+'/contract','POST',{revision:(await api('/state')).accounts.find(row=>row.id===a).revision,contract:{currency:'USD',contractStart:on,contractEnd:end,lines:[{id:'synthetic-buoy-2415',product:'synthetic-buoy-2415',quantity:1,amountMinor:93456789,frequency:'annual',entitlements:'synthetic-buoy-2492 private contract text'}],source:{reference:'synthetic-buoy-2493 private contract source',confirmedOn:on}}})
  const task=async(accountId,owner,title)=>{const proposal=await api('/proposals','POST',{accountId,kind:'playbook',payload:{title,dueDate:on,ownerId:owner.id}});await api('/proposals/'+proposal.id+'/approve','POST',{});return (await api('/state')).tasks.find(row=>row.proposalId===proposal.id)}
  const due=await task(a,csm,'synthetic-buoy-2494 private task 93456789');await task(b,peer,'synthetic-buoy-2495 other handler task')
  await app.scheduled('0 * * * *',Date.parse(on+'T12:00:00Z'))
  await assign(csm,'csm');await assign(manager,'cs-manager');await assign(finance,'finance');await assign(peer,'csm')
  const mine=await home(csm),managed=await home(manager,csm),executive=await home(finance,csm)
  assert.deepEqual(mine.book.map(row=>row.id),[a,b]);assert.deepEqual(mine.tasks.map(row=>row.id),[due.id]);assert.equal(mine.alerts.length,2);assert.equal(mine.renewals.length,2);assert.equal(mine.renewals.find(row=>row.accountId===a).opportunities.length,1);assert.equal(mine.meetings.status,'unavailable')
  for(const field of ['book','tasks','alerts','renewals']){assert.deepEqual(managed[field],mine[field],'A manager sees the target’s same scoped '+field);assert.deepEqual(executive[field],mine[field],'A finance reader sees the target’s same scoped '+field)}
  assert.equal(executive.readOnly,true)
  for(const reader of [csm,peer])assert.equal((await request('/workspace/home?person='+manager.id,'GET',undefined,{cookie:reader.cookie})).status,403,'A CSM cannot inspect another home')
  assert.doesNotMatch(JSON.stringify(managed),/synthetic-buoy-2402|synthetic-buoy-249[0-5]/,'A book home does not disclose outside accounts or source/task free text')
  await assign(manager,'cs-manager',{scope:{kind:'team'}});assert.deepEqual((await home(manager,csm)).book.map(row=>row.id),[a,b])
  assert.equal((await request('/workspace/home?person='+peer.id,'GET',undefined,{cookie:manager.cookie})).status,403,'A team-scoped manager cannot inspect an outside book')
  await assign(manager,'cs-manager',{scope:{kind:'own'}});assert.deepEqual((await home(manager)).book.map(row=>row.id),[managerAccount]);assert.equal((await request('/workspace/home?person='+csm.id,'GET',undefined,{cookie:manager.cookie})).status,403)
  const segment=await api('/segments','POST',{name:'synthetic-buoy-2416',mode:'static',accountIds:[a],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
  const reader=await api('/roles/definitions','POST',{revision:(await api('/roles')).revision,name:'synthetic-buoy-2417',permissions:{read:'scope',home:'read-only',commercialRead:'band'},scope:{kind:'segment',segmentId:segment.id},commercial:'band'})
  await assign(finance,reader.id);const scoped=await home(finance,csm)
  assert.deepEqual(scoped.book.map(row=>row.id),[a]);assert.deepEqual(scoped.tasks.map(row=>row.id),[due.id]);assert.equal(scoped.alerts.length,1);assert.deepEqual(scoped.renewals.map(row=>row.accountId),[a]);assert.ok(scoped.book[0].arrBand);assert.equal(scoped.book[0].commercial,undefined)
  assert.doesNotMatch(JSON.stringify(scoped),/93456789|synthetic-buoy-2401|synthetic-buoy-2402|synthetic-buoy-249[0-5]/,'A band-only segment home masks hidden records and exact commercial/source values')
  const definition=(await api('/segments')).segments.find(row=>row.id===segment.id)
  await api('/segments','POST',{id:segment.id,revision:definition.revision,name:'synthetic-buoy-2416',mode:'static',accountIds:[outside],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
  assert.equal((await request('/workspace/home?person='+csm.id,'GET',undefined,{cookie:finance.cookie})).status,403,'Segment exit withdraws another person’s book access immediately')
  await api('/people/'+csm.id+'/away','POST',{coverId:peer.id,startsOn:on,endsOn:on});assert.deepEqual((await home(csm)).tasks,[],'The home follows the current away handler')
  await assign(manager,'cs-manager',{scope:{kind:'team'}});await api('/people/'+csm.id+'/manager','PUT',{managerId:null})
  assert.equal((await request('/workspace/home?person='+csm.id,'GET',undefined,{cookie:manager.cookie})).status,403,'A live manager change withdraws team-scoped home access')
  assert.equal((await request('/workspace/bulk/preview','POST',{},{cookie:csm.cookie})).status,403,'Home reads do not create bulk edit authority')
 }finally{await app.close()}
}
