import assert from 'node:assert/strict'
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
  for(const [i,r]of data.records.entries())await api('/renewals/'+r.id+'/fields','PUT',{revision:(await row(r.id)).revision,values:{used:i===1?0:12,purchased:i===1?0:20,note:'Confirmed review '+i,start:'2026-01-01',package:i===0?'Scale':'Growth',products:['Reports','Exports'],approved:i===0,amount:{currency:i===0?'USD':'EUR',amountMinor:240000}},source:'Reviewed customer order '+i})
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
  console.log('RENEW-001 twelve confirmed periods, lead-time Cron, quarter board/list, all five approved outcomes, linked work and complete inherited field/segment carrier passed; provider billing reconciliation remains pending.')
 }finally{await app.close()}
}
