import assert from 'node:assert/strict'

// Confirmed terms and numeric health meet at real staff/segment/approval doors.
export async function revenueHealth(app,fixture,member,healthResult){
 const {api,accounts}=fixture,accountId=accounts[0].id,otherId=accounts[1].id,fieldKey=healthResult.fieldKey
 const on=new Date().toISOString().slice(0,10),day=n=>new Date(Date.parse(on)+n*86400000).toISOString().slice(0,10)
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie:app.cookie,method,body,...options})
 const status=async(path,method,body,expected,options={})=>{const r=await request(path,method,body,options);assert.equal(r.status,expected,`${method} ${path}: ${await r.clone().text()}`);return r}
 const read=()=>api('/revenue'),state=()=>api('/state')
 const account=async(id=accountId)=>(await state()).accounts.find(a=>a.id===id)
 const row=(data,id=accountId)=>{const r=data.accounts.find(a=>a.accountId===id);assert.ok(r,`Revenue for ${id}`);return r}
 const line=(amountMinor,frequency='annual',id='synthetic-buoy-1')=>({id,product:'Analytics workspace',quantity:20,amountMinor,frequency,entitlements:'Reports, exports and twenty licensed users'})
 const contract={currency:'USD',contractStart:day(-1),contractEnd:day(365),lines:[line(6000000)],source:{reference:'Customer-confirmed recurring order',confirmedOn:on}}
 const save=async(value,id=accountId,cookie=app.cookie)=>api('/accounts/'+id+'/contract','POST',{revision:(await account(id)).revision,contract:value},cookie)
 const custom=async(value,id=accountId)=>{const a=(await api('/fields')).accounts.find(a=>a.id===id);await api('/accounts/'+id+'/fields','PUT',{revision:a.revision,values:{[fieldKey]:value},source:'Customer-confirmed revenue health review'})}
 const initial=await read()
 for(const id of [accountId,otherId]){const r=row(initial,id);assert.equal(r.contract,null);assert.equal(r.revenue.arrMinor,null);assert.equal(r.revenue.mrrMinor,null);assert.equal(r.revenue.status,'missing');assert.equal(r.revenue.freshness,'missing')}
 const body={revision:(await account()).revision,contract}
 await status('/revenue','GET',undefined,401,{cookie:undefined})
 for(const options of [{cookie:undefined},{cookie:member},{headers:{origin:'https://foreign.invalid'}}])await status('/accounts/'+accountId+'/contract','POST',body,options.cookie===undefined&&!options.headers?401:403,options)
 const grant=await api('/agent-tokens','POST',{label:'Recurring terms authority probe'})
 try{for(const [path,method,input] of [['/revenue','GET'],['/accounts/'+accountId+'/contract','POST',body]])await status(path,method,input,403,{cookie:undefined,token:grant.token})}finally{await api('/agent-tokens/'+grant.id,'DELETE')}
 const first=await save(contract),firstState=await read(),firstVersion=firstState.versions.find(v=>v.id===first.versionId)
 assert.deepEqual(firstVersion.contract,contract);assert.equal(first.sourceKind,'person-confirmed');assert.match(first.recordedBy,/^person:/);assert.ok(Date.parse(first.recordedAt))
 assert.equal(first.revenue.arrMinor,6000000,'Annual period total is USD 60,000 ARR without multiplying quantity again')
 assert.equal(first.revenue.mrrMinor,500000);assert.deepEqual(first.revenue.mrrExact,{numeratorMinor:6000000,denominator:12})
 assert.equal(first.revenue.seats,20);assert.deepEqual(first.revenue.products,['Analytics workspace'])
 assert.equal(first.revenue.reference,contract.source.reference);assert.equal(first.revenue.confirmedOn,on);assert.equal(first.revenue.freshness,'current')
 await status('/accounts/'+accountId+'/contract','POST',body,409)
 assert.equal((await read()).versions.length,firstState.versions.length,'Stale contract editor cannot append a version')
 const mixed={...contract,lines:[line(1200006),{...line(400000,'monthly','synthetic-buoy-2'),product:'Support module',quantity:3,entitlements:'Priority case routing'}]}
 const mixedSaved=await save(mixed)
 assert.equal(mixedSaved.revenue.arrMinor,1200006+400000*12,'Monthly and annual totals add in one native currency')
 assert.equal(mixedSaved.revenue.mrrMinor,500001,'Fractional minor-unit MRR rounds half up')
 assert.deepEqual(mixedSaved.revenue.mrrExact,{numeratorMinor:6000006,denominator:12})
 assert.equal(mixedSaved.revenue.seats,23);assert.deepEqual(mixedSaved.revenue.products,['Analytics workspace','Support module'])
 assert.deepEqual(row(await read()).contract.lines,mixed.lines,'Product, quantity, entitlements and period totals survive the public read')
 for(const [start,end,expected] of [[day(1),day(365),'scheduled'],[day(-365),day(-1),'expired'],[on,on,'active']]){
  const saved=await save({...contract,contractStart:start,contractEnd:end})
  assert.equal(saved.revenue.status,expected);assert.equal(saved.revenue.arrMinor,expected==='active'?6000000:0);assert.equal(saved.revenue.mrrMinor,expected==='active'?500000:0)
 }
 const zero=await save({...contract,lines:[]})
 assert.equal(zero.revenue.arrMinor,0);assert.equal(zero.revenue.mrrMinor,0);assert.equal(zero.revenue.status,'active');assert.deepEqual(zero.revenue.products,[])
 const stale=await save({...contract,source:{reference:'Earlier confirmed recurring order',confirmedOn:day(-31)}})
 assert.equal(stale.revenue.freshness,'stale');assert.equal(stale.revenue.arrMinor,6000000,'Stale confirmation retains its disclosed terms')
 const invalidRevision=(await account()).revision,beforeInvalid=await read()
 const invalid=[{...contract,currency:'ABC'},{...contract,contractStart:'2026-02-30'},{...contract,contractEnd:day(-2)},
  {...contract,source:{...contract.source,confirmedOn:day(1)}},{...contract,source:{...contract.source,reference:''}},
  {...contract,lines:[{...line(1),frequency:'quarterly'}]},{...contract,lines:[line(Number.MAX_SAFE_INTEGER,'monthly')]},
  {...contract,lines:[line(1.5)]},{...contract,lines:[{...line(1),quantity:0}]},{...contract,lines:[line(1),line(2)]},
  {...contract,lines:[{...line(1),quantity:Number.MAX_SAFE_INTEGER},{...line(1,'annual','synthetic-buoy-2'),quantity:1}]},
  {...contract,sourceKind:'billing'}]
 for(const value of invalid)await status('/accounts/'+accountId+'/contract','POST',{revision:invalidRevision,contract:value},400)
 assert.deepEqual((await read()).versions,beforeInvalid.versions,'Invalid terms do not mutate immutable history')
 await save(contract)
 const invitation=await app.request('/auth/invite',{cookie:app.cookie,method:'POST',body:{email:'synthetic-buoy-4@example.test',displayName:'Recurring terms admin',role:'admin'}})
 assert.equal(invitation.status,202)
 const admin=await app.signIn('synthetic-buoy-4@example.test'),eur={...contract,currency:'EUR',source:{reference:'Customer-confirmed euro order',confirmedOn:on}}
 await save(eur,otherId,admin)
 const currencies=await read()
 assert.equal(row(currencies).revenue.currency,'USD');assert.equal(row(currencies,otherId).revenue.currency,'EUR')
 assert.equal(row(currencies,otherId).revenue.arrMinor,6000000)
 assert.equal(Object.hasOwn(currencies,'arrMinor'),false,'The portfolio does not invent a cross-currency ARR total')
 assert.deepEqual(await (await status('/revenue','GET',undefined,200,{cookie:member})).json(),await read(),'A staff member can read the confirmed terms and retained history')
 const config={name:'Customer success review health',measures:[{key:'success',name:'Customer success index',field:'custom.'+fieldKey,min:0,max:100,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:60,healthyAt:75},segments:[]}
 await custom(50);await custom(50,otherId)
 await api('/scorecards/publish','POST',{revision:(await api('/scorecards')).revision,config})
 assert.equal((await account()).health.score,50)
 const rule=(field,op,value)=>({field,op,...(value===undefined?{}:{value})})
 const segmentInput={name:'USD recurring customers needing a health review',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[rule('revenue.currency','eq','USD'),rule('revenue.arrMinor','gt',5000000),rule('health.score','lt',60)]},tier:null,stage:null,playbook:{title:'Review recurring customer health',dueDays:2}}
 for(const field of ['revenue.arrMinor','revenue.mrrMinor']){
  await status('/segments','POST',{...segmentInput,rules:{match:'all',conditions:[rule(field,'gt',0)]}},400)
  await status('/segments','POST',{...segmentInput,rules:{match:'any',conditions:[rule('revenue.currency','eq','USD'),rule(field,'gt',0)]}},400)
 }
 const monthly=await api('/segments','POST',{...segmentInput,name:'Confirmed USD monthly revenue',playbook:null,rules:{match:'all',conditions:[rule('revenue.currency','eq','USD'),rule('revenue.mrrMinor','eq',500000),rule('revenue.sourceKind','eq','person-confirmed'),rule('revenue.seats','eq',20),rule('revenue.products','contains','Analytics workspace')]}})
 assert.deepEqual((await api('/segments/'+monthly.id+'/report')).accounts.map(a=>a.accountId),[accountId],'Currency-scoped monthly revenue and source/product quantities are real segment inputs')
 const segment=await api('/segments','POST',segmentInput),segmentId=segment.id
 const report=()=>api('/segments/'+segmentId+'/report'),segmentState=async()=>(await api('/segments')).segments.find(s=>s.id===segmentId)
 assert.deepEqual((await report()).accounts.map(a=>a.accountId),[accountId],'USD ARR over 50,000 and score below 60 exclude the otherwise identical EUR customer')
 let current=await segmentState(),proposalId=current.history.find(h=>!h.exitedAt).proposalId
 assert.ok(proposalId);assert.equal((await state()).tasks.filter(t=>t.proposalId===proposalId).length,0)
 await api('/proposals/'+proposalId+'/approve','POST',{});await api('/proposals/'+proposalId+'/approve','POST',{})
 assert.equal((await state()).tasks.filter(t=>t.proposalId===proposalId).length,1,'Revenue-health entry approval creates exactly one task')
 const boundary={...contract,lines:[line(5000000)]}
 await save(boundary);assert.equal((await report()).count,0,'ARR exactly at 50,000 exits the strict greater-than threshold')
 await save(contract);current=await segmentState();assert.equal(current.members.length,1);assert.equal(current.history.length,2)
 proposalId=current.history.find(h=>!h.exitedAt).proposalId
 const previousContractRevision=row(await read()).contractRevision
 await save({...contract,source:{reference:'Customer reconfirmed unchanged annual terms',confirmedOn:on}})
 assert.notEqual(row(await read()).contractRevision,previousContractRevision)
 assert.equal((await report()).count,1,'A new confirmation can retain the same matching contract value')
 await status('/proposals/'+proposalId+'/approve','POST',{},409)
 assert.equal((await state()).tasks.filter(t=>t.proposalId===proposalId).length,0,'Contract revision invalidates old approval even while membership still matches')
 assert.equal((await segmentState()).history.length,2,'A source version does not replay an active entry')
 await custom(60);assert.equal((await report()).count,0,'A score at 60 exits the strict health-score threshold')
 await custom(50);current=await segmentState();assert.equal(current.history.length,3);assert.equal(current.members.length,1)
 const pendingProposalId=current.history.find(h=>!h.exitedAt).proposalId
 assert.equal((await state()).proposals.find(p=>p.id===pendingProposalId).status,'prepared')
 const reportNow=await report();assert.equal(reportNow.health['at-risk'],1);assert.equal(reportNow.accounts[0].assessment.score,50)
 const csv=await status('/segments/'+segmentId+'/report.csv','GET',undefined,200)
 assert.match(csv.headers.get('content-type'),/csv/);assert.ok((await csv.text()).includes((await account()).name))
 // Erasure uses a temporary account so both fixture accounts remain reviewable.
 const temporary=await api('/accounts','POST',{id:'synthetic-buoy-3',name:'Temporary recurring customer',renewalDate:day(365),noticeDays:30,renewalEvidence:'Temporary confirmed order',billing:null,support:null})
 const privateContract={...contract,source:{reference:'Temporary private recurring confirmation',confirmedOn:on}}
 await save(privateContract,temporary.id);await save({...privateContract,lines:[line(1200000)]},temporary.id)
 assert.equal((await read()).versions.filter(v=>v.accountId===temporary.id).length,2)
 await api('/accounts/'+temporary.id,'DELETE',{confirmation:temporary.name})
 const afterErase=await read()
 assert.ok(!afterErase.accounts.some(a=>a.accountId===temporary.id));assert.ok(!afterErase.versions.some(v=>v.accountId===temporary.id))
 assert.ok(!JSON.stringify(afterErase).includes(privateContract.source.reference),'Erasure removes retained recurring source details')
 assert.deepEqual(afterErase.versions.find(v=>v.id===first.versionId),firstVersion,'Later edits and another account erasure preserve the original immutable contract version')
 const end=row(afterErase)
 assert.equal(end.revenue.arrMinor,6000000);assert.equal(end.revenue.status,'active');assert.equal(end.revenue.currency,'USD')
 assert.equal(row(afterErase,otherId).revenue.currency,'EUR');assert.equal((await account()).health.score,50)
 assert.deepEqual((await report()).accounts.map(a=>a.accountId),[accountId])
 console.log('Recurring revenue: confirmed native amounts, exact/rounded MRR, mixed periods, terms, metadata, provenance/history, authority/validation, currency-scoped numeric health, entry approvals, stale guards and erasure passed.')
 return {accountId,otherId,contract:end.contract,segmentId,config,fieldKey,pendingProposalId,firstVersionId:first.versionId,admin}
}
