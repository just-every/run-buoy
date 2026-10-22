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
  const cohort=await api('/segments','POST',{name:'Playbook enrolled/control cohort',mode:'static',rules:{match:'all',conditions:[]},accountIds:failures,tier:null,stage:null,playbook:null})

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

export async function playTriggerJourney(){
 const f=await playFixture(),{app,api,ownerId,create,customer,run,action}=f
 try{
  const accountId=await create('synthetic-buoy-1701'),entry=condition('id','eq',accountId),steps=[{id:'review',kind:'approval',title:'Review triggered work'}]
  await api('/fields','POST',{key:'play_ready',label:'Reviewed play readiness',type:'boolean'})
  const putReady=async value=>{const a=(await api('/state')).accounts.find(a=>a.id===accountId);await api('/accounts/'+accountId+'/fields','PUT',{revision:a.revision,values:{play_ready:value},source:'synthetic-buoy-1702'})}
  const typed=await api('/playbooks','POST',{config:playConfig(ownerId,{name:'Typed-field entry',trigger:{kind:'rule',rules:condition('custom.play_ready','eq',1)},entry,steps})});assert.equal((await api('/playbooks')).runs.length,0)
  await putReady(true);assert.equal((await api('/playbooks')).runs.filter(r=>r.playbook_id===typed.id).length,1);await putReady(true);assert.equal((await api('/playbooks')).runs.filter(r=>r.playbook_id===typed.id).length,1)
  const segment=await api('/segments','POST',{name:'Play entry cohort',mode:'static',rules:{match:'all',conditions:[]},accountIds:[],tier:null,stage:null,playbook:null}),segmentBook=await api('/playbooks','POST',{config:playConfig(ownerId,{name:'Segment entry',trigger:{kind:'segment',segmentId:segment.id},entry,steps})})
  await api('/segments','POST',{...segment,id:segment.id,revision:(await api('/segments')).segments.find(s=>s.id===segment.id).revision,name:'Play entry cohort',mode:'static',rules:{match:'all',conditions:[]},accountIds:[accountId],tier:null,stage:null,playbook:null});assert.equal((await api('/playbooks')).runs.filter(r=>r.playbook_id===segmentBook.id).length,1)
  const stageBook=await api('/playbooks','POST',{config:playConfig(ownerId,{name:'Lifecycle entry',trigger:{kind:'stage',stage:'adoption'},entry,steps})})
  await api('/accounts/'+accountId+'/classification','PUT',{tier:'__rules__',stage:'adoption'});assert.equal((await api('/playbooks')).runs.filter(r=>r.playbook_id===stageBook.id).length,1)
  const on=new Date().toISOString().slice(0,10),current=(await api('/state')).accounts.find(a=>a.id===accountId)
  await api('/accounts/'+accountId,'PUT',{...customer(accountId),revision:current.revision,renewalDate:on})
  const renewalBook=await api('/playbooks','POST',{config:playConfig(ownerId,{name:'Renewal date entry',trigger:{kind:'renewal',days:0},entry,steps})});assert.equal((await api('/playbooks')).runs.filter(r=>r.playbook_id===renewalBook.id).length,1)
  const contractBook=await api('/playbooks','POST',{config:playConfig(ownerId,{name:'Contract start entry',trigger:{kind:'contract-start',days:0},entry,steps})})
  await api('/accounts/'+accountId+'/contract','POST',{revision:(await api('/state')).accounts.find(a=>a.id===accountId).revision,contract:{currency:'USD',contractStart:on,contractEnd:'2027-03-31',lines:[],source:{reference:'synthetic-buoy-1703',confirmedOn:on}}});assert.equal((await api('/playbooks')).runs.filter(r=>r.playbook_id===contractBook.id).length,1)
  // Use the real authenticated receiver, reviewed identity mapping and adoption metric, not a data-layer fake.
  const source=await api('/usage/sources','POST',{name:'Playbook recovery product',kind:'native',reference:'synthetic-buoy-1704'}),credential=await api('/usage/sources/'+source.id+'/credentials','POST',{label:'synthetic-buoy-1705',scope:['event']}),person=await api('/customer-people','POST',{kind:'user',name:'synthetic-buoy-1706',accountIds:[accountId],source:'synthetic-buoy-1707'})
  const mapping={sourceId:source.id,userId:'synthetic-buoy-1708',groupId:'synthetic-buoy-1709',accountId,personId:person.id},preview=await api('/usage/mappings/preview','POST',mapping);await api('/usage/mappings','POST',{...mapping,fingerprint:preview.fingerprint})
  const recovery=condition('adoption.current.eventCount','gte',1),usageBook=await api('/playbooks','POST',{config:playConfig(ownerId,{name:'Observed usage recovery',entry,steps:[{id:'wait',kind:'wait',title:'Wait for actual usage',seconds:0,rules:recovery,timeoutSeconds:1},{id:'branch',kind:'branch',title:'Branch on actual usage',rules:recovery,next:2,otherwise:3},{id:'approved',kind:'approval',title:'Approve recovered usage follow-up'}]})}),enrolled=await api('/playbooks/'+usageBook.id+'/enroll','POST',{accountId,operationKey:'synthetic-buoy-1710'})
  assert.equal((await run(enrolled.id)).status,'waiting');await app.scheduled('0 * * * *',Date.now()+1500);assert.equal((await run(enrolled.id)).status,'failed');await action(enrolled.id,{action:'retry'});assert.equal((await run(enrolled.id)).status,'waiting')
  const received=await app.dispatch(new Request(app.origin+'/api/buoy/usage/intake/'+source.id,{method:'POST',headers:{authorization:'Bearer '+credential.secret,'content-type':'application/json'},body:JSON.stringify({type:'event',event:'Reviewed feature used',messageId:'synthetic-buoy-1711',userId:mapping.userId,groupId:mapping.groupId})}));assert.equal(received.status,202,await received.clone().text())
  // Ingestion has its own early authenticated route; cron observes the successfully committed source.
  await app.scheduled();const recovered=await run(enrolled.id);assert.equal(recovered.status,'approval');assert.equal(recovered.cursor,2);assert.ok(recovered.events.some(e=>e.stepIndex===1&&e.inputs['adoption.current.eventCount']===1&&e.result.matched===true))
  await action(enrolled.id,{action:'approve',reference:'synthetic-buoy-1712'});assert.equal((await run(enrolled.id)).status,'completed')
  const counts=Object.fromEntries([typed,segmentBook,stageBook,renewalBook,contractBook].map(b=>[b.id,1]));await app.scheduled();for(const [id,count]of Object.entries(counts))assert.equal((await api('/playbooks')).runs.filter(r=>r.playbook_id===id).length,count)
  console.log('PLAY-001 typed field/segment/lifecycle/renewal/confirmed-contract triggers deduplicate; authenticated usage recovery satisfies a persisted wait/branch after timeout retry.')
 }finally{await app.close()}
}

export async function playIntakeJourney(){
 const f=await playFixture(),{app,api,ownerId,create,run}=f
 try{
  const allowed=await create('synthetic-buoy-1750'),other=await create('synthetic-buoy-1751'),config=playConfig(ownerId,{name:'Scoped webhook enrollment',trigger:{kind:'webhook'},steps:[{id:'approve',kind:'approval',title:'Review server-originated follow-up'}]}),book=await api('/playbooks','POST',{config})
  const email='play-intake-admin@example.test';await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email,displayName:'Intake admin',role:'admin'}});const admin=await app.signIn(email)
  assert.equal((await app.request('/api/buoy/playbooks/'+book.id+'/credentials',{method:'POST',cookie:admin,body:{accountIds:[allowed]}})).status,403,'Only the owner delegates new intake authority')
  const credential=await api('/playbooks/'+book.id+'/credentials','POST',{accountIds:[allowed]})
  const send=(key,body={accountId:allowed,operationKey:'synthetic-buoy-1752'},extra={})=>app.dispatch(new Request(app.origin+'/api/buoy/playbooks/intake/'+book.id,{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json',...extra},body:JSON.stringify(body)}))
  assert.equal((await send('synthetic-buoy-1753')).status,401)
  assert.equal((await app.request('/api/buoy/state',{token:credential.secret})).status,401,'Intake authority grants no account reads or session fallback')
  assert.equal((await send(credential.secret,undefined,{origin:app.origin})).status,403,'A browser cannot bypass the authenticated server relay')
  assert.equal((await send(credential.secret,{accountId:other,operationKey:'synthetic-buoy-1754'})).status,403)
  let response=await send(credential.secret);assert.equal(response.status,202);const enrolled=await response.json();assert.equal((await run(enrolled.id)).status,'approval')
  response=await send(credential.secret);assert.equal(response.status,202);assert.equal((await response.json()).id,enrolled.id);assert.equal((await api('/playbooks')).runs.length,1)
  const current=await api('/playbooks/'+book.id+'/credentials');assert.ok(current.credentials[0].lastUsedAt);assert.ok(!JSON.stringify(current).includes(credential.secret),'Credential status has no plaintext secret')
  const audit=(await api('/audit?action=playbook.intake-issued')).entries;assert.ok(audit.some(e=>e.subject===credential.id));assert.ok(!JSON.stringify(audit).includes(credential.secret))
  // The limit is independent for each credential, and failed/over-scope intake also consumes its reservation.
  const limited=await api('/playbooks/'+book.id+'/credentials','POST',{accountIds:[allowed]}),buckets=new Map();let refused
  for(let i=0;i<121;i++){const r=await send(limited.secret,{accountId:allowed,operationKey:'synthetic-buoy-1752'}),bucket=r.headers.get('ratelimit-reset'),count=(buckets.get(bucket)??0)+1;buckets.set(bucket,count);assert.equal(r.headers.get('ratelimit-limit'),'60');assert.equal(Number(r.headers.get('ratelimit-remaining')),Math.max(0,60-count));if(r.status===429){refused=r;assert.equal(count,61);break}assert.equal(r.status,202)}
  assert.ok(refused,'One credential is refused on its 61st request in a server-reported UTC minute');assert.ok(Number(refused.headers.get('retry-after'))>0)
  assert.equal((await send(credential.secret)).status,202)
  await api('/playbooks/'+book.id+'/credentials/'+credential.id,'DELETE',{});assert.equal((await send(credential.secret)).status,401)
  const fresh=await api('/playbooks/'+book.id+'/credentials','POST',{accountIds:[allowed]});await api('/playbooks','POST',{id:book.id,revision:book.revision,config:{...config,name:'Reviewed later version'}});assert.equal((await send(fresh.secret)).status,401,'Publishing cannot silently expand an earlier delegation')
  assert.equal((await api('/playbooks')).runs.length,1);assert.equal((await api('/state')).tasks.length,0,'Webhook intake cannot approve sensitive steps')
  console.log('PLAY-001 webhook intake: owner-only delegation, server-only request, one version/account scope, no reads/approvals, atomic source replay, per-credential limits, last use, secret-free status/audit and immediate revocation passed.')
 }finally{await app.close()}
}

export async function playFieldJourney(){
 const f=await playFixture(),{app,api,ownerId,create,run,action}=f
 try{
  const accountId=await create('synthetic-buoy-1780'),entry=condition('id','eq',accountId)
  await api('/fields','POST',{key:'play_ready',label:'Other reviewed readiness',type:'boolean'})
  // Approved field steps preserve unrelated values and atomically refresh downstream health/branches.
  await api('/fields','POST',{key:'play_value',label:'Reviewed play value',type:'number'});await api('/fields','POST',{key:'play_untouched',label:'Unrelated retained value',type:'text'});await api('/fields','POST',{key:'play_twice',label:'Derived play value',type:'formula',formula:'custom.play_value * 2'})
  const putValues=async value=>api('/accounts/'+accountId+'/fields','PUT',{revision:(await api('/state')).accounts.find(a=>a.id===accountId).revision,values:{play_ready:true,play_value:value,play_untouched:'synthetic-buoy-1770'},source:'synthetic-buoy-1771'})
  await putValues(2)
  await api('/scorecards/publish','POST',{revision:null,config:{name:'Reviewed field health',measures:[{key:'value',name:'Play value',field:'custom.play_value',min:0,max:10,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]}})
  const fieldBook=await api('/playbooks','POST',{config:playConfig(ownerId,{name:'Reviewed field transition',entry,steps:[{id:'fields',kind:'fields',title:'Set reviewed value',values:{play_value:9}},{id:'branch',kind:'branch',title:'Use recalculated health',rules:condition('health.score','gte',75),next:2,otherwise:3},{id:'review',kind:'approval',title:'Review recalculated result'}]})}),fieldRun=await api('/playbooks/'+fieldBook.id+'/enroll','POST',{accountId,operationKey:'synthetic-buoy-1772'})
  assert.equal((await run(fieldRun.id)).status,'approval');assert.equal((await api('/fields')).accounts.find(a=>a.id===accountId).values.play_value,2)
  await putValues(3);const pending=await run(fieldRun.id),stale=await app.request('/api/buoy/playbook-runs/'+pending.id+'/action',{cookie:app.cookie,method:'POST',body:{revision:pending.revision,action:'approve',reference:'synthetic-buoy-1773'}});assert.equal(stale.status,409)
  await action(pending.id,{action:'review'});const reviewed=await run(pending.id);assert.deepEqual(reviewed.events.at(-1).result.changes.play_value,{before:3,after:9})
  const results=await Promise.all([0,1].map(()=>app.request('/api/buoy/playbook-runs/'+pending.id+'/action',{cookie:app.cookie,method:'POST',body:{revision:reviewed.revision,action:'approve',reference:'synthetic-buoy-1774'}})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409])
  const fields=await api('/fields'),values=fields.accounts.find(a=>a.id===accountId).values;assert.equal(values.play_value,9);assert.equal(values.play_twice,18);assert.equal(values.play_untouched,'synthetic-buoy-1770');assert.equal(fields.history.filter(h=>h.accountId===accountId&&h.key==='play_value'&&h.source==='Approved playbook step: synthetic-buoy-1774').length,1);assert.equal((await run(pending.id)).cursor,2,'The next branch reads freshly recalculated health')
  console.log('PLAY-001 reviewed field step: no mutation before approval, stale review, one concurrent winner, preserved unrelated data/formula history and freshly recalculated health branch passed.')
 }finally{await app.close()}
}
