import {planDelegatedJourney} from './plan-delegated-journey.mjs'
import assert from 'node:assert/strict'
import {planFixture,planDependencies,planRenewal} from './plan-fixture.mjs'
export async function planAttainmentJourney(){
 const f=await planFixture(),{app,api,accountId,champion,save,plans}=f
 try{
  const plan=await save(),first=(await plans()).plans[0]
  assert.equal(first.id,plan.id);assert.equal(first.objectives[0].status,'unavailable');assert.equal(first.objectives[1].status,'awaiting-customer-confirmation')
  const source=await api('/usage/sources','POST',{name:'Plan usage source',kind:'native',reference:'synthetic-buoy-1910'}),credential=await api('/usage/sources/'+source.id+'/credentials','POST',{label:'synthetic-buoy-1911',scope:['event']}),person=await api('/customer-people','POST',{kind:'user',name:'synthetic-buoy-1912',accountIds:[accountId],source:'synthetic-buoy-1913'})
  const mapping={sourceId:source.id,userId:'synthetic-buoy-1914',groupId:'synthetic-buoy-1915',accountId,personId:person.id},preview=await api('/usage/mappings/preview','POST',mapping);await api('/usage/mappings','POST',{...mapping,fingerprint:preview.fingerprint})
  await api('/scorecards/publish','POST',{revision:null,config:{name:'Actual plan goals',measures:[{key:'goals',name:'Success goal attainment',field:'goals.attainmentPercent',min:0,max:100,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]}})
  const send=()=>app.dispatch(new Request(app.origin+'/api/buoy/usage/intake/'+source.id,{method:'POST',headers:{authorization:'Bearer '+credential.secret,'content-type':'application/json'},body:JSON.stringify({type:'event',event:'Reviewed feature used',messageId:'synthetic-buoy-1916',userId:mapping.userId,groupId:mapping.groupId})}))
  assert.equal((await send()).status,202);assert.equal((await send()).status,202)
  const current=(await plans()).plans[0];assert.equal(current.objectives[0].value,1);assert.equal(current.objectives[0].status,'achieved');assert.equal(current.objectives[1].status,'awaiting-customer-confirmation')
  const cards=await api('/scorecards'),score=cards.accounts.find(a=>a.accountId===accountId)
  assert.equal(score.breakdown[0].rawValue,50);assert.equal(score.score,50)
  assert.doesNotMatch(JSON.stringify(score.inputs.sources['goals.attainmentPercent']),/business result|synthetic-buoy-1902|Customer success draft/,'Health input exposes only goal counts and opaque plan versions')
  const revision=(await api('/state')).accounts.find(a=>a.id===accountId).revision
  await plans();assert.equal((await api('/state')).accounts.find(a=>a.id===accountId).revision,revision,'Repeated reads do not rewrite source timestamps or account revisions')
  assert.ok((await api('/accounts/'+accountId+'/activity?kind=success-plan')).records.some(e=>e.kind==='success-plan'))
  assert.equal(app.outbound.filter(url=>!url.includes('resend.com')).length,0,'Draft plans trigger no new outbound call')
  // A source correction can remove current attainment; it never invents a retained milestone outcome.
  await api('/fields','POST',{key:'plan_value',label:'Verified custom goal measure',type:'number'})
  const put=async value=>api('/accounts/'+accountId+'/fields','PUT',{revision:(await api('/state')).accounts.find(a=>a.id===accountId).revision,values:{plan_value:value},source:'synthetic-buoy-1917'})
  await put(10);await save({id:current.id,revision:current.revision,objectives:[{...f.objectives[0],field:'custom.plan_value',target:10},f.objectives[1]]})
  assert.equal((await plans()).plans[0].objectives[0].status,'achieved');await put(2);assert.equal((await plans()).plans[0].objectives[0].status,'in-progress');assert.equal((await api('/scorecards')).accounts.find(a=>a.accountId===accountId).score,0)
  await api('/surveys/responses','POST',{accountId,personId:champion.id,surveyName:'Actual received plan review',kind:'nps',value:9,observedAt:new Date(Date.now()-1000).toISOString(),reference:'synthetic-buoy-1918',sourceResponseId:'synthetic-buoy-1919',accountRevision:(await api('/state')).accounts.find(a=>a.id===accountId).revision})
  const latest=(await plans()).plans[0];await save({id:latest.id,revision:latest.revision,objectives:[{...f.objectives[0],field:'survey.nps',target:100,direction:'at-most'},f.objectives[1]]})
  assert.equal((await plans()).plans[0].objectives[0].value,100);assert.equal((await plans()).plans[0].objectives[0].status,'achieved','Received survey goals honor the inclusive at-most boundary')
  assert.equal((await api('/scorecards')).accounts.find(a=>a.accountId===accountId).score,50)
  assert.equal(champion.id,(await plans()).plans[0].customerOwnerId)
  const outcomeConfig={name:'Plan outcome baseline',measures:[{key:'goals',name:'Success goal attainment',field:'goals.attainmentPercent',min:0,max:100,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:75,healthyAt:100},segments:[]}
  await api('/scorecards/publish','POST',{revision:(await api('/scorecards')).revision,config:outcomeConfig})
  const dep=await planDependencies(f),p=(await plans()).plans[0]
  await save({id:p.id,revision:p.revision,taskIds:[dep.taskId],milestones:dep.milestones})
  let linked=(await plans()).plans[0]
  assert.deepEqual(linked.linkedTasks.map(t=>[t.id,t.completedAt]),[[dep.taskId,null]])
  assert.deepEqual(linked.milestoneEvidence.map(m=>[m.id,m.kind,m.status,m.rate,m.comparisonRate]),[['recovery','healthy','observing',0,0]])
  const report=await api('/outcomes/'+dep.outcomeId+'/report')
  assert.equal(Date.parse(linked.milestoneEvidence[0].deadline)-Date.parse(linked.milestoneEvidence[0].startedAt),2*86400000)
  assert.deepEqual(report.enrolled.map(a=>a.accountId),[accountId]);assert.deepEqual(report.comparison.map(a=>a.accountId),[f.other])
  const segment=(await api('/segments')).segments.find(s=>s.id===dep.segment.id)
  await api('/segments','POST',{...dep.segmentInput,id:segment.id,revision:segment.revision,accountIds:[]})
  await api('/tasks/'+dep.taskId+'/complete','POST',{outcome:'Work reviewed',evidence:'synthetic-buoy-1951'})
  assert.equal((await plans()).plans[0].milestoneEvidence[0].status,'observing','Task completion cannot invent milestone success')
  await api('/scorecards/publish','POST',{revision:(await api('/scorecards')).revision,config:{...outcomeConfig,bands:{riskBelow:25,healthyAt:50}}})
  linked=(await plans()).plans[0];const reached=(await api('/outcomes/'+dep.outcomeId+'/report')).enrolled[0]
  assert.equal(linked.milestoneEvidence[0].status,'reached');assert.equal(linked.milestoneEvidence[0].rate,1);assert.equal(linked.milestoneEvidence[0].comparisonRate,0)
  assert.equal(linked.milestoneEvidence[0].elapsedHours,(Date.parse(reached.reachedAt)-Date.parse(report.startedAt))/3600000)
  assert.equal((await plans()).plans[0].milestoneEvidence[0].reachedAt,reached.reachedAt)
  const frozen=await api('/outcomes/'+dep.outcomeId+'/report');assert.deepEqual(frozen.enrolled.map(a=>a.accountId),[accountId]);assert.deepEqual(frozen.comparison.map(a=>a.accountId),[f.other])
  const review=await api('/reviews','POST',{accountId,name:'Plan review capture',kind:'QBR'}),deck=(await api('/reviews?id='+review.id)).selected
  const facts=deck.document.slides.find(s=>s.title==='Success plans and goal evidence').facts
  assert.ok(facts.some(x=>x.label.endsWith('Customer confirms the business result')&&x.value==='awaiting-customer-confirmation'))
  assert.ok(facts.some(x=>x.label==='Reach healthy evidence'&&x.value==='reached'))
  assert.ok(facts.some(x=>x.label==='Agreed plan follow-up'&&x.value==='Completed'))
  assert.deepEqual((await plans()).readiness,{status:'goals-pending',total:2,achieved:1,unavailable:0,awaitingConfirmation:1,interpretation:'Current goal evidence only; this is not customer confirmation or a renewal prediction.'})
  const renewal=await planRenewal(f);assert.ok(renewal);assert.deepEqual(renewal.goalReadiness,(await plans()).readiness)
  const member=await f.invited('plan-readiness@example.test','Plan readiness member')
  assert.ok((await api('/renewals','GET',undefined,{cookie:member.cookie})).records.every(r=>r.goalReadiness===undefined),'Member renewal reads reveal no internal plan evidence')
  console.log('PLAN-001 linked outcomes, frozen cohorts, observed elapsed time, same-account tasks, review inclusion and renewal goal readiness passed.')
  console.log('PLAN-001 live attributed usage, replay, custom source correction, awaiting customer confirmation, goal health, stable reads and internal activity passed.')
 }finally{await app.close()}
}
export async function planAuthorityJourney(){
 const f=await planFixture(),{app,api,accountId,other,body,save,post,plans,invited}=f
 try{
  const member=await invited('plan-member@example.test','Plan member'),agent=await api('/agent-tokens','POST',{label:'synthetic-buoy-1920'}),valid=await body()
  for(const cookie of [undefined,member.cookie]){const options={cookie};assert.ok([401,403].includes((await app.request('/api/buoy/accounts/'+accountId+'/plans',options)).status));assert.ok([401,403].includes((await post(valid,options)).status))}
  assert.equal((await post(valid,{token:agent.token})).status,403);assert.equal((await post(valid,{headers:{origin:'https://outside.invalid'}})).status,403)
  for(const extra of [{shared:true},{confirmed:true},{objectives:[{...f.objectives[1],status:'achieved'}]},{objectives:[{...f.objectives[0],field:'goals.attainmentPercent'}]},{objectives:[{...f.objectives[0],field:'custom.missing'}]},{objectives:[f.objectives[0],f.objectives[0]]}])assert.equal((await post({...valid,...extra})).status,400)
  const dep=await planDependencies(f)
  for(const extra of [{taskIds:[dep.foreignTaskId]},{taskIds:[dep.taskId,dep.taskId]},{milestones:[{...dep.milestones[0],objectiveId:'missing'}]},{milestones:[{...dep.milestones[0],outcomeId:'synthetic-buoy-1954'}]},{milestones:[{...dep.milestones[0],outcomeId:dep.foreignOutcomeId}]}])assert.ok([400,409].includes((await post({...await body(),...extra})).status))
  const foreign=await api('/customer-people','POST',{kind:'contact',name:'synthetic-buoy-1921',accountIds:[other],source:'synthetic-buoy-1922'});assert.equal((await post({...await body(),customerOwnerId:foreign.id})).status,409)
  const created=await save(),edit=await body({id:created.id,revision:created.revision,name:'Reviewed changed draft'}),results=await Promise.all([post(edit),post(edit)])
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal((await plans()).plans.length,1);assert.equal((await post(edit)).status,409)
  const before=(await plans()).plans[0];assert.equal((await post(await body({id:before.id,revision:before.revision,accountRevision:'synthetic-buoy-1923'}))).status,409)
  assert.equal((await app.request('/api/buoy/accounts/'+other+'/plans',{cookie:app.cookie})).status,200)
  assert.equal((await post(await body({id:before.id,revision:before.revision,customerOwnerId:foreign.id}))).status,409)
  assert.equal((await api('/audit?action=plan.saved')).entries.length,2,'Only the original and one winning edit have an audit entry')
  await planDelegatedJourney(f)
  console.log('PLAN-001 active administrator authority, agent and member refusal, CSRF, invented confirmation or sharing, self-feedback, membership and concurrent stale edits passed.')
 }finally{await app.close()}
}
export async function planCustodyJourney(){
 const f=await planFixture(),{app,api,accountId,other,ownerId,champion,save,plans,invited}=f
 try{
  const next=await invited('plan-next@example.test','Next CSM'),separate=await invited('plan-separate@example.test','Separate owner')
  await api('/accounts/'+accountId+'/owner','PUT',{ownerId});const moving=await save(),fixed=await save({name:'Separately owned plan',staffOwnerId:separate.id})
  await api('/accounts/'+accountId+'/owner','PUT',{ownerId:next.id,note:'Reviewed customer handover'})
  const rows=(await plans()).plans;assert.equal(rows.find(p=>p.id===moving.id).staffOwnerId,next.id);assert.equal(rows.find(p=>p.id===fixed.id).staffOwnerId,separate.id);assert.notEqual(rows.find(p=>p.id===moving.id).revision,moving.revision)
  const privacy=await api('/customer-people/'+champion.id+'/privacy/export','POST',{revision:(await api('/customer-people')).records.find(p=>p.id===champion.id).revision,confirmation:'synthetic-buoy-1902',request:{verificationMethod:'verified-offline',receivedDate:new Date().toISOString().slice(0,10),requesterReference:crypto.randomUUID()}})
  assert.equal(privacy.records.successPlans.length,2,'Customer export includes both current success plan ownership records')
  const contact=(await api('/customer-people')).records.find(p=>p.id===champion.id)
  await api('/customer-people/'+champion.id,'PUT',{kind:'contact',name:contact.name,accountIds:[other],revision:contact.revision,source:'synthetic-buoy-1930'})
  assert.ok((await plans()).plans.every(p=>p.customerOwnerId===null),'Withdrawn membership cannot remain a plan owner')
  await api('/accounts/'+accountId,'DELETE',{confirmation:f.customer(accountId).name})
  assert.equal((await app.request('/api/buoy/accounts/'+accountId+'/plans',{cookie:app.cookie})).status,404)
  assert.ok(!(await api('/scorecards')).accounts.some(a=>a.accountId===accountId))
  assert.doesNotMatch(JSON.stringify(await api('/audit?action=plan.saved')),/Customer success draft|Separate owner|synthetic-buoy-1902/)
  console.log('PLAN-001 handover moves the outgoing CSM draft, preserves another owner, membership withdrawal clears customer ownership and account erasure removes plans and goal evidence.')
 }finally{await app.close()}
}
