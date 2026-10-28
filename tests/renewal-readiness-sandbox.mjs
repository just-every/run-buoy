// Held-key Stripe TEST qualification; intentionally outside push Verify.
// Provider writes belong only to this fixture actor. Product transport stays GET-only.
import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'

const key=process.env.STRIPE_TEST_KEY
assert.ok(key&&/^(sk|rk)_test_/.test(key),'Inject the dedicated Stripe test key by environment name')
const version='2025-02-24.acacia',tag='synthetic-buoy-uplift-'+Date.now(),prices=[],productCalls=[]
let product,customer,subscription,app,summary
async function stripe(method,path,values={}){
 const params=new URLSearchParams(Object.entries(values).map(([k,v])=>[k,String(v)]))
 let response
 try{response=await fetch('https://api.stripe.com/v1'+path,{method,redirect:'manual',headers:{authorization:'Bearer '+key,'Stripe-Version':version,'content-type':'application/x-www-form-urlencoded'},...(method==='DELETE'?{}:{body:params}),signal:AbortSignal.timeout(30000)})}
 catch{throw new Error('Stripe test fixture transport failed')}
 assert.equal(response.status,200,'Stripe test fixture operation HTTP status')
 return response.json()
}
try{
 app=await startWorker({providerFetch:async request=>{
  assert.equal(new URL(request.url).origin,'https://api.stripe.com')
  assert.equal(request.method,'GET','Product must never write provider billing')
  productCalls.push(request.method)
  return fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),redirect:'manual',signal:AbortSignal.timeout(30000)})
 }})
 const api=async(path,method='GET',body)=>{
  const response=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body})
  assert.ok(response.ok,'Buoy public API operation HTTP '+response.status)
  return response.json()
 }
 product=await stripe('POST','/products',{name:tag})
 for(const amount of [10000,12000])prices.push(await stripe('POST','/prices',{product:product.id,currency:'usd',unit_amount:amount,'recurring[interval]':'month','metadata[fixture]':tag}))
 const paymentMethod=await stripe('POST','/payment_methods',{type:'card','card[token]':'tok_visa'})
 customer=await stripe('POST','/customers',{name:tag,payment_method:paymentMethod.id,'invoice_settings[default_payment_method]':paymentMethod.id,'metadata[fixture]':tag})
 subscription=await stripe('POST','/subscriptions',{customer:customer.id,'items[0][price]':prices[0].id,'items[0][quantity]':1,payment_behavior:'error_if_incomplete','metadata[fixture]':tag})
 const end=new Date(subscription.current_period_end*1000).toISOString().slice(0,10)
 assert.ok(Date.parse(end)>Date.now()&&Date.parse(end)-Date.now()<120*86400000,'Monthly renewal is inside the 120-day window')
 const connection=await api('/connections','POST',{name:'Held-key readiness uplift test source',key})
 const settings=(await api('/renewals')).settings
 await api('/renewals/settings','PUT',{revision:settings.revision,leadDays:120,stages:settings.stages})
 const account=await api('/accounts','POST',{id:tag,name:'Held-key readiness uplift',renewalDate:end,noticeDays:30,renewalEvidence:'Confirmed synthetic subscription notice terms',billing:null,support:null})
 const preview=await api('/billing/'+connection.id+'/bindings/preview','POST',{customerId:customer.id,accountId:account.id})
 await api('/billing/'+connection.id+'/bindings','POST',{token:preview.token})
 const sync=async()=>{const run=await api('/billing/'+connection.id+'/sync','POST',{});assert.equal(run.status,'succeeded','Native billing sync succeeds')}
 const current=async()=>{
  const records=(await api('/renewals')).records.filter(r=>r.accountId===account.id)
  assert.equal(records.length,1,'One subscription produces one renewal')
  return records[0]
 }
 await sync()
 const initial=await current()
 assert.equal(initial.expectedArrMinor,120000)
 assert.ok(initial.sourceSubscriptionId===subscription.id,'Renewal cites the exact fixture subscription')
 const proposal=await api('/proposals','POST',{accountId:account.id,kind:'renewal',payload:{renewalId:initial.id,outcome:'renewed-with-expansion',resultArrMinor:144000,reason:'customer-confirmed',evidence:'Approved synthetic twenty percent uplift'}})
 assert.equal((await current()).outcome,null,'Preparation does not approve commercial terms')
 await api('/proposals/'+proposal.id+'/approve','POST',{})
 assert.equal((await current()).billingReconciliation,'pending-provider-sync')
 await sync()
 const mismatch=await current()
 assert.equal(mismatch.billingReconciliation,'mismatch')
 assert.equal(mismatch.billingActual.arrMinor,120000)
 assert.equal(mismatch.billingActual.differenceMinor,-24000)
 await stripe('POST','/subscriptions/'+subscription.id,{'items[0][id]':subscription.items.data[0].id,'items[0][price]':prices[1].id,proration_behavior:'none'})
 await sync()
 const matched=await current(),billing=(await api('/billing')).observations.find(o=>o.accountId===account.id)
 assert.equal(matched.billingReconciliation,'matched')
 assert.equal(matched.billingActual.arrMinor,144000)
 assert.equal(matched.billingActual.differenceMinor,0)
 assert.equal(matched.resultArrMinor,144000)
 assert.equal(matched.expectedArrMinor,120000)
 assert.ok(matched.sourceVersionId===initial.sourceVersionId,'Original source version remains frozen')
 assert.ok(matched.billingActual.snapshotId===billing?.id,'Actual cites the retained native billing observation')
 assert.ok(productCalls.length>0&&productCalls.every(method=>method==='GET'))
 summary={qualification:'AGENT-003 Stripe test uplift',result:'passed',originalArrMinor:120000,approvedArrMinor:144000,mismatchActualMinor:120000,mismatchDifferenceMinor:-24000,matchedActualMinor:144000,matchedDifferenceMinor:0,originalSourcePreserved:true,productCalls:{reads:productCalls.length,writes:0},boundary:'Fixture actor alone changes the test subscription; Buoy only reads and reconciles.'}
}finally{
 let cleanupFailed=false
 const cleanup=async action=>{try{await action()}catch{cleanupFailed=true}}
 if(app)await cleanup(()=>app.close())
 if(subscription)await cleanup(()=>stripe('DELETE','/subscriptions/'+subscription.id))
 if(customer)await cleanup(()=>stripe('DELETE','/customers/'+customer.id))
 for(const price of prices)await cleanup(()=>stripe('POST','/prices/'+price.id,{active:false}))
 if(product)await cleanup(()=>stripe('POST','/products/'+product.id,{active:false}))
 assert.equal(cleanupFailed,false,'Owned Stripe fixture cleanup and Worker shutdown must all succeed')
}
console.log(JSON.stringify(summary))
