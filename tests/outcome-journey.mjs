import assert from 'node:assert/strict'
// PLAY-004: real approved playbooks, sources, human decisions and Cron through HTTP.
export async function outcomeJourney({call,json,request,cookie,member,account,scheduled}) {
 const accounts=Array.from({length:80},(_,i)=>({...account(`outcome-${String(i).padStart(3,'0')}`),name:`Outcome Customer ${i+1}`}))
 for(const account of accounts) await json(await call('/accounts','POST',account),201)
 const segmentInput={name:'PLAY-004 outcome cohort',mode:'static',rules:{match:'all',conditions:[]},accountIds:accounts.map(a=>a.id),tier:null,stage:null,playbook:null}
 const segmentId=(await json(await call('/segments','POST',segmentInput),201)).id
 const taskIds=[]
 for(const a of accounts.slice(0,40)){
  const p=await json(await call('/proposals','POST',{accountId:a.id,kind:'playbook',payload:{title:'Customer success recovery check',dueDate:'2027-01-01'}}),201)
  await json(await call(`/proposals/${p.id}/approve`,'POST',{}))
  taskIds.push((await json(await call('/state'))).tasks.find(t=>t.proposalId===p.id).id)
 }
 const input={name:'Health recovery after approved interventions',segmentId,kind:'healthy',windowDays:2,taskIds,operationKey:'PLAY-004-health'}
 assert.equal((await request('/api/buoy/outcomes')).status,401)
 assert.equal((await call('/outcomes','POST',input,{cookie:member})).status,403)
 assert.equal((await call('/outcomes','POST',input,{headers:{origin:'https://elsewhere.invalid'}})).status,403)
 assert.equal((await call('/outcomes','POST',{...input,taskIds:['missing']})).status,400)
 const {id}=await json(await call('/outcomes','POST',input),201)
 assert.equal((await json(await call('/outcomes','POST',input),201)).id,id,'PLAY-004 replay does not start a second window')
 const report=async rid=>await json(await call(`/outcomes/${rid??id}/report`))
 let r=await report();assert.equal(r.enrolled.length,40);assert.equal(r.comparison.length,40);assert.equal(r.rate,0);assert.equal(r.meanHours,null)
 assert.equal(Date.parse(r.deadline)-Date.parse(r.startedAt),2*86400000)
 assert.deepEqual(r.enrolled.map(a=>a.accountId).sort(),accounts.slice(0,40).map(a=>a.id))
 assert.deepEqual(r.comparison.map(a=>a.accountId).sort(),accounts.slice(40).map(a=>a.id))
 await json(await call(`/tasks/${taskIds[0]}/complete`,'POST',{outcome:'Review conducted',evidence:'Meeting minutes confirmed'}))
 assert.equal((await report()).rate,0,'PLAY-004 finishing a task never invents a recovery outcome')
 const healthy=async a=>{const current=(await json(await call('/state'))).accounts.find(x=>x.id===a.id);await json(await call('/accounts/'+a.id,'PUT',{...a,revision:current.revision,billing:{...a.billing,allocatedMinor:a.billing.totalMinor-a.billing.creditsMinor},support:{...a.support,urgentTickets:0}}))}
 for(const a of accounts.slice(0,20))await healthy(a)
 for(const a of accounts.slice(40,45))await healthy(a)
 r=await report();assert.equal(r.rate,0.5);assert.equal(r.comparisonRate,0.125)
 assert.equal(r.enrolled.filter(a=>a.status==='reached').length,20);assert.equal(r.comparison.filter(a=>a.status==='reached').length,5)
 for(const a of r.enrolled.filter(a=>a.reachedAt)){assert.ok(a.reachedAt>=r.startedAt&&a.reachedAt<=r.deadline);assert.match(a.evidence,/Healthy evidence at account revision/);assert.equal(a.elapsedHours,(Date.parse(a.reachedAt)-Date.parse(r.startedAt))/3600000)}
 assert.equal(r.meanHours,r.enrolled.filter(a=>a.reachedAt).reduce((sum,a)=>sum+a.elapsedHours,0)/20)
 const first=JSON.stringify(r.enrolled.find(a=>a.reachedAt));await scheduled('0 * * * *',Date.now());assert.equal(JSON.stringify((await report()).enrolled.find(a=>a.reachedAt)),first,'PLAY-004 observations never overwrite a reached outcome')
 const csv=await call(`/outcomes/${id}/report.csv`);assert.match(csv.headers.get('content-type'),/csv/);const lines=(await csv.text()).split('\r\n').filter(Boolean);assert.equal(lines.length,81);assert.equal(lines.filter(l=>l.startsWith('"enrolled"')).length,40);assert.equal(lines.filter(l=>l.includes('"reached"')).length,25)
 const memberRead=await json(await call(`/outcomes/${id}/report`,'GET',undefined,{cookie:member}));assert.deepEqual(memberRead,r,'PLAY-004 reads keep the existing account policy')
 assert.equal((await call('/outcomes','POST',{...input,operationKey:'already-healthy',taskIds:[taskIds[0]]})).status,400,'PLAY-004 outcome must be unsatisfied at baseline')
 const segment=(await json(await call('/segments'))).segments.find(s=>s.id===segmentId)
 await json(await call('/segments','POST',{...segmentInput,id:segmentId,revision:segment.revision,accountIds:[]}),201)
 assert.equal((await report()).enrolled.length,40);assert.equal((await report()).comparison.length,40,'PLAY-004 later segment changes never rewrite frozen cohorts')
 // A second current outcome kind uses new approved renewal decisions, not task completion.
 const renewalSegment=(await json(await call('/segments','POST',{...segmentInput,name:'Renewal observations',accountIds:[accounts[20].id,accounts[21].id]}),201)).id
 const renewed=(await json(await call('/outcomes','POST',{...input,name:'Approved renewal outcome',kind:'renewed',segmentId:renewalSegment,taskIds:[taskIds[20]],operationKey:'PLAY-004-renewed'}),201)).id
 for(const a of accounts.slice(20,22)){const p=await json(await call('/proposals','POST',{accountId:a.id,kind:'renewal',payload:{outcome:'renewed',reason:'Customer signed the renewal',evidence:'Signed order form retained'}}),201);await json(await call(`/proposals/${p.id}/approve`,'POST',{}))}
 const renewedReport=await report(renewed);assert.equal(renewedReport.rate,1);assert.equal(renewedReport.comparisonRate,1);assert.match(renewedReport.enrolled[0].evidence,/Approved renewed decision.*Signed order form retained/)
 // The inclusive deadline and hourly-only observation use expiring real sentiment.
 const expiryTasks=[],expiryAccounts=[]
 for(let i=0;i<2;i++){
  const a={...account('outcome-expiry-'+i),name:'Outcome Expiry '+i,billing:{...account().billing,allocatedMinor:account().billing.totalMinor-account().billing.creditsMinor},support:{...account().support,urgentTickets:0}}
  await json(await call('/accounts','POST',a),201);expiryAccounts.push(a)
  await json(await call(`/accounts/${a.id}/sentiment`,'POST',{rating:'red',reason:'Risk review active',days:1}),201)
  if(i===0){const p=await json(await call('/proposals','POST',{accountId:a.id,kind:'playbook',payload:{title:'Expiry recovery check',dueDate:'2027-01-01'}}),201);await json(await call(`/proposals/${p.id}/approve`,'POST',{}));expiryTasks.push((await json(await call('/state'))).tasks.find(t=>t.proposalId===p.id).id)}
 }
 const expirySegment=(await json(await call('/segments','POST',{...segmentInput,name:'Expiry cohort',accountIds:expiryAccounts.map(a=>a.id)}),201)).id
 const expiryId=(await json(await call('/outcomes','POST',{...input,name:'Expiry window',segmentId:expirySegment,taskIds:expiryTasks,operationKey:'PLAY-004-expiry'}),201)).id
 const expiring=await report(expiryId);await scheduled('0 * * * *',Date.parse(expiring.deadline))
 const expired=await report(expiryId);assert.equal(expired.rate,1);assert.equal(expired.comparisonRate,1);assert.equal(expired.enrolled[0].reachedAt,expiring.deadline);assert.equal(expired.enrolled[0].elapsedHours,48);assert.equal(expired.meanHours,48,'PLAY-004 exactly-at-deadline hourly observation counts')
 // Deadline passage is a real scheduled door. It closes unresolved observation windows durably.
 await scheduled('0 * * * *',Date.parse(r.deadline)+1)
 r=await report();assert.equal(r.enrolled.filter(a=>a.status==='missed').length,20);assert.equal(r.rate,0.5)
 await healthy(accounts[22]);assert.equal((await report()).rate,0.5,'PLAY-004 recovery after the window never counts')
 assert.equal((await json(await call('/state'))).tasks.find(t=>t.id===taskIds[22]).completedAt,null,'PLAY-004 reports never complete work')
 await json(await call('/accounts/'+accounts[0].id,'DELETE',{confirmation:accounts[0].name}))
 r=await report();assert.ok(!r.enrolled.some(a=>a.accountId===accounts[0].id));assert.equal(r.enrolled.length,39,'PLAY-004 owner erasure removes the subject and report evidence')
}
