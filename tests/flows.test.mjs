import {trustJourney,trustPrivacyJourney,trustUndoJourney} from './trust-journey.mjs'
import {portalJourney,portalWithdrawalJourney} from './portal-journey.mjs'
import {integrationJourney} from './integration-journey.mjs'
import {reviewJourney} from './review-journey.mjs'
import {dashboardJourney} from './dashboard-journey.mjs'
import {planAttainmentJourney,planAuthorityJourney,planCustodyJourney} from './plan-journey.mjs'
import {roleRenewalApprovalJourney} from './roles-renewal-approval.mjs'
import {roleReportsJourney} from './roles-reports.mjs'
import {roleAccountEditJourney} from './roles-account-edit.mjs'
import {roleWorkspaceJourney} from './roles-workspace.mjs'
import {roleConfigurationJourney,roleReadJourney,roleScopeJourney,roleIsolationJourney} from './roles-journey.mjs'
import {reportingJourney} from './reporting-journey.mjs'
import {playJourney,playTriggerJourney,playIntakeJourney,playFieldJourney,playChildJourney,playCalendarJourney} from './play-journey.mjs'
import {hierarchyJourney} from './hierarchy-journey.mjs'
import {workspaceJourney} from './workspace-journey.mjs'
import {forecastJourney} from './forecast-journey.mjs'
import {renewalJourney} from './renewal-journey.mjs'
import {eraseJourney} from './erase-journey.mjs'
import {searchHttpJourney} from './search-journey.mjs'
import {inappJourney} from './inapp-journey.mjs'
import {customerPeopleJourney} from './customer-people-journey.mjs'
import {usageJourney} from './usage-journey.mjs'
import {fieldJourney} from './field-journey.mjs'
import { importClient } from './import-door-client.mjs'
import { accountErasureJourney } from './import-door-journey.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { outcomeJourney } from './outcome-journey.mjs'
import { segmentJourney } from './segment-journey.mjs'
import { teamJourney } from './team-journey.mjs'
import { startWorker } from './worker.mjs'

const today=new Date().toISOString().slice(0,10)
const account=(id='harbour')=>({id,name:'Harbour Software',renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Signed order form section 4, approved by customer',billing:{observedAt:today,reference:'Nectar invoice INV-1042',currency:'AUD',totalMinor:120000,creditsMinor:10000,allocatedMinor:20000,dueDate:'2026-01-01'},support:{observedAt:today,reference:'Support case CS-42',openTickets:3,urgentTickets:1}})
test('Buoy public HTTP jobs and trust boundaries',async t=>{
 const worker=await startWorker(), {cookie,signIn,scheduled}=worker, seen=[]
 const request=(path,options={})=>{seen.push([options.method??'GET',path.split('?')[0]]);return worker.request(path,options)}
 const call=(path,method='GET',body,extra={})=>request('/api/buoy'+path,{method,body,cookie,...extra})
 async function json(response,status=200){assert.equal(response.status,status,await response.clone().text());return response.json()}
 let member,token,proposal,task
 try {
  await t.test('AUDIT-001 bootstrap and email-link sign-ins record an opaque actor; unauthenticated data refusal and CSRF',async()=>{
   assert.equal((await request('/api/buoy/state')).status,401)
   assert.equal((await call('/accounts','POST',account(),{headers:{origin:'https://other.invalid'}})).status,403)
   assert.equal((await request('/__dev/outbox')).status,404)
   const signedIn=await signIn('owner@example.test')
   assert.equal((await request('/api/buoy/state',{cookie:signedIn})).status,200)
   const signins=(await json(await call('/audit?action=auth.signed-in'))).entries
   assert.equal(signins.length,2,'AUDIT-001 the bootstrap door and the email link each record a sign-in')
   for(const entry of signins){assert.match(entry.actor,/^person:[0-9a-f-]+$/);assert.equal(entry.subject,entry.actor);assert.equal(entry.actor,signins[0].actor);assert.equal(entry.detail,'native session issued');assert.ok(Date.parse(entry.occurredAt))}
   assert.doesNotMatch(JSON.stringify(signins),/owner@example|Harbour CS owner/)
  })
  await t.test('billing evidence, renewal date and honest unknown health',async()=>{
   await json(await call('/accounts','POST',account()),201)
   const a=(await json(await call('/state'))).accounts[0]
   assert.equal(a.health.status,'at-risk');assert.match(a.health.reasons.join(' '),/900\.00/)
   assert.equal(a.noticeDate,'2027-03-01')
   await json(await call('/accounts','POST',{...account('unknown'),billing:null,support:null}),201)
   const unknown=(await json(await call('/state'))).accounts.find(a=>a.id==='unknown')
   assert.equal(unknown.health.status,'unknown')
   assert.equal((await call('/accounts','POST',{...account('bad-money'),billing:{...account().billing,creditsMinor:200000}})).status,400)
   assert.equal((await call('/accounts','POST',{...account('bad-date'),renewalDate:'2027-02-30'})).status,400)
  })
  await t.test('members can prepare but cannot change accounts or approve',async()=>{
   await json(await request('/auth/invite',{method:'POST',cookie,body:{email:'member@example.test',displayName:'CS colleague',role:'member'}}),202)
   member=await signIn('member@example.test')
   assert.equal((await call('/accounts','POST',account('denied'),{cookie:member})).status,403)
   proposal=await json(await call('/proposals','POST',{accountId:'harbour',kind:'playbook',payload:{title:'Review incident with customer',dueDate:'2027-02-01'}},{cookie:member}),201)
   assert.equal((await call(`/proposals/${proposal.id}/approve`,'POST',{}, {cookie:member})).status,403)
  })
  await t.test('approval is durable and idempotent, completed work needs evidence',async()=>{
   await json(await call(`/proposals/${proposal.id}/approve`,'POST',{}))
   await json(await call(`/proposals/${proposal.id}/approve`,'POST',{}))
   const data=await json(await call('/state'));assert.equal(data.tasks.length,1);task=data.tasks[0]
   assert.match(data.proposals[0].approvedBy,/person:/);assert.ok(data.proposals[0].approvedAt)
   assert.equal((await call(`/tasks/${task.id}/complete`,'POST',{evidence:''})).status,400)
   await json(await call(`/tasks/${task.id}/complete`,'POST',{outcome:'Incident resolved with the customer',evidence:'Customer meeting minutes 2027-01-15; incident resolved.'}))
   assert.ok((await json(await call('/state'))).tasks[0].completedAt)
  })
  await t.test('agents prepare decisions, cannot approve; revoked tokens stop',async()=>{
   await json(await call('/agents'))
   await json(await call('/agents/settings','PUT',{disabled:false}))
   token=await json(await call('/agent-tokens','POST',{label:'Renewal assistant'}),201)
   const prepared=await json(await call('/commands','POST',{command:'renewal.prepare',input:{accountId:'harbour',payload:{outcome:'renewed',reason:'Customer accepted renewal',evidence:'Signed renewal order R-17'}}},{token:token.token}),201)
   assert.equal((await call(`/proposals/${prepared.id}/approve`,'POST',{}, {token:token.token})).status,403)
   await json(await call(`/proposals/${prepared.id}/approve`,'POST',{}))
   const decisions=(await json(await call('/state'))).decisions
   assert.equal(decisions.length,1);assert.equal(decisions[0].outcome,'renewed');assert.equal(decisions[0].evidence,'Signed renewal order R-17')
   await json(await call(`/agent-tokens/${token.id}`,'DELETE'))
   assert.equal((await call('/commands','POST',{command:'renewals.list'},{token:token.token})).status,401)
  })
  await t.test('a source refresh invalidates prepared approvals',async()=>{
   const draft=await json(await call('/proposals','POST',{accountId:'harbour',kind:'renewal',payload:{outcome:'deferred',reason:'Awaiting signature',evidence:'Customer email E-8'}}),201)
   const before=(await json(await call('/state'))).accounts.find(a=>a.id==='harbour')
   await json(await call('/accounts/harbour','PUT',{...account(),renewalDate:'2027-04-30',revision:before.revision}))
   assert.equal((await call(`/proposals/${draft.id}/approve`,'POST',{})).status,409)
   assert.equal((await json(await call('/state'))).decisions[0].renewalDate,'2027-03-31','earlier decision evidence keeps original date')
  })
  const door=importClient(request,cookie)
 let imported
  await t.test('IMPORT-001 shared door no-write planning, review binding, idempotent apply, reconcile and strict undo',async()=>{
   const upload={accounts:[account('move-one')]}
   const plan=await door.plan(upload)
   assert.equal((await json(await call('/state'))).accounts.length,2)
   assert.equal((await door.send('apply',{planId:plan.planId,reviewedFingerprint:'0'.repeat(64)})).status,403)
   const input={planId:plan.planId,reviewedFingerprint:plan.fingerprint}
   imported=await door.apply(plan);assert.equal(imported.state,'completed')
   const replay=await door.apply(plan);assert.equal(replay.id,imported.id)
   assert.equal((await call(`/imports/${imported.id}/undo`,'POST',{})).status,409,'IMPORT-001 the legacy undo route refuses door jobs')
   const report=await door.json('reconcile',{planId:plan.planId});assert.equal(report.ok,true);assert.equal(report.counts.present,1)
   const undone=await door.undo(plan);assert.equal(undone.state,'undone')
   assert.ok(!(await json(await call('/state'))).accounts.some(a=>a.id==='move-one'))
  })
  await t.test('IMPORT-001 ERASE-001 door undo preserves dependent work and owner erasure withdraws door custody',async()=>{
   await accountErasureJourney({request,cookie,member,account})
  })
  await t.test('server-rendered work screens and unknown paths',async()=>{
   for(const path of ['/app','/app/accounts/harbour','/app/imports','/app/backups']){
    const response=await request(path,{cookie});assert.equal(response.status,200);assert.match(await response.text(),/Buoy/)
   }
   assert.equal((await request('/app/no-such-page',{cookie})).status,404)
  })
  await t.test('HEALTH-002 CSM sentiment feeds health as a dated judgment and expires to missing',async()=>{
   const calm={...account('calm'),name:'Calm Ledger',billing:{...account().billing,allocatedMinor:110000},support:{...account().support,urgentTickets:0}}
   await json(await call('/accounts','POST',calm),201)
   const read=async()=>(await json(await call('/state'))).accounts.find(a=>a.id==='calm').health
   assert.equal((await read()).status,'healthy');assert.equal((await read()).sentiment,null)
   const playbook={accountId:'calm',kind:'playbook',payload:{title:'Executive check-in',dueDate:'2027-02-01'}}
   assert.equal((await call('/proposals','POST',playbook)).status,409)
   assert.equal((await call('/accounts/calm/sentiment','POST',{rating:'purple',reason:'x'},{cookie:member})).status,400)
   assert.equal((await call('/accounts/calm/sentiment','POST',{rating:'red',reason:'Sponsor left',days:91},{cookie:member})).status,400)
   const agent=await json(await call('/agent-tokens','POST',{label:'Sentiment probe'}),201)
   assert.equal((await call('/accounts/calm/sentiment','POST',{rating:'red',reason:'Agent guess',days:7},{cookie:undefined,token:agent.token})).status,403)
   await json(await call(`/agent-tokens/${agent.id}`,'DELETE'))
   const recorded=await json(await call('/accounts/calm/sentiment','POST',{rating:'red',reason:'Executive sponsor left; renewal call cancelled',days:7},{cookie:member}),201)
   const expiresOn=recorded.sentiment.expiresOn, usExpiry=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(`${expiresOn}T00:00:00Z`)).replace(/,(?= \w{3} )/,''), after=new Date(Date.parse(expiresOn)+86400000).toISOString().slice(0,10)
   const now=await read();assert.equal(now.status,'at-risk')
   assert.match(now.reasons.join(' '),new RegExp(`Red CSM sentiment — CS colleague’s judgment, not source data, counting through ${usExpiry}: Executive sponsor left`))
   assert.deepEqual({rating:now.sentiment.rating,by:now.sentiment.by,expired:now.sentiment.expired},{rating:'red',by:'CS colleague',expired:false})
   const page=await (await request('/app/accounts/calm',{cookie})).text()
   assert.match(page,/CSM sentiment<\/h3><p>A person’s judgment, not source data\. Counts through/);assert.match(page,/Executive sponsor left/)
   await json(await call('/proposals','POST',playbook),201)
   assert.equal((await json(await call(`/accounts/calm/health?on=${expiresOn}`))).health.status,'at-risk','the rating counts through its expiry date')
   const lapsed=(await json(await call(`/accounts/calm/health?on=${after}`))).health
   assert.equal(lapsed.status,'healthy');assert.equal(lapsed.sentiment.expired,true)
   assert.match(lapsed.reasons.join(' '),new RegExp(`CSM sentiment from CS colleague expired after ${usExpiry}; the sentiment measure is missing`))
   assert.equal((await call('/accounts/calm/health?on=2020-01-01')).status,400)
  })
  await t.test('DATA-001 observations are validated in any ISO 4217 currency and staleness is set per source',async()=>{
   const daysAgo=n=>new Date(Date.now()-n*86400000).toISOString().slice(0,10)
   const refused=async(body,pattern)=>{const r=await call('/accounts','POST',body);assert.equal(r.status,400);assert.match((await r.json()).error,pattern)}
   await refused({...account('neg'),billing:{...account().billing,totalMinor:-1}},/totalMinor must be a nonnegative whole number/)
   await refused({...account('nodate'),billing:{...account().billing,observedAt:'2026-02-30'}},/observedAt must be a real date/)
   await refused({...account('extra'),billing:{...account().billing,taxMinor:5}},/billing\.taxMinor is not supported/)
   for(const currency of ['ABC','XAU','usd'])await refused({...account('cur'),billing:{...account().billing,currency}},/ISO 4217 currency code/)
   const kwd={...account('kwd'),name:'Gulf Freight',billing:{...account().billing,currency:'KWD',totalMinor:1500,creditsMinor:0,allocatedMinor:0},support:{...account().support,urgentTickets:0}}
   const jpy={...account('jpy'),name:'Osaka Works',billing:{...account().billing,currency:'JPY',totalMinor:120000,creditsMinor:0,allocatedMinor:0},support:{...account().support,urgentTickets:0}}
   const stale={...account('stale'),name:'Quiet Mills',billing:{...account().billing,observedAt:daysAgo(45),allocatedMinor:110000},support:{...account().support,observedAt:daysAgo(45),urgentTickets:0}}
   for(const a of [kwd,jpy,stale])await json(await call('/accounts','POST',a),201)
   const accounts=async()=>Object.fromEntries((await json(await call('/state'))).accounts.map(a=>[a.id,a]))
   let now=await accounts()
   assert.match(now.kwd.health.reasons[0],/^KWD 1\.500 overdue in Nectar invoice INV-1042\.$/);assert.match(now.jpy.health.reasons[0],/^JPY 120000 overdue/)
   assert.equal(now.stale.health.status,'unknown')
   assert.deepEqual(now.stale.health.reasons.slice(0,2),['Billing evidence is older than 30 days.','Support evidence is older than 30 days.'])
   assert.deepEqual(now.stale.health.evidence.map(e=>[e.kind,e.sourceSystem,e.staleAfterDays,e.stale]),[['billing','manual',30,true],['support','manual',30,true]])
   assert.match(await (await request('/app/accounts/stale',{cookie})).text(),/<dt>Source system<\/dt><dd>Manual snapshot<\/dd><dt>Freshness<\/dt><dd><strong>Stale<\/strong>: older than 30 days/)
   assert.equal((await call('/settings/staleness','PUT',{billingDays:60,supportDays:60},{cookie:member})).status,403)
   assert.equal((await call('/settings/staleness','PUT',{billingDays:0,supportDays:60})).status,400)
   await json(await call('/settings/staleness','PUT',{billingDays:60,supportDays:20}))
   now=await accounts()
   assert.deepEqual(now.stale.health.evidence.map(e=>[e.staleAfterDays,e.stale]),[[60,false],[20,true]])
   assert.deepEqual(now.stale.health.reasons,['Support evidence is older than 20 days.'])
   await json(await call('/settings/staleness','PUT',{billingDays:60,supportDays:60}))
   assert.equal((await accounts()).stale.health.status,'healthy')
   const before=(await accounts()).kwd, draft=await json(await call('/proposals','POST',{accountId:'kwd',kind:'renewal',payload:{outcome:'renewed',reason:'Paid',evidence:'Receipt R-9'}}),201)
   await json(await call('/accounts/kwd','PUT',{...kwd,billing:{...kwd.billing,allocatedMinor:1500},revision:before.revision}))
   assert.equal((await json(await call('/state'))).proposals.find(p=>p.id===draft.id).snapshot.billing.allocatedMinor,0,'earlier work keeps the earlier revision')
   assert.equal((await call(`/proposals/${draft.id}/approve`,'POST',{})).status,409)
  })
  await t.test('BOUNDARY-004 agent commercial changes are refused with their reason and recorded; mail is single-recipient team mail',async()=>{
   const agent=await json(await call('/agent-tokens','POST',{label:'Discount probe'}),201), as={cookie:undefined,token:agent.token}
   const before=(await json(await call('/state'))).accounts.find(a=>a.id==='harbour')
   const attempts=[
    [await call('/commands','POST',{command:'renewal.prepare',input:{accountId:'harbour',payload:{outcome:'renewed',reason:'Offer 20% off to close',evidence:'Agent draft',discountPercent:20}}},as),403,'account harbour',/^Agents cannot set discountPercent\. A preparation carries only outcome, reason, evidence; prices, discounts and other commercial terms change only by a person/],
    [await call('/commands','POST',{command:'renewal.discount',input:{accountId:'harbour',percent:20}},as),400,'command renewal.discount',/^Unknown command\. Agents can prepare; people approve\.$/],
    [await call('/accounts/harbour','PUT',{...account(),renewalDate:'2028-03-31',revision:before.revision},as),403,'PUT /api/buoy/accounts/harbour',/^Agents can only use the preparation commands\.$/]]
   for(const [response,status,,reason] of attempts){assert.equal(response.status,status);assert.match((await response.json()).error,reason)}
   const after=(await json(await call('/state'))).accounts.find(a=>a.id==='harbour')
   assert.equal(after.revision,before.revision,'no term changed');assert.ok(!(await json(await call('/state'))).proposals.some(p=>p.payload.reason==='Offer 20% off to close'))
   assert.equal((await call('/audit','GET',undefined,{cookie:member})).status,403)
   const recorded=(await json(await call('/audit'))).entries.filter(e=>e.actor===`agent:${agent.id}`&&e.action==='agent.refused')
   assert.equal((await json(await call('/audit?actor='+agent.id+'&action=agent.requested'))).entries.length,3,'GOVERN-001 AUDIT-001 every authenticated request, including another route, records its attempt separately from refusal');
   assert.deepEqual(recorded.map(e=>e.action),['agent.refused','agent.refused','agent.refused']);for(const e of recorded)assert.equal(e.actor,`agent:${agent.id}`,'AUDIT-001 retains the agent id without its display name')
   for(const [,,subject,reason] of attempts){const entry=recorded.find(e=>e.subject===subject);assert.ok(entry,`${subject} is recorded`);assert.match(entry.detail,reason);assert.ok(Date.parse(entry.occurredAt))}
   await json(await call(`/agent-tokens/${agent.id}`,'DELETE'))
   // NOTIFY-001 adds internal notices. Every message still has one team recipient;
   // sign-in mail still contains its ordinary confirmation door.
   const people=await json(await request('/auth/operators',{cookie})), emails=people.map(p=>p.email)
   assert.ok(worker.mails.length);for(const mail of worker.mails){assert.equal([mail.to].flat().length,1);assert.ok(emails.includes([mail.to].flat()[0]));if(mail.subject.startsWith('Buoy:'))assert.match(mail.html,/\/app\/accounts\//);else assert.match(mail.html,/\/auth\/confirm\?token=/)}
  })
  await t.test('AUDIT-001 admins search recorded actions with inclusive UTC dates and stable pages',async()=>{
   const agent=await json(await call('/agent-tokens','POST',{label:'Audit desk <script>alert(1)</script>'}),201), as={cookie:undefined,token:agent.token}
   for(let i=0;i<52;i++)assert.equal((await call('/commands','POST',{command:`audit-probe-${String(i).padStart(2,'0')}`},as)).status,400)
   const filters=`actor=${encodeURIComponent(agent.id)}&action=AGENT.REFUSED&subject=command%20AUDIT-probe&since=${today}&until=${today}`
   const first=await json(await call('/audit?'+filters))
   assert.equal(first.entries.length,50);assert.equal(first.nextOffset,50)
   for(const entry of first.entries){assert.match(entry.actor,new RegExp(agent.id));assert.equal(entry.action,'agent.refused');assert.match(entry.subject,/^command audit-probe-\d{2}$/);assert.equal(entry.occurredAt.slice(0,10),today)}
   const last=await json(await call('/audit?'+filters+'&offset='+first.nextOffset))
   assert.equal(last.entries.length,2);assert.equal(last.nextOffset,null)
   assert.equal(new Set([...first.entries,...last.entries].map(e=>e.id)).size,52)
   assert.deepEqual([...first.entries,...last.entries].map(e=>e.occurredAt),[...first.entries,...last.entries].map(e=>e.occurredAt).sort().reverse())
   assert.equal((await json(await call('/audit?'+filters.replace('action=AGENT.REFUSED','action=missing')))).entries.length,0)
   assert.equal((await json(await call('/audit?actor='+encodeURIComponent(agent.id)+'&subject=%25'))).entries.length,0,'percent is literal, not a wildcard')
   const tomorrow=new Date(Date.parse(today)+86400000).toISOString().slice(0,10)
   assert.equal((await json(await call('/audit?'+filters.replace(`since=${today}&until=${today}`,`since=${tomorrow}`)))).entries.length,0)
   for(const query of ['since=2026-02-30','since=2027-01-02&until=2027-01-01','offset=-1','offset=1.5','actor='+ 'a'.repeat(201)])assert.equal((await call('/audit?'+query)).status,400)
   const page=await request('/app/audit?'+filters,{cookie});assert.equal(page.status,200)
   const html=await page.text();assert.match(html,/Audit entries/);assert.match(html,/audit-probe-/);assert.match(html,/Next entries/);assert.doesNotMatch(html,/<script>alert/)
   assert.equal((await request('/app/audit',{cookie:member})).status,403)
   assert.equal((await request('/app/audit?since=bad',{cookie})).status,400)
   assert.match(await (await request('/app/audit?action=missing',{cookie})).text(),/No recorded actions match/)
   assert.equal((await call('/audit','GET',undefined,as)).status,403)
   await json(await request('/auth/invite',{method:'POST',cookie,body:{email:'admin@example.test',displayName:'CS administrator',role:'admin'}}),202)
   const admin=await signIn('admin@example.test')
   assert.equal((await request('/app/audit?'+filters,{cookie:admin})).status,200)
   assert.deepEqual((await json(await call('/audit?'+filters,'GET',undefined,{cookie:admin}))).entries,first.entries)
   await json(await call(`/agent-tokens/${agent.id}`,'DELETE'))
  })
  await t.test('AUDIT-001 approvals and agent preparation survive erasure without subject or actor names',async()=>{
   const privateId='joan-example-person', name='Joan Example LLC', path='/accounts/'+encodeURIComponent(privateId)
   await json(await call('/accounts','POST',{...account(privateId),name}),201)
   const created=(await json(await call('/audit?action=account.created'))).entries[0]
   assert.match(created.subject,/^[0-9a-f]{32}$/)
   const subject=created.subject, read=async()=>(await json(await call('/audit?subject='+subject))).entries
   const agent=await json(await call('/agent-tokens','POST',{label:'Joan Example assistant'}),201), as={cookie:undefined,token:agent.token}
   const prepared=await json(await call('/commands','POST',{command:'renewal.prepare',input:{accountId:privateId,payload:{outcome:'renewed',reason:'Confirmed renewal',evidence:'Signed renewal order R-18'}}},as),201)
   await json(await call(`/proposals/${prepared.id}/approve`,'POST',{}))
   await json(await call(`/proposals/${prepared.id}/approve`,'POST',{}))
   assert.equal((await read()).filter(e=>e.action==='renewal.approved').length,1,'approval replay adds no audit action')
   const before=await read()
   assert.equal((await call(path,'PUT',{...account(privateId),name,revision:'outdated'})).status,409)
   assert.deepEqual(await read(),before,'a failed transaction adds no audit action')
   assert.equal((await call(path,'PUT',{},as)).status,403)
   assert.equal((await call(path,'DELETE',{confirmation:name},{cookie:member})).status,403)
   await json(await call(path,'DELETE',{confirmation:name}))
   const retained=await read()
   assert.deepEqual(retained.map(e=>e.action).sort(),['account.created','account.erased','agent.refused','renewal.approved','renewal.prepared'])
   for(const entry of retained){assert.match(entry.actor,/^(person|agent):[0-9a-f-]+$/);assert.ok(Date.parse(entry.occurredAt));assert.equal(entry.subject,subject)}
   assert.doesNotMatch(JSON.stringify(retained),/Joan|joan|example.test|Harbour CS owner/)
   assert.deepEqual((await json(await call('/audit?actor='+agent.id))).entries.filter(e=>e.action==='agent.refused'),retained.filter(e=>e.action==='agent.refused'))
   assert.ok(!(await json(await call('/state'))).accounts.some(a=>a.id===privateId))
   await json(await call(`/agent-tokens/${agent.id}`,'DELETE'))
  })
  await t.test('AUDIT-001 invitations, role and status changes record actor, person and change; refused or unchanged ones add nothing',async()=>{
   const owner=(await json(await call('/audit?action=auth.signed-in'))).entries.at(-1).actor
   const operators=async()=>json(await request('/auth/operators',{cookie}))
   const access=(path,body,as=cookie)=>request(path,{method:'POST',cookie:as,body})
   await json(await access('/auth/invite',{email:'analyst@example.test',displayName:'Ana Lyst',role:'member'}),202)
   await json(await access('/auth/invite',{email:'pending@example.test',displayName:'Pen Ding',role:'member'}),202)
   const analystSession=await signIn('analyst@example.test')
   const people=await operators(), analyst=people.find(p=>p.email==='analyst@example.test'), pending=people.find(p=>p.email==='pending@example.test')
   const read=async id=>(await json(await call('/audit?subject=person:'+id))).entries
   assert.deepEqual((await read(analyst.id)).map(e=>[e.action,e.actor,e.detail]),[['auth.signed-in','person:'+analyst.id,'native session issued'],['auth.invited',owner,'invited as member']],'AUDIT-001 an accepted invitation is a recorded sign-in')
   assert.equal((await access('/auth/operator/role',{operatorId:analyst.id,role:'admin'},member)).status,403)
   await json(await access('/auth/operator/role',{operatorId:analyst.id,role:'admin'}))
   await json(await access('/auth/operator/role',{operatorId:analyst.id,role:'admin'}))
   await json(await access('/auth/operator/status',{operatorId:analyst.id,status:'inactive'}))
   assert.equal((await request('/api/buoy/state',{cookie:analystSession})).status,401)
   await json(await access('/auth/operator/status',{operatorId:analyst.id,status:'active'}))
   await json(await access('/auth/invite/cancel',{operatorId:pending.id}))
   const changes=(await read(analyst.id)).filter(e=>e.action!=='auth.signed-in'&&e.action!=='auth.invited')
   assert.deepEqual(changes.map(e=>[e.action,e.detail]),[['auth.status-changed','inactive -> active'],['auth.status-changed','active -> inactive'],['auth.role-changed','member -> admin']])
   for(const entry of changes){assert.equal(entry.actor,owner);assert.equal(entry.subject,'person:'+analyst.id);assert.ok(Date.parse(entry.occurredAt))}
   assert.deepEqual((await read(pending.id)).map(e=>[e.action,e.actor,e.detail]),[['auth.invitation-cancelled',owner,'invited -> inactive'],['auth.invited',owner,'invited as member']])
   assert.doesNotMatch(JSON.stringify([...await read(analyst.id),...await read(pending.id)]),/example\.test|Ana Lyst|Pen Ding/)
   assert.match(await (await request('/app/audit?action=auth.role-changed',{cookie})).text(),/member -&gt; admin/)
  })
  await t.test('AUDIT-001 agent reads and invalid commands record attempts without claiming outcomes',async()=>{
   const agent=await json(await call('/agent-tokens','POST',{label:'Portfolio assistant'}),201), as={cookie:undefined,token:agent.token}
   await json(await call('/commands','GET',undefined,as))
   const data=await json(await call('/commands','POST',{command:'renewals.list'},as));assert.ok(data.accounts.some(a=>a.id==='harbour'))
   assert.equal((await call('/commands','POST',[],as)).status,400)
   assert.equal((await call('/commands','POST',{command:'renewal.<script>alert(1)</script>'},as)).status,400)
   const read=async()=>(await json(await call('/audit?actor='+agent.id+'&action=agent.requested'))).entries
   const attempts=await read();assert.equal(attempts.length,4)
   for(const row of attempts){assert.equal(row.actor,`agent:${agent.id}`);assert.equal(row.subject,`agent:${agent.id}`);assert.ok(Date.parse(row.occurredAt));assert.match(row.detail,/^(GET|POST) commands request received; outcome not recorded\.$/)}
   assert.equal(attempts.filter(row=>row.detail.startsWith('GET')).length,1)
   assert.equal(attempts.filter(row=>row.detail.startsWith('POST')).length,3)
   assert.doesNotMatch(JSON.stringify(attempts),/Portfolio|Bearer|Harbour/)
   const page=await (await request('/app/audit?actor='+agent.id,{cookie})).text()
   assert.match(page,/&lt;script&gt;alert/);assert.doesNotMatch(page,/<script>alert/)
   await json(await call(`/agent-tokens/${agent.id}`,'DELETE'))
   assert.equal((await call('/commands','POST',{command:'renewals.list'},as)).status,401)
   assert.deepEqual(await read(),attempts,'a revoked credential cannot confer an audit actor identity')
   await json(await call(`/agent-tokens/${agent.id}`,'DELETE'))
   const owner=(await json(await call('/audit?action=auth.signed-in'))).entries.at(-1).actor
   const custody=(await json(await call('/audit?subject=agent:'+agent.id))).entries.filter(e=>e.action.startsWith('agent.credential'))
   assert.deepEqual(custody.map(e=>[e.action,e.actor]),[['agent.credential-revoked',owner],['agent.credential-issued',owner]],'AUDIT-001 issuing and the first revocation are recorded; a repeat adds nothing')
   assert.match(custody[1].detail,/^expires \d{4}-\d{2}-\d{2}T/);assert.doesNotMatch(JSON.stringify(custody),/Portfolio/)
  })
  await t.test('PLAY-002 owners, priority and type; reminders in-app and by email; escalation; reassignment; away cover; outcome',async()=>{
   // Task days are dates in the installation's time zone: pick one where it is now about noon.
   // The setting stores the canonical IANA name, so offset 0 is named UTC (Etc/GMT would be stored, and returned, as UTC).
   const zoneAt=hour=>{const offset=((hour-new Date().getUTCHours()+36)%24)-12;return [offset===0?'UTC':`Etc/GMT${offset>0?'-':'+'}${Math.abs(offset)}`,new Date(Date.now()+offset*3600000).toISOString().slice(0,10)]}
   const [zone,local]=zoneAt(12), [night]=zoneAt(3)
   const day=n=>new Date(Date.parse(local)+n*86400000).toISOString().slice(0,10)
   for(const [email,displayName] of [['casey@example.test','Casey CSM'],['blair@example.test','Blair CSM'],['morgan@example.test','Morgan Manager']])await json(await request('/auth/invite',{method:'POST',cookie,body:{email,displayName,role:'member'}}),202)
   const casey=await signIn('casey@example.test');await signIn('blair@example.test');const morgan=await signIn('morgan@example.test')
   const people=await json(await request('/auth/operators',{cookie})), idOf=email=>people.find(p=>p.email===email).id
   const [A,B,M]=['casey','blair','morgan'].map(name=>idOf(`${name}@example.test`))
   assert.equal((await call('/accounts/harbour/owner','PUT',{ownerId:A},{cookie:member})).status,403)
   assert.equal((await call(`/people/${A}/manager`,'PUT',{managerId:M},{cookie:member})).status,403)
   assert.equal((await call('/settings/tasks','PUT',{remindDaysBefore:1,escalateAfterDays:2,timeZone:zone},{cookie:member})).status,403)
   await json(await call('/accounts/harbour/owner','PUT',{ownerId:A}))
   await json(await call(`/people/${A}/manager`,'PUT',{managerId:M}))
   assert.equal((await call(`/people/${A}/manager`,'PUT',{managerId:A})).status,400)
   for(const bad of [{remindDaysBefore:0,escalateAfterDays:2},{remindDaysBefore:1,escalateAfterDays:31},{remindDaysBefore:1,escalateAfterDays:2,quiet:true},{remindDaysBefore:1,escalateAfterDays:2,timeZone:'Mars/Olympus'}])assert.equal((await call('/settings/tasks','PUT',bad)).status,400)
   await json(await call('/settings/tasks','PUT',{remindDaysBefore:1,escalateAfterDays:2,timeZone:night}))
   const create=async(title,dueDate,extra={})=>{const p=await json(await call('/proposals','POST',{accountId:'harbour',kind:'playbook',payload:{title,dueDate,...extra}}),201);await json(await call(`/proposals/${p.id}/approve`,'POST',{}));return (await json(await call('/state'))).tasks.find(t=>t.proposalId===p.id)}
   assert.equal((await call('/proposals','POST',{accountId:'harbour',kind:'playbook',payload:{title:'x',dueDate:local,priority:'someday'}})).status,400)
   assert.equal((await call('/proposals','POST',{accountId:'harbour',kind:'playbook',payload:{title:'x',dueDate:local,type:'chore'}})).status,400)
   const soon=await create('PLAY-002 renewal prep call',day(1),{priority:'high',type:'renewal'})
   const due=await create('PLAY-002 usage recap',local)
   const late=await create('PLAY-002 resolve escalated ticket',day(-1),{priority:'urgent'})
   const kept=await create('PLAY-002 executive sponsor intro',day(5),{ownerId:M,type:'expansion'})
   assert.deepEqual([soon.ownerId,soon.priority,soon.type],[A,'high','renewal'],'the account owner owns a task by default')
   assert.deepEqual([due.ownerId,due.priority,due.type,late.priority,kept.ownerId],[A,'medium','risk','urgent',M])
   const mailsFor=email=>worker.mails.filter(m=>[m.to].flat().includes(email)&&/PLAY-002/.test(m.subject)&&/^(Due |Escalated,)/.test(m.subject))
   const inbox=async as=>(await json(await call('/state','GET',undefined,{cookie:as}))).notifications.filter(n=>/PLAY-002/.test(n.title))
   await scheduled()
   assert.deepEqual(await inbox(casey),[],'before 8 am in the installation time zone no reminder is recorded')
   assert.equal((await json(await call('/settings/tasks','PUT',{remindDaysBefore:1,escalateAfterDays:2,timeZone:zone}))).tasks.timeZone,zone)
   await scheduled()
   assert.deepEqual((await inbox(casey)).map(n=>[n.kind,n.title]).sort(),[['due-soon','PLAY-002 renewal prep call'],['due-today','PLAY-002 usage recap']],'reminders before and on the due date arrive in-app')
   for(const n of await inbox(casey)){assert.equal(n.email,'accepted');assert.equal(n.emailLabel,'Email accepted by the mail provider');assert.equal(n.accountName,'Harbour Software')}
   assert.deepEqual(mailsFor('casey@example.test').map(m=>m.subject).sort(),[`Due ${new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(day(1)+'T00:00:00Z')).replace(/,(?= \w{3} )/,'')}: PLAY-002 renewal prep call`,'Due today: PLAY-002 usage recap'],'and by email, one recipient each')
   for(const m of mailsFor('casey@example.test')){assert.equal([m.to].flat().length,1);assert.match(m.text,/Harbour Software/);assert.match(m.text,/\/app\/accounts\/harbour#tasks/)}
   assert.deepEqual(await inbox(morgan),[],'one day overdue is inside the two-day escalation delay')
   await json(await call('/settings/tasks','PUT',{remindDaysBefore:1,escalateAfterDays:1,timeZone:zone}))
   await scheduled();await scheduled()
   assert.deepEqual((await inbox(morgan)).map(n=>[n.kind,n.title]),[['escalated','PLAY-002 resolve escalated ticket']],'the overdue task escalates to the owner’s manager once the delay has passed')
   assert.equal(mailsFor('morgan@example.test').length,1);assert.match(mailsFor('morgan@example.test')[0].text,/Casey CSM's task for Harbour Software was due .* escalated to you as their manager/)
   assert.equal((await inbox(casey)).length,2,'repeated runs add no duplicate');assert.equal(mailsFor('casey@example.test').length,2)
   await json(await call('/accounts/harbour/owner','PUT',{ownerId:B}))
   let tasks=(await json(await call('/state'))).tasks
   assert.deepEqual([soon,due,late,kept].map(x=>tasks.find(t=>t.id===x.id).ownerId),[B,B,B,M],'reassignment moves the previous owner’s open tasks; another owner’s task stays')
   assert.equal((await json(await call('/state'))).accounts.find(a=>a.id==='harbour').ownerId,B)
   assert.equal((await call(`/people/${B}/away`,'POST',{coverId:A,startsOn:local,endsOn:day(1)},{cookie:member})).status,403)
   assert.equal((await call(`/people/${B}/away`,'POST',{coverId:B,startsOn:local,endsOn:day(1)})).status,400)
   assert.equal((await call(`/people/${B}/away`,'POST',{coverId:A,startsOn:day(2),endsOn:day(1)})).status,400)
   await json(await call(`/people/${B}/away`,'POST',{coverId:A,startsOn:local,endsOn:day(1)}),201)
   assert.equal((await call(`/people/${B}/away`,'POST',{coverId:M,startsOn:day(1),endsOn:day(3)})).status,409)
   const handlers=async on=>Object.fromEntries((await json(await call('/tasks?on='+on))).tasks.filter(t=>[soon.id,kept.id].includes(t.id)).map(t=>[t.id,[t.ownerId,t.handlerId]]))
   assert.deepEqual(await handlers(day(-1)),{[soon.id]:[B,B],[kept.id]:[M,M]})
   for(const on of [local,day(1)])assert.deepEqual(await handlers(on),{[soon.id]:[B,A],[kept.id]:[M,M]},'the cover handles the away person’s tasks for the away period')
   assert.deepEqual(await handlers(day(2)),{[soon.id]:[B,B],[kept.id]:[M,M]},'and they return the day after it')
   const fresh=await create('PLAY-002 away-week check-in',day(1))
   assert.equal(fresh.ownerId,B);assert.equal(fresh.handlerId,A)
   await scheduled()
   assert.ok((await inbox(casey)).some(n=>n.kind==='due-soon'&&n.title==='PLAY-002 away-week check-in'),'while Blair is away the reminder goes to the cover')
   assert.equal(mailsFor('blair@example.test').length,0)
   const home=await (await request('/app',{cookie:casey})).text()
   assert.match(home,/Your reminders/);assert.match(home,/Due today<\/strong>: <a href="\/app\/accounts\/harbour#tasks">PLAY-002 usage recap<\/a> for Harbour Software/)
   const page=await (await request('/app/accounts/harbour',{cookie})).text()
   assert.match(page,/Urgent priority · Risk · Owner Blair CSM/);assert.match(page,/Owner Blair CSM · Covered today by Casey CSM/)
   assert.equal((await call(`/tasks/${soon.id}/complete`,'POST',{evidence:'Call notes CN-4'})).status,400,'completion needs an outcome reason')
   await json(await call(`/tasks/${soon.id}/complete`,'POST',{outcome:'Renewal terms confirmed on the call',evidence:'Call notes CN-4'}))
   const done=(await json(await call('/state'))).tasks.find(t=>t.id===soon.id)
   assert.deepEqual([done.outcome,done.evidence,!!done.completedAt],['Renewal terms confirmed on the call','Call notes CN-4',true])
   assert.match(await (await request('/app/accounts/harbour',{cookie})).text(),/Outcome: Renewal terms confirmed on the call/)
   const recorded=(await json(await call('/audit?subject=person:'+B))).entries.map(e=>[e.action,e.detail])
   assert.ok(recorded.some(([action,detail])=>action==='person.away-set'&&detail===`cover person:${A} from ${local} through ${day(1)}`))
   assert.ok((await json(await call('/audit?action=account.reassigned'))).entries.length>=2)
  })
  await t.test('NOTIFY-001 own inbox: mentions, assignments, current signals and approvals; per-type email; daily/weekly book digests without duplicates',async()=>{
   const ownerState=await json(await call('/state')), ownerId=ownerState.operator.id
   const modes={mention:'immediate',assignment:'immediate',signal:'digest',approval:'none'}
   const prefs=(body,as=cookie)=>call('/notifications/preferences','PUT',body,{cookie:as})
   const read=async(as=cookie)=>json(await call('/notifications','GET',undefined,{cookie:as}))
   assert.equal((await prefs({frequency:'hourly',modes})).status,400)
   assert.equal((await prefs({frequency:'daily',modes:{...modes,extra:'none'}})).status,400)
   assert.equal((await prefs({frequency:'daily',modes,personId:'someone-else'})).status,400)
   await json(await prefs({frequency:'daily',modes}))
   const stored=await read();assert.equal(stored.preferences.frequency,'daily');assert.deepEqual(stored.preferences.modes,modes)
   const other=await read(member);assert.equal(other.preferences.frequency,'off','preferences are personal')
   const token=await json(await call('/agent-tokens','POST',{label:'NOTIFY-001 refused agent'}),201), as={cookie:undefined,token:token.token}
   for(const [path,method,body] of [['/notifications','GET'],['/notifications/preferences','PUT',{frequency:'daily',modes}],['/accounts/harbour/mentions','POST',{personId:ownerId,note:'forbidden'}]])assert.equal((await call(path,method,body,as)).status,403)
   await json(await call('/agent-tokens/'+token.id,'DELETE'))
   const a={...account('notify-case'),name:'NOTIFY-001 Renewal Labs'}
   await json(await call('/accounts','POST',a),201)
   await json(await call('/accounts/notify-case/owner','PUT',{ownerId}))
   const baseline=worker.mails.length
   const mention=await json(await call('/accounts/notify-case/mentions','POST',{personId:ownerId,note:'NOTIFY-001 please review the renewal commitment'},{cookie:member}),201)
   const proposal=await json(await call('/proposals','POST',{accountId:a.id,kind:'playbook',payload:{title:'NOTIFY-001 call the champion',dueDate:'2027-02-01'}}),201)
   await json(await call('/proposals/'+proposal.id+'/approve','POST',{}))
   assert.ok(worker.mails.slice(baseline).some(m=>m.subject.includes('mentioned you')&&m.text.includes('NOTIFY-001 please review')))
   assert.equal(worker.mails.slice(baseline).filter(m=>m.subject==='Buoy: NOTIFY-001 call the champion').length,1)
   assert.ok(!worker.mails.slice(baseline).some(m=>m.subject==='Buoy: Review playbook proposal'&&m.to.includes('owner@example.test')),'approval email disabled; inbox remains')
   // Exact public Cron Trigger timestamps exercise time-zone, daily and weekly semantics.
   await json(await call('/settings/tasks','PUT',{remindDaysBefore:1,escalateAfterDays:1,timeZone:'America/New_York'}))
   const cron=at=>scheduled('0 * * * *',Date.parse(at))
   await cron('2026-10-19T11:00:00Z') // Monday 7am
   assert.equal((await read()).digests.length,0,'no digest before 8am installation time')
   let all=await read(), mine=all.items.filter(i=>i.accountId===a.id)
   assert.deepEqual(mine.map(i=>i.type).sort(),['approval','assignment','mention','signal'])
   const signal=mine.find(i=>i.type==='signal');assert.equal(signal.email,'queued')
   assert.ok(!worker.mails.slice(baseline).some(m=>m.subject==='Buoy: Account at risk'),'digest-only signal has no immediate mail')
   assert.ok(!(await read(member)).items.some(i=>i.id===mention.id),'a colleague cannot read another inbox')
   assert.equal((await call('/notifications/'+mention.id+'/read','POST',{}, {cookie:member})).status,404)
   await json(await call('/notifications/'+mention.id+'/read','POST',{}))
   assert.ok((await read()).items.find(i=>i.id===mention.id).readAt)
   await cron('2026-10-19T12:00:00Z');await cron('2026-10-19T13:00:00Z')
   const digests=worker.mails.slice(baseline).filter(m=>m.subject==='Buoy daily digest')
   assert.equal(digests.length,1);assert.deepEqual(digests[0].to,['owner@example.test'])
   assert.equal(digests[0].text.split('signal: Account at risk — NOTIFY-001 Renewal Labs').length-1,1)
   assert.match(digests[0].text,/NOTIFY-001 Renewal Labs: \d+ recorded book change/)
   assert.doesNotMatch(digests[0].text,/mention:|assignment:|approval:/,'already-immediate and disabled types are not duplicated in digest')
   all=await read();assert.equal(all.items.find(i=>i.id===signal.id).email,'digest');assert.equal(all.digests[0].email,'accepted')
   assert.equal(all.items.filter(i=>i.id===signal.id).length,1,'digest does not create another inbox notification')
   await cron('2026-10-20T12:00:00Z')
   const tomorrow=worker.mails.filter(m=>m.subject==='Buoy daily digest').at(-1)
   assert.doesNotMatch(tomorrow.text,/signal: Account at risk|NOTIFY-001 Renewal Labs: /,'consumed notices and old book changes stay consumed')
   await json(await prefs({frequency:'weekly',modes:{...modes,mention:'digest'}},member))
   const memberId=ownerState.people.find(p=>p.displayName==='CS colleague').id
   await json(await call('/accounts/notify-case/mentions','POST',{personId:memberId,note:'NOTIFY-001 weekly note'}),201)
   await cron('2026-10-20T12:00:00Z')
   assert.equal((await read(member)).digests.length,0,'weekly waits for Monday')
   await cron('2026-10-26T12:00:00Z');await cron('2026-10-26T13:00:00Z')
   const weekly=worker.mails.filter(m=>m.subject==='Buoy weekly digest'&&m.to.includes('member@example.test'))
   assert.equal(weekly.length,1);assert.match(weekly[0].text,/NOTIFY-001 weekly note/)
   await json(await prefs({frequency:'off',modes:{mention:'none',assignment:'none',signal:'none',approval:'none'}},member))
   const before=worker.mails.length
   await json(await call('/accounts/notify-case/mentions','POST',{personId:memberId,note:'NOTIFY-001 inbox only'}),201)
   const beforeDST=worker.mails.filter(m=>m.subject==='Buoy daily digest').length
   await cron('2026-11-02T12:00:00Z')
   assert.equal(worker.mails.filter(m=>m.subject==='Buoy daily digest').length,beforeDST,'after DST ends, 12Z is still before 8am New York')
   await cron('2026-11-02T13:00:00Z')
   assert.equal(worker.mails.filter(m=>m.subject==='Buoy daily digest').length,beforeDST+1)
   assert.ok(!(worker.mails.slice(before).some(m=>m.to.includes('member@example.test'))))
   assert.equal((await read(member)).items.find(i=>i.body==='NOTIFY-001 inbox only').email,'none')
   for(const [status,label] of [[400,'failed'],[500,'uncertain']]){
    worker.setMailStatus(status)
    const notice=await json(await call('/accounts/notify-case/mentions','POST',{personId:ownerId,note:`NOTIFY-001 mail edge ${status}`}),201)
    assert.equal((await read()).items.find(i=>i.id===notice.id).email,label)
   }
   worker.setMailStatus(200)
   const sent=worker.mails.length
   await cron('2026-11-02T14:00:00Z')
   assert.equal(worker.mails.length,sent,'refused and unconfirmed immediate attempts are never resent')
   const page=await (await request('/app/notifications',{cookie})).text()
   assert.match(page,/Your inbox/);assert.match(page,/NOTIFY-001 please review/);assert.match(page,/Email accepted by the mail provider/)
   const browserForm=await request('/app/notifications',{method:'POST',cookie:member,headers:{'content-type':'application/x-www-form-urlencoded'},body:undefined})
   assert.equal(browserForm.status,400,'invalid form action refused')
   await json(await call('/accounts/notify-case','DELETE',{confirmation:a.name}))
   assert.ok(!(await read()).items.some(i=>i.accountId===a.id),'account erasure clears inbox content')
   assert.doesNotMatch(worker.mails.findLast(m=>m.subject==='Buoy weekly digest').text,/NOTIFY-001 inbox only/)
  })
  for(const [route,method] of [['/renewals/settings','PUT'],['/renewals/synthetic-buoy-400','PUT'],['/renewal-fields/preview','POST'],['/renewal-fields','POST'],['/renewals/synthetic-buoy-400/fields','PUT']])assert.ok((await call(route,method,{})).status>=400)
  for(const [route,method] of [['/workspace/lists/preview','POST'],['/workspace/views','POST'],['/workspace/views/synthetic-buoy-600','DELETE'],['/workspace/bulk/preview','POST'],['/workspace/bulk/apply','POST']])assert.ok((await call(route,method,{})).status>=400)
  for(const tail of ['hierarchy','scorecard'])assert.ok((await call('/accounts/synthetic-buoy-700/'+tail,'PUT',{})).status>=400)
  // Privacy doors share the same outbound/authority boundary inventory. The full
  // journey below uses its own installation to isolate its published scorecard.
  for(const [tail,method,body] of [['holders','PUT',{revision:'stale',holders:[]}],['export','POST',{}],['erase','POST',{}],['preview','POST',{}],['hold','POST',{}]])assert.equal((await call('/customer-people/synthetic-buoy-260/privacy/'+tail,method,body)).status,404)
  await t.test('USAGE-001 ACCOUNT-004 SEGMENT-001 complete contact and user carrier',async()=>customerPeopleJourney({call,json,request,cookie,member,account}))
  await t.test('SEGMENT-001 rules, classification, intervals, proposals, reports and erasure',async()=>segmentJourney({call,json,request,cookie,member,account,scheduled}))
  await t.test('PLAY-004 frozen cohorts, 40 playbooks, outcomes, observed times and comparison',async()=>outcomeJourney({call,json,request,cookie,member,account,scheduled}))
  await t.test('ACCOUNT-004 typed fields, formulas, preview, history and segments',async()=>fieldJourney({call,json,request,cookie,member,account,signIn}))
  await t.test('CONNECT-001 disconnected source lifecycle never reaches a provider',async()=>{
   const source=await json(await call('/connections','POST',{name:'Disconnected test inventory',key:['rk','test','flowFixtureOnly'].join('_')}),201)
   await json(await call('/connections/'+source.id+'/credential','PUT',{key:['rk','test','flowReplacementOnly'].join('_')}))
   await json(await call('/connections/'+source.id,'DELETE',{}))
   assert.equal((await call('/connections/'+source.id+'/sync','POST',{})).status,409)
  })
  await t.test('ADOPT-001 configuration doors retain ordinary authority and do not call a provider',async()=>{
   await json(await call('/adoption/definitions','POST',{kind:'feature',key:'reports',name:'Reports',events:['Report generated']}),201)
   await json(await call('/adoption/seats','PUT',{accountId:'harbour',seats:20,reference:'Customer-approved license schedule',observedAt:'2026-10-01',staleDays:30}))
   const licensePerson=await json(await call('/customer-people','POST',{kind:'user',name:'Licensed customer',accountIds:['harbour'],source:'Customer license register'}),201)
   await json(await call('/adoption/person-licenses','PUT',{accountId:'harbour',personId:licensePerson.id,licensed:true,reference:'Customer-approved individual license',observedAt:'2026-10-01'}))
   await json(await call('/adoption/consumers','POST',{name:'Flow adoption measure',scope:'account',metric:'adoption.current.mau',op:'gte',value:1,health:true,alert:false,enabled:false}),201)
   assert.ok((await json(await call('/adoption/consumers'))).rules.some(r=>r.name==='Flow adoption measure'))
   const report=await json(await call('/adoption?accountId=harbour'))
   assert.equal(report.accounts.length,1);assert.equal(report.accounts[0].seats,20)
   assert.equal((await request('/api/buoy/adoption/report.csv')).status,401)
   assert.equal((await call('/adoption','GET',undefined,{cookie:member})).status,200)
   const grant=await json(await call('/agent-tokens','POST',{label:'Adoption authority boundary'}),201)
   for(const path of ['/adoption','/adoption/report.csv','/adoption/consumers'])assert.equal((await call(path,'GET',undefined,{cookie:undefined,token:grant.token})).status,403)
   const dismissalAccount=await json(await call('/accounts','POST',account('synthetic-buoy-92')),201)
   const operator=(await json(await call('/state'))).operator
   await json(await call('/accounts/'+dismissalAccount.id+'/owner','PUT',{ownerId:operator.id}))
   const modes={mention:'immediate',assignment:'immediate',signal:'digest',approval:'immediate'}
   await json(await call('/notifications/preferences','PUT',{frequency:'off',modes}))
   let signal=await json(await call('/adoption/consumers','POST',{name:'synthetic-buoy-92',scope:'account',metric:'adoption.current.mau',op:'gte',value:0,health:false,alert:true,enabled:true}),201)
   const notices=async()=>(await json(await call('/notifications'))).items.filter(n=>n.accountId===dismissalAccount.id&&n.adoptionRuleId===signal.id)
   const notice=(await notices())[0]
   assert.ok(notice);assert.equal(notice.dismissal,null);assert.equal(notice.email,'queued')
   const door='/notifications/'+notice.id+'/dismiss',until=new Date(Date.now()+86400000).toISOString(),reason='Customer review agreed; synthetic-buoy-92'
   assert.equal((await call(door,'POST',{reason,until},{cookie:member})).status,404)
   assert.equal((await call(door,'POST',{reason,until},{cookie:undefined,token:grant.token})).status,403)
   assert.equal((await call(door,'POST',{reason,until},{headers:{origin:'https://other.invalid'}})).status,403)
   for(const body of [{until},{reason:' ',until},{reason:'x'.repeat(1001),until},{reason,until:'2026-01-01T00:00:00Z'},{reason,until:'2027-02-30T00:00:00Z'},{reason,until:new Date(Date.now()+366*86400000).toISOString()},{reason,until,personId:operator.id}])assert.equal((await call(door,'POST',body)).status,400)
   const dismissed=await json(await call(door,'POST',{reason,until}))
   assert.equal(dismissed.adoptionRuleId,signal.id);assert.equal(dismissed.dismissal.reason,reason)
   assert.deepEqual((await notices())[0].dismissal,dismissed.dismissal);assert.equal((await notices())[0].email,'dismissed')
   signal=await json(await call('/adoption/consumers','POST',{...signal,value:-1,op:'lt'}),201)
   signal=await json(await call('/adoption/consumers','POST',{...signal,value:0,op:'gte'}),201)
   await scheduled()
   assert.equal((await notices()).length,1,'dismissal survives recovery and matching reentry')
   const dismissAudit=await json(await call('/audit?action=signal.dismissed'))
   assert.ok(dismissAudit.entries.length);assert.doesNotMatch(JSON.stringify(dismissAudit),/Customer review agreed/)
   signal=await json(await call('/adoption/consumers','POST',{...signal,enabled:false}),201)
   await json(await call('/notifications/preferences','PUT',{frequency:'off',modes:{...modes,signal:'immediate'}}))
   await json(await call('/accounts/'+dismissalAccount.id,'DELETE',{confirmation:dismissalAccount.name}))
   await json(await call('/agent-tokens/'+grant.id,'DELETE'))
   assert.equal((await call('/surveys/responses','POST',{})).status,400)
   assert.equal((await call('/accounts/harbour/contract','POST',{})).status,400)
   assert.equal((await call('/accounts/harbour/revenue-reconciliation','POST',{})).status,400)
   const scorecard={name:'Recorded billing preview',measures:[{key:'allocation',name:'Recorded allocation',field:'billing.allocatedMinor',min:0,max:100000,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]}
   await json(await call('/scorecards/preview','POST',{config:scorecard}))
   assert.equal((await call('/scorecards/publish','POST',{revision:null,config:scorecard},{cookie:member})).status,403)
   assert.equal((await call('/scorecards/publish','POST',{revision:'stale',config:scorecard})).status,409)
  })
  await t.test('INAPP-001 authenticated targeting, caps and receipt custody',async()=>{await inappJourney({...worker,request,dispatch:async req=>{seen.push([req.method,new URL(req.url).pathname]);return worker.dispatch(req)}})})
  await t.test('BILLING-004 REPORT-001 confirmed-term retention reconciles native and constant USD cents',async()=>reportingJourney({api:async(path,method='GET',body)=>{const response=await call(path,method,body);assert.ok(response.ok,await response.clone().text());return response.json()},request:(path,options={})=>request(path,{cookie,...options}),member}))
  await t.test('BOUNDARY-001 no route moves money: every write route ran and only the sign-in mail edge was called',async()=>{
   // Full usage-volume, team and multi-step playbook journeys use isolated installations.
   await integrationJourney({...worker,request,dispatch:async req=>{seen.push([req.method,new URL(req.url).pathname]);return worker.dispatch(req)}})
   // Keep the central write-door inventory and denied ordinary-member boundary here.
   for(const [method,path]of [['POST','/portal-invitations'],['POST','/portal/synthetic-buoy-1980/action'],['POST','/accounts/harbour/portal-sharing'],['DELETE','/accounts/harbour/portal-sharing/synthetic-buoy-1980'],['POST','/trust/scan'],['POST','/trust/mappings'],['POST','/trust/synthetic-buoy-7514/review'],['POST','/ai/configuration/signals/synthetic-buoy-8499/pause'],['POST','/ai/configuration'],['POST','/ai/configuration/synthetic-buoy-8499/approve'],['DELETE','/ai/configuration/synthetic-buoy-8499'],['POST','/ai/communications'],['POST','/ai/communications/score'],['POST','/ai/answers'],['POST','/ai/schedules'],['DELETE','/ai/schedules/synthetic-buoy-9903'],['PUT','/ai/settings'],['POST','/ai/conversations'],['POST','/ai/proposals/synthetic-buoy-9902/decision'],['POST','/experiments'],['POST','/experiments/synthetic-buoy-9901/approve'],['POST','/accounts/harbour/plans'],['POST','/reviews'],['PUT','/reviews/synthetic-buoy-9900'],['POST','/reviews/synthetic-buoy-9900/review'],['POST','/reviews/synthetic-buoy-9900/meetings'],['POST','/reports'],['POST','/dashboards'],['POST','/renewals/forecast/snapshots'],['POST','/renewals/synthetic-buoy-2191/forecast-override'],['PATCH','/accounts/harbour'],['POST','/roles/definitions'],['PUT','/roles/assignments'],['DELETE','/roles/assignments/synthetic-buoy-2190'],['POST','/billing/synthetic-buoy-2190/bindings/preview'],['POST','/billing/synthetic-buoy-2190/bindings'],['DELETE','/billing/bindings/synthetic-buoy-2190'],['PUT','/billing/synthetic-buoy-2190/settings'],['PUT','/billing/synthetic-buoy-2190/webhook-secret'],['POST','/billing/synthetic-buoy-2190/sync'],['POST','/playbooks'],['POST','/playbooks/synthetic-buoy-1790/enroll'],['POST','/playbook-runs/synthetic-buoy-1791/action'],['POST','/playbooks/synthetic-buoy-1790/credentials'],['DELETE','/playbooks/synthetic-buoy-1790/credentials/synthetic-buoy-1792'],['POST','/playbooks/intake/synthetic-buoy-1790'],['POST','/usage/intake/synthetic-buoy-1502'],['POST','/usage/sources'],['PUT','/usage/sources/synthetic-buoy-1500'],['POST','/usage/sources/synthetic-buoy-1500/credentials'],['DELETE','/usage/credentials/synthetic-buoy-1501'],['POST','/usage/mappings/preview'],['POST','/usage/mappings'],['PUT','/team/settings'],['POST','/team/preview'],['POST','/team/apply']])assert.equal((await call(path,method,{}, {cookie:member})).status,403)
   assert.equal((await call('/billing/synthetic-buoy-2190/webhook','POST',{})).status,404,'The public signed delivery door refuses an unknown connector')
   assert.equal((await call('/ai/questions','POST',{})).status,403)
   const {routes}=await json(await call('/routes'))
   assert.ok(routes.some(r=>r.path==='/api/buoy/commands'))
   for(const route of routes){
    assert.doesNotMatch(route.path,/(?:^|\/)(?:charge|payment|refund|payout|dunning|checkout|tax|subscription|card)s?(?:[-_\/]|$)/i,`${route.method} ${route.path} does not move money`)
    if(route.method==='GET')continue
    const pattern=new RegExp('^'+route.path.replace(/:[^/]+/g,'[^/]+')+'$')
    assert.ok(seen.some(([method,path])=>method===route.method&&pattern.test(path)),`${route.method} ${route.path} ran in this journey`)
   }
   assert.ok(worker.outbound.length);assert.deepEqual([...new Set(worker.outbound)],['https://api.resend.com/emails'],'the only outbound call is the sign-in mail provider')
  })
 }finally{await worker.close()}
})

test('HTTP-001 IMPORT-001 operator and Business door authority, provisioning, revocation and erasure',async()=>{
 const {importDoorJourney}=await import('./import-door-journey.mjs')
 await importDoorJourney()
})

// Search owns a fresh public Worker so unrelated field/usage fixtures do not
// multiply every lookup's reconciliation cost in Verify's 15-minute budget.
test('ACCOUNT-005 native search, live custody and ordinary staff authority',async()=>searchHttpJourney())

// Privacy fixtures publish a scorecard, so use an independent real installation.
test('ERASE-002 owner customer export and erasure, source replay, aggregates and opaque audit',async()=>{
 const app=await startWorker(),cookie=app.cookie;
 const call=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie,method,body,...options});
 const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()};
 try{
  await json(await app.request('/auth/invite',{method:'POST',cookie,body:{email:'member@example.test',displayName:'CS colleague',role:'member'}}),202);
  const member=await app.signIn('member@example.test');
  await eraseJourney({call,json,request:app.request,cookie,member,signIn:app.signIn,account,dispatch:app.dispatch,origin:app.origin});
 }finally{await app.close()}
})

test('RENEW-001 native renewal pipeline and inherited field carrier',renewalJourney)

test('RENEW-004 retained forecast movement and closed-period accuracy',()=>forecastJourney())

test('ACCOUNT-003 current workspace, live views and reviewed bulk operations',workspaceJourney)

test('ACCOUNT-001 complete native hierarchy and product relationships',hierarchyJourney)

// The same volume/business assertions use their own public installation so their
// retained 100k observations and 300 accounts do not multiply unrelated tests.
async function isolatedJourney(run){
 const app=await startWorker(),cookie=app.cookie;
 const call=(path,method='GET',body,extra={})=>app.request('/api/buoy'+path,{method,body,cookie,...extra});
 const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()};
 try{
  await json(await app.request('/auth/invite',{method:'POST',cookie,body:{email:'member@example.test',displayName:'CS colleague',role:'member'}}),202);
  const member=await app.signIn('member@example.test');await json(await call('/accounts','POST',account()),201);
  await run({call,json,request:app.request,cookie,member,signIn:app.signIn,dispatch:app.dispatch,origin:app.origin,account});
  assert.deepEqual([...new Set(app.outbound)],['https://api.resend.com/emails'],'Isolated positive journeys retain the same only-internal-mail outbound boundary');
 }finally{await app.close()}
}
test('USAGE-001 receiver credentials, relay-only intake and reviewed user/account attribution',async()=>isolatedJourney(usageJourney))
test('TEAM-001 300-account rules, capacity, book handover, open work, notes and rebalance',async()=>isolatedJourney(teamJourney))

test('PLAY-001 PLAY-003 durable multi-step work and manual external failure recovery',playJourney)

test('PLAY-001 typed enrollment triggers and observed usage recovery',playTriggerJourney)

test('PLAY-001 scoped server webhook enrollment authority and replay',playIntakeJourney)

test('PLAY-001 reviewed field changes commit once before downstream branching',playFieldJourney)

test('PLAY-001 child playbook starts are pinned and recorded once',playChildJourney)

test('PLAY-001 task offsets follow the installation calendar',playCalendarJourney)

test('ROLE-001 configuration, native isolation and audited grants',roleConfigurationJourney)
test('ROLE-001 default and custom account reads',roleReadJourney)
test('ROLE-001 live book, manager, segment and identity withdrawal',roleScopeJourney)
test('ROLE-001 commercial, search and unported door isolation',roleIsolationJourney)

test('ROLE-001 scoped homes use current books, handlers and safe commercial fields', roleWorkspaceJourney)

test('ROLE-001 scoped account details preserve commercial sources and current authority', roleAccountEditJourney)

test('ROLE-001 financial reports and CSV contain only permitted records', roleReportsJourney)

test('ROLE-001 renewal approvals retain current team, grants and native source authority',roleRenewalApprovalJourney)

test('REPORT-002 saved report calculations and scoped dashboard sharing',dashboardJourney)

test('REVIEW-001 native source-linked decks, local exports and meeting follow-ups',reviewJourney)
test('PLAN-001 observed source goals and honest customer confirmation',planAttainmentJourney)
test('PLAN-001 current authority and version-bound concurrent edits',planAuthorityJourney)
test('PLAN-001 account handover and erased ownership custody',planCustodyJourney)

test('AGENT-002 approved matched interventions and independently seeded effects',async()=>{const {experimentJourney}=await import('./outcome-journey.mjs');await experimentJourney()})

test('AI-001 scoped extractive questions and working citations',async()=>{const {aiQuestionJourney}=await import('./ai-journey.mjs');await aiQuestionJourney()})
test('AI-002 cited conversation proposals require reviewed acceptance',async()=>{const {aiConversationJourney}=await import('./ai-journey.mjs');await aiConversationJourney()})
test('AI-004 model choice, excluded transcripts, budget and disablement',async()=>{const {aiControlJourney}=await import('./ai-journey.mjs');await aiControlJourney()})

test('AI-006 standing scheduled consent and revocation',async()=>{const {aiScheduleJourney}=await import('./ai-journey.mjs');await aiScheduleJourney()})
test('AI-005 generated claims cite current permitted source records',async()=>{const {aiGeneratedJourney}=await import('./ai-journey.mjs');await aiGeneratedJourney()})

test('AI-003 cited communication health, class disablement and guarded model effects',async()=>{const {communicationJourney}=await import('./communication-journey.mjs');await communicationJourney()})

test('API-001 scoped account integration with atomic replay and bounded authority',()=>integrationJourney())

test('AGENT-008 plain-language signal drafts, historical evidence and approval',async()=>{const {configurationJourney}=await import('./configuration-journey.mjs');await configurationJourney()})
test('AGENT-008 native configuration kinds and retained scorecard back-testing',async()=>{const {configurationKindsJourney}=await import('./configuration-journey.mjs');await configurationKindsJourney()})
test('AGENT-007 evidence review, admin-only correction and immediate health refresh',trustJourney)
test('AGENT-007 person evidence export, reviewed redaction, holds and erasure',trustPrivacyJourney)
test('AGENT-007 import undo preserves dependent trust work on either account',trustUndoJourney)
test('PLAN-001 customer portal confirmation and isolated collaboration',portalJourney)

test('PLAN-001 customer access expiry and withdrawal',portalWithdrawalJourney)
