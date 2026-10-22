import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'

export async function roleRenewalApprovalJourney(){
 const app=await startWorker(),cookie=app.cookie
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie,method,body,...options})
 const json=async response=>{assert.ok(response.ok,await response.clone().text());return response.json()}
 const api=async(...args)=>json(await request(...args))
 const invite=async n=>{const email='synthetic-buoy-'+n+'@example.test';await json(await app.request('/auth/invite',{method:'POST',cookie,body:{email,displayName:'synthetic-buoy-'+n,role:'member'}}));const as=await app.signIn(email);return {email,id:(await api('/state','GET',undefined,{cookie:as})).operator.id,cookie:as}}
 const assign=async(person,roleId,extra={})=>api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId,...extra})
 const queue=person=>api('/renewals/approvals','GET',undefined,{cookie:person.cookie})
 const decide=(person,p,body={revision:p.revision,sourceRevision:p.sourceRevision})=>request('/proposals/'+p.id+'/approve','POST',body,{cookie:person.cookie})
 const on=new Date().toISOString().slice(0,10),end=new Date(Date.parse(on)+20*86400000).toISOString().slice(0,10)
 const ids=['synthetic-buoy-2700','synthetic-buoy-2701','synthetic-buoy-2702']
 try{
  const csm=await invite(2710),peer=await invite(2711),manager=await invite(2712),finance=await invite(2713),customPerson=await invite(2714)
  const settings=(await api('/renewals')).settings
  await api('/renewals/settings','PUT',{revision:settings.revision,leadDays:30,stages:['Review']})
  for(const [i,id]of ids.entries()){
   await api('/accounts','POST',{id,name:id+' account',renewalDate:end,noticeDays:10,renewalEvidence:'synthetic-buoy-2720 customer notice terms',billing:null,support:{observedAt:on,reference:'synthetic-buoy-2721 support source',openTickets:1,urgentTickets:1}})
   await api('/accounts/'+id+'/owner','PUT',{ownerId:i===2?peer.id:csm.id})
   const account=(await api('/state')).accounts.find(row=>row.id===id)
   await api('/accounts/'+id+'/contract','POST',{revision:account.revision,contract:{currency:'USD',contractStart:new Date(Date.parse(on)-180*86400000).toISOString().slice(0,10),contractEnd:end,lines:[{id:'synthetic-buoy-'+(2730+i),product:'synthetic-buoy-2735 recurring product',quantity:1,amountMinor:120000+i*1000,frequency:'annual',entitlements:''}],source:{reference:'synthetic-buoy-2736 private confirmed contract',confirmedOn:on}}})
  }
  const renewal=async accountId=>(await api('/renewals')).records.find(row=>row.accountId===accountId)
  const prepare=async accountId=>{const source=await renewal(accountId);return api('/proposals','POST',{accountId,kind:'renewal',payload:{renewalId:source.id,outcome:'renewed',resultArrMinor:source.expectedArrMinor,reason:'synthetic-buoy-2740 customer accepted',evidence:'synthetic-buoy-2741 signed renewal evidence'}})}
  const proposals=await Promise.all(ids.map(prepare))
  await assign(csm,'csm',{sharedAccountIds:[ids[2]]});await assign(manager,'cs-manager');await assign(finance,'finance')
  await api('/people/'+csm.id+'/manager','PUT',{managerId:manager.id})
  assert.deepEqual((await queue(csm)).proposals,[],'An own-book CSM needs the explicit outcome grant')
  assert.deepEqual((await queue(finance)).proposals,[],'Exact financial read access alone grants no approval')
  await assign(csm,'csm',{sharedAccountIds:[ids[2]],grants:{concessionLimitMinor:null,renewalOutcome:true}})
  const ownQueue=await queue(csm),teamQueue=await queue(manager)
  assert.deepEqual(ownQueue.proposals.map(row=>row.accountId).sort(),ids.slice(0,2))
  assert.deepEqual(teamQueue.proposals.map(row=>row.accountId).sort(),ids.slice(0,2),'A manager reviews only active direct-report books')
  assert.doesNotMatch(JSON.stringify(ownQueue),/snapshot|prepared_by|preparedBy|synthetic-buoy-(2736|2721|2712|2702)/,'The review projection excludes raw sources, preparers and hidden accounts')
  const own=ownQueue.proposals.find(row=>row.accountId===ids[0]),team=teamQueue.proposals.find(row=>row.accountId===ids[1])
  for(const person of [peer,finance])assert.equal((await decide(person,own)).status,403)
  assert.equal((await decide(csm,{...own,id:proposals[2].id})).status,403,'A share cannot grant outcome approval')
  assert.equal((await decide(manager,{...team,id:proposals[2].id})).status,403,'A readable account outside the team is refused')
  assert.equal((await decide(csm,own,{revision:own.revision,sourceRevision:'synthetic-buoy-2742 unreviewed source'})).status,409)
  const playbook=await api('/proposals','POST',{accountId:ids[0],kind:'playbook',payload:{title:'synthetic-buoy-2743 risk review',dueDate:on}})
  assert.equal((await decide(csm,{...own,id:playbook.id})).status,403,'The scoped door cannot approve another proposal kind')
  const before=(await api('/state')).decisions.length
  await json(await decide(manager,team));await json(await decide(manager,team))
  let decisions=(await api('/state')).decisions.filter(row=>row.proposalId===team.id)
  assert.equal(decisions.length,1);assert.ok(decisions[0].recordedBy.includes(manager.id))
  const audit=(await api('/audit?action=renewal.approved&actor='+manager.id)).entries
  assert.equal(audit.length,1);assert.equal(audit[0].actor,'person:'+manager.id)
  assert.equal((await renewal(ids[1])).outcome,'renewed')
  await api('/people/'+csm.id+'/manager','PUT',{managerId:null})
  assert.equal((await decide(manager,team)).status,403,'Approved replays still require live team authority')
  // Source refresh withdraws the reviewed account and renewal revisions.
  const source=await renewal(ids[0])
  await api('/renewals/'+source.id,'PUT',{revision:source.revision,stage:source.stage,forecast:'commit',ownerId:csm.id,riskReasons:[]})
  assert.equal((await decide(csm,own)).status,409,'A changed native source refuses the original reviewed outcome')
  assert.ok(!(await queue(csm)).proposals.some(row=>row.id===own.id))
  const fresh=await prepare(ids[0]),review=(await queue(csm)).proposals.find(row=>row.id===fresh.id)
  await assign(csm,'csm',{grants:{concessionLimitMinor:null,renewalOutcome:false}})
  assert.equal((await decide(csm,review)).status,403,'A revoked named grant immediately blocks approval')
  await assign(csm,'csm',{grants:{concessionLimitMinor:null,renewalOutcome:true}})
  // Native versions revoke both sessions and grants, even after reactivation.
  for(const status of ['inactive','active'])await json(await app.request('/auth/operator/status',{method:'POST',cookie,body:{operatorId:csm.id,status}}))
  assert.equal((await decide(csm,review)).status,401)
  csm.cookie=await app.signIn(csm.email)
  assert.equal((await decide(csm,review)).status,403)
  await assign(csm,'csm',{grants:{concessionLimitMinor:null,renewalOutcome:true}})
  await json(await decide(csm,review));await json(await decide(csm,review))
  const segment=await api('/segments','POST',{name:'synthetic-buoy-2750 renewal review',mode:'static',accountIds:[ids[2]],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
  const custom=await api('/roles/definitions','POST',{revision:(await api('/roles')).revision,name:'synthetic-buoy-2751 renewal reviewer',permissions:{read:'scope',commercialRead:'full',renewals:'yes'},scope:{kind:'segment',segmentId:segment.id},commercial:'full'})
  await assign(customPerson,custom.id,{scope:{kind:'own'}})
  assert.deepEqual((await queue(customPerson)).proposals,[],'Assignment scope intersects the role segment')
  await assign(customPerson,custom.id)
  const customQueue=await queue(customPerson)
  assert.deepEqual(customQueue.proposals.map(row=>row.accountId),[ids[2]])
  const customReview=customQueue.proposals[0]
  await assign(customPerson,custom.id,{commercial:'band'})
  assert.deepEqual((await queue(customPerson)).proposals,[],'A commercial band cannot expose outcome review evidence')
  assert.equal((await decide(customPerson,customReview)).status,403)
  await assign(customPerson,custom.id)
  assert.equal((await decide(customPerson,review)).status,403,'An all-outcome custom row cannot escape its role segment')
  await json(await decide(customPerson,customReview));await json(await decide(customPerson,customReview))
  await api('/roles/definitions','POST',{revision:(await api('/roles')).revision,id:custom.id,name:custom.name??'synthetic-buoy-2751 renewal reviewer',permissions:{read:'scope',commercialRead:'full',renewals:'none'},scope:{kind:'segment',segmentId:segment.id},commercial:'full'})
  assert.equal((await decide(customPerson,customReview)).status,403,'Definition withdrawal also blocks approved replays')
  decisions=(await api('/state')).decisions
  assert.equal(decisions.length,before+3)
  for(const id of [team.id,review.id,customReview.id])assert.equal(decisions.filter(row=>row.proposalId===id).length,1)
 }finally{await app.close()}
}
