// Deliberately outside push Verify: dedicated held-key Stripe test qualification.
// Only this fixture actor writes provider setup. The emitted product stays GET-only.
import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
const key=process.env.STRIPE_TEST_KEY
assert.ok(key&&/^(sk|rk)_test_/.test(key),'Inject the dedicated held Stripe test key by name')
const version='2025-02-24.acacia',tag='synthetic-buoy-'+Date.now(),clocks=[],prices=[],customers=[],subscriptions=[],productCalls=[]
let product,app
async function stripe(method,path,values={}){
 const params=new URLSearchParams(Object.entries(values).map(([k,v])=>[k,String(v)])),url=new URL('https://api.stripe.com/v1'+path)
 if(method==='GET')url.search=params.toString()
 const response=await fetch(url,{method,redirect:'manual',headers:{authorization:'Bearer '+key,'Stripe-Version':version,...(method==='GET'?{}:{'content-type':'application/x-www-form-urlencoded'})},...(method==='GET'?{}:{body:params}),signal:AbortSignal.timeout(30000)})
 const body=await response.json();assert.equal(response.status,200,'Stripe test fixture '+method+' '+path.split('/').slice(0,2).join('/')+' HTTP '+response.status+' '+(body.error?.code??body.error?.type??''));return body
}
try{
 app=await startWorker({providerFetch:async request=>{assert.equal(new URL(request.url).origin,'https://api.stripe.com');assert.equal(request.method,'GET','Product never writes provider billing');productCalls.push(request.method);return fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),redirect:'manual',signal:AbortSignal.timeout(30000)})}})
 const api=async(path,method='GET',body)=>{const response=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.ok(response.ok,'Buoy '+method+' '+path+' HTTP '+response.status);return response.json()}
 const on=new Date().toISOString().slice(0,10),now=Math.floor(Date.now()/1000)
 // Monthly ends next month. An annual clock about nine months behind ends
 // about three months ahead, so the two cohorts occupy different UTC quarters.
 const recent=now-5*86400,recentDay=new Date(recent*1000),annualClockMonth=Math.floor((recentDay.getUTCMonth()+1)/3)*3+3-12,older=Math.floor(new Date(Date.UTC(recentDay.getUTCFullYear(),annualClockMonth,15)).getTime()/1000)
 for(const frozen_time of [recent,older])clocks.push(await stripe('POST','/test_helpers/test_clocks',{frozen_time,name:tag}))
 product=await stripe('POST','/products',{name:tag})
 for(const [amount,interval]of [[10000,'month'],[120000,'year'],[5000,'month']])prices.push(await stripe('POST','/prices',{product:product.id,currency:'usd',unit_amount:amount,'recurring[interval]':interval,'metadata[fixture]':tag}))
 for(let i=0;i<2;i++){
  const method=await stripe('POST','/payment_methods',{type:'card','card[token]':'tok_visa'})
  customers.push(await stripe('POST','/customers',{name:tag+'-'+i,email:tag+'-'+i+'@example.test',test_clock:clocks[i].id,payment_method:method.id,'invoice_settings[default_payment_method]':method.id,'metadata[fixture]':tag}))
  for(let j=0;j<6;j++)subscriptions.push(await stripe('POST','/subscriptions',{customer:customers[i].id,'items[0][price]':prices[i].id,'items[0][quantity]':1,payment_behavior:'error_if_incomplete','metadata[fixture]':tag}))
 }
 const connection=await api('/connections','POST',{name:'Held-key renewal test source',key}),settings=(await api('/renewals')).settings,owner=(await api('/state')).operator.id
 await api('/renewals/settings','PUT',{revision:settings.revision,leadDays:730,stages:settings.stages})
 const accounts=[]
 for(let i=0;i<2;i++){
  const end=new Date(subscriptions[i*6].current_period_end*1000).toISOString().slice(0,10)
  const account=await api('/accounts','POST',{id:'synthetic-buoy-'+(9100+i),name:'Held-key renewal cohort '+i,renewalDate:end,noticeDays:30,renewalEvidence:'Confirmed synthetic subscription notice terms',billing:null,support:null});accounts.push(account)
  await api('/accounts/'+account.id+'/owner','PUT',{ownerId:owner})
  const preview=await api('/billing/'+connection.id+'/bindings/preview','POST',{customerId:customers[i].id,accountId:account.id});await api('/billing/'+connection.id+'/bindings','POST',{token:preview.token})
 }
 const sync=async()=>{for(let i=0;i<2;i++){const run=await api('/billing/'+connection.id+'/sync','POST',{});assert.equal(run.status,'succeeded',run.error)}}
 await sync();await sync()
 const initial=await api('/renewals');assert.equal(initial.records.length,12);assert.equal(new Set(initial.records.map(r=>r.id)).size,12);assert.equal(initial.quarters.length,2)
 for(const r of initial.records){const sub=subscriptions.find(s=>s.id===r.sourceSubscriptionId);assert.ok(sub);assert.equal(r.expectedArrMinor,120000);assert.equal(r.ownerId,owner);assert.equal(r.renewalDate,new Date(sub.current_period_end*1000).toISOString().slice(0,10));assert.equal(r.noticeDeadline,new Date(Date.parse(r.renewalDate)-30*86400000).toISOString().slice(0,10))}
 const selected=subscriptions.slice(0,2).map(sub=>initial.records.find(r=>r.sourceSubscriptionId===sub.id))
 for(const [i,r]of selected.entries()){
  await api('/renewals/'+r.id,'PUT',{revision:r.revision,stage:'Decision',forecast:'at-risk',ownerId:owner,riskReasons:['Signed synthetic customer outcome']})
  const proposal=await api('/proposals','POST',{accountId:r.accountId,kind:'renewal',payload:{renewalId:r.id,outcome:i===0?'churned':'renewed-with-contraction',resultArrMinor:i===0?0:60000,reason:'customer-confirmed',evidence:'Signed held-key synthetic subscription outcome'}})
  assert.equal((await api('/renewals')).records.find(v=>v.id===r.id).outcome,null)
  await api('/proposals/'+proposal.id+'/approve','POST',{});await api('/proposals/'+proposal.id+'/approve','POST',{})
 }
 await sync()
 for(const r of selected)assert.equal((await api('/renewals')).records.find(v=>v.id===r.id).billingReconciliation,'mismatch','A human expectation never fabricates provider actuals')
 await stripe('DELETE','/subscriptions/'+subscriptions[0].id)
 await stripe('POST','/subscriptions/'+subscriptions[1].id,{'items[0][id]':subscriptions[1].items.data[0].id,'items[0][price]':prices[2].id,proration_behavior:'none'})
 await sync()
 const final=await api('/renewals')
 assert.equal(final.records.length,12,'Six subscriptions on one customer do not duplicate or overwrite one another')
 for(const [i,r]of selected.entries()){
  const record=final.records.find(v=>v.id===r.id);assert.equal(record.billingReconciliation,'matched');assert.equal(record.billingActual.arrMinor,i===0?0:60000);assert.equal(record.billingActual.differenceMinor,0);assert.equal(record.expectedArrMinor,120000);assert.equal(record.sourceVersionId,r.sourceVersionId)
  const billing=(await api('/billing')).observations.find(o=>o.accountId===r.accountId);assert.equal(record.billingActual.snapshotId,billing.id)
 }
 assert.ok(productCalls.length&&productCalls.every(m=>m==='GET'))
 console.log(JSON.stringify({qualification:'RENEW-001 real Stripe test subscriptions',result:'passed',at:new Date().toISOString(),subscriptions:12,quarters:initial.quarters,approvedOutcomes:['churned','renewed-with-contraction'],originalArrMinor:120000,providerActualsMinor:[0,60000],mismatchThenMatch:true,noticeDays:30,deduplicated:true,originalSourcesPreserved:true,productReadCalls:productCalls.length,productWriteCalls:0}))
}finally{
 if(app)await app.close()
 let cleanupFailed=false
 for(const clock of clocks){try{await stripe('DELETE','/test_helpers/test_clocks/'+clock.id)}catch{cleanupFailed=true;console.error('Renewal test clock cleanup needs fixture-metadata review')}}
 for(const price of prices){try{await stripe('POST','/prices/'+price.id,{active:false})}catch{cleanupFailed=true;console.error('Renewal test price archival needs fixture-metadata review')}}
 if(product){try{await stripe('POST','/products/'+product.id,{active:false})}catch{cleanupFailed=true;console.error('Renewal test product archival needs fixture-metadata review')}}
 assert.equal(cleanupFailed,false,'Every owned test clock/customer/subscription is removed and every price/product archived')
}
