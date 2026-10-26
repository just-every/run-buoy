// Live Stripe test-mode year and four-currency journey, outside push Verify.
// Only fixture setup writes to Stripe. Buoy's provider transport stays GET-only.
import assert from 'node:assert/strict'
import {setTimeout as delay} from 'node:timers/promises'
import {startWorker} from './worker.mjs'
import {ratesFixture} from './reporting-journey.mjs'
import {monthlyRevenueBrowser,providerReportingBrowser} from './provider-reporting-browser.mjs'
const key=process.env.STRIPE_TEST_KEY
assert.ok(key&&/^(sk|rk)_test_/.test(key),'Inject the held Stripe test key by name')
const tag='synthetic-buoy-'+Date.now(),version='2025-02-24.acacia',prices=[],customers=[],subscriptions=[],calls=[]
const monthly=process.argv.includes('--monthly'),clocks=[]
let clock,product,app,instant=Date.parse('2025-07-01T12:00:00Z'),cookie
async function stripe(method,path,values={}){
 const params=new URLSearchParams(Object.entries(values).map(([k,v])=>[k,String(v)])),url=new URL('https://api.stripe.com/v1'+path)
 if(method==='GET')url.search=params.toString()
 const response=await fetch(url,{method,headers:{authorization:'Bearer '+key,'stripe-version':version,...(method==='GET'?{}:{'content-type':'application/x-www-form-urlencoded'})},...(method==='GET'?{}:{body:params}),signal:AbortSignal.timeout(30000)})
 const body=await response.json();assert.ok(response.ok,'Stripe fixture '+method+' '+path.split('/').slice(0,2).join('/')+' HTTP '+response.status+' '+(body.error?.code??body.error?.type??'')+' parameter '+(body.error?.param??'none')+' '+String(body.error?.message??'').replaceAll(key,'[redacted]').replace(/\b(?:sk|rk)_(?:test|live)_[^\s"'<>]*/g,'[redacted]'));return body
}
async function advance(on){
 instant=Date.parse(on+'T12:00:00Z');for(const clock of clocks)await stripe('POST','/test_helpers/test_clocks/'+clock.id+'/advance',{frozen_time:instant/1000})
 const deadline=Date.now()+120000
 while(Date.now()<deadline){const states=await Promise.all(clocks.map(clock=>stripe('GET','/test_helpers/test_clocks/'+clock.id)));if(states.every(state=>state.status==='ready'))return;await delay(1000)}
 assert.fail('Stripe test clock did not finish advancing')
}
const codes=['USD','EUR','GBP','CAD'],accountIds=codes.map((_,i)=>'synthetic-buoy-'+(2000+i)),initial=[10000,10001,10000,10000],ending=[10000,15001,8000,monthly?0:10000]
try{
 for(let i=0;i<2;i++)clocks.push(await stripe('POST','/test_helpers/test_clocks',{frozen_time:instant/1000,name:tag+'-'+i}));clock=clocks[0];product=await stripe('POST','/products',{name:tag})
 app=await startWorker({clock:()=>instant,providerFetch:async request=>{assert.equal(request.method,'GET');assert.equal(new URL(request.url).origin,'https://api.stripe.com');calls.push({method:request.method,path:new URL(request.url).pathname});return fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),signal:AbortSignal.timeout(30000)})}});cookie=app.cookie
 const api=async(path,method='GET',body)=>{const r=await app.request('/api/buoy'+path,{cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()}
 const connection=await api('/connections','POST',{name:'Four currency Stripe test source',key}),base='/billing/'+connection.id
 const makePrice=async(currency,amount)=>{const p=await stripe('POST','/prices',{product:product.id,currency:currency.toLowerCase(),unit_amount:amount,'recurring[interval]':'month','metadata[fixture]':tag});prices.push(p);return p}
 for(const [i,currency]of codes.entries()){
  await api('/accounts','POST',{id:accountIds[i],name:currency+' subscription customer',renewalDate:'2026-07-01',noticeDays:30,renewalEvidence:'Synthetic sandbox order with confirmed notice terms',billing:null,support:null})
  const method=await stripe('POST','/payment_methods',{type:'card','card[token]':'tok_visa'}),customer=await stripe('POST','/customers',{name:tag+'-'+currency,email:tag+'-'+currency+'@example.test',test_clock:clocks[Math.floor(i/3)].id,payment_method:method.id,'invoice_settings[default_payment_method]':method.id,'metadata[fixture]':tag});customers.push(customer);assert.equal(customer.livemode,false)
  const price=await makePrice(currency,initial[i]),subscription=await stripe('POST','/subscriptions',{customer:customer.id,'items[0][price]':price.id,payment_behavior:'error_if_incomplete','metadata[fixture]':tag});subscriptions.push(subscription)
  const review=await api(base+'/bindings/preview','POST',{customerId:customer.id,accountId:accountIds[i]});await api(base+'/bindings','POST',{token:review.token})
 }
 await api('/revenue/rates','POST',{revision:null,table:ratesFixture()})
 const capture=async()=>{cookie=await app.signIn('owner@example.test');for(let i=0;i<4;i++){instant+=1000;const run=await api(base+'/sync','POST',{});assert.equal(run.status,'succeeded',run.error)}}
 await capture()
 for(const on of ['2025-07-31','2025-08-31','2025-09-30','2025-10-31','2025-11-30','2025-12-31','2026-01-31','2026-02-28','2026-03-31']){await advance(on);await capture();console.log('Retained Stripe test-clock month',on)}
 await advance('2026-04-01')
 for(const i of [1,2]){const price=await makePrice(codes[i],ending[i]);await stripe('POST','/subscriptions/'+subscriptions[i].id,{'items[0][id]':subscriptions[i].items.data[0].id,'items[0][price]':price.id,proration_behavior:'none'})}
 await capture()
 for(const on of ['2026-04-30','2026-05-31','2026-06-30']){await advance(on);if(monthly&&on==='2026-06-30')await stripe('DELETE','/subscriptions/'+subscriptions[3].id);await capture();console.log('Retained Stripe test-clock month',on)}
 // This real provider invoice has no subscription association. It is an
 // exception, never an invented recurring contribution.
 await stripe('POST','/invoiceitems',{customer:customers[0].id,currency:'usd',amount:12345,description:tag+' unmatched non-subscription invoice'})
 await stripe('POST','/invoices',{customer:customers[0].id,collection_method:'send_invoice',days_until_due:30,auto_advance:false,pending_invoice_items_behavior:'include','metadata[fixture]':tag});await capture()
 const query='?period=quarter&end=2026-06-30',report=await api('/revenue/retention'+query),state=await api('/billing'),native=structuredClone(state.observations.map(o=>o.document).sort((a,b)=>a.customerId.localeCompare(b.customerId)))
 const startRates=[100,110,130,75],endRates=[100,120,140,80],round=(minor,rate)=>Math.floor((minor*rate+50)/100)
 let start=0,endConstant=0,endUsd=0,gross=0
 for(const [i,currency]of codes.entries()){
  const row=report.rows.find(r=>r.accountId===accountIds[i]),a=initial[i]*12,b=ending[i]*12,usdA=round(a,startRates[i]),usdB=round(b,startRates[i]),usdEnd=round(b,endRates[i]);start+=usdA;endConstant+=usdB;endUsd+=usdEnd;gross+=Math.min(usdA,usdB)
  assert.deepEqual([row.currency,row.startMinor,row.endMinor,row.usdStartMinor,row.usdEndConstantMinor,row.usdEndMinor],[currency,a,b,usdA,usdB,usdEnd]);assert.equal(row.fxMinor,usdEnd-usdB)
  const observation=state.observations.find(o=>o.accountId===accountIds[i]);assert.ok(observation.document.invoices.length>=12,'A real year of provider invoices is retained');assert.ok(observation.document.payments.every(p=>p.currency===currency));assert.ok(row.sourceLinks.some(l=>l.label.startsWith('Invoice ')))
  const revenue=(await api('/revenue?on=2026-06-30')).accounts.find(a=>a.accountId===accountIds[i]).revenue;assert.equal(revenue.reporting.arrMinor,usdEnd);assert.equal(revenue.reporting.mrrMinor,round(ending[i],endRates[i]))
 }
 assert.deepEqual(report.usd.nrr,{numeratorMinor:endConstant,denominatorMinor:start});assert.deepEqual(report.usd.grr,{numeratorMinor:gross,denominatorMinor:start});assert.equal(report.usd.fxMinor,endUsd-endConstant);assert.equal(report.usd.endPortfolioMinor,endUsd)
 assert.ok(report.exceptions.some(e=>e.reason.includes('Unmatched Stripe invoice')&&e.reason.includes('12345')))
 const prior=await api('/revenue/retention?period=quarter&end=2026-03-31');assert.equal(prior.usd.expansionMinor,0);assert.equal(prior.usd.contractionMinor,0)
 await app.scheduled('0 * * * *',instant);cookie=await app.signIn('owner@example.test')
 const forecast=await api('/renewals/forecast?period=month&start=2026-07-01&on=2026-06-30')
 for(const [i,currency]of codes.entries()){if(monthly&&i===3)continue;const r=forecast.records.find(r=>r.accountId===accountIds[i]);assert.ok(r,'Provider renewal exists for '+currency);assert.equal(r.usdArrMinor,round(ending[i]*12,endRates[i]));assert.equal(r.rate.tableName,ratesFixture().name)}
 const table=ratesFixture();table.rates.find(r=>r.currency==='EUR'&&r.from==='2026-04-01').usdPerUnit='1.25'
 const published=await api('/revenue/rates','POST',{revision:(await api('/revenue/rates')).table.revision,table}),restated=await api('/revenue/retention'+query)
 assert.equal(restated.usd.endCohortMinor,endConstant);assert.equal(restated.rows.find(r=>r.currency==='EUR').usdEndMinor,round(ending[1]*12,125));assert.ok((await api('/audit?action=revenue.rates-published')).entries.some(e=>e.subject==='rate-table:'+published.revision))
 assert.deepEqual((await api('/billing')).observations.map(o=>o.document).sort((a,b)=>a.customerId.localeCompare(b.customerId)),native,'All native provider financial amounts survive rate restatement')
 await providerReportingBrowser({app,cookie,api,accountIds,query})
 if(monthly){
  const histories=(await api('/revenue?on=2026-06-30')).monthly
  for(const [i,id]of accountIds.entries()){
   const h=histories.find(h=>h.accountId===id);assert.equal(h.months.length,12);let prior=0
   for(const [month,row]of h.months.entries()){
    const current=(i===3?(month===11?0:initial[i]):month>=9?ending[i]:initial[i])*12,movement=month===0?'new':i===1&&month===9?'expansion':i===2&&month===9?'contraction':i===3&&month===11?'churn':'unchanged',native=row.currencies.find(c=>c.currency===codes[i])
    assert.deepEqual([native.start.arrMinor,native.end.arrMinor,native.movement],[prior,current,movement]);prior=current
    assert.ok(native.sourceLinks.some(l=>l.label.startsWith('Invoice '))||native.sourceLinks.some(l=>l.label.startsWith('Subscription change ')))
   }
  }
  const movement=(i,month)=>histories.find(h=>h.accountId===accountIds[i]).months.find(m=>m.month===month).currencies[0].movement
  assert.equal(movement(0,'2025-07'),'new');assert.equal(movement(1,'2026-04'),'expansion');assert.equal(movement(2,'2026-04'),'contraction');assert.equal(movement(3,'2026-06'),'churn')
  const account=(await api('/state')).accounts.find(a=>a.id===accountIds[0])
  await api('/accounts/'+account.id+'/contract','POST',{revision:account.revision,contract:{currency:'USD',contractStart:'2025-07-01',contractEnd:'2027-07-01',lines:[{product:'Reviewed sandbox order',quantity:1,amountMinor:130000,frequency:'annual',entitlements:'One contracted workspace'}],source:{reference:'Person-reviewed sandbox order differs from billing',confirmedOn:'2026-06-30'}}})
  const pending=(await api('/revenue?on=2026-06-30')).reconciliation.find(r=>r.accountId===account.id);assert.equal(pending.status,'pending');assert.equal(pending.contract.arrMinor,130000);assert.equal(pending.stripe.amounts[0].arr.roundedMinor,120000)
  const before=structuredClone((await api('/billing')).observations.map(o=>o.document))
  await monthlyRevenueBrowser({app,cookie,accountId:account.id});assert.equal((await api('/revenue?on=2026-06-30')).reconciliation.find(r=>r.accountId===account.id).status,'resolved')
  assert.deepEqual((await api('/billing')).observations.map(o=>o.document),before);assert.equal((await api('/audit?action=revenue.mismatch-resolved')).entries.length,1)
  console.log('Live Stripe monthly history: twelve retained invoice months, new business, EUR expansion, GBP contraction, CAD churn, exact source links, native person-resolved contract mismatch and immutable provider records passed at 1440 and 390.')
 }
 console.log(JSON.stringify({result:'passed',qualification:'Stripe test mode only',checks:['twelve real provider invoice months','USD EUR GBP CAD two quarters','EUR upgrade and GBP downgrade','independent native and USD cents','NRR and GRR against the same retained provider export','FX isolated from financial movements','provider invoice and subscription drilldown','unmatched real invoice exception','native and converted provider forecast','audited rate restatement preserves native amounts','native account and report screens at 1440 and 390'],readCalls:calls.length,writeCalls:calls.filter(c=>c.method!=='GET').length,nrr:{numeratorMinor:endConstant,denominatorMinor:start},grr:{numeratorMinor:gross,denominatorMinor:start},fxMinor:endUsd-endConstant}))
}finally{
 if(app)await app.close()
 for(const clock of clocks)await stripe('DELETE','/test_helpers/test_clocks/'+clock.id)
 for(const price of prices)await stripe('POST','/prices/'+price.id,{active:false})
 if(product)await stripe('POST','/products/'+product.id,{active:false})
}
