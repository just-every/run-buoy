import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {join} from 'node:path'
import {billingFixtureKey,billingWebhookSecret} from './billing-fixture.mjs'
import {scan} from './a11y-checks.mjs'
import {startWorker} from './worker.mjs'

export async function renewalJourney(){
 const app=await startWorker(),cookie=app.cookie
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie,method,body,...options})
 const api=async(path,method='GET',body,status=200)=>{const r=await request(path,method,body);assert.equal(r.status,status,await r.clone().text());return r.json()}
 try{
  await app.request('/auth/invite',{method:'POST',cookie,body:{email:'renewal-member@example.test',displayName:'Renewal CSM',role:'member'}})
  const member=await app.signIn('renewal-member@example.test'),owner=(await api('/state')).operator.id
  const settings=(await api('/renewals')).settings
  await api('/renewals/settings','PUT',{revision:settings.revision,leadDays:30,stages:['Planning','Review','Decision']})
  const accountRevision=async id=>(await api('/state')).accounts.find(a=>a.id===id).revision
  const accounts=[],contracts=[]
  for(let i=0;i<12;i++){
   const id='synthetic-buoy-'+(400+i),end=i<6?'2026-12-31':'2027-03-31'
   await api('/accounts','POST',{id,name:'Renewal customer '+i,renewalDate:end,noticeDays:45,renewalEvidence:'Customer-confirmed notice clause 4',billing:null,support:{observedAt:new Date().toISOString().slice(0,10),reference:'Customer support register',openTickets:1,urgentTickets:1}},201)
   await api('/accounts/'+id+'/owner','PUT',{ownerId:owner})
   const contract={currency:i===11?'EUR':'USD',contractStart:'2026-01-01',contractEnd:end,lines:[{id:'synthetic-buoy-'+(420+i),product:'Reporting workspace',quantity:20,amountMinor:120000+i*1000,frequency:'annual',entitlements:'20 reporting seats'}],source:{reference:'Confirmed contract '+i,confirmedOn:new Date().toISOString().slice(0,10)}}
   await api('/accounts/'+id+'/contract','POST',{revision:await accountRevision(id),contract},201);accounts.push(id);contracts.push(contract)
  }
  assert.equal((await api('/renewals')).records.length,0)
  await app.scheduled('0 * * * *',Date.parse('2026-11-30T23:00:00Z'));assert.equal((await api('/renewals')).records.length,0,'Nothing is generated one day before the lead window')
  await app.scheduled('0 * * * *',Date.parse('2026-12-01T00:00:00Z'));await app.scheduled('0 * * * *',Date.parse('2026-12-01T01:00:00Z'))
  let data=await api('/renewals');assert.equal(data.records.length,6);assert.equal(new Set(data.records.map(r=>r.id)).size,6)
  for(const r of data.records){assert.equal(r.renewalDate,'2026-12-31');assert.equal(r.noticeDeadline,'2026-11-16');assert.equal(r.stage,'Planning');assert.equal(r.ownerId,owner);assert.equal(r.forecast,'likely')}
  await app.scheduled('0 * * * *',Date.parse('2027-03-01T00:00:00Z'));await app.scheduled('0 * * * *',Date.parse('2027-03-01T01:00:00Z'))
  data=await api('/renewals');assert.equal(data.records.length,12);assert.deepEqual(data.quarters,['2026-Q4','2027-Q1'])
  assert.equal((await api('/renewals?quarter=2026-Q4')).records.length,6);assert.equal((await api('/renewals?quarter=2027-Q1')).records.length,6)
  assert.deepEqual(data.records.map(r=>r.expectedArrMinor).sort((a,b)=>a-b),contracts.map(c=>c.lines[0].amountMinor))
  const row=async id=>(await api('/renewals')).records.find(r=>r.id===id),first=data.records.find(r=>r.accountId===accounts[0]),second=data.records.find(r=>r.accountId===accounts[1])
  const edit=async(r,extra={})=>api('/renewals/'+r.id,'PUT',{revision:r.revision,stage:'Review',forecast:'at-risk',ownerId:owner,riskReasons:['Customer procurement timing'],...extra})
  assert.equal((await request('/renewals/'+first.id,'PUT',{revision:first.revision,stage:'Review',forecast:'commit',ownerId:owner,riskReasons:[]},{cookie:member})).status,403)
  assert.equal((await request('/renewals/settings','PUT',{}, {cookie:member})).status,403)
  await edit(first);assert.equal((await row(first.id)).forecast,'at-risk');assert.deepEqual((await row(first.id)).riskReasons,['Customer procurement timing'])
  assert.equal((await request('/renewals/'+first.id,'PUT',{revision:first.revision,stage:'Review',forecast:'commit',ownerId:owner,riskReasons:[]})).status,409)
  // Every ACCOUNT-004 field kind and full-portfolio no-write preview before shipping opportunities.
  const definitions=[{key:'used',label:'Seats used',type:'number'},{key:'purchased',label:'Seats purchased',type:'number'},{key:'note',label:'Review note',type:'text'},{key:'start',label:'Review start',type:'date'},{key:'package',label:'Package',type:'picklist',options:['Growth','Scale']},{key:'products',label:'Products',type:'multi-select',options:['Reports','Exports']},{key:'approved',label:'Customer approved',type:'boolean'},{key:'amount',label:'Reviewed amount',type:'currency'}]
  for(const def of definitions)await api('/renewal-fields','POST',def,201)
  for(const [i,r]of data.records.entries())await api('/renewals/'+r.id+'/fields','PUT',{revision:(await row(r.id)).revision,values:{used:r.accountId===accounts[1]?0:12,purchased:r.accountId===accounts[1]?0:20,note:'Confirmed review '+i,start:'2026-01-01',package:r.accountId===accounts[0]?'Scale':'Growth',products:['Reports','Exports'],approved:r.accountId===accounts[0],amount:{currency:r.accountId===accounts[0]?'USD':'EUR',amountMinor:240000}},source:'Reviewed customer order '+i})
  const ratio={key:'ratio',label:'Seat ratio',type:'formula',formula:'custom.used / custom.purchased'},beforePreview=await api('/renewals'),beforeState=await api('/state')
  const preview=await api('/renewal-fields/preview','POST',ratio)
  assert.equal(preview.totalRecords,12);assert.equal(preview.records.length,10);assert.equal(preview.totalAccounts,12);assert.equal(preview.accounts.length,10)
  assert.deepEqual(await api('/renewals'),beforePreview);assert.deepEqual(await api('/state'),beforeState,'Preview changes no renewal, account revision or history')
  for(const def of [ratio,{key:'double',label:'Dependent ratio',type:'formula',formula:'if(custom.purchased == 0, 0, custom.ratio * 2)'},{key:'days',label:'UTC term days',type:'formula',formula:'days(renewalDate, custom.start)'},{key:'total',label:'Full opportunity seat total',type:'formula',formula:'sum(custom.used)'},{key:'unit_arr',label:'Source annual value per seat',type:'formula',formula:'expectedArrMinor / custom.purchased'}])await api('/renewal-fields','POST',def,201)
  data=await api('/renewals');let fields=data.fields.records.find(r=>r.id===first.id)
  assert.equal(fields.values.ratio,.6);assert.equal(fields.values.double,1.2);assert.equal(fields.values.total,132);assert.equal(fields.values.days,364);assert.match(fields.explanations.ratio,/custom.used=12/)
  const zero=data.fields.records.find(r=>r.id===second.id);assert.equal(zero.values.ratio,null);assert.match(zero.explanations.ratio,/zero/);assert.equal(zero.values.double,0)
  for(const invalid of [{key:'cycle',label:'Cycle',type:'formula',formula:'custom.cycle + 1'},{...ratio,formula:'unsafe.process()'},{key:'unknown',label:'Unknown',type:'formula',formula:'custom.missing + 1'},{key:'used',label:'Type changed',type:'text'}])assert.equal((await request('/renewal-fields','POST',invalid)).status,400)
  assert.equal((await request('/renewals/'+first.id+'/fields','PUT',{revision:(await row(first.id)).revision,values:{amount:{currency:'USD',amountMinor:-1}},source:'Bad input'})).status,400)
  // Source refresh recalculates before returning and preserves prior source history.
  await api('/accounts/'+accounts[0]+'/contract','POST',{revision:await accountRevision(accounts[0]),contract:{...contracts[0],lines:[{...contracts[0].lines[0],amountMinor:240000}],source:{...contracts[0].source,reference:'Confirmed amended order'}}},201)
  data=await api('/renewals');assert.equal(data.records.filter(r=>r.accountId===accounts[0]).length,1);assert.equal(data.records.find(r=>r.id===first.id).expectedArrMinor,240000);assert.equal(data.fields.records.find(r=>r.id===first.id).values.unit_arr,12000)
  assert.ok(data.fields.history.some(h=>h.recordId===first.id&&h.key==='unit_arr'&&h.oldValue===6000&&h.newValue===12000&&h.actor&&h.source&&h.recordedAt))
  // Typed related-opportunity fields bind all conditions to the same record.
  const conditions=[{field:'records.renewal.custom.ratio',op:'gt',value:.5},{field:'records.renewal.custom.package',op:'eq',value:'Scale'},{field:'records.renewal.custom.amount.currency',op:'eq',value:'USD'},{field:'records.renewal.custom.amount.amountMinor',op:'gte',value:240000},{field:'records.renewal.custom.approved',op:'eq',value:1}]
  const segment=await api('/segments','POST',{name:'Reviewed renewal opportunities',mode:'dynamic',accountIds:[],rules:{match:'all',conditions},tier:null,stage:null,playbook:null},201)
  assert.deepEqual((await api('/segments/'+segment.id+'/report')).accounts.map(r=>r.accountId),[accounts[0]])
  assert.equal((await request('/segments','POST',{name:'Unsafe mixed money',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[conditions[3]]},tier:null,stage:null,playbook:null})).status,400)
  const prepare=async(r,outcome,resultArrMinor)=>api('/proposals','POST',{accountId:r.accountId,kind:'renewal',payload:{renewalId:r.id,outcome,resultArrMinor,reason:'customer-confirmed',evidence:'Signed customer outcome evidence'}},201)
  const pending=await prepare(await row(first.id),'churned',0)
  assert.equal((await request('/proposals/'+pending.id+'/approve','POST',{}, {cookie:member})).status,403)
  await edit(await row(first.id),{forecast:'commit'})
  assert.equal((await request('/proposals/'+pending.id+'/approve','POST',{})).status,409,'Pipeline edits invalidate prepared outcomes')
  for(const [i,outcome]of ['churned','renewed-with-contraction','renewed-with-expansion','renewed','deferred'].entries()){
   const current=await row(data.records[i].id),result=outcome==='churned'?0:outcome==='renewed-with-contraction'?current.expectedArrMinor-1000:outcome==='renewed-with-expansion'?current.expectedArrMinor+1000:current.expectedArrMinor
   const proposal=await prepare(current,outcome,result),beforeDecisions=(await api('/state')).decisions.length
   await api('/proposals/'+proposal.id+'/approve','POST',{});await api('/proposals/'+proposal.id+'/approve','POST',{})
   const saved=await row(current.id);assert.equal(saved.outcome,outcome);assert.equal(saved.resultArrMinor,result);assert.equal(saved.billingReconciliation,'pending-provider-sync');assert.equal((await api('/state')).decisions.length,beforeDecisions+1)
  }
  const linked=await row(data.records[7].id),task=await api('/proposals','POST',{accountId:linked.accountId,kind:'playbook',payload:{title:'Review renewal legal terms',dueDate:'2027-03-01',type:'renewal',renewalId:linked.id}},201)
  await api('/proposals/'+task.id+'/approve','POST',{});assert.equal((await api('/tasks')).tasks.find(t=>t.proposalId===task.id).renewalId,linked.id)
  const page=await(await app.request('/app/renewals',{cookie})).text();assert.match(page,/Renewal board/);assert.match(page,/Renewal list/);assert.match(page,/2026-Q4/);assert.match(page,/2027-Q1/)
  await api('/accounts/'+accounts[0],'DELETE',{confirmation:'Renewal customer 0'})
  assert.ok(!(await api('/renewals')).records.some(r=>r.accountId===accounts[0]),'Account erasure owns renewal and field history custody')
  console.log('RENEW-001 twelve confirmed periods, lead-time Cron, quarter board/list, all five approved outcomes, linked work and complete inherited field/segment carrier passed; native terms retain a pending provider reconciliation label.')
 }finally{await app.close()}
 await providerRenewalJourney()
}

// Twelve subscriptions at Stripe's network edge, real migrated Worker everywhere
// else. The same public journey supplies the native reconciliation screen proof.
export async function providerRenewalJourney({browser,evidence}={}){
 const source={calls:[],fail:false,rows:Array.from({length:12},(_,i)=>({customer:'synthetic-buoy-'+(7000+i),subscription:'synthetic-buoy-'+(7100+i),price:'synthetic-buoy-'+(7200+i),item:'synthetic-buoy-'+(7300+i),amount:10000+i*100,status:'active',start:'2026-01-01',end:i<6?'2026-12-31':'2027-03-31'}))}
 const seconds=s=>Date.parse(s+'T00:00:00Z')/1000
 const fetch=async request=>{
  const url=new URL(request.url);source.calls.push({method:request.method,path:url.pathname});assert.equal(request.method,'GET')
  if(source.fail)return Response.json({error:'Unavailable'},{status:503})
  const list=data=>Response.json({object:'list',data,has_more:false}),customer=url.searchParams.get('customer'),row=source.rows.find(r=>r.customer===customer)
  if(url.pathname.startsWith('/v1/customers/'))return Response.json({id:url.pathname.split('/').at(-1),object:'customer',livemode:false,created:seconds('2025-01-01')})
  if(url.pathname==='/v1/subscriptions')return list(row?[{id:row.subscription,object:'subscription',livemode:false,customer,status:row.status,created:seconds(row.start),current_period_start:seconds(row.start),current_period_end:seconds(row.end),cancel_at_period_end:false,canceled_at:row.status==='canceled'?seconds('2026-10-01'):null,discounts:[]}]:[])
  if(url.pathname==='/v1/subscription_items'){
   const r=source.rows.find(r=>r.subscription===url.searchParams.get('subscription'));assert.ok(r)
   return list([{id:r.item,object:'subscription_item',subscription:r.subscription,quantity:1,price:{id:r.price,object:'price',livemode:false,billing_scheme:'per_unit',transform_quantity:null,tiers_mode:null,product:'synthetic-buoy-7400',currency:'usd',unit_amount_decimal:String(r.amount),recurring:{interval:'month',interval_count:1,usage_type:'licensed'}}}])
  }
  assert.ok(['/v1/customers','/v1/invoices','/v1/payment_intents','/v1/charges','/v1/credit_notes'].includes(url.pathname),url.pathname);return list([])
 }
 const app=await startWorker({providerFetch:fetch}),api=async(path,method='GET',body)=>{const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()}
 try{
  const owner=(await api('/state')).operator.id,settings=(await api('/renewals')).settings
  await api('/renewals/settings','PUT',{revision:settings.revision,leadDays:30,stages:settings.stages})
  const connection=await api('/connections','POST',{name:'Reviewed subscription source',key:billingFixtureKey}),base='/billing/'+connection.id
  await api(base+'/settings','PUT',{staleDays:365});await api(base+'/webhook-secret','PUT',{secret:billingWebhookSecret})
  for(const [i,row]of source.rows.entries()){
   const a=await api('/accounts','POST',{id:'synthetic-buoy-'+(7500+i),name:'Provider renewal '+i,renewalDate:row.end,noticeDays:45,renewalEvidence:'Confirmed subscription notice terms',billing:null,support:null})
   await api('/accounts/'+a.id+'/owner','PUT',{ownerId:owner});row.accountId=a.id
   const preview=await api(base+'/bindings/preview','POST',{customerId:row.customer,accountId:a.id});await api(base+'/bindings','POST',{token:preview.token})
  }
  for(const row of source.rows){const run=await api(base+'/sync','POST',{});assert.equal(run.status,'succeeded',run.error)}
  assert.equal((await api('/renewals')).records.length,0)
  await app.scheduled('0 * * * *',Date.parse('2026-11-30T23:00:00Z'));assert.equal((await api('/renewals')).records.length,0)
  await app.scheduled('0 * * * *',Date.parse('2026-12-01T00:00:00Z'));await app.scheduled('0 * * * *',Date.parse('2026-12-01T01:00:00Z'));assert.equal((await api('/renewals')).records.length,6)
  await app.scheduled('0 * * * *',Date.parse('2027-03-01T00:00:00Z'));await app.scheduled('0 * * * *',Date.parse('2027-03-01T01:00:00Z'))
  const pipeline=await api('/renewals');assert.equal(pipeline.records.length,12);assert.equal(new Set(pipeline.records.map(r=>r.id)).size,12);assert.deepEqual(pipeline.quarters,['2026-Q4','2027-Q1'])
  for(const [i,row]of source.rows.entries()){
   const r=pipeline.records.find(r=>r.accountId===row.accountId);row.renewalId=r.id
   assert.equal(r.expectedArrMinor,row.amount*12);assert.equal(r.sourceSubscriptionId,row.subscription);assert.equal(r.ownerId,owner);assert.equal(r.noticeDeadline,i<6?'2026-11-16':'2027-02-14');assert.equal(r.sourceKind,'stripe-test')
  }
  let eventNumber=0
  const sync=async row=>{const event={id:'synthetic-buoy-'+(7600+eventNumber++),object:'event',livemode:false,type:'customer.subscription.updated',created:Math.floor(Date.now()/1000),data:{object:{id:row.subscription,object:'subscription',customer:row.customer}}},t=Math.floor(Date.now()/1000),signature=`t=${t},v1=${createHmac('sha256',billingWebhookSecret).update(t+'.'+JSON.stringify(event)).digest('hex')}`;const response=await app.request('/api/buoy'+base+'/webhook',{method:'POST',body:event,headers:{'stripe-signature':signature}});assert.equal(response.status,200,await response.clone().text())}
  const current=async row=>(await api('/renewals')).records.find(r=>r.id===row.renewalId)
  for(const [i,row]of source.rows.slice(0,2).entries()){
   const r=await current(row),outcome=i===0?'churned':'renewed-with-contraction',result=i===0?0:r.expectedArrMinor/2
   await api('/renewals/'+r.id,'PUT',{revision:r.revision,stage:'Decision',forecast:'at-risk',riskReasons:['Customer confirmed change'],ownerId:owner})
   const p=await api('/proposals','POST',{accountId:row.accountId,kind:'renewal',payload:{renewalId:r.id,outcome,resultArrMinor:result,reason:'customer-confirmed',evidence:'Signed subscription change'}})
   assert.equal((await current(row)).outcome,null,'Preparation is not approval')
   await api('/proposals/'+p.id+'/approve','POST',{});await api('/proposals/'+p.id+'/approve','POST',{})
   assert.equal((await current(row)).billingReconciliation,'pending-provider-sync')
   await sync(row);const mismatch=await current(row);assert.equal(mismatch.billingReconciliation,'mismatch');assert.equal(mismatch.billingActual.arrMinor,r.expectedArrMinor);assert.equal(mismatch.billingActual.differenceMinor,r.expectedArrMinor-result)
   if(i===0)row.status='canceled';else row.amount/=2
   await sync(row);const matched=await current(row)
   assert.equal(matched.billingReconciliation,'matched');assert.equal(matched.billingActual.arrMinor,result);assert.equal(matched.billingActual.differenceMinor,0);assert.equal(matched.expectedArrMinor,r.expectedArrMinor);assert.equal(matched.sourceVersionId,r.sourceVersionId,'Approved source image remains frozen')
   const billing=(await api('/billing')).observations.find(o=>o.accountId===row.accountId)
   assert.equal(matched.billingActual.snapshotId,billing.id);assert.equal(matched.billingActual.arrMinor,billing.document.revenue[0].arr.roundedMinor)
   assert.ok((await api('/renewals')).fields.history.some(h=>h.recordId===r.id&&h.key==='billing-reconciliation'&&h.newValue.billingReconciliation==='mismatch'),'Earlier mismatches remain in source history')
  }
  const first=source.rows[0]
  if(browser)for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try{await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}));const page=await context.newPage();await page.goto(app.origin+'/app/renewals?renewal='+first.renewalId,{waitUntil:'networkidle'});assert.match(await page.locator('#renewal-record').innerText(),/Billing reconciliation: matched/);assert.match(await page.locator('#renewal-record').innerText(),/Provider actual ARR/);assert.match(await page.locator('#renewal-history').innerText(),/mismatch/);await scan(page,'RENEW-001 provider reconciliation '+width);await page.screenshot({path:join(evidence,'renewal-provider-'+width+'.png'),fullPage:true});await page.locator('#renewal-record').screenshot({path:join(evidence,'renewal-provider-record-'+width+'.png')});await page.setViewportSize({width:320,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Provider renewal screen reflows to 320');assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&/^[+−×↗]$/.test(n.textContent.trim())).length),0,'All actions on this screen have visible text; no icon-only control needs a tooltip')}finally{await context.close()}
  }
  const forecast=await api('/renewals/forecast?period=quarter&start=2026-10-01&on=2027-01-01')
  assert.equal(forecast.records.find(r=>r.id===first.renewalId).actualNativeMinor,0);assert.equal(forecast.records.find(r=>r.id===source.rows[1].renewalId).actualNativeMinor,60600);assert.equal(forecast.accuracy,null);assert.match(forecast.gaps.join(' '),/actual coverage is incomplete/)
  await api('/connections/'+connection.id,'DELETE',{})
  const disconnected=await api('/renewals/forecast?period=quarter&start=2026-10-01');assert.ok(disconnected.gaps.some(g=>g.includes('Stripe source reconnect required')));assert.equal(disconnected.records.find(r=>r.id===source.rows[2].renewalId).forecastUsdMinor,null);assert.equal(disconnected.records.find(r=>r.id===first.renewalId).actualNativeMinor,0,'A reconnect gap does not rewrite an earlier verified actual')
  assert.ok(source.calls.every(c=>c.method==='GET'),'Renewal outcomes never mutate provider billing')
  await api('/accounts/'+first.accountId,'DELETE',{confirmation:'Provider renewal 0'});assert.ok(!(await api('/renewals')).records.some(r=>r.accountId===first.accountId));assert.ok(!JSON.stringify((await api('/renewals')).fields.history).includes(first.customer),'Erasure withdraws provider-renewal source history')
  console.log('RENEW-001 provider subscriptions: 12/two quarters, exact lead and notice dates, unique generation, stages, separate approved churn/contraction, mismatched then matched next-sync ARR, immutable prior sources, erasure and GET-only provider calls passed.')
 }finally{await app.close()}
}
