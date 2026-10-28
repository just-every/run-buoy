import assert from 'node:assert/strict'
import {join} from 'node:path'
import {startWorker} from './worker.mjs'
import {billingFixtureKey} from './billing-fixture.mjs'
import {scan,submit} from './a11y-checks.mjs'

// Real application, sessions and storage; only Stripe's network boundary is fake.
export async function renewalReadinessJourney({browser,evidence}={}){
 console.log('Renewal readiness: starting native fixture')
 let instant=Date.parse('2026-10-28T12:00:00Z'),amount=120000
 const calls=[],customer='synthetic-buoy-9801',subscription='synthetic-buoy-9802',seconds=day=>Date.parse(day+'T00:00:00Z')/1000
 const providerFetch=async request=>{
  calls.push(request.method);assert.equal(request.method,'GET')
  const url=new URL(request.url),list=data=>Response.json({object:'list',data,has_more:false})
  if(url.pathname.startsWith('/v1/customers/'))return Response.json({id:customer,object:'customer',livemode:false,created:seconds('2025-01-01')})
  if(url.pathname==='/v1/subscriptions')return list([{id:subscription,object:'subscription',livemode:false,customer,status:'active',created:seconds('2026-02-25'),current_period_start:seconds('2026-02-25'),current_period_end:seconds('2027-02-25'),cancel_at_period_end:false,canceled_at:null,discounts:[]}])
  if(url.pathname==='/v1/subscription_items')return list([{id:'synthetic-buoy-9803',object:'subscription_item',subscription,quantity:1,price:{id:'synthetic-buoy-9804',object:'price',livemode:false,billing_scheme:'per_unit',transform_quantity:null,tiers_mode:null,product:'synthetic-buoy-9805',currency:'usd',unit_amount_decimal:String(amount),recurring:{interval:'year',interval_count:1,usage_type:'licensed'}}}])
  assert.ok(['/v1/customers','/v1/invoices','/v1/payment_intents','/v1/charges','/v1/credit_notes'].includes(url.pathname));return list([])
 }
 const app=await startWorker({clock:()=>instant,providerFetch}),cookie=app.cookie
 console.log('Renewal readiness: native Worker ready')
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie,method,body,...options})
 const api=async(path,method='GET',body)=>{const r=await request(path,method,body);assert.ok(r.ok,await r.clone().text());return r.json()}
 try{
  const owner=(await api('/state')).operator.id,accountId='synthetic-buoy-9810'
  await api('/accounts','POST',{id:accountId,name:'Cascade Analytics',renewalDate:'2027-02-25',noticeDays:30,renewalEvidence:'Signed Cascade order notice clause 4',billing:null,support:{observedAt:'2026-10-28',reference:'Cascade support register',openTickets:1,urgentTickets:1}})
  await api('/accounts/'+accountId+'/owner','PUT',{ownerId:owner})
  const champion=await api('/customer-people','POST',{kind:'contact',name:'Morgan Hale',accountIds:[accountId],source:'Cascade contact register'})
  const participant=await api('/customer-people','POST',{kind:'contact',name:'Jamie Quinn',accountIds:[accountId],source:'Cascade procurement introduction'})
  const currentAccount=async()=>(await api('/state')).accounts.find(a=>a.id===accountId)
  console.log('Renewal readiness: account and contacts seeded')
  await api('/accounts/'+accountId+'/hierarchy','PUT',{revision:(await currentAccount()).revision,parentId:null,kind:'account',accountExecutiveId:null,executiveSponsorId:null,supportOwnerId:null,stakeholders:[{personId:champion.id,roles:['champion']}],source:'Customer-confirmed stakeholder map'})
  await api('/accounts/'+accountId+'/plans','POST',{accountRevision:(await currentAccount()).revision,name:'Cascade success outcomes',staffOwnerId:owner,customerOwnerId:participant.id,objectives:[{id:'synthetic-buoy-9811',title:'Customer confirms reporting time saved',kind:'customer-statement',dueOn:'2027-01-15'}]})
  console.log('Renewal readiness: stakeholder map and plan seeded')
  const connection=await api('/connections','POST',{name:'Cascade test subscription source',key:billingFixtureKey}),base='/billing/'+connection.id
  const binding=await api(base+'/bindings/preview','POST',{customerId:customer,accountId});await api(base+'/bindings','POST',{token:binding.token})
  console.log('Renewal readiness: Stripe binding reviewed')
  const sync=async()=>{const result=await api(base+'/sync','POST',{});assert.equal(result.status,'succeeded',result.error)}
  await sync()
  console.log('Renewal readiness: billing source seeded')
  const renewal=(await api('/renewals')).records.find(r=>r.accountId===accountId),record='/renewals/'+renewal.id,readiness=()=>api(record+'/readiness')
  let ready=await readiness();assert.equal(ready.active,true);assert.equal(ready.startsOn,'2026-10-28')
  const timelineInput=async()=>({revision:(await readiness()).revision,customerId:participant.id,staffId:owner})
  instant=Date.parse('2026-10-27T12:00:00Z');assert.equal((await readiness()).active,false);assert.equal((await request(record+'/timelines','POST',await timelineInput())).status,409)
  instant=Date.parse('2026-10-28T12:00:00Z')
  await api(record+'/stakeholder-status','PUT',{revision:(await readiness()).revision,personId:champion.id,status:'departed',observedOn:'2026-10-27',source:'Customer departure confirmation C-17'})
  ready=await readiness()
  console.log('Renewal readiness: cited stakeholder and plan evidence')
  assert.ok(ready.flags.some(f=>f.kind==='departed-champion'&&f.title.includes('Morgan Hale')&&f.reference.includes('C-17')&&f.href.includes(accountId)))
  assert.ok(ready.flags.some(f=>f.kind==='unconfirmed-goal'&&f.title.includes('reporting time saved')&&f.reference.includes('synthetic-buoy-9811')&&f.href.endsWith('#success-plans')))
  assert.ok(ready.flags.some(f=>f.kind==='missing-authority'));assert.ok(ready.flags.some(f=>f.kind==='health-risk'))
  const email=['synthetic-buoy-9820','example.test'].join('@')
  await app.request('/auth/invite',{method:'POST',cookie,body:{email,displayName:'Scoped renewal CSM',role:'member'}})
  const member=await app.signIn(email)
  assert.equal((await request(record+'/readiness','GET',undefined,{cookie:member})).status,403)
  assert.equal((await request(record+'/stakeholder-status','PUT',{}, {cookie:member})).status,403)
  const token=await api('/agent-tokens','POST',{label:'Readiness preparation',scopes:['renewal.readiness','renewal.timeline.prepare']})
  const command=async(command,input,credential=token.token)=>request('/commands','POST',{command,input},{cookie:undefined,token:credential})
  const agentRead=await command('renewal.readiness',{renewalId:renewal.id});assert.equal(agentRead.status,200);assert.equal((await agentRead.json()).flags.find(f=>f.kind==='departed-champion').reference,ready.flags.find(f=>f.kind==='departed-champion').reference)
  const before=(await api('/state')),prepared=await command('renewal.timeline.prepare',{renewalId:renewal.id,...await timelineInput()});assert.equal(prepared.status,201)
  const timeline=await prepared.json();assert.deepEqual(timeline.classification,['standard']);assert.equal(timeline.customerAgreement,'unconfirmed');assert.ok(timeline.milestones.some(m=>m.title.includes('departed champion')&&m.dueOn==='2027-01-26'))
  assert.equal((await api('/state')).tasks.length,before.tasks.length,'Timeline preparation creates no operational work')
  assert.equal((await api('/state')).decisions.length,before.decisions.length,'Timeline preparation creates no commercial decision')
  assert.equal((await request(record+'/timelines/'+timeline.id+'/approve','POST',{}, {cookie:undefined,token:token.token})).status,403)
  assert.equal((await request(record+'/timelines/'+timeline.id+'/approve','POST',{}, {cookie:member})).status,403)
  assert.equal((await command('renewal.timeline.prepare',{renewalId:renewal.id,...await timelineInput(),resultArrMinor:1})).status,400,'A standard timeline cannot carry money')
  await api(record+'/stakeholder-status','PUT',{revision:(await readiness()).revision,personId:participant.id,status:'active',observedOn:'2026-10-28',source:'Customer participant confirmed C-18'})
  assert.equal((await request(record+'/timelines/'+timeline.id+'/approve','POST',{})).status,409,'Changed evidence refuses stale review')
  const fresh=await api(record+'/timelines','POST',await timelineInput())
  console.log('Renewal readiness: stale and forbidden review paths checked')
  const approvalPath=record+'/timelines/'+fresh.id+'/approve'
  await api(approvalPath,'POST',{});await api(approvalPath,'POST',{})
  const approved=(await readiness()).timelines.find(t=>t.id===fresh.id);assert.equal(approved.approvedBy,owner);assert.ok(approved.approvedAt)
  const audits=await api('/audit?action=renewal.timeline-approved');assert.equal(audits.entries.length,1,'Approval replay does not duplicate the audit')
  assert.ok((await api('/accounts/'+accountId+'/activity')).records.some(r=>r.kind==='renewal-timeline-approved'&&r.href.includes(renewal.id)))
  await api('/agent-tokens/'+token.id,'DELETE',{})
  assert.equal((await command('renewal.readiness',{renewalId:renewal.id})).status,401)
  const sourceVersion=(await api('/renewals')).records.find(r=>r.id===renewal.id).sourceVersionId
  const proposal=await api('/proposals','POST',{accountId,kind:'renewal',payload:{renewalId:renewal.id,outcome:'renewed-with-expansion',resultArrMinor:144000,reason:'customer-confirmed',evidence:'Signed Cascade uplift U-20'}})
  assert.equal((await request('/proposals/'+proposal.id+'/approve','POST',{}, {cookie:member})).status,403)
  assert.equal((await api('/renewals')).records.find(r=>r.id===renewal.id).outcome,null)
  await api('/proposals/'+proposal.id+'/approve','POST',{})
  await sync();ready=await readiness()
  assert.equal(ready.billing.status,'mismatch');assert.equal(ready.billing.actual.arrMinor,120000);assert.equal(ready.billing.actual.differenceMinor,-24000);assert.equal(ready.billing.expectedArrMinor,144000)
  assert.ok(ready.flags.some(f=>f.kind==='billing-mismatch'&&f.reference===ready.billing.actual.sourceReference))
  if(browser){console.log('Renewal readiness: opening native browser screens');await readinessScreens({browser,evidence,app,renewalId:renewal.id,api,readiness,timelineInput,participant,owner})}
  amount=144000;await sync();ready=await readiness()
  assert.equal(ready.billing.status,'matched');assert.equal(ready.billing.actual.arrMinor,144000);assert.equal(ready.billing.actual.differenceMinor,0);assert.ok(!ready.flags.some(f=>f.kind==='billing-mismatch'))
  assert.equal((await api('/renewals')).records.find(r=>r.id===renewal.id).sourceVersionId,sourceVersion)
  if(browser)for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try{
    await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...parts]=pair.split('=');return {name,value:parts.join('='),url:app.origin}}))
    const page=await context.newPage();await page.goto(app.origin+'/app/renewals?renewal='+renewal.id,{waitUntil:'networkidle'})
    assert.match(await page.locator('#renewal-record').innerText(),/Billing reconciliation: matched/)
    assert.equal(await page.locator('[data-readiness-kind=billing-mismatch]').count(),0)
    await scan(page,'Renewal readiness billing matched '+width)
    await page.locator('#renewal-record').screenshot({path:join(evidence,'renewal-readiness-matched-'+width+'.png')})
   }finally{await context.close()}
  }
  assert.ok((await api('/renewals')).fields.history.some(h=>h.recordId===renewal.id&&h.key==='billing-reconciliation'&&h.newValue.billingReconciliation==='mismatch'))
  await api('/connections/'+connection.id,'DELETE',{})
  assert.ok((await readiness()).flags.some(f=>f.kind==='billing-unavailable'),'Disconnecting never presents retained actuals as current verification')
  const person=(await api('/customer-people')).records.find(p=>p.id===participant.id),privacy='/customer-people/'+participant.id+'/privacy/',preview=await api(privacy+'preview','POST',{revision:person.revision})
  const erased=await api(privacy+'erase','POST',{revision:person.revision,confirmation:'Jamie Quinn',fingerprint:preview.fingerprint,request:{verificationMethod:'verified-offline',receivedDate:'2026-10-28',requesterReference:crypto.randomUUID()}})
  assert.ok(erased)
  ready=await readiness();assert.equal(ready.timelines.length,0,'Person erasure withdraws every linked timeline')
  assert.ok(!JSON.stringify(ready).includes('Jamie Quinn'))
  assert.equal((await request(approvalPath,'POST',{})).status,404,'Erased timeline cannot be replayed')
  await api('/accounts/'+accountId,'DELETE',{confirmation:'Cascade Analytics'})
  assert.equal((await request(record+'/readiness')).status,404)
  assert.ok(calls.length&&calls.every(m=>m==='GET'))
  console.log('Renewal readiness: cited departure, unconfirmed goal, standard reviewed timeline, money and commitment approval, Stripe uplift mismatch then match, stale and forbidden reviews, revocation, replay and erasure passed.')
 }finally{await app.close()}
}

async function readinessScreens({browser,evidence,app,renewalId,api,readiness,timelineInput,participant,owner}){
 for(const width of [1440,390]){
  console.log('Renewal readiness: browser viewport',width)
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...parts]=pair.split('=');return {name,value:parts.join('='),url:app.origin}}))
   const page=await context.newPage(),url=app.origin+'/app/renewals?renewal='+renewalId
   await page.goto(url,{waitUntil:'networkidle'})
   console.log('Renewal readiness: native page loaded',width)
   const panel=page.locator('#renewal-readiness')
   assert.match(await panel.innerText(),/Champion departed: Morgan Hale/);assert.match(await panel.innerText(),/Customer confirms reporting time saved/)
   assert.match(await panel.innerText(),/Stripe does not match/)
   const disclosure=page.locator('#renewal-timeline-panel');await disclosure.locator('summary').click()
   const form=page.locator('#renewal-timeline');await form.getByLabel('Customer participant').selectOption(participant.id);await form.getByLabel('Timeline staff owner').selectOption(owner)
   await submit(page,form.getByRole('button',{name:'Prepare joint timeline',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)
   const timeline=(await readiness()).timelines.filter(t=>!t.approvedAt&&t.current).at(-1);assert.ok(timeline)
   const review=page.locator('#renewal-timeline-'+timeline.id);assert.match(await review.innerText(),/Customer agreement unconfirmed/)
   await scan(page,'Renewal readiness prepared '+width);await panel.screenshot({path:join(evidence,'renewal-readiness-prepared-'+width+'.png')})
   await submit(page,review.getByRole('button',{name:'Approve internal timeline',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)
   assert.ok((await readiness()).timelines.find(t=>t.id===timeline.id).approvedAt)
   await scan(page,'Renewal readiness approved '+width);await panel.screenshot({path:join(evidence,'renewal-readiness-approved-'+width+'.png')})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Renewal readiness reflows')
   assert.deepEqual(await panel.locator('*').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&n.textContent.trim()&&getComputedStyle(n).fontSize&&parseFloat(getComputedStyle(n).fontSize)<13).map(n=>n.tagName)),[],'Readable text at each viewport')
  }finally{await context.close()}
 }
}
