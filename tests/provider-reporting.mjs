// Public Worker money journey. Only Stripe's transport and the clock are test edges.
import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
import {ratesFixture} from './reporting-journey.mjs'
export async function providerReportingJourney(source,billingFixtureKey){
 let instant=Date.parse('2026-03-31T12:00:00Z'),currency='eur',interval='month',intervalCount=1
 const app=await startWorker({clock:()=>instant,providerFetch:async request=>{
  const response=await source.fetch(request),body=await response.json(),url=new URL(request.url)
  if(url.pathname==='/v1/subscriptions')for(const row of body.data){row.created=Date.parse('2025-07-01T12:00:00Z')/1000;row.current_period_start=Math.floor(instant/1000)-86400;row.current_period_end=Math.floor(instant/1000)+30*86400}
  if(url.pathname==='/v1/subscription_items')for(const item of body.data){item.price.currency=currency;item.price.recurring.interval=interval;item.price.recurring.interval_count=intervalCount}
  if(url.pathname==='/v1/invoices')for(const row of body.data){row.currency=currency;row.subscription=null;row.created=Math.floor(instant/1000)}
  if(url.pathname==='/v1/payment_intents'||url.pathname==='/v1/refunds'||url.pathname==='/v1/credit_notes')for(const row of body.data)row.currency=currency
  return Response.json(body,{status:response.status})
 }})
 try{
  let cookie=app.cookie
  const api=async(path,method='GET',body)=>{const r=await app.request('/api/buoy'+path,{cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()}
  const id='synthetic-buoy-1900';await api('/accounts','POST',{id,name:'European billing customer',renewalDate:'2027-01-01',noticeDays:30,renewalEvidence:'Reviewed provider contract',billing:null,support:null})
  const connection=await api('/connections','POST',{name:'Reporting Stripe source',key:billingFixtureKey}),base='/billing/'+connection.id
  const review=await api(base+'/bindings/preview','POST',{customerId:'synthetic-buoy-101',accountId:id});await api(base+'/bindings','POST',{token:review.token})
  await api('/revenue/rates','POST',{revision:null,table:ratesFixture()})
  assert.ok((await api('/revenue/retention?period=quarter&end=2026-03-31')).exceptions.some(e=>e.accountId===id&&e.reason.includes('Missing Stripe read')))
  await api(base+'/sync','POST',{})
  instant=Date.parse('2026-06-30T12:00:00Z');cookie=await app.signIn('owner@example.test');source.amount=5500
  await api(base+'/sync','POST',{})
  const nativeBefore=(await api('/billing')).observations[0].document
  assert.ok((await api('/revenue?on=2026-06-30')).providers.every(p=>!('document' in p)&&!('credentialPresent' in p)),'Revenue summaries expose financial projections, not raw connection custody or provider documents')
  assert.equal((await api('/revenue?on=2026-03-31')).accounts.find(a=>a.accountId===id).revenue.arrMinor,90000,'Historical revenue uses the read retained at that date')
  const revenue=(await api('/revenue?on=2026-06-30')).accounts.find(a=>a.accountId===id).revenue
  assert.equal(revenue.arrMinor,198000);assert.equal(revenue.reporting.arrMinor,237600);assert.equal(revenue.reporting.mrrMinor,19800)
  const report=await api('/revenue/retention?period=quarter&end=2026-06-30'),row=report.rows.find(r=>r.accountId===id)
  assert.deepEqual([row.startMinor,row.endMinor,row.usdStartMinor,row.usdEndConstantMinor,row.usdEndMinor,row.fxMinor],[90000,198000,99000,217800,237600,19800])
  assert.deepEqual(report.usd.nrr,{numeratorMinor:217800,denominatorMinor:99000});assert.deepEqual(report.usd.grr,{numeratorMinor:99000,denominatorMinor:99000})
  assert.equal(row.movement,'expansion');assert.ok(row.sourceLinks.some(l=>l.label.startsWith('Invoice ')));assert.ok(report.exceptions.some(e=>e.reason.includes('Unmatched Stripe invoice')))
  const segment=await api('/segments','POST',{name:'Converted provider revenue',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'revenue.usdArrMinor',op:'gt',value:230000}]},tier:null,stage:null,playbook:null})
  assert.equal((await api('/segments/'+segment.id+'/report')).count,1)
  const edited=ratesFixture();edited.rates.find(r=>r.currency==='EUR'&&r.from==='2026-04-01').usdPerUnit='1.25'
  await api('/revenue/rates','POST',{revision:(await api('/revenue/rates')).table.revision,table:edited})
  assert.equal((await api('/revenue?on=2026-06-30')).accounts.find(a=>a.accountId===id).revenue.reporting.arrMinor,247500)
  assert.deepEqual((await api('/billing')).observations[0].document,nativeBefore,'Rate edits preserve every native subscription, invoice and payment amount')
  const current=await api('/audit?action=revenue.rates-published');assert.equal(current.entries.length,2)
  const noRates={name:'Missing source rates',mode:'corporate',rates:[]};await api('/revenue/rates','POST',{revision:(await api('/revenue/rates')).table.revision,table:noRates})
  assert.equal((await api('/revenue/retention?period=quarter&end=2026-06-30')).usd.available,false)
  interval='week';intervalCount=2;instant+=1000;await api(base+'/sync','POST',{})
  const fractional=(await api('/revenue?on=2026-06-30')).accounts.find(a=>a.accountId===id).revenue.mrrExact,nativeFraction=(await api('/billing')).observations[0].document.revenue[0].mrr
  assert.equal(BigInt(fractional.numeratorMinor)*BigInt(nativeFraction.denominator),BigInt(nativeFraction.numeratorMinor)*BigInt(fractional.denominator),'Public provider MRR preserves the exact source fraction before any native or USD rounding')
  console.log('Provider reporting: exact native and USD revenue, independent NRR and GRR, isolated FX, invoice exceptions, retained source links, explicit USD segments and audited native-preserving restatement passed.')
 }finally{await app.close()}
}

export async function providerMonthlyJourney(source,billingFixtureKey,{browser=false}={}){
 let instant=Date.parse('2025-07-01T12:00:00Z')
 const app=await startWorker({clock:()=>instant,providerFetch:async request=>{
  const response=await source.fetch(request),body=await response.json(),path=new URL(request.url).pathname
  if(path==='/v1/subscriptions')for(const row of body.data){row.created=Date.parse('2025-07-01T12:00:00Z')/1000;row.current_period_start=Math.floor(instant/1000);row.current_period_end=Math.floor(instant/1000)+30*86400}
  if(path==='/v1/invoices')for(const row of body.data){row.created=Math.floor(instant/1000);row.subscription='synthetic-buoy-301'}
  return Response.json(body,{status:response.status})
 }})
 try{
  let cookie=app.cookie
  const api=async(path,method='GET',body)=>{const r=await app.request('/api/buoy'+path,{cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()}
  const accountId='synthetic-buoy-1950';await api('/accounts','POST',{id:accountId,name:'Monthly subscription history',renewalDate:'2027-01-01',noticeDays:30,renewalEvidence:'Reviewed provider order',billing:null,support:null})
  const connection=await api('/connections','POST',{name:'Monthly Stripe source',key:billingFixtureKey}),base='/billing/'+connection.id
  const preview=await api(base+'/bindings/preview','POST',{customerId:'synthetic-buoy-101',accountId});await api(base+'/bindings','POST',{token:preview.token})
  const sync=async()=>{instant+=1000;const run=await api(base+'/sync','POST',{});assert.equal(run.status,'succeeded',run.error)}
  source.amount=10000;await sync()
  const months=['2025-07-31','2025-08-31','2025-09-30','2025-10-31','2025-11-30','2025-12-31','2026-01-31','2026-02-28','2026-03-31','2026-04-30','2026-05-31','2026-06-30']
  for(const [i,on]of months.entries()){
   instant=Date.parse(on+'T12:00:00Z');cookie=await app.signIn('owner@example.test');source.amount=i===1?15000:i===2?8000:10000;source.status=i===3?'canceled':'active';await sync()
  }
  let data=await api('/revenue?on=2026-06-30'),history=data.monthly.find(h=>h.accountId===accountId)
  assert.deepEqual(history.months.map(m=>m.month),months.map(m=>m.slice(0,7)))
  assert.deepEqual(history.months.map(m=>m.currencies[0].movement),['new','expansion','contraction','churn','reactivation',...Array(7).fill('unchanged')])
  assert.deepEqual(history.months.slice(0,5).map(m=>[m.currencies[0].start.arrMinor,m.currencies[0].end.arrMinor]),[[0,360000],[360000,540000],[540000,288000],[288000,0],[0,360000]])
  assert.ok(history.months.every(m=>m.currencies.every(c=>c.sourceLinks.some(l=>l.label.startsWith('Invoice '))||c.sourceLinks.some(l=>l.label.startsWith('Subscription change ')))))
  const config={name:'Provider payment review health',measures:[{key:'failures',name:'Payment failures',field:'stripe.failedPayments',min:0,max:1,weight:1,direction:'lower',missing:'unknown'}],bands:{riskBelow:60,healthyAt:75},segments:[]}
  await api('/scorecards/publish','POST',{revision:(await api('/scorecards')).revision,config})
  source.amount=200000;await sync()
  const segment=await api('/segments','POST',{name:'Sourced ARR and health review',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'revenue.currency',op:'eq',value:'USD'},{field:'revenue.arrMinor',op:'gt',value:5000000},{field:'health.score',op:'lt',value:60}]},tier:null,stage:null,playbook:{title:'Review sourced recurring health',dueDays:2}})
  const report=()=>api('/segments/'+segment.id+'/report'),state=()=>api('/state')
  assert.deepEqual((await report()).accounts.map(a=>a.accountId),[accountId]);assert.equal((await state()).accounts.find(a=>a.id===accountId).health.score,0)
  let entry=(await api('/segments')).segments.find(s=>s.id===segment.id).history.find(h=>!h.exitedAt)
  await api('/proposals/'+entry.proposalId+'/approve','POST',{});await api('/proposals/'+entry.proposalId+'/approve','POST',{})
  assert.equal((await state()).tasks.filter(t=>t.proposalId===entry.proposalId).length,1)
  source.amount=100000;await sync();assert.equal((await report()).count,0)
  source.amount=200000;await sync();assert.equal((await report()).count,1)
  source.paymentFailed=false;await sync();assert.equal((await report()).count,0)
  source.paymentFailed=true;await sync();assert.equal((await report()).count,1)
  const csv=await app.request('/api/buoy/segments/'+segment.id+'/report.csv',{cookie});assert.equal(csv.status,200);assert.ok((await csv.text()).includes('Monthly subscription history'))
  const account=(await state()).accounts.find(a=>a.id===accountId)
  await api('/accounts/'+accountId+'/contract','POST',{revision:account.revision,contract:{currency:'USD',contractStart:'2025-07-01',contractEnd:'2027-07-01',lines:[{product:'Reviewed contract',quantity:3,amountMinor:6000000,frequency:'annual',entitlements:'Three contracted seats'}],source:{reference:'Person-confirmed recurring terms differ from Stripe',confirmedOn:'2026-06-30'}}})
  data=await api('/revenue?on=2026-06-30');const pending=data.reconciliation.find(r=>r.accountId===accountId)
  assert.equal(pending.status,'pending');assert.equal(pending.contract.arrMinor,6000000);assert.equal(pending.stripe.amounts[0].arr.roundedMinor,7200000)
  const variance=async()=>assert.ok((await api('/revenue/retention?period=quarter&end=2026-06-30')).exceptions.some(e=>e.accountId===accountId&&e.reason.includes('Confirmed contract and Stripe ARR differ')))
  await variance()
  const body={revision:pending.revision,contractVersionId:pending.contractVersionId,contractRevision:pending.contractRevision,billingSnapshotId:pending.billingSnapshotId,reason:'Reviewed signed order and billing schedule; retain their documented difference.'},path='/accounts/'+accountId+'/revenue-reconciliation'
  const memberInvite=await app.request('/auth/invite',{cookie,method:'POST',body:{email:'synthetic-buoy-1951@example.test',displayName:'Revenue reader',role:'member'}});assert.equal(memberInvite.status,202)
  const member=await app.signIn('synthetic-buoy-1951@example.test'),staff=await (await app.request('/api/buoy/revenue',{cookie:member})).json();assert.deepEqual(staff.monthly,[]);assert.deepEqual(staff.reconciliation,[])
  for(const options of [{cookie:member},{cookie:undefined},{cookie,headers:{origin:'https://foreign.invalid'}}])assert.equal((await app.request('/api/buoy'+path,{...options,method:'POST',body})).status,options.cookie===undefined?401:403)
  if(browser){const {monthlyRevenueBrowser}=await import('./provider-reporting-browser.mjs');await monthlyRevenueBrowser({app,cookie,accountId})}
  const native=(await api('/billing')).observations.find(o=>o.accountId===accountId).document
  if(!browser)await api(path,'POST',body);data=await api('/revenue?on=2026-06-30');assert.equal(data.reconciliation.find(r=>r.accountId===accountId).status,'resolved');assert.equal(data.accounts.find(a=>a.accountId===accountId).revenue.arrMinor,6000000)
  assert.deepEqual((await api('/billing')).observations.find(o=>o.accountId===accountId).document,native);await variance()
  assert.equal((await app.request('/api/buoy'+path,{cookie,method:'POST',body})).status,409)
  assert.ok((await api('/audit?action=revenue.mismatch-resolved')).entries.length===1)
  await sync();assert.equal((await api('/revenue?on=2026-06-30')).reconciliation.find(r=>r.accountId===accountId).status,'pending')
  assert.equal((await app.request('/api/buoy'+path,{cookie,method:'POST',body})).status,409)
  await api('/accounts/'+accountId,'DELETE',{confirmation:'Monthly subscription history'});assert.ok(!(await api('/revenue')).monthly.some(h=>h.accountId===accountId));assert.ok(!(await api('/revenue')).reconciliation.some(r=>r.accountId===accountId))
  console.log('Provider monthly history: twelve months, exact new, expansion, contraction, churn and reactivation, retained source links, sourced ARR and health entry and exit, approved playbook and CSV, privileged human reconciliation, immutable sources and stale resolution guards passed.')
 }finally{await app.close()}
}

if(process.argv[1]?.endsWith('/provider-reporting.mjs')){const {billingSource,billingFixtureKey}=await import('./billing-journey.mjs');await providerReportingJourney(billingSource(),billingFixtureKey);await providerMonthlyJourney(billingSource(),billingFixtureKey,{browser:process.argv.includes('--browser')})}
