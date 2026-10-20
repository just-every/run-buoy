import assert from 'node:assert/strict'
// ACCOUNT-004: actual Worker HTTP, with only the paid mail-provider edge faked.
export async function fieldJourney({call,json,request,cookie,member,account}) {
 const read=async()=>json(await call('/fields'))
 const define=async d=>json(await call('/fields','POST',d),201)
 const defs=[{key:'seats_used',label:'Seats used',type:'number'},{key:'seats_purchased',label:'Seats purchased',type:'number'},
  {key:'plan',label:'Plan',type:'picklist',options:['Starter','Enterprise']},{key:'contract',label:'Contract value',type:'currency'},
  {key:'start',label:'Contract start',type:'date'},{key:'modules',label:'Modules',type:'multi-select',options:['Billing','Support']},
  {key:'active',label:'Active',type:'boolean'},{key:'reference',label:'Customer statement',type:'text'}]
 for(let i=0;i<10;i++)await json(await call('/accounts','POST',{...account('field-'+i),name:'Field customer '+i}),201)
 assert.equal((await request('/api/buoy/fields')).status,401)
 assert.equal((await call('/fields','POST',defs[0],{cookie:member})).status,403)
 assert.equal((await call('/fields','POST',defs[0],{headers:{origin:'https://foreign.invalid'}})).status,403)
 for(const d of defs)await define(d)
 const save=async(id,values,source='Customer-confirmed license record L-18')=>{
  const a=(await read()).accounts.find(a=>a.id===id)
  return json(await call('/accounts/'+id+'/fields','PUT',{revision:a.revision,values,source}))
 }
 const values=i=>({seats_used:20+i,seats_purchased:40,plan:'Enterprise',contract:{currency:'USD',amountMinor:1200000},start:'2026-01-01',modules:['Billing'],active:true,reference:'License statement confirmed by customer'})
 for(let i=0;i<10;i++)await save('field-'+i,values(i))
 const formula={key:'utilization',label:'Seats used divided by purchased',type:'formula',formula:'custom.seats_used / custom.seats_purchased'}
 const before=await read(),preview=await json(await call('/fields/preview','POST',formula))
 assert.equal(preview.accounts.filter(a=>a.id.startsWith('field-')).length,10,'ACCOUNT-004 preview uses ten actual accounts')
 for(let i=0;i<10;i++){const a=preview.accounts.find(a=>a.id==='field-'+i);assert.equal(a.values.utilization,(20+i)/40);assert.match(a.explanations.utilization,/custom.seats_used=/);assert.match(a.explanations.utilization,/custom.seats_purchased=40/)}
 assert.deepEqual(await read(),before,'ACCOUNT-004 preview saves no values, definition or history')
 await define(formula)
 for(const d of [
  {key:'conditional',label:'Conditional',formula:'if(custom.active == true, custom.utilization * 100, 0)'},
  {key:'days',label:'Contract duration',formula:'days(renewalDate, custom.start)'},
  {key:'rollup',label:'Portfolio notice days',formula:'sum(noticeDays)'},
  {key:'average',label:'Average notice',formula:'avg(noticeDays)'},
  {key:'count',label:'Account count',formula:'count(id)'},
  {key:'arithmetic',label:'Arithmetic',formula:'(2 + 3) * 4 - 6 / 2'},
 ])await define({...d,type:'formula'})
 let state=await read(),a=state.accounts.find(a=>a.id==='field-0')
 assert.equal(a.values.utilization,.5);assert.equal(a.values.conditional,50);assert.equal(a.values.arithmetic,17)
 assert.equal(a.values.days,(Date.parse(account().renewalDate)-Date.parse('2026-01-01'))/86400000)
 const natives=(await json(await call('/state'))).accounts,noticeTotal=natives.reduce((sum,a)=>sum+a.noticeDays,0)
 assert.equal(a.values.rollup,noticeTotal);assert.equal(a.values.average,noticeTotal/natives.length);assert.equal(a.values.count,natives.length)
 assert.match(a.explanations.rollup,/Portfolio sum\(noticeDays\)/)
 const stale=a.revision
 await save('field-0',{...values(0),seats_used:30},'License meter export row 88')
 state=await read();a=state.accounts.find(a=>a.id==='field-0');assert.equal(a.values.utilization,.75);assert.equal(a.values.conditional,75)
 const h=state.history.filter(h=>h.accountId==='field-0')
 for(const key of ['seats_used','utilization','conditional']){const entry=h.find(h=>h.key===key&&h.source==='License meter export row 88');assert.ok(entry);assert.match(entry.actor,/^person:/);assert.ok(Date.parse(entry.recordedAt))}
 assert.deepEqual([h.find(h=>h.key==='seats_used'&&h.source==='License meter export row 88').oldValue,h.find(h=>h.key==='seats_used'&&h.source==='License meter export row 88').newValue],[20,30])
 assert.equal((await call('/accounts/field-0/fields','PUT',{revision:stale,values:values(0),source:'stale'})).status,409)
 for(const invalid of [{...values(0),plan:'Unknown'},{...values(0),start:'2026-02-30'},{...values(0),active:'true'},{...values(0),contract:{currency:'ABC',amountMinor:4}},{...values(0),utilization:.8},{...values(0),modules:['Billing','Billing']},{...values(0),seats_used:'20'}]){
  const current=(await read()).accounts.find(a=>a.id==='field-0')
  assert.equal((await call('/accounts/field-0/fields','PUT',{revision:current.revision,values:invalid,source:'invalid'})).status,400)
 }
 for(const formula of ['custom.unknown / 2','custom.utilization / custom.seats_purchased','1 +','globalThis.process()']){
  const d={key:formula.includes('custom.utilization')?'utilization':'invalid',label:'Invalid',type:'formula',formula}
  assert.equal((await call('/fields/preview','POST',d)).status,400,'ACCOUNT-004 rejects unknown, circular and invalid formulas')
 }
 await save('field-0',{...values(0),seats_purchased:0});a=(await read()).accounts.find(a=>a.id==='field-0');assert.equal(a.values.utilization,null);assert.match(a.explanations.utilization,/zero/)
 await save('field-0',{...values(0),seats_purchased:null});a=(await read()).accounts.find(a=>a.id==='field-0');assert.equal(a.values.utilization,null);assert.match(a.explanations.utilization,/Missing/)
 await save('field-0',{...values(0),seats_used:30})
 const segment=await json(await call('/segments','POST',{name:'ACCOUNT-004 seats over half',mode:'dynamic',rules:{match:'all',conditions:[{field:'custom.utilization',op:'gt',value:.7}]},accountIds:[],tier:null,stage:null,playbook:null}),201)
 assert.deepEqual((await json(await call(`/segments/${segment.id}/report`))).accounts.map(a=>a.accountId).sort(),['field-0','field-9'])
 await save('field-0',values(0));assert.deepEqual((await json(await call(`/segments/${segment.id}/report`))).accounts.map(a=>a.accountId),['field-9'])
 await define({key:'native',label:'Native support count',type:'formula',formula:'support.openTickets * 2'})
 const native=(await json(await call('/state'))).accounts.find(a=>a.id==='field-0')
 await json(await call('/accounts/field-0','PUT',{...account('field-0'),name:native.name,revision:native.revision,support:{...account().support,openTickets:9}}))
 a=(await read()).accounts.find(a=>a.id==='field-0');assert.equal(a.values.native,18)
 assert.ok((await read()).history.some(h=>h.accountId==='field-0'&&h.key==='native'&&h.newValue===18&&h.source==='Calculated from current account inputs'))
 const memberRead=await json(await call('/fields','GET',undefined,{cookie:member}));assert.deepEqual(memberRead,await read())
 const adminResponse=await request('/auth/invite',{method:'POST',cookie,body:{email:'fields-admin@example.test',displayName:'Field admin',role:'admin'}});assert.equal(adminResponse.status,202)
 assert.equal((await request('/app/fields',{cookie})).status,200)
 assert.equal((await call('/fields/preview','POST',formula,{cookie:member})).status,403)
 await json(await call('/accounts/field-0','DELETE',{confirmation:'Field customer 0'}))
 state=await read();assert.ok(!state.accounts.some(a=>a.id==='field-0'));assert.ok(!state.history.some(h=>h.accountId==='field-0'))
}
