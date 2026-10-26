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
if(process.argv[1]?.endsWith('/provider-reporting.mjs')){const {billingSource,billingFixtureKey}=await import('./billing-journey.mjs');await providerReportingJourney(billingSource(),billingFixtureKey)}
