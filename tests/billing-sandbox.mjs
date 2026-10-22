// Held-key qualification, deliberately outside push Verify. Setup writes belong
// to this fixture actor. Every request made by Buoy is independently checked GET.
import assert from 'node:assert/strict'
import {startBillingTunnel} from './billing-tunnel.mjs'
import {setTimeout as delay} from 'node:timers/promises'
import {startWorker} from './worker.mjs'
const key=process.env.STRIPE_TEST_KEY??process.env.STRIPE_TEST_SECRET_KEY
assert.ok(key&&/^(sk|rk)_test_/.test(key),'A held Stripe test key must be injected by name')
const version='2025-02-24.acacia',setupCalls=[],productCalls=[],delivered=[],runTag='synthetic-buoy-'+Date.now()
let app,tunnel,endpoint,clock,connectionId,monthly,annual
const created={customers:[],prices:[],product:null,subscriptions:[]}
async function stripe(method,path,values={},allowed=[200]){
 const url=new URL('https://api.stripe.com/v1'+path),params=new URLSearchParams()
 for(const [name,value]of Object.entries(values))params.set(name,String(value))
 if(method==='GET')url.search=params.toString()
 setupCalls.push({method,path})
 const response=await fetch(url,{method,redirect:'manual',headers:{Authorization:'Bearer '+key,'Stripe-Version':version,...(method==='GET'?{}:{'content-type':'application/x-www-form-urlencoded'})},...(method==='GET'?{}:{body:params}),signal:AbortSignal.timeout(30000)})
 const body=await response.json()
 if(!allowed.includes(response.status))throw new Error(`Stripe sandbox setup ${method} ${path.split('/').slice(0,2).join('/')} failed HTTP ${response.status} (${body.error?.type??'unknown'}/${body.error?.code??'unknown'}).`)
 return body
}
async function waitFor(label,check,timeout=120000){
 const until=Date.now()+timeout
 while(Date.now()<until){const value=await check();if(value)return value;await delay(500)}
 throw new Error('Timed out: '+label)
}
async function api(path,method='GET',body,status=200){const response=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.equal(response.status,status,`${method} ${path} failed HTTP ${response.status}`);return response.json()}
const state=()=>api('/billing')
async function observed(accountId){return (await state()).observations.find(o=>o.accountId===accountId)}
async function syncPair(){for(let i=0;i<2;i++){const r=await api('/billing/'+connectionId+'/sync','POST',{});assert.equal(r.status,'succeeded',r.error)}}
async function assertRevenue(accountId,expected,label){const row=await observed(accountId);assert.ok(row,label+' has source observation');const revenue=row.document.revenue.find(r=>r.currency==='USD');assert.ok(revenue);assert.equal(revenue.arr.roundedMinor,expected,label+' Stripe-derived annualized recurring amount');assert.equal(revenue.mrr.roundedMinor,Math.round(expected/12),label+' monthly normalized amount');return row}
async function webhookAfter(count,predicate,label){
 await waitFor(label,async()=>delivered.length>count&&(await predicate()))
 assert.ok(delivered.slice(count).some(d=>d.status===200),'Stripe delivered a provider-signed event accepted through the public webhook door')
}
async function startRelay(){
 tunnel=await startBillingTunnel(async request=>{
  const response=await app.dispatch(new Request(app.origin+'/api/buoy/billing/'+connectionId+'/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':request.headers.get('stripe-signature')??''},body:await request.arrayBuffer()}))
  delivered.push({status:response.status,at:new Date().toISOString()})
  return response
 })
 return tunnel.url
}

try{
 console.log('Stripe sandbox: preparing real test subscriptions and read-only Buoy transport.')
 app=await startWorker({providerFetch:async request=>{
  const url=new URL(request.url);assert.equal(url.origin,'https://api.stripe.com');assert.equal(request.method,'GET','Buoy never writes to Stripe')
  assert.match(url.pathname,/^\/v1\/(customers\/[A-Za-z0-9_-]+|customers|subscriptions|subscription_items|invoices|payment_intents|charges(?:\/[A-Za-z0-9_-]+)?|refunds|credit_notes)$/)
  productCalls.push({method:request.method,path:url.pathname,at:new Date().toISOString()})
  return fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),redirect:'manual',signal:AbortSignal.timeout(30000)})
 }})
 const on=new Date().toISOString().slice(0,10),renewal=new Date(Date.now()+365*86400000).toISOString().slice(0,10)
 const createAccount=(id,name)=>api('/accounts','POST',{id,name,renewalDate:renewal,noticeDays:30,renewalEvidence:'Stripe sandbox synthetic test order',billing:null,support:null},201)
 const account1=await createAccount('synthetic-buoy-1','Synthetic monthly Stripe customer'),account2=await createAccount('synthetic-buoy-2','Synthetic annual Stripe customer')
 const connection=await api('/connections','POST',{name:'Held-key Stripe test billing',key},201);connectionId=connection.id
 // Start behind real time so an overdue invoice is a real calendar fact when
 // Buoy reads it. The test clock affects provider fixtures only.
 clock=await stripe('POST','/test_helpers/test_clocks',{frozen_time:Math.floor(Date.now()/1000)-5*86400,name:runTag})
 created.product=await stripe('POST','/products',{name:runTag})
 const createPrice=async(amount,interval)=>{const p=await stripe('POST','/prices',{product:created.product.id,currency:'usd',unit_amount:amount,'recurring[interval]':interval,'metadata[fixture]':runTag});created.prices.push(p);return p}
 const [basePrice,annualPrice,upgradePrice,downgradePrice]=[await createPrice(2500,'month'),await createPrice(60001,'year'),await createPrice(5500,'month'),await createPrice(1500,'month')]
 for(let i=0;i<2;i++){
  const method=await stripe('POST','/payment_methods',{type:'card','card[token]':'tok_visa'})
  const customer=await stripe('POST','/customers',{name:runTag+'-'+(i+1),test_clock:clock.id,payment_method:method.id,'invoice_settings[default_payment_method]':method.id,'metadata[fixture]':runTag});assert.equal(customer.livemode,false);created.customers.push(customer)
 }
 monthly=await stripe('POST','/subscriptions',{customer:created.customers[0].id,'items[0][price]':basePrice.id,'items[0][quantity]':3,payment_behavior:'error_if_incomplete','metadata[fixture]':runTag});created.subscriptions.push(monthly.id)
 annual=await stripe('POST','/subscriptions',{customer:created.customers[1].id,'items[0][price]':annualPrice.id,'items[0][quantity]':2,payment_behavior:'error_if_incomplete','metadata[fixture]':runTag});created.subscriptions.push(annual.id)
 for(const [customerId,accountId]of [[created.customers[0].id,account1.id],[created.customers[1].id,account2.id]]){
  const review=await api('/billing/'+connectionId+'/bindings/preview','POST',{customerId,accountId});await api('/billing/'+connectionId+'/bindings','POST',{token:review.token},201)
 }
 await syncPair();await assertRevenue(account1.id,2500*3*12,'Monthly subscription');await assertRevenue(account2.id,60001*2,'Annual subscription')
 const monthlyFirst=await observed(account1.id),annualFirst=await observed(account2.id)
 const card=(await api('/scorecards')),config={name:'Held-key Stripe source propagation',measures:[{key:'arr',name:'Source ARR',field:'stripe.arrMinor',min:0,max:200000,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:60,healthyAt:75},segments:[]}
 await api('/scorecards/publish','POST',{revision:card.revision,config},201)
 const expansionSegment=await api('/segments','POST',{name:'Stripe webhook expansion',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'stripe.currency',op:'eq',value:'USD'},{field:'stripe.arrMinor',op:'gt',value:150000}]},tier:null,stage:null,playbook:null},201)
 assert.equal((await api('/segments/'+expansionSegment.id+'/report')).count,0)

 assert.ok(monthlyFirst.document.payments.some(p=>p.status==='succeeded'));assert.equal(monthlyFirst.sourceSystem,'stripe-test')
 const webhookUrl=await startRelay()
 endpoint=await stripe('POST','/webhook_endpoints',{url:webhookUrl,api_version:version,'enabled_events[0]':'customer.subscription.updated','enabled_events[1]':'customer.subscription.deleted','enabled_events[2]':'invoice.payment_failed','enabled_events[3]':'invoice.updated','enabled_events[4]':'charge.refunded','enabled_events[5]':'refund.created','enabled_events[6]':'credit_note.created','metadata[fixture]':runTag})
 assert.ok(endpoint.secret,'Stripe returns the endpoint signing secret only at creation')
 await api('/billing/'+connectionId+'/webhook-secret','PUT',{secret:endpoint.secret})
 console.log('Stripe sandbox: monthly and annual math passed; waiting for provider-signed changes.')
 let count=delivered.length
 await stripe('POST','/subscriptions/'+monthly.id,{'items[0][id]':monthly.items.data[0].id,'items[0][price]':upgradePrice.id,'items[0][quantity]':3,proration_behavior:'none'})
 await webhookAfter(count,async()=>((await observed(account1.id))?.document.revenue[0]?.arr.roundedMinor)===5500*3*12,'provider-signed upgrade webhook')
 await assertRevenue(account1.id,5500*3*12,'Upgrade')
 const upgradeCard=(await api('/scorecards')).accounts.find(a=>a.accountId===account1.id),acceptedAt=delivered.findLast(d=>d.status===200).at
 assert.equal(upgradeCard.breakdown[0].rawValue,198000);assert.ok(Date.parse(upgradeCard.calculatedAt)<=Date.parse(acceptedAt),'Real provider delivery recalculates published health before its response')
 assert.deepEqual((await api('/segments/'+expansionSegment.id+'/report')).accounts.map(a=>a.accountId),[account1.id])
 const membership=(await api('/segments')).segments.find(s=>s.id===expansionSegment.id).history.find(h=>h.accountId===account1.id&&!h.exitedAt);assert.ok(Date.parse(membership.enteredAt)<=Date.parse(acceptedAt),'Real provider delivery publishes segment entry before its response')
 count=delivered.length
 await stripe('POST','/subscriptions/'+monthly.id,{'items[0][id]':monthly.items.data[0].id,'items[0][price]':downgradePrice.id,'items[0][quantity]':3,proration_behavior:'none'})
 await webhookAfter(count,async()=>((await observed(account1.id))?.document.revenue[0]?.arr.roundedMinor)===1500*3*12,'provider-signed downgrade webhook')
 await assertRevenue(account1.id,1500*3*12,'Downgrade');assert.equal((await api('/segments/'+expansionSegment.id+'/report')).count,0,'Provider downgrade exits the source ARR segment')
 // A real invoice payment attempt with Stripe's documented declining test card.
 const failedMethod=await stripe('POST','/payment_methods',{type:'card','card[token]':'tok_chargeCustomerFail'})
 await stripe('POST','/payment_methods/'+failedMethod.id+'/attach',{customer:created.customers[0].id})
 await stripe('POST','/invoiceitems',{customer:created.customers[0].id,currency:'usd',amount:8500,description:runTag+' failed payment'})
 let invoice=await stripe('POST','/invoices',{customer:created.customers[0].id,collection_method:'send_invoice',days_until_due:1,auto_advance:false,pending_invoice_items_behavior:'include'})
 invoice=await stripe('POST','/invoices/'+invoice.id+'/finalize',{auto_advance:false})
 count=delivered.length
 const attempted=await stripe('POST','/invoices/'+invoice.id+'/pay',{payment_method:failedMethod.id},[402]);assert.ok(attempted.error,'Stripe declines the fixture payment')
 await webhookAfter(count,async()=>(await observed(account1.id))?.document.risks.some(r=>r.kind==='failed-payment'&&r.reference===invoice.id),'provider-signed failed invoice payment')
 const failureRow=await observed(account1.id);assert.ok(failureRow.document.risks.some(r=>r.kind==='overdue-invoice'&&r.reference===invoice.id&&r.amountMinor===8500),'A real past-due provider invoice has its exact remaining balance')
 assert.deepEqual((await observed(account2.id)).document.risks,[],'No failed payment leaks to the annual customer')
 // Refund and credit-note facts are retained without mutating recurring revenue.
 const paidInvoice=await stripe('GET','/invoices/'+monthly.latest_invoice)
 assert.ok(paidInvoice.charge,'Paid subscription invoice has a charge')
 await stripe('POST','/refunds',{charge:paidInvoice.charge,amount:200,'metadata[fixture]':runTag})
 await stripe('POST','/credit_notes',{invoice:paidInvoice.id,'lines[0][type]':'custom_line_item','lines[0][description]':runTag+' credit','lines[0][quantity]':1,'lines[0][unit_amount]':100,out_of_band_amount:100,'metadata[fixture]':runTag})
 await waitFor('provider refund and credit-note observation',async()=>{const r=await observed(account1.id);return r?.document.refunds.some(r=>r.amountMinor===200)&&r?.document.creditNotes.some(r=>r.amountMinor===100)})
 await assertRevenue(account1.id,1500*3*12,'Credits leave recurring subscription revenue unchanged')
 count=delivered.length
 await stripe('DELETE','/subscriptions/'+monthly.id)
 await webhookAfter(count,async()=>((await observed(account1.id))?.document.revenue[0]?.arr.roundedMinor)===0,'provider-signed cancellation webhook')
 await assertRevenue(account1.id,0,'Cancellation');await assertRevenue(account2.id,60001*2,'Independent annual customer after cancellation')
 const before=(await state()).history.length;await app.scheduled();assert.ok((await state()).history.length>before,'Public scheduled Worker door performs periodic reconciliation')
 assert.ok(productCalls.length>0&&productCalls.every(c=>c.method==='GET'))
 const final=await state();assert.ok(final.history.some(r=>r.id===monthlyFirst.id));assert.ok(final.history.some(r=>r.id===annualFirst.id))
 assert.ok(final.changes.some(c=>c.before?.some(s=>s.lines.some(l=>l.priceId===upgradePrice.id))&&c.after.some(s=>s.lines.some(l=>l.priceId===downgradePrice.id))))
 console.log(JSON.stringify({qualification:'Stripe test-mode billing',result:'passed',at:new Date().toISOString(),checks:['monthly ARR 90000 / MRR 7500','annual ARR 120002 / exact MRR 60001/6','upgrade ARR 198000','downgrade ARR 54000','failed payment and exact overdue balance 8500 on monthly account only','refund 200 and credit note 100 retained','cancellation ARR 0','actual Stripe-delivered signature verification and immediate health/segment propagation','periodic reconciliation','prior immutable source history','all Buoy Stripe requests GET'],providerDeliveries:delivered.length,acceptedProviderDeliveries:delivered.filter(d=>d.status===200).length,productReadCalls:productCalls.length,productWriteCalls:productCalls.filter(c=>c.method!=='GET').length,fixtureSetupCalls:setupCalls.length,on}))
}finally{
 // Tear down the provider sender first; then stop only exact children owned here.
 if(endpoint){try{await stripe('DELETE','/webhook_endpoints/'+endpoint.id)}catch{console.error('Stripe sandbox cleanup: webhook endpoint requires manual removal by fixture metadata.')}}
 let tunnelCleanupError;if(tunnel){try{await tunnel.close()}catch(error){tunnelCleanupError=error}}
 if(app)await app.close()
 // Clock deletion removes its test customers and their subscriptions. Prices
 // are archived explicitly; Stripe retains financial test records by design.
 if(clock){try{await stripe('DELETE','/test_helpers/test_clocks/'+clock.id)}catch{console.error('Stripe sandbox cleanup: test clock requires manual removal by fixture metadata.')}}
 for(const price of created.prices){try{await stripe('POST','/prices/'+price.id,{active:false})}catch{console.error('Stripe sandbox cleanup: price requires manual archival by fixture metadata.')}}
 if(created.product){try{await stripe('POST','/products/'+created.product.id,{active:false})}catch{console.error('Stripe sandbox cleanup: product requires manual archival by fixture metadata.')}}
 if(tunnelCleanupError)throw tunnelCleanupError
}
