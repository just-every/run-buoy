import assert from 'node:assert/strict'

// USAGE-001 ACCOUNT-004: customer contacts/users through the real Worker HTTP door.
export async function customerPeopleJourney({call,json,request,cookie,member,account}) {
 const read=async()=>json(await call('/customer-people'))
 const define=async definition=>json(await call('/customer-fields','POST',definition),201)
 const staff=await json(await request('/auth/operators',{cookie}))
 const accountIds=Array.from({length:10},(_,i)=>`people-account-${i}`)
 for(const [i,id] of accountIds.entries())await json(await call('/accounts','POST',{...account(id),name:`Customer people account ${i}`}),201)
 const fixtures=[]
 for(const kind of ['contact','user'])for(let i=0;i<10;i++){
  const name=kind==='contact'&&i===0?staff[0].displayName:`Customer ${kind} ${i}`
  const memberships=kind==='contact'&&i===0?accountIds.slice(0,2):[accountIds[i]]
  const created=await json(await call('/customer-people','POST',{kind,name,accountIds:memberships,source:'Customer directory D-12'}),201)
  fixtures.push({id:created.id,kind,i,name,accountIds:memberships})
 }
 const fixture=(kind,i=0)=>fixtures.find(p=>p.kind===kind&&p.i===i)
 const record=async id=>(await read()).records.find(p=>p.id===id)
 const save=async(id,values,source='Customer license statement L-18',sourceAccountId)=>{
  const current=await record(id)
  return json(await call(`/customer-people/${id}/fields`,'PUT',{revision:current.revision,values,source,...(sourceAccountId?{sourceAccountId}:{})}))
 }
 const move=async(id,ids)=>{
  const current=await record(id)
  return json(await call(`/customer-people/${id}`,'PUT',{revision:current.revision,kind:current.kind,name:current.name,accountIds:ids,source:'Customer directory membership correction D-13'}))
 }
 let state=await read()
 assert.equal(state.records.length,20,'USAGE-001 contacts and product users are actual customer records')
 for(const p of fixtures){
  const actual=state.records.find(r=>r.id===p.id)
  assert.equal(actual.kind,p.kind);assert.equal(actual.name,p.name)
  assert.deepEqual([...actual.accountIds].sort(),[...p.accountIds].sort())
  assert.ok(!staff.some(s=>s.id===actual.id),'USAGE-001 customer identity is separate from staff identity')
  assert.ok(Date.parse(actual.createdAt))
  for(const a of state.accounts)assert.equal(a.records.some(r=>r.id===p.id),p.accountIds.includes(a.id),'USAGE-001 membership is explicit, including matching staff names')
 }
 assert.deepEqual(await json(await request('/auth/operators',{cookie})),staff,'USAGE-001 creating customer people does not create or change team members')
 const create={kind:'contact',name:'Explicit account contact',accountIds:[accountIds[0]],source:'Customer directory'}
 for(const invalid of [{...create,accountIds:[]},{...create,accountIds:['missing-account']},{...create,accountIds:[accountIds[0],accountIds[0]]},{...create,personId:staff[0].id},{...create,operatorId:staff[0].id}])
  assert.equal((await call('/customer-people','POST',invalid)).status,400,'USAGE-001 customer membership cannot infer or reuse staff identity')

 const definitions=[
  {key:'seats',label:'Licensed seats used',type:'number'},
  {key:'purchased',label:'Licensed seats purchased',type:'number'},
  {key:'plan',label:'Customer package',type:'picklist',options:['Starter','Enterprise']},
  {key:'contract',label:'Customer contract',type:'currency'},
  {key:'started',label:'License start',type:'date'},
  {key:'modules',label:'Licensed modules',type:'multi-select',options:['Billing','Support']},
  {key:'active',label:'License active',type:'boolean'},
  {key:'reference',label:'Customer evidence',type:'text'},
 ]
 for(const d of definitions)await define(d)
 const values=p=>({seats:(p.kind==='contact'?20:40)+p.i,purchased:100,plan:'Enterprise',contract:{currency:'USD',amountMinor:1200000},started:'2026-01-01',modules:['Billing'],active:true,reference:'Customer confirmed license statement'})
 for(const p of fixtures)await save(p.id,values(p))
 state=await read()
 for(const p of fixtures)assert.deepEqual(state.records.find(r=>r.id===p.id).values,values(p),'ACCOUNT-004 every manual field type persists for contacts and users')
 assert.deepEqual(await json(await call('/customer-fields')),state)
 const first=fixture('contact'),current=await record(first.id)
 const routes=[
  ['/customer-people','POST',create],
  [`/customer-people/${first.id}`,'PUT',{revision:current.revision,kind:first.kind,name:first.name,accountIds:first.accountIds,source:'Unauthorized directory change'}],
  [`/customer-people/${first.id}/fields`,'PUT',{revision:current.revision,values:values(first),source:'Unauthorized field change'}],
  ['/customer-fields','POST',{key:'denied',label:'Unauthorized',type:'text'}],
  ['/customer-fields/preview','POST',{key:'denied_preview',label:'Unauthorized preview',type:'formula',formula:'custom.seats / custom.purchased'}],
 ]
 const agent=await json(await call('/agent-tokens','POST',{label:'USAGE-001 ACCOUNT-004 carrier boundary'}),201)
 for(const path of ['/customer-people','/customer-fields']){
  assert.equal((await request('/api/buoy'+path)).status,401)
  assert.equal((await call(path,'GET',undefined,{token:agent.token})).status,403)
  assert.deepEqual(await json(await call(path,'GET',undefined,{cookie:member})),state)
 }
 for(const [path,method,body] of routes){
  assert.equal((await request('/api/buoy'+path,{method,body})).status,401)
  assert.equal((await call(path,method,body,{cookie:member})).status,403)
  assert.equal((await call(path,method,body,{token:agent.token})).status,403)
  assert.equal((await call(path,method,body,{headers:{origin:'https://foreign.invalid'}})).status,403)
 }
 await json(await call(`/agent-tokens/${agent.id}`,'DELETE'))
 assert.deepEqual(await read(),state,'USAGE-001 ACCOUNT-004 refused mutations save no customer data')

 const utilization={key:'utilization',label:'License utilization',type:'formula',formula:'custom.seats / custom.purchased'}
 const before=await read(),preview=await json(await call('/customer-fields/preview','POST',utilization))
 assert.equal(preview.totalRecords,before.records.length);assert.equal(preview.totalAccounts,before.accounts.length)
 assert.equal(preview.records.length,10,'ACCOUNT-004 previews ten real customer records')
 assert.equal(preview.accounts.length,10,'ACCOUNT-004 previews ten real accounts')
 assert.equal(new Set(preview.records.map(p=>p.id)).size,10)
 assert.equal(new Set(preview.accounts.map(a=>a.id)).size,10)
 for(const p of preview.records){
  const actual=before.records.find(r=>r.id===p.id);assert.ok(actual)
  assert.equal(p.values.utilization,actual.values.seats/actual.values.purchased)
  assert.match(p.explanations.utilization,/custom.seats=/);assert.match(p.explanations.utilization,/custom.purchased=100/)
 }
 for(const a of preview.accounts){
  const actual=before.accounts.find(r=>r.id===a.id);assert.ok(actual)
  assert.equal(a.name,actual.name)
  assert.deepEqual(a.records.map(p=>p.id).sort(),actual.records.map(p=>p.id).sort())
  for(const p of a.records){const actualPerson=before.records.find(r=>r.id===p.id);assert.equal(p.values.utilization,actualPerson.values.seats/100)}
 }
 const total=fixtures.reduce((sum,p)=>sum+values(p).seats,0)
 const rollupPreview=await json(await call('/customer-fields/preview','POST',{key:'preview_total',label:'All customer seats',type:'formula',formula:'sum(custom.seats)'}))
 for(const p of rollupPreview.records)assert.equal(p.values.preview_total,total,'ACCOUNT-004 ten-record preview evaluates the complete twenty-record portfolio')
 assert.deepEqual(await read(),before,'ACCOUNT-004 preview writes no definitions, values, revisions, memberships or history')
 await define(utilization)
 for(const d of [
  {key:'conditional',label:'Active utilization percent',formula:'if(custom.active == true, custom.utilization * 100, 0)'},
  {key:'days',label:'License duration',formula:'days("2027-03-31", custom.started)'},
  {key:'arithmetic',label:'Arithmetic precedence',formula:'(2 + 3) * 4 - 6 / 2'},
  {key:'total_seats',label:'Customer people seat total',formula:'sum(custom.seats)'},
  {key:'average_seats',label:'Customer people seat average',formula:'avg(custom.seats)'},
  {key:'person_count',label:'Customer people count',formula:'count(id)'},
 ])await define({...d,type:'formula'})
 state=await read()
 for(const p of fixtures){
  const actual=state.records.find(r=>r.id===p.id)
  assert.equal(actual.values.utilization,values(p).seats/100)
  assert.equal(actual.values.conditional,(values(p).seats/100)*100)
  assert.equal(actual.values.days,(Date.parse('2027-03-31')-Date.parse('2026-01-01'))/86400000)
  assert.equal(actual.values.arithmetic,17)
  assert.equal(actual.values.total_seats,total);assert.equal(actual.values.average_seats,total/20);assert.equal(actual.values.person_count,20)
  assert.match(actual.explanations.total_seats,/Portfolio sum\(custom.seats\)/)
 }

 for(const kind of ['contact','user']){
  const p=fixture(kind),base=values(p),stale=(await record(p.id)).revision,source=`Customer ${kind} license meter row 88`
  await save(p.id,{...base,seats:base.seats+50},source)
  state=await read();const changed=state.records.find(r=>r.id===p.id)
  assert.equal(changed.values.utilization,(base.seats+50)/100);assert.equal(changed.values.conditional,base.seats+50)
  for(const [key,oldValue,newValue] of [['seats',base.seats,base.seats+50],['utilization',base.seats/100,(base.seats+50)/100],['conditional',base.seats,base.seats+50]]){
   const entry=state.history.find(h=>h.personId===p.id&&h.key===key&&h.source===source)
   assert.ok(entry,`ACCOUNT-004 ${kind} ${key} change retains evidence`)
   assert.deepEqual([entry.oldValue,entry.newValue],[oldValue,newValue]);assert.match(entry.actor,/^person:/);assert.ok(Date.parse(entry.recordedAt))
  }
  assert.equal((await call(`/customer-people/${p.id}/fields`,'PUT',{revision:stale,values:base,source:'Stale license statement'})).status,409)
  assert.equal((await call(`/customer-people/${p.id}`,'PUT',{revision:stale,kind,name:p.name,accountIds:p.accountIds,source:'Stale directory'})).status,409)
  for(const invalid of [{...base,seats:'20'},{...base,plan:'Unknown'},{...base,started:'2026-02-30'},{...base,active:'true'},{...base,modules:['Billing','Billing']},{...base,contract:{currency:'ABC',amountMinor:4}},{...base,contract:{currency:'USD',amountMinor:-1}},{...base,utilization:.8}]){
   const revision=(await record(p.id)).revision
   assert.equal((await call(`/customer-people/${p.id}/fields`,'PUT',{revision,values:invalid,source:'Invalid license statement'})).status,400)
  }
  await save(p.id,{...base,purchased:0,active:false})
  let actual=await record(p.id);assert.equal(actual.values.utilization,null);assert.match(actual.explanations.utilization,/zero/)
  assert.equal(actual.values.conditional,0,'ACCOUNT-004 if evaluates only the selected branch')
  await save(p.id,{...base,purchased:null})
  actual=await record(p.id);assert.equal(actual.values.utilization,null);assert.match(actual.explanations.utilization,/Missing/)
  const missingStart={...base};delete missingStart.started
  await save(p.id,missingStart)
  actual=await record(p.id);assert.equal(actual.values.days,null);assert.match(actual.explanations.days,/Missing/)
  await save(p.id,{...base,seats:base.seats+50})
 }
 for(const formula of ['custom.unknown / 2','custom.conditional / custom.purchased','1 +','globalThis.process()']){
  const key=formula.includes('custom.conditional')?'utilization':'invalid_formula'
  const definition={key,label:'Invalid calculation',type:'formula',formula}
  const before=await read()
  for(const path of ['/customer-fields/preview','/customer-fields'])assert.equal((await call(path,'POST',definition)).status,400,'ACCOUNT-004 unknown, cyclic and invalid formulas are refused')
  assert.deepEqual(await read(),before)
 }
 for(const definition of [{key:'plan',label:'Package',type:'picklist',options:['Starter']},{key:'seats',label:'Seats',type:'text'}])
  assert.equal((await call('/customer-fields','POST',definition)).status,400,'ACCOUNT-004 used values survive attempted schema incompatibility')

 // SEGMENT-001 consumes typed related records and refreshes after value or membership changes.
 const segmentInput=(name,conditions)=>({name,mode:'dynamic',rules:{match:'all',conditions},accountIds:[],tier:null,stage:null,playbook:null})
 const report=async id=>(await json(await call(`/segments/${id}/report`))).accounts.map(a=>a.accountId).sort()
 for(const kind of ['contact','user']){
  const field=key=>`people.${kind}.custom.${key}`
  const conditions=[
   {field:field('utilization'),op:'gt',value:.6},
   {field:field('active'),op:'eq',value:1},
   {field:field('plan'),op:'eq',value:'Enterprise'},
   {field:field('started'),op:'gte',value:'2026-01-01'},
   {field:field('reference'),op:'contains',value:'confirmed'},
   {field:field('modules'),op:'contains',value:'Billing'},
   {field:field('contract.amountMinor'),op:'gte',value:1200000},
   {field:field('contract.currency'),op:'eq',value:'USD'},
  ]
  const input=segmentInput(`ACCOUNT-004 ${kind} licensed customers`,conditions)
  assert.equal((await call('/segments','POST',{...input,rules:{match:'all',conditions:[{field:field('seats'),op:'gt',value:'60'}]}})).status,400,'SEGMENT-001 related numeric fields reject text')
  assert.equal((await call('/segments','POST',{...input,rules:{match:'all',conditions:[{field:field('plan'),op:'eq',value:1}]}})).status,400,'SEGMENT-001 related text fields reject numbers')
  assert.equal((await call('/segments','POST',{...input,rules:{match:'all',conditions:[{field:field('active'),op:'eq',value:true}]}})).status,400,'SEGMENT-001 related booleans use the explicit numeric rule representation')
  assert.equal((await call('/segments','POST',{...input,rules:{match:'all',conditions:conditions.filter(c=>c.field!==field('contract.currency'))}})).status,400,'SEGMENT-001 money comparisons need an explicit currency')
  const segment=await json(await call('/segments','POST',input),201)
  assert.deepEqual(await report(segment.id),kind==='contact'?accountIds.slice(0,2):[accountIds[0]])
  const p=fixture(kind)
  await save(p.id,values(p));assert.deepEqual(await report(segment.id),[],'SEGMENT-001 custom value changes re-evaluate customer membership')
  await save(p.id,{...values(p),seats:values(p).seats+50})
  await move(p.id,[accountIds[2]])
  assert.deepEqual(await report(segment.id),[accountIds[2]],'SEGMENT-001 explicit customer relationship changes re-evaluate account membership')
  const membership=(await read()).history.find(h=>h.personId===p.id&&h.key==='person.accountIds'&&JSON.stringify(h.newValue)===JSON.stringify([accountIds[2]]))
  assert.ok(membership);assert.deepEqual(membership.oldValue,p.accountIds)
  assert.equal(membership.source,'Customer directory membership correction D-13');assert.match(membership.actor,/^person:/);assert.ok(Date.parse(membership.recordedAt))
  await move(p.id,p.accountIds)
 }
 const user8=fixture('user',8),user9=fixture('user',9)
 await move(user9.id,[accountIds[8]])
 await save(user8.id,{...values(user8),seats:90,contract:{currency:'EUR',amountMinor:1200000}})
 const samePerson=await json(await call('/segments','POST',segmentInput('USAGE-001 same customer user',[
  {field:'id',op:'eq',value:accountIds[8]},
  {field:'people.user.custom.seats',op:'gt',value:60},
  {field:'people.user.custom.contract.amountMinor',op:'gte',value:1200000},
  {field:'people.user.custom.contract.currency',op:'eq',value:'USD'},
 ])),201)
 assert.deepEqual(await report(samePerson.id),[],'SEGMENT-001 conjunctions cannot borrow amount and currency from different users')
 await save(user8.id,{...values(user8),seats:90})
 assert.deepEqual(await report(samePerson.id),[accountIds[8]])
 assert.deepEqual(await json(await request('/auth/operators',{cookie})),staff,'USAGE-001 customer membership edits leave team membership intact')

 const shared=fixture('contact'),privateSource='Erased account 0 private license statement L-99'
 const sharedRevision=(await record(shared.id)).revision
 assert.equal((await call(`/customer-people/${shared.id}/fields`,'PUT',{revision:sharedRevision,values:values(shared),source:privateSource,sourceAccountId:accountIds[9]})).status,400,'ACCOUNT-004 source custody must be an explicit membership')
 await save(shared.id,{...values(shared),seats:70,reference:privateSource},privateSource,accountIds[0])
 assert.ok(JSON.stringify(await read()).includes(privateSource))
 await json(await call(`/accounts/${accountIds[0]}`,'DELETE',{confirmation:'Customer people account 0'}))
 state=await read()
 assert.ok(!state.accounts.some(a=>a.id===accountIds[0]))
 assert.ok(!state.records.some(p=>p.id===fixture('user').id),'USAGE-001 ERASE-001 sole-account customer records leave custody with their account')
 assert.ok(!state.history.some(h=>h.personId===fixture('user').id),'ACCOUNT-004 ERASE-001 erased customer values and history are withdrawn')
 assert.deepEqual(state.records.find(p=>p.id===fixture('contact').id).accountIds,[accountIds[1]],'USAGE-001 ERASE-001 shared customer remains only with the surviving explicit account')
 const retained=state.records.find(p=>p.id===shared.id)
 assert.equal(retained.values.reference,null);assert.equal(retained.values.seats,null);assert.equal(retained.values.utilization,null)
 assert.equal(retained.values.person_count,19)
 assert.equal(state.records.find(p=>p.id===fixture('contact',1).id).values.seats,21,'ERASE-001 surviving account inputs remain available')
 assert.ok(!JSON.stringify(state).includes(privateSource),'ACCOUNT-004 ERASE-001 shared values, explanations and dependent history retain no erased source custody')
 assert.ok(state.records.every(p=>!p.accountIds.includes(accountIds[0])))
 assert.deepEqual(await json(await call('/customer-people','GET',undefined,{cookie:member})),state)
}
