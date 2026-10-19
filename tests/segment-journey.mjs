import assert from 'node:assert/strict'
// SEGMENT-001 through authenticated product HTTP; paid mail is the only fake.
export async function segmentJourney({call,json,request,cookie,member,account,scheduled}) {
 const a={...account('segment-harbour'),name:'SEGMENT-001 Harbour Software',billing:{...account().billing,currency:'USD',totalMinor:6000000,creditsMinor:0,allocatedMinor:0},support:{...account().support,urgentTickets:1}}
 await json(await call('/accounts','POST',a),201)
 const condition=(field,op,value)=>({field,op,...(value===undefined?{}:{value})})
 const source={name:'USD invoice over $50,000 and at risk',mode:'dynamic',rules:{match:'all',conditions:[condition('billing.currency','eq','USD'),condition('billing.totalMinor','gt',5000000),condition('health.status','eq','at-risk')]},accountIds:[],tier:'high-touch',stage:'renewal',playbook:{title:'Review segment entry with customer',dueDays:7}}
 assert.equal((await request('/api/buoy/segments')).status,401)
 assert.equal((await call('/segments','POST',source,{cookie:member})).status,403)
 assert.equal((await call('/segments','POST',source,{headers:{origin:'https://other.invalid'}})).status,403)
 assert.equal((await call('/segments','POST',{...source,rules:{match:'all',conditions:[condition('billing.totalMinor','gt','5000000')]}})).status,400)
 assert.equal((await call('/segments','POST',{...source,rules:{match:'all',conditions:[condition('arr','gt',5000000)]}})).status,400,'no fabricated ARR')
 assert.equal((await call('/segments','POST',{...source,rules:{match:'all',conditions:[condition('name','contains','Harbour'),{field:'name',op:'is-missing',value:'not allowed'}]}})).status,400)
 const {id}=await json(await call('/segments','POST',source),201)
 const read=async()=>await json(await call('/segments'))
 const seg=async sid=>(await read()).segments.find(s=>s.id===(sid??id))
 const report=async()=>await json(await call(`/segments/${id}/report`))
 let s=await seg();assert.equal(s.members.length,1);assert.equal(s.members[0].accountId,a.id);assert.equal(s.members[0].tier,'high-touch');assert.equal(s.members[0].stage,'renewal');assert.ok(Date.parse(s.history[0].enteredAt));assert.equal(s.history[0].exitedAt,null)
 let entry=s.history[0],p=(await json(await call('/state'))).proposals.find(p=>p.id===entry.proposalId)
 assert.equal(p.accountRevision,(await json(await call('/state'))).accounts.find(x=>x.id===a.id).revision)
 assert.equal(p.payload.title,source.playbook.title);assert.equal((await json(await call('/state'))).tasks.filter(t=>t.proposalId===p.id).length,0)
 for(let i=0;i<2;i++){await read();await scheduled('0 * * * *',Date.now())}
 assert.equal((await seg()).history.length,1,'repeated reads and Cron do not reenroll active members')
 await json(await call(`/proposals/${p.id}/approve`,'POST',{}));await json(await call(`/proposals/${p.id}/approve`,'POST',{}))
 assert.equal((await json(await call('/state'))).tasks.filter(t=>t.proposalId===p.id).length,1,'entry proposal runs once after approval')
 const update=async(total,currency='USD')=>{const current=(await json(await call('/state'))).accounts.find(x=>x.id===a.id);return json(await call('/accounts/'+a.id,'PUT',{...a,revision:current.revision,billing:{...a.billing,totalMinor:total,currency}}))}
 await update(5000000);s=await seg();assert.equal(s.members.length,0);assert.ok(Date.parse(s.history[0].exitedAt));assert.ok(s.history[0].exitedAt>=s.history[0].enteredAt)
 await update(6000000,'EUR');assert.equal((await report()).count,0,'currencies are not mixed')
 await update(6000000);s=await seg();assert.equal(s.history.length,2);assert.equal(s.members.length,1);assert.equal(new Set(s.history.map(e=>e.proposalId)).size,2,'legitimate re-entry creates one new proposal')
 await update(6000000);const staleAccount=s.history.find(e=>!e.exitedAt).proposalId;assert.equal((await call(`/proposals/${staleAccount}/approve`,'POST',{})).status,409,'SEGMENT-001 account revision invalidates its entry proposal')
 await update(5000000);await update(6000000);s=await seg()
 const second=s.history.find(e=>!e.exitedAt).proposalId
 await json(await call('/segments','POST',{id,revision:s.revision,...source,name:'Reviewed risk segment'}),201)
 assert.equal((await call(`/proposals/${second}/approve`,'POST',{})).status,409,'config revision invalidates old entry proposal')
 assert.equal((await seg()).history.length,3,'editing without membership change never replays entry')
 const r=await report();assert.equal(r.count,1);assert.equal(r.health['at-risk'],1);assert.deepEqual(r.accounts.map(x=>x.accountId),[a.id])
 const csv=await call(`/segments/${id}/report.csv`);assert.match(csv.headers.get('content-type'),/csv/);assert.match(await csv.text(),/SEGMENT-001 Harbour Software/)
 const memberReport=await json(await call(`/segments/${id}/report`,'GET',undefined,{cookie:member}));assert.deepEqual(memberReport,r,'segment never grants or changes access')
 const manual=async(tier,stage)=>json(await call(`/accounts/${a.id}/classification`,'PUT',{tier,stage}))
 assert.equal((await call(`/accounts/${a.id}/classification`,'PUT',{tier:'digital',stage:'adoption'},{cookie:member})).status,403)
 await manual('digital','adoption');let current=(await json(await call('/state'))).accounts.find(x=>x.id===a.id);assert.equal(current.tier,'digital');assert.equal(current.stage,'adoption')
 await manual(null,null);current=(await json(await call('/state'))).accounts.find(x=>x.id===a.id);assert.equal(current.tier,null);assert.equal(current.stage,null)
 await manual('__rules__','__rules__');current=(await json(await call('/state'))).accounts.find(x=>x.id===a.id);assert.equal(current.tier,'high-touch');assert.equal(current.stage,'renewal')
 const staticInput={...source,name:'Hand picked accounts',mode:'static',rules:{match:'all',conditions:[]},accountIds:[a.id],tier:'digital',stage:'adoption',playbook:null}
 const staticId=(await json(await call('/segments','POST',staticInput),201)).id
 assert.equal((await seg(staticId)).members.length,1);assert.equal((await report()).accounts[0].tier,'high-touch','first matching rule wins')
 let st=await seg(staticId);await json(await call('/segments','POST',{id:staticId,revision:st.revision,...staticInput,accountIds:[]}),201);assert.equal((await seg(staticId)).members.length,0)
 // OR/missing conditions and automatic import evaluation use the real import door.
 const otherId=(await json(await call('/segments','POST',{...source,name:'Missing billing or named account',tier:null,stage:null,playbook:null,rules:{match:'any',conditions:[condition('billing.totalMinor','is-missing'),condition('name','contains','SEGMENT-001')]}}),201)).id
 assert.ok((await seg(otherId)).members.some(x=>x.accountId===a.id));assert.ok((await seg(otherId)).members.some(x=>x.accountId==='unknown'),'SEGMENT-001 missing billing matches only the explicit missing predicate')
 const imported={...a,id:'segment-imported',name:'SEGMENT-001 Imported Software'},upload={accounts:[imported]},preview=await json(await call('/imports/preview','POST',upload))
 await json(await call('/imports/apply','POST',{...upload,fingerprint:preview.fingerprint,operationKey:'segment-import'}))
 assert.equal((await report()).count,2)
 // Source health changes and the hourly clock can make an account enter/exit.
 const clock={...a,id:'segment-clock',name:'SEGMENT-001 Clock',billing:{...a.billing,allocatedMinor:a.billing.totalMinor},support:{...a.support,urgentTickets:0}}
 await json(await call('/accounts','POST',clock),201)
 const clockId=(await json(await call('/segments','POST',{...source,name:'Current healthy accounts',tier:null,stage:null,playbook:{title:'Welcome healthy account',dueDays:0},rules:{match:'all',conditions:[condition('id','eq',clock.id),condition('health.status','eq','healthy')]}}),201)).id
 const healthyEntry=(await seg(clockId)).history[0];assert.equal((await seg(clockId)).members.length,1);await json(await call(`/proposals/${healthyEntry.proposalId}/approve`,'POST',{}));assert.equal((await json(await call('/state'))).tasks.filter(t=>t.proposalId===healthyEntry.proposalId).length,1,'SEGMENT-001 configured non-risk entry still requires and accepts human approval')
 await json(await call(`/accounts/${clock.id}/sentiment`,'POST',{rating:'red',reason:'Customer concerned',days:1}),201);assert.equal((await seg(clockId)).members.length,0)
 await scheduled('0 * * * *',Date.now()+3*86400000)
 const timed=await seg(clockId);assert.equal(timed.members.length,0,'current red sentiment still counts on current date');assert.ok(timed.history.some(e=>e.enteredAt.slice(0,10)===new Date(Date.now()+3*86400000).toISOString().slice(0,10)),'Cron records entry when sentiment expires without a source write')
 const boundaryId=(await json(await call('/segments','POST',{...source,name:'Typed comparisons',tier:null,stage:null,playbook:null,rules:{match:'all',conditions:[condition('id','eq',clock.id),condition('billing.totalMinor','gte',6000000),condition('billing.totalMinor','lte',6000000),condition('billing.totalMinor','lt',6000001),condition('billing.totalMinor','ne',0),condition('name','contains','Clock'),condition('renewalDate','gt','2026-01-01'),condition('renewalDate','gte','2027-03-31'),condition('renewalDate','lte','2027-03-31'),condition('renewalDate','lt','2028-01-01')]}}),201)).id
 assert.deepEqual((await seg(boundaryId)).members.map(x=>x.accountId),[clock.id],'SEGMENT-001 typed inclusive/exclusive/text comparisons match independent values')
 const exitId=(await json(await call('/segments','POST',{...source,name:'Sentiment red entry',tier:null,stage:null,rules:{match:'all',conditions:[condition('id','eq',clock.id),condition('sentiment.rating','eq','red')]}}),201)).id
 const exitedProposal=(await seg(exitId)).history[0].proposalId
 await json(await call(`/accounts/${clock.id}/sentiment`,'POST',{rating:'green',reason:'Customer confirmed recovery',days:1}),201)
 assert.equal((await call(`/proposals/${exitedProposal}/approve`,'POST',{})).status,409,'SEGMENT-001 exited interval cannot approve even with unchanged account and config revisions')
 const owner=(await json(await call('/state'))).operator.id
 const team=await json(await call('/team'))
 await json(await call('/team/settings','PUT',{teams:[...team.teams,{id:'segment-team',name:'Segment team',pod:'Risk',personIds:[owner]}],capacities:[...team.capacities.filter(c=>c.personId!==owner),{personId:owner,capacity:500}],rules:[{id:'segment-rule',name:'Segment allocation',teamId:'segment-team',segmentId:id},...team.rules],territories:team.territories}))
 const assignment=await json(await call('/team/preview','POST',{mode:'rules'}));assert.ok(assignment.moves.some(m=>m.accountId===a.id),'TEAM-001 rules consume segment membership')
 // Static ids and every interval/classification/proposal disappear with erasure.
 st=await seg(staticId);await json(await call('/segments','POST',{id:staticId,revision:st.revision,...staticInput}),201)
 await json(await call('/accounts/'+a.id,'DELETE',{confirmation:a.name}))
 const after=await read();assert.ok(after.segments.every(s=>!s.accountIds.includes(a.id)&&!s.history.some(e=>e.accountId===a.id)&&!s.members.some(e=>e.accountId===a.id)))
 assert.ok(!after.classifications.some(c=>c.accountId===a.id));assert.deepEqual((await report()).accounts.map(x=>x.accountId).sort(),['segment-imported'],'remaining counts equal the live rule inputs')
 const page=await request('/app/segments',{cookie});assert.equal(page.status,200);assert.match(await page.text(),/Reviewed risk segment/)
}
