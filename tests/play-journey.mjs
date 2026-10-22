import assert from 'node:assert/strict'
import {playFixture,playConfig,condition} from './play-fixture.mjs'
export async function playJourney(){
 const f=await playFixture(),{app,api,ownerId,create,update,state,run,action,approveTask,customer}=f
 try{
  const ids=[];for(let i=0;i<4;i++)ids.push(await create('synthetic-buoy-150'+i))
  const memberEmail='play-member@example.test',adminEmail='play-admin@example.test'
  for(const [email,role]of [[memberEmail,'member'],[adminEmail,'admin']])assert.equal((await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email,displayName:'Playbook '+role,role}})).status,202)
  const member=await app.signIn(memberEmail),admin=await app.signIn(adminEmail)
  const forbidden=async(path,method,body,status=403,options={cookie:member})=>assert.equal((await app.request('/api/buoy'+path,{method,body,...options})).status,status)
  await forbidden('/playbooks','GET',undefined);await forbidden('/playbooks','GET',undefined,401,{})
  await forbidden('/playbooks','POST',{config:playConfig(ownerId)})
  await forbidden('/playbooks','POST',{config:playConfig(ownerId)},403,{cookie:app.cookie,headers:{origin:'https://elsewhere.invalid'}})
  const bad=await app.request('/api/buoy/playbooks',{cookie:app.cookie,method:'POST',body:{config:playConfig(ownerId,{steps:[{id:'loop',kind:'branch',title:'No cycles',rules:condition('id','eq','x'),next:0,otherwise:0}]})}});assert.equal(bad.status,400)
  await api('/scorecards/publish','POST',{revision:null,config:{name:'Playbook evidence score',measures:[{key:'support',name:'Urgent tickets',field:'support.urgentTickets',min:0,max:2,weight:1,direction:'lower',missing:'unknown'}],bands:{riskBelow:50,healthyAt:75},segments:[]}})
  const config=playConfig(ownerId,{name:'Recovery route',trigger:{kind:'rule',rules:{match:'all',conditions:[{field:'id',op:'contains',value:'synthetic-buoy-150'},{field:'health.score',op:'lt',value:50}]}},exit:condition('health.score','gte',75),steps:[{id:'task',kind:'task',title:'Initial review',dueDays:2},{id:'wait',kind:'wait',title:'Wait for customer evidence',seconds:1},{id:'branch',kind:'branch',title:'Review urgent work',rules:condition('support.urgentTickets','gte',2),next:3,otherwise:5},{id:'approval',kind:'approval',title:'Approve planned external follow-up'},{id:'email',kind:'external',title:'Record email performed outside Buoy',channel:'email',next:6},{id:'webhook',kind:'external',title:'Record webhook performed outside Buoy',channel:'webhook'},{id:'slack',kind:'external',title:'Record Slack work performed outside Buoy',channel:'slack'}]})
  const book=await api('/playbooks','POST',{config});let runs=(await state()).runs.filter(r=>r.playbook_id===book.id);assert.equal(runs.length,4);assert.ok(runs.every(r=>r.status==='approval'))
  const publishAudit=(await api('/audit?action=playbook.published')).entries;assert.equal(publishAudit.length,1);assert.equal(publishAudit[0].subject,book.id);assert.equal(publishAudit[0].actor,'person:'+ownerId)
  const byId=id=>runs.find(r=>r.account_id===id).id
  // The manual enrollment operation key replays the original run, never another task.
  const first=runs[0];const replay=await api('/playbooks/'+book.id+'/enroll','POST',{accountId:first.account_id,operationKey:first.entry_key});assert.equal(replay.id,first.id);assert.equal(replay.replayed,true)
  await forbidden('/playbooks/'+book.id+'/enroll','POST',{accountId:ids[0],operationKey:'synthetic-buoy-1510'})
  // Stale task review produces a new revision-bound proposal; its old proposal cannot be approved.
  let a=await run(byId(ids[0]));const staleProposal=a.proposalId;await update(ids[0],{name:'Reviewed newer account evidence'})
  assert.equal((await app.request('/api/buoy/proposals/'+staleProposal+'/approve',{cookie:app.cookie,method:'POST',body:{}})).status,409)
  await action(a.id,{action:'review'});a=await run(a.id);assert.notEqual(a.proposalId,staleProposal)
  assert.equal((await app.request('/api/buoy/proposals/'+staleProposal+'/approve',{cookie:app.cookie,method:'POST',body:{}})).status,409)
  for(const id of ids)await approveTask(byId(id))
  assert.equal((await api('/state')).tasks.length,4)
  await update(ids[1],{support:{...customer(ids[1]).support,urgentTickets:1}})
  await update(ids[3],{support:{...customer(ids[3]).support,urgentTickets:0}})
  assert.equal((await run(byId(ids[3]))).status,'exited','Recovery exits during the wait')
  await app.scheduled('0 * * * *',Date.now()+3000)
  a=await run(byId(ids[0]));assert.equal(a.status,'approval');assert.equal(a.cursor,3)
  assert.equal((await run(byId(ids[1]))).cursor,5,'The alternative branch skips email approval and email')
  // Account evidence changes invalidate generic approval too; explicit review recovers.
  await update(ids[0],{name:'Second reviewed evidence change'})
  const stale=await app.request('/api/buoy/playbook-runs/'+a.id+'/action',{cookie:app.cookie,method:'POST',body:{revision:(await run(a.id)).revision,action:'approve',reference:'synthetic-buoy-1511'}});assert.equal(stale.status,409)
  await action(a.id,{action:'review'});await action(a.id,{action:'approve',reference:'synthetic-buoy-1512'})
  for(const id of ids.slice(0,3)){
   const rid=byId(id);if((await run(rid)).status==='approval')await action(rid,{action:'approve',reference:'synthetic-buoy-1513'})
   while((await run(rid)).status==='receipt')await action(rid,{action:'receipt',outcome:'succeeded',reference:'synthetic-buoy-1514'})
   assert.equal((await run(rid)).status,'completed')
  }
  await app.scheduled();assert.equal((await state()).runs.filter(r=>r.playbook_id===book.id).length,4,'Unchanged entry conditions and Cron never re-enroll')
  assert.equal((await app.request('/api/buoy/playbooks/'+book.id+'/enroll',{cookie:app.cookie,method:'POST',body:{accountId:ids[0],operationKey:'synthetic-buoy-1515'}})).status,409,'Re-enrollment interval survives completion')
  for(const id of ids){const r=await run(byId(id)),activity=await api('/accounts/'+id+'/activity?kind=playbook-step&limit=200');assert.equal(activity.records.length,r.events.length);assert.ok(activity.records.every(e=>e.href.endsWith('#playbooks')));assert.ok(r.events.every(e=>e.recordedAt));}
  assert.deepEqual([...new Set(app.outbound)],['https://api.resend.com/emails'],'External-work receipts make no external sends')
  // Ten runs with already-completed task steps, one threshold episode, exact failed-step retry.
  const failures=[];for(let i=0;i<10;i++)failures.push(await create('synthetic-buoy-152'+i))
  const failureBook=await api('/playbooks','POST',{config:playConfig(ownerId,{name:'Webhook work receipts',failureThreshold:3})})
  const failed=[]
  const cohort=await api('/segments','POST',{name:'Playbook enrolled/control cohort',mode:'static',rules:{match:'all',conditions:[]},accountIds:failures,rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})

  for(const accountId of failures){const r=await api('/playbooks/'+failureBook.id+'/enroll','POST',{accountId,operationKey:'synthetic-buoy-1530'});await approveTask(r.id);await action(r.id,{action:'receipt',outcome:'failed',reference:'synthetic-buoy-1531'});failed.push(r.id)}
  for(const cookie of [app.cookie,admin]){const notices=await api('/notifications','GET',undefined,{cookie});assert.equal(notices.items.filter(n=>n.title==='Playbook failure threshold crossed').length,1)}
  assert.equal(app.mails.filter(m=>m.subject==='Buoy: Playbook failure threshold crossed').length,2,'One single-recipient threshold email per admin')
  const tracking={name:'Versioned run outcomes',segmentId:cohort.id,kind:'healthy',windowDays:2,runIds:failed.slice(0,5),operationKey:'synthetic-buoy-1533'},outcome=await api('/outcomes','POST',tracking)
  assert.equal((await api('/outcomes','POST',tracking)).id,outcome.id)
  const report=()=>api('/outcomes/'+outcome.id+'/report'),baseline=await report();assert.equal(baseline.enrolled.length,5);assert.equal(baseline.comparison.length,5);assert.equal(baseline.rate,0);assert.equal(baseline.windowDays,2);assert.ok(baseline.enrolled.every(a=>failed.includes(a.runId)))
  const taskCount=(await api('/state')).tasks.length
  for(const rid of failed){await action(rid,{action:'retry'});assert.equal((await run(rid)).cursor,1);assert.equal((await run(rid)).status,'receipt');await action(rid,{action:'receipt',outcome:'succeeded',reference:'synthetic-buoy-1532'});assert.equal((await run(rid)).status,'completed');const events=(await run(rid)).events;assert.equal(events.filter(e=>e.stepIndex===0&&e.result.taskCreated).length,1);assert.equal(events.filter(e=>e.stepIndex===1&&e.attempt===2&&e.result.outcome==='succeeded').length,1)}
  assert.equal((await api('/state')).tasks.length,taskCount,'Retries never recreate completed tasks')
  await app.scheduled();assert.equal(app.mails.filter(m=>m.subject==='Buoy: Playbook failure threshold crossed').length,2)
  // The same outcome/cohort engine observes an independent first source recovery and preserves it.
  for(const accountId of failures.slice(0,2))await update(accountId,{support:{...customer(accountId).support,urgentTickets:0}})
  await update(failures[5],{support:{...customer(failures[5]).support,urgentTickets:0}})
  let observed=await report();assert.equal(observed.rate,.4);assert.equal(observed.comparisonRate,.2);assert.ok(observed.enrolled.filter(a=>a.reachedAt).every(a=>a.elapsedHours===(Date.parse(a.reachedAt)-Date.parse(observed.startedAt))/3600000))
  const firstEvidence=observed.enrolled.find(a=>a.reachedAt);await update(firstEvidence.accountId,{support:{...customer(firstEvidence.accountId).support,urgentTickets:2}});assert.deepEqual((await report()).enrolled.find(a=>a.accountId===firstEvidence.accountId).evidence,firstEvidence.evidence)
  const csv=await app.request('/api/buoy/outcomes/'+outcome.id+'/report.csv',{cookie:app.cookie});assert.equal((await csv.text()).trim().split('\r\n').length,11)
  // Version pinning and disable are effective at the existing proposal approval door.
  const pin=await create('synthetic-buoy-1540'),pinned=await api('/playbooks/'+failureBook.id+'/enroll','POST',{accountId:pin,operationKey:'synthetic-buoy-1541'}),old=await run(pinned.id)
  let changed=await api('/playbooks','POST',{id:failureBook.id,revision:failureBook.revision,config:playConfig(ownerId,{enabled:false,name:'Changed later definition'})})
  assert.equal((await app.request('/api/buoy/proposals/'+old.proposalId+'/approve',{cookie:app.cookie,method:'POST',body:{}})).status,409)
  changed=await api('/playbooks','POST',{id:failureBook.id,revision:changed.revision,config:playConfig(ownerId,{name:'Changed later definition'})})
  assert.equal((await run(pinned.id)).version_id,failureBook.revision);await approveTask(pinned.id)
  // Duplicate failed-step actions race on the same version; one retry wins.
  await action(pinned.id,{action:'receipt',outcome:'failed',reference:'synthetic-buoy-1542'})
  const revision=(await run(pinned.id)).revision,attempts=await Promise.all([0,1].map(()=>app.request('/api/buoy/playbook-runs/'+pinned.id+'/action',{cookie:app.cookie,method:'POST',body:{revision,action:'retry'}})))
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);assert.equal((await run(pinned.id)).status,'receipt')
  // Account erasure cascades private run inputs/results while opaque publish audit remains.
  await api('/accounts/'+pin,'DELETE',{confirmation:customer(pin).name});assert.ok(!(await state()).runs.some(r=>r.id===pinned.id))
  console.log('PLAY-001/003 public HTTP: health-score entry, both branches, waits, mid-run exit, stale review, pinned versions, re-enrollment, timeline, ten manual external failures, one admin episode/email, retry without duplicate completed steps, freeze and erasure passed. Automatic outbound/provider delivery remains unimplemented.')
 }finally{await app.close()}
}
