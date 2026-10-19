import test from 'node:test'
import assert from 'node:assert/strict'
import { startWorker } from './worker.mjs'

const today=new Date().toISOString().slice(0,10)
const account=(id='harbour')=>({id,name:'Harbour Software',renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Signed order form section 4, approved by customer',billing:{observedAt:today,reference:'Nectar invoice INV-1042',currency:'AUD',totalMinor:120000,creditsMinor:10000,allocatedMinor:20000,dueDate:'2026-01-01'},support:{observedAt:today,reference:'Support case CS-42',openTickets:3,urgentTickets:1}})
test('Buoy public HTTP jobs and trust boundaries',async t=>{
 const worker=await startWorker(), {cookie,signIn}=worker, seen=[]
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
   await json(await call(`/tasks/${task.id}/complete`,'POST',{evidence:'Customer meeting minutes 2027-01-15; incident resolved.'}))
   assert.ok((await json(await call('/state'))).tasks[0].completedAt)
  })
  await t.test('agents prepare decisions, cannot approve; revoked tokens stop',async()=>{
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
  let imported
  await t.test('move-in dry run, review binding, idempotent apply and strict undo',async()=>{
   const upload={accounts:[account('move-one')]}
   const plan=await json(await call('/imports/preview','POST',upload))
   assert.equal((await json(await call('/state'))).accounts.length,2)
   assert.equal((await call('/imports/apply','POST',{...upload,fingerprint:'0'.repeat(64),operationKey:'import-one'})).status,409)
   const input={...upload,fingerprint:plan.fingerprint,operationKey:'import-one'}
   imported=await json(await call('/imports/apply','POST',input));assert.equal(imported.state,'completed')
   const replay=await json(await call('/imports/apply','POST',input));assert.equal(replay.id,imported.id)
   const undone=await json(await call(`/imports/${imported.id}/undo`,'POST',{}));assert.equal(undone.state,'undone')
   assert.ok(!(await json(await call('/state'))).accounts.some(a=>a.id==='move-one'))
  })
  await t.test('undo preserves changed accounts and owner erasure redacts imported custody',async()=>{
   const upload={accounts:[account('move-two')]}, plan=await json(await call('/imports/preview','POST',upload))
   const job=await json(await call('/imports/apply','POST',{...upload,fingerprint:plan.fingerprint,operationKey:'import-two'}))
   await json(await call('/proposals','POST',{accountId:'move-two',kind:'playbook',payload:{title:'Escalate support',dueDate:'2027-01-31'}}),201)
   assert.equal((await call(`/imports/${job.id}/undo`,'POST',{})).status,409)
   assert.equal((await call('/accounts/move-two','DELETE',{confirmation:'Harbour Software'},{cookie:member})).status,403)
   await json(await call('/accounts/move-two','DELETE',{confirmation:'Harbour Software'}))
   const state=await json(await call('/state'));assert.ok(!state.accounts.some(a=>a.id==='move-two'));assert.ok(!state.proposals.some(p=>p.accountId==='move-two'))
   const history=await json(await call('/imports'));assert.ok(history.erasures.length)
   const retained=JSON.stringify(await json(await call(`/imports/${job.id}`)))
   assert.ok(!retained.includes('Harbour Software'));assert.ok(!retained.includes('INV-1042'))
   assert.equal((await call('/accounts','POST',account('move-two'))).status,409)
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
  await t.test('BOUNDARY-004 agent commercial changes are refused with their reason and recorded; mail is sign-in only',async()=>{
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
   assert.equal((await json(await call('/audit?actor='+agent.id+'&action=agent.requested'))).entries.length,2,'AUDIT-001 commands attempts are distinct from their refusal outcomes');
   assert.deepEqual(recorded.map(e=>e.action),['agent.refused','agent.refused','agent.refused']);for(const e of recorded)assert.equal(e.actor,`agent:${agent.id}`,'AUDIT-001 retains the agent id without its display name')
   for(const [,,subject,reason] of attempts){const entry=recorded.find(e=>e.subject===subject);assert.ok(entry,`${subject} is recorded`);assert.match(entry.detail,reason);assert.ok(Date.parse(entry.occurredAt))}
   await json(await call(`/agent-tokens/${agent.id}`,'DELETE'))
   // No journey, campaign or other one-to-many send exists: every message the installation sent is a sign-in link to the one person who asked for it.
   assert.ok(worker.mails.length);for(const mail of worker.mails){assert.equal([mail.to].flat().length,1);assert.match(mail.html,/\/auth\/confirm\?token=/)}
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
  })
  await t.test('BOUNDARY-001 no route moves money: every write route ran and only the sign-in mail edge was called',async()=>{
   const {routes}=await json(await call('/routes'))
   assert.ok(routes.some(r=>r.path==='/api/buoy/commands'))
   for(const route of routes){
    assert.doesNotMatch(route.path,/charge|payment|refund|payout|dunning|checkout|tax|subscription|card/i,`${route.method} ${route.path} does not move money`)
    if(route.method==='GET')continue
    const pattern=new RegExp('^'+route.path.replace(/:[^/]+/g,'[^/]+')+'$')
    assert.ok(seen.some(([method,path])=>method===route.method&&pattern.test(path)),`${route.method} ${route.path} ran in this journey`)
   }
   assert.ok(worker.outbound.length);assert.deepEqual([...new Set(worker.outbound)],['https://api.resend.com/emails'],'the only outbound call is the sign-in mail provider')
  })
 }finally{await worker.close()}
})
