// Real emitted Worker and D1. Synthetic records exist only at Stripe's network edge.
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {startWorker} from './worker.mjs'
import {billingFixtureKey,billingWebhookSecret} from './billing-fixture.mjs'
export {billingFixtureKey,billingWebhookSecret} from './billing-fixture.mjs'
const c1='synthetic-buoy-101',c2='synthetic-buoy-102',c3='synthetic-buoy-103'
const baseTime=Math.floor(Date.now()/1000)-3600
export function billingSource(){
 const source={calls:[],fail:false,invalid:null,paymentFailed:true,amount:2500,status:'active',hold:null,onRead:null,pages:true}
 const price=(id,amount,interval='month')=>({id,object:'price',livemode:false,billing_scheme:'per_unit',transform_quantity:null,tiers_mode:null,product:'synthetic-buoy-201',currency:'usd',unit_amount_decimal:String(amount),recurring:{interval,interval_count:1,usage_type:'licensed'}})
 const sub=customer=>({id:customer===c1?'synthetic-buoy-301':'synthetic-buoy-302',object:'subscription',livemode:false,customer,status:customer===c1?source.status:'active',created:baseTime,current_period_start:baseTime,current_period_end:baseTime+31536000,cancel_at_period_end:false,canceled_at:customer===c1&&source.status==='canceled'?baseTime:null,discounts:[]})
 source.fetch=async request=>{
  const url=new URL(request.url);source.calls.push({method:request.method,path:url.pathname,params:Object.fromEntries(url.searchParams)})
  assert.equal(request.method,'GET','No product write may reach Stripe')
  assert.equal(url.origin,'https://api.stripe.com');assert.equal(request.headers.get('stripe-version'),'2025-02-24.acacia')
  assert.match(url.pathname,/^\/v1\/(customers(?:\/[A-Za-z0-9_-]+)?|subscriptions|subscription_items|invoices|payment_intents|charges(?:\/[A-Za-z0-9_-]+)?|refunds|credit_notes)$/)
  if(source.hold&&url.pathname==='/v1/subscriptions'){source.onRead?.();await source.hold}
  if(source.fail)return Response.json({error:{message:'Private upstream detail '+billingFixtureKey}},{status:401})
  const customer=url.searchParams.get('customer'),list=(data,has_more=false)=>Response.json({object:'list',data,has_more})
  if(url.pathname==='/v1/customers')return list([]) // Legacy customer-ID staging is outside this billing journey.
  if(url.pathname.startsWith('/v1/customers/'))return Response.json({id:url.pathname.split('/').at(-1),object:'customer',livemode:source.invalid==='live',created:source.invalid==='date'?-1:baseTime})
  if(url.pathname==='/v1/subscriptions')return list(customer===c3?[]:[sub(customer)])
  if(url.pathname==='/v1/subscription_items'){
   const first=url.searchParams.get('subscription')==='synthetic-buoy-301',subscription=first?'synthetic-buoy-301':'synthetic-buoy-302'
   const p=price(first?'synthetic-buoy-401':'synthetic-buoy-402',first?source.amount:60001,first?'month':'year')
   if(source.invalid==='money')p.unit_amount_decimal='-1'
   if(source.invalid==='currency')p.currency='xxx'
   if(source.invalid==='unsupported')p.billing_scheme='tiered'
   return list([{id:first?'synthetic-buoy-501':'synthetic-buoy-502',object:'subscription_item',subscription,quantity:first?3:2,price:p}])
  }
  if(url.pathname==='/v1/invoices'){
   if(customer!==c1)return list([])
   const invoice={id:'synthetic-buoy-601',object:'invoice',livemode:false,customer,currency:'usd',status:'open',amount_due:8500,amount_paid:source.paymentFailed?0:1000,amount_remaining:source.paymentFailed?8500:7500,due_date:baseTime-86400,attempted:true,attempt_count:1,payment_intent:'synthetic-buoy-701',created:baseTime}
   const paid={...invoice,id:'synthetic-buoy-602',status:'paid',amount_paid:1000,amount_remaining:0,amount_due:1000,attempted:true,payment_intent:'synthetic-buoy-702'}
   return source.pages?(url.searchParams.has('starting_after')?list([paid]):list([invoice],true)):list([invoice,paid])
  }
  if(url.pathname==='/v1/payment_intents')return list(customer===c1?[{id:'synthetic-buoy-701',object:'payment_intent',livemode:false,customer,currency:'usd',amount:8500,amount_received:source.paymentFailed?0:1000,status:source.paymentFailed?'requires_payment_method':'processing',last_payment_error:source.paymentFailed?{code:'card_declined'}:null,created:baseTime},{id:'synthetic-buoy-702',object:'payment_intent',livemode:false,customer,currency:'usd',amount:1000,amount_received:1000,status:'succeeded',last_payment_error:null,created:baseTime}]:[])
  if(url.pathname==='/v1/charges')return list(customer===c1?[{id:'synthetic-buoy-801',object:'charge',livemode:false,customer}]:[])
  if(url.pathname.startsWith('/v1/charges/'))return Response.json({id:url.pathname.split('/').at(-1),object:'charge',livemode:false,customer:c1})
  if(url.pathname==='/v1/refunds')return list([{id:'synthetic-buoy-901',object:'refund',charge:'synthetic-buoy-801',currency:'usd',amount:200,status:'succeeded',created:baseTime}])
  if(url.pathname==='/v1/credit_notes')return list(customer===c1?[{id:'synthetic-buoy-1001',object:'credit_note',livemode:false,customer,invoice:'synthetic-buoy-602',currency:'usd',amount:100,status:'issued',created:baseTime}]:[])
  assert.fail('Unrecognized Stripe fixture endpoint')
 }
 return source
}
export async function billingJourney(app,source){
 const call=(path,method='GET',body,extra={})=>app.request('/api/buoy'+path,{cookie:app.cookie,method,body,...extra})
 const api=async(path,method='GET',body,status=200,extra={})=>{const r=await call(path,method,body,extra);assert.equal(r.status,status,`${method} ${path}: ${await r.clone().text()}`);return r.json()}
 const state=()=>api('/billing'),on=new Date().toISOString().slice(0,10),future=n=>new Date(Date.parse(on)+n*86400000).toISOString().slice(0,10)
 const account=async(id,name)=>api('/accounts','POST',{id,name,renewalDate:future(365),noticeDays:30,renewalEvidence:'Customer-approved order',billing:null,support:null},201)
 const a1=await account('synthetic-buoy-11','Monthly Stripe customer'),a2=await account('synthetic-buoy-12','Annual Stripe customer'),a3=await account('synthetic-buoy-13','Unmapped account')
 const connection=await api('/connections','POST',{name:'Stripe billing sandbox',key:billingFixtureKey},201),base='/billing/'+connection.id
 await api(base+'/settings','PUT',{staleDays:30});await api(base+'/webhook-secret','PUT',{secret:billingWebhookSecret})
 assert.equal((await app.request('/api/buoy/billing')).status,401)
 await app.request('/auth/invite',{cookie:app.cookie,method:'POST',body:{email:'synthetic-buoy-14@example.test',displayName:'Billing member',role:'member'}})
 const member=await app.signIn('synthetic-buoy-14@example.test')
 await api('/billing','GET',undefined,403,{cookie:member})
 await app.request('/auth/invite',{cookie:app.cookie,method:'POST',body:{email:'synthetic-buoy-15@example.test',displayName:'Billing admin',role:'admin'}})
 const admin=await app.signIn('synthetic-buoy-15@example.test')
 const token=await api('/agent-tokens','POST',{label:'No billing authority'},201)
 await api('/billing','GET',undefined,403,{cookie:undefined,token:token.token});await api('/agent-tokens/'+token.id,'DELETE')
 await api(base+'/bindings/preview','POST',{customerId:c1,accountId:a1.id},403,{cookie:member})
 await api(base+'/settings','PUT',{staleDays:1},403,{headers:{origin:'https://foreign.invalid'}})
 const before=await state(),preview=await api(base+'/bindings/preview','POST',{customerId:c1,accountId:a1.id})
 assert.deepEqual((await state()).bindings,before.bindings,'Preview never binds or attributes an account')
 await api(base+'/bindings','POST',{token:preview.token},403,{cookie:member})
 await api(base+'/bindings','POST',{token:preview.token},201)
 for(const [customerId,accountId]of [[c2,a2.id]]){const p=await api(base+'/bindings/preview','POST',{customerId,accountId});await api(base+'/bindings','POST',{token:p.token},201)}
 await api(base+'/bindings/preview','POST',{customerId:c1,accountId:a3.id},409)
 await api(base+'/bindings/preview','POST',{customerId:c3,accountId:'synthetic-buoy-missing'},404)
 const stalePreview=await api(base+'/bindings/preview','POST',{customerId:c3,accountId:a3.id})
 await api('/accounts/'+a3.id,'PUT',{...a3,name:'Unmapped account revised'})
 await api(base+'/bindings','POST',{token:stalePreview.token},409)
 const read=id=>(async()=>{const s=await state(),r=s.observations.find(r=>r.accountId===id);assert.ok(r,'Complete source observation for '+id);return r})()
 const sync=async()=>{const run=await api(base+'/sync','POST',{});assert.equal(run.status,'succeeded',run.error);return run}
 await sync();await sync()
 let first=await read(a1.id),annual=await read(a2.id)
 assert.equal(first.document.revenue[0].arr.roundedMinor,2500*3*12);assert.equal(first.document.revenue[0].mrr.roundedMinor,2500*3)
 assert.equal(annual.document.revenue[0].arr.roundedMinor,60001*2);assert.equal(annual.document.revenue[0].mrr.roundedMinor,Math.round(60001*2/12))
 assert.deepEqual(annual.document.revenue[0].mrr,{numeratorMinor:'60001',denominator:'6',roundedMinor:10000})
 for(const row of [first,annual]){assert.equal(row.sourceSystem,'stripe-test');assert.ok(row.sourceReference.includes(row.customerId));assert.equal(row.observedAt.slice(0,10),on);assert.ok(Date.parse(row.receivedAt)>=Date.parse(row.observedAt))}
 assert.equal(first.document.invoices.length,2,'Complete invoice pagination');assert.equal(first.document.refunds[0].amountMinor,200);assert.equal(first.document.creditNotes[0].amountMinor,100)
 assert.ok(first.document.risks.some(r=>r.kind==='failed-payment'&&r.reference==='synthetic-buoy-601'))
 assert.ok(first.document.risks.some(r=>r.kind==='overdue-invoice'&&r.amountMinor===8500));assert.deepEqual(annual.document.risks,[])
 assert.ok(!(await state()).observations.some(r=>r.accountId===a3.id),'Staged or unmatched customers never attribute source observations')
 // The provider can leave an attempted invoice open while its payment is
 // processing or partly paid. Only an explicit linked payment error is failure.
 source.paymentFailed=false;await sync();await sync()
 const processing=(await read(a1.id)).document
 assert.equal(processing.invoices.find(i=>i.id==='synthetic-buoy-601').attempted,true)
 assert.equal(processing.invoices.find(i=>i.id==='synthetic-buoy-601').amountPaidMinor,1000)
 assert.ok(!processing.risks.some(r=>r.kind==='failed-payment'),'An attempted, partially paid processing invoice is not a failed-payment signal')
 assert.ok(processing.risks.some(r=>r.kind==='overdue-invoice'&&r.amountMinor===7500),'Overdue balance remains independent of payment failure')
 source.paymentFailed=true;await sync();await sync()
 const native=await api('/state'),monthlyHealth=native.accounts.find(a=>a.id===a1.id).health,annualHealth=native.accounts.find(a=>a.id===a2.id).health
 assert.equal(monthlyHealth.status,'at-risk');assert.match(monthlyHealth.reasons.join(' '),/Stripe failed payment.*synthetic-buoy-601/)
 assert.ok(monthlyHealth.evidence.some(e=>e.sourceSystem==='stripe-test'))
 assert.doesNotMatch(annualHealth.reasons.join(' '),/Stripe failed payment|Stripe overdue invoice/)
 const healthDoor=(await api('/accounts/'+a1.id+'/health')).health
 assert.equal(healthDoor.status,'at-risk');assert.match(healthDoor.reasons.join(' '),/Stripe.*85\.00/)
 const fields=(await api('/scorecards')).fields
 for(const field of ['stripe.arrMinor','stripe.mrrMinor','stripe.currency','stripe.failedPayments','stripe.overdueInvoices'])assert.ok(fields.some(f=>f.key===field),'Published scorecard input '+field)
 const measure=(key,field,max,direction='higher')=>({key,name:key,field,min:0,max,weight:1,direction,missing:'unknown'})
 const config={name:'Connected Stripe billing health',measures:[measure('arr','stripe.arrMinor',200000),measure('mrr','stripe.mrrMinor',20000),{...measure('currency','stripe.currency',100),categoryValues:{USD:100}},measure('failures','stripe.failedPayments',1,'lower'),measure('overdue','stripe.overdueInvoices',1,'lower')],bands:{riskBelow:60,healthyAt:75},segments:[]}
 const cardBefore=await api('/scorecards'),cardPreview=await api('/scorecards/preview','POST',{config}),previewMonthly=cardPreview.accounts.find(a=>a.accountId===a1.id)
 assert.ok(Math.abs(previewMonthly.score-36.5)<1e-8,'Five connected billing measures calculate the independently derived weighted score')
 assert.deepEqual(previewMonthly.breakdown.map(m=>m.rawValue),[90000,7500,'USD',1,1])
 assert.ok(previewMonthly.breakdown.every(m=>m.sources.some(source=>source.details?.sourceSystem==='stripe-test'&&source.reference&&source.observedAt)))
 assert.equal((await api('/scorecards')).revision,cardBefore.revision,'Connected source preview does not publish')
 await api('/scorecards/publish','POST',{revision:cardBefore.revision,config},201)
 const published=(await api('/scorecards')).accounts.find(a=>a.accountId===a1.id)
 assert.ok(Math.abs(published.score-36.5)<1e-8);assert.equal((await api('/state')).accounts.find(a=>a.id===a1.id).health.score,published.score)
 const segmentInput={name:'USD Stripe recurring customers with failed payment',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'stripe.currency',op:'eq',value:'USD'},{field:'stripe.arrMinor',op:'gt',value:50000},{field:'stripe.failedPayments',op:'gt',value:0}]},tier:null,stage:null,playbook:null}
 await api('/segments','POST',{...segmentInput,rules:{match:'all',conditions:[{field:'stripe.arrMinor',op:'gt',value:0}]}},400)
 const segment=await api('/segments','POST',segmentInput,201),segmentReport=()=>api('/segments/'+segment.id+'/report')
 assert.deepEqual((await segmentReport()).accounts.map(a=>a.accountId),[a1.id],'Only the correctly bound USD account with source ARR and failed payment enters the segment')

 const signature=(event,t=Math.floor(Date.now()/1000))=>`t=${t},v1=${createHmac('sha256',billingWebhookSecret).update(t+'.'+JSON.stringify(event)).digest('hex')}`
 let eventNumber=1100
 const event=()=>({id:'synthetic-buoy-'+eventNumber++,object:'event',livemode:false,type:'customer.subscription.updated',created:Math.floor(Date.now()/1000),data:{object:{id:'synthetic-buoy-301',object:'subscription',customer:c1}}})
 let lastWebhookReturnedAt
 const webhook=async(e,status=200,header=signature(e))=>{const result=await api(base+'/webhook','POST',e,status,{cookie:undefined,headers:{'stripe-signature':header}});lastWebhookReturnedAt=new Date().toISOString();return result}
 const unsigned=event();await webhook(unsigned,400,'');await webhook(unsigned,400,signature(unsigned,Math.floor(Date.now()/1000)-301))
 const tampered={...unsigned,id:'synthetic-buoy-tampered'};await webhook(tampered,400,signature(unsigned))
 const upgrade=event();source.amount=5500;await webhook(upgrade)
 first=await read(a1.id);assert.equal(first.document.revenue[0].arr.roundedMinor,5500*3*12)
 const upgradeScore=(await api('/scorecards')).accounts.find(a=>a.accountId===a1.id);assert.equal(upgradeScore.breakdown.find(m=>m.field==='stripe.arrMinor').rawValue,198000);assert.ok(upgradeScore.score>published.score,'Webhook refresh recalculates published connected-source health');assert.ok(Date.parse(upgradeScore.calculatedAt)<=Date.parse(lastWebhookReturnedAt),'Published health recalculation completed before the successful public webhook returned')
 const afterUpgrade=await state();await webhook(upgrade);assert.equal((await state()).history.length,afterUpgrade.history.length,'Duplicate webhook produces no extra snapshot')
 source.amount=1500;await webhook(event());first=await read(a1.id);assert.equal(first.document.revenue[0].arr.roundedMinor,1500*3*12)
 // An older signed event causes a fresh provider read; it cannot roll back the downgrade.
 const late={...event(),created:baseTime-1000};await webhook(late);assert.equal((await read(a1.id)).document.revenue[0].arr.roundedMinor,1500*3*12)
 const retained=(await state()).history.find(r=>r.id===afterUpgrade.observations.find(r=>r.accountId===a1.id).id);assert.equal(retained.document.revenue[0].arr.roundedMinor,5500*3*12)
 for(const invalid of ['money','currency','unsupported','date','live']){
  const before=await state(),preserved=before.observations.find(o=>o.accountId===a1.id)
  source.invalid=invalid;const r=await api(base+'/sync','POST',{});assert.equal(r.status,'failed',invalid);source.invalid=null
  const after=await state(),current=after.observations.find(o=>o.accountId===a1.id)
  assert.equal(current.id,preserved.id,'Malformed source data cannot publish a partial replacement snapshot')
  assert.deepEqual(current.document,preserved.document,'The prior valid provider evidence remains unchanged')
  assert.deepEqual(after.history.map(({freshness,confidence,...observation})=>observation),before.history.map(({freshness,confidence,...observation})=>observation),'Malformed source data cannot append or alter immutable billing observations')
  assert.equal(after.connections.find(c=>c.id===connection.id).freshness,'Failed');assert.equal(current.freshness,'Failed');assert.match(current.confidence,/Reduced/)
  const missing=(await api('/scorecards')).accounts.find(a=>a.accountId===a1.id)
  assert.equal(missing.score,null,'Configured connected-source health becomes unknown after provider validation failure')
  assert.ok(missing.breakdown.every(m=>m.value===null&&m.sources.some(source=>source.details?.sourceFreshness==='failed')),'Failed-source numeric and category inputs become missing without replacing their underlying observations')
  const nativeHealth=(await api('/state')).accounts.find(a=>a.id===a1.id).health
  assert.equal(nativeHealth.score,null);assert.match(nativeHealth.reasons.join(' '),/Stripe billing evidence is failed; dependent confidence is reduced/)
 }
 source.fail=true;const lastSuccess=(await state()).connections.find(c=>c.id===connection.id).last_success
 const failure=await api(base+'/sync','POST',{});assert.equal(failure.status,'failed');let failed=await state();assert.equal(failed.connections.find(c=>c.id===connection.id).last_success,lastSuccess)
 assert.ok(failed.observations.every(r=>r.freshness==='Failed'&&r.confidence.startsWith('Reduced')))
 assert.equal((await segmentReport()).count,0,'Failed source revenue is unavailable to a current-data segment')
 const reduced=(await api('/state')).accounts.find(a=>a.id===a1.id).health;assert.equal(reduced.score,null);assert.match(reduced.reasons.join(' '),/Stripe billing evidence is failed; dependent confidence is reduced/)
 const failedCard=(await api('/scorecards')).accounts.find(a=>a.accountId===a1.id);assert.ok(failedCard.breakdown.every(m=>m.value===null));assert.ok(failedCard.breakdown.every(m=>m.sources.some(s=>s.details?.sourceFreshness==='failed'))) 
 assert.ok((await api('/notifications')).items.some(n=>n.title==='Reconnect Stripe billing'),'Owner receives an actionable source failure notice')
 assert.ok((await api('/notifications','GET',undefined,200,{cookie:admin})).items.some(n=>n.title==='Reconnect Stripe billing'),'Admin receives source failure notice')
 const privateText=JSON.stringify(failed);assert.doesNotMatch(privateText,new RegExp('\\b'+billingFixtureKey+'\\b'));assert.ok(!privateText.includes('Private upstream'))
 source.fail=false;await api('/connections/'+connection.id+'/credential','PUT',{key:billingFixtureKey});await sync();await sync()
 assert.deepEqual((await segmentReport()).accounts.map(a=>a.accountId),[a1.id],'Successful reconnection restores current source segment inputs')
 const inOne=await api('/billing?on='+future(2));assert.equal(inOne.observations.find(r=>r.accountId===a1.id).freshness,'Current')
 await api(base+'/settings','PUT',{staleDays:1});const inTwo=await api('/billing?on='+future(2));assert.equal(inTwo.observations.find(r=>r.accountId===a1.id).freshness,'Stale')
 assert.equal(inTwo.observations.find(r=>r.accountId===a1.id).document.revenue[0].arr.roundedMinor,1500*3*12,'Threshold changes no observation')
 await api(base+'/settings','PUT',{staleDays:30})
 source.status='canceled';await webhook(event());assert.equal((await read(a1.id)).document.revenue[0].arr.roundedMinor,0)
 assert.equal((await segmentReport()).count,0,'Canceled source ARR exits the revenue/failure segment')
 const sourceState=await state();assert.ok(sourceState.changes.length>=4);assert.ok(sourceState.changes.some(c=>c.before?.some(s=>s.lines.some(l=>l.unitAmountDecimal==='5500'))&&c.after.some(s=>s.lines.some(l=>l.unitAmountDecimal==='1500'))))
 assert.ok(sourceState.history.length>sourceState.observations.length,'Account refreshes retain immutable prior observations')
 const revision=(await api('/state')).accounts.find(a=>a.id===a1.id).revision;await app.scheduled();assert.notEqual((await api('/state')).accounts.find(a=>a.id===a1.id).revision,revision,'Cron Trigger reconciles the next reviewed customer')
 let release;source.hold=new Promise(r=>release=r);const started=new Promise(r=>source.onRead=r),pending=api(base+'/sync','POST',{});
 let holdTimer;try{await Promise.race([started,new Promise((_,reject)=>{holdTimer=setTimeout(()=>reject(new Error('Held Stripe subscription read did not start')),30000)})])}catch(error){release();await pending;throw error}finally{clearTimeout(holdTimer)}
 await api('/connections/'+connection.id,'DELETE',{});release();source.hold=null;source.onRead=null;assert.equal((await pending).status,'failed')
 const count=source.calls.length;await app.scheduled();assert.equal(source.calls.length,count,'Disconnected provider receives no next scheduled request')
 await api('/connections/'+connection.id+'/credential','PUT',{key:billingFixtureKey});await sync();await sync()
 const erasedPreview=await api(base+'/bindings/preview','POST',{customerId:c3,accountId:a3.id});await api(base+'/bindings','POST',{token:erasedPreview.token},201)
 const erasureEvent={...event(),type:'customer.updated',data:{object:{id:c3,object:'customer',livemode:false}}};await webhook(erasureEvent)
 assert.ok((await state()).observations.some(o=>o.accountId===a3.id));await api('/accounts/'+a3.id,'DELETE',{confirmation:'Unmapped account revised'})
 const erasedState=await state();assert.ok(!erasedState.bindings.some(b=>b.accountId===a3.id));assert.ok(!erasedState.history.some(o=>o.accountId===a3.id));assert.ok(!erasedState.changes.some(o=>o.account_id===a3.id));assert.ok(!JSON.stringify(erasedState).includes(c3),'Erasure removes source references from retained customer runs and event records')
 assert.equal((await read(a1.id)).document.revenue[0].arr.roundedMinor,0,'Another account erasure preserves this account billing evidence')
 const browserAccount=await account('synthetic-buoy-16','Unmapped browser account')
 const audit=await api('/audit');for(const action of ['billing.binding-reviewed','connector.webhook-credential-changed','billing.freshness-changed'])assert.ok(audit.entries.some(r=>r.action===action))
 assert.ok(source.calls.every(c=>c.method==='GET'))
 console.log('Stripe billing HTTP: exact reviewed account attribution; paginated subscriptions/items/prices/invoices/payments/refunds/credits; monthly/annual independent ARR/MRR; upgrade/downgrade/cancellation; signed duplicate/unordered webhooks; failed/overdue risk; source validation/freshness; revocation/reconnect/cursor and GET-only transport passed.')
 return {connectionId:connection.id,accountId:a1.id,otherAccountId:a2.id,unmappedAccountId:browserAccount.id,member,source}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const source=billingSource(),app=await startWorker({providerFetch:source.fetch})
 try{const result=await billingJourney(app,source);if(process.argv.includes('--browser')){const {billingBrowser}=await import('./billing-browser.mjs');await billingBrowser(app,result)}}finally{await app.close()}
}
