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

// Independently generated potential-outcome history. No application result is
// used to choose the effect: each block has a 50 percentage point arm contrast.
const seededHistory=(cohort,index)=>({healthy:(cohort==='enrolled'?[true,true,true,false]:[true,false,false,false])[index%4],renewed:(cohort==='enrolled'?[true,true,false,true]:[false,false,true,false])[index%4]})
export async function experimentJourney(){
 const {startWorker}=await import('./worker.mjs'),app=await startWorker({clock:Date.parse('2026-10-25T12:00:00Z')})
 const json=async(r,status=200)=>{assert.equal(r.status,status,await r.clone().text());return r.json()}
 const call=(path,method='GET',body,extra={})=>app.request('/api/buoy'+path,{method,body,cookie:app.cookie,...extra})
 const command=(token,command,input)=>app.request('/api/buoy/commands',{method:'POST',token,body:{command,input}})
 try{
  const today='2026-10-25',accounts=[]
  await json(await call('/fields','POST',{key:'customer_since',label:'Customer since',type:'date'}),201)
  for(let i=0;i<32;i++){
   const stratum=Math.floor(i/8),a={id:`synthetic-buoy-${8000+i}`,name:`Experiment customer ${i}`,renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Signed order',billing:{observedAt:today,reference:`synthetic-buoy-${8100+i}`,currency:'USD',totalMinor:10000,creditsMinor:0,allocatedMinor:0,dueDate:today},support:{observedAt:today,reference:`synthetic-buoy-${8200+i}`,openTickets:4,urgentTickets:1}}
   const created=await json(await call('/accounts','POST',a),201)
   await json(await call('/accounts/'+a.id+'/contract','POST',{revision:created.revision,contract:{currency:stratum%2?'EUR':'USD',contractStart:'2025-01-01',contractEnd:'2027-12-31',lines:[{product:'Customer success',quantity:1,amountMinor:120000+stratum*10000,frequency:'annual',entitlements:'Contracted service remains unchanged'}],source:{reference:`synthetic-buoy-${8300+i}`,confirmedOn:today}}}),201)
   const current=(await json(await call('/fields'))).accounts.find(r=>r.id===a.id)
   await json(await call('/accounts/'+a.id+'/fields','PUT',{revision:current.revision,values:{customer_since:`202${3+stratum%2}-01-01`},source:`synthetic-buoy-${8400+i}`}));accounts.push(a)
  }
  const segment=await json(await call('/segments','POST',{name:'Measured optional check-ins',mode:'static',rules:{match:'all',conditions:[]},accountIds:accounts.map(a=>a.id),tier:null,stage:null,playbook:null}),201)
  const input={name:'Optional customer success experiment',segmentId:segment.id,tenureField:'custom.customer_since',pairs:16,windowDays:30,successMetric:'renewed',intervention:'additional-check-in',operationKey:'synthetic-buoy-8500'}
  assert.equal((await app.request('/api/buoy/experiments',{method:'POST',body:input})).status,401)
  assert.equal((await call('/experiments','POST',input,{headers:{origin:'https://foreign.invalid'}})).status,403)
  await json(await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'experiment-member@example.test',displayName:'CS colleague',role:'member'}}),202)
  const member=await app.signIn('experiment-member@example.test')
  assert.equal((await call('/experiments','POST',input,{cookie:member})).status,403)
  for(const changed of [{intervention:'withhold-contracted-service'},{intervention:'change-price'},{withholdContractedService:true},{price:1},{successMetric:'revenue-proven-by-health'}])assert.equal((await call('/experiments','POST',{...input,...changed})).status,400)
  assert.equal((await call('/experiments','POST',{...input,tenureField:'custom.unknown'})).status,400)
  assert.equal((await call('/experiments','POST',{...input,pairs:17})).status,409)
  const grant=await json(await call('/agent-tokens','POST',{label:'Experiment planner',scopes:['experiment.prepare','experiment.report'],budgetMinor:0}),201)
  const insufficient=await json(await call('/agent-tokens','POST',{label:'No commercial data',scopes:['experiment.prepare'],dataClasses:['account']}),201)
  assert.equal((await command(insufficient.token,'experiment.prepare',input)).status,403)
  const legacy=await json(await call('/agent-tokens','POST',{label:'Existing commands'}),201)
  assert.equal((await command(legacy.token,'experiment.prepare',input)).status,403)
  let draft=await json(await command(grant.token,'experiment.prepare',input),201)
  assert.equal(draft.status,'proposed');assert.equal(draft.health,null);assert.equal(draft.renewal,null)
  assert.equal((await json(await command(grant.token,'experiment.prepare',input),201)).id,draft.id)
  assert.equal((await command(grant.token,'experiment.prepare',{...input,name:'Different request'})).status,409)
  assert.equal((await json(await call('/state'))).tasks.length,0,'No intervention is performed before leadership approves')
  for(let pair=0;pair<16;pair++){
   const [a,b]=draft.assignments.filter(a=>a.pairIndex===pair);assert.notEqual(a.cohort,b.cohort)
   for(const factor of ['segmentId','health','healthScore','arrMinor','currency','tenureDays','customerSince'])assert.deepEqual(a.baseline[factor],b.baseline[factor],factor)
   for(const subject of [a,b]){
    const index=accounts.findIndex(record=>record.id===subject.accountId),stratum=Math.floor(index/8)
    assert.ok(index>=0);assert.equal(subject.baseline.segmentId,segment.id)
    assert.equal(subject.baseline.health,'at-risk');assert.equal(subject.baseline.healthScore,null)
    assert.equal(subject.baseline.arrMinor,120000+stratum*10000);assert.equal(subject.baseline.currency,stratum%2?'EUR':'USD')
    assert.equal(subject.baseline.customerSince,`202${3+stratum%2}-01-01`)
    assert.equal(subject.baseline.tenureDays,(Date.parse(today)-Date.parse(subject.baseline.customerSince))/86400000)
    assert.equal(subject.baseline.asOf,today)
   }
   assert.ok(a.baseline.arrReference);assert.ok(a.baseline.revision);assert.equal(a.baseline.tenureField,'custom.customer_since')
  }
  const changedAccount=accounts[0],changedCurrent=(await json(await call('/state'))).accounts.find(a=>a.id===changedAccount.id)
  await json(await call('/accounts/'+changedAccount.id,'PUT',{...changedAccount,revision:changedCurrent.revision}))
  assert.equal((await call('/experiments/'+draft.id+'/approve','POST',{revision:draft.revision,reference:'Review stale source'})).status,409,'Source revision changes invalidate the experiment approval')
  input.operationKey='synthetic-buoy-8501';draft=await json(await command(grant.token,'experiment.prepare',input),201)
  const approval={revision:draft.revision,reference:'CS leadership approves optional calls and renewed success metric'}
  assert.equal((await call('/experiments/'+draft.id+'/approve','POST',approval,{cookie:member})).status,403)
  assert.equal((await app.request('/api/buoy/experiments/'+draft.id+'/approve',{method:'POST',body:approval,token:grant.token})).status,403)
  assert.equal((await call('/experiments/'+draft.id+'/approve','POST',{...approval,revision:'stale'})).status,409)
  assert.equal((await call('/experiments/'+draft.id+'/approve','POST',{...approval,successMetric:'healthy'})).status,400)
  let approved=await json(await call('/experiments/'+draft.id+'/approve','POST',approval))
  assert.equal(approved.status,'approved');assert.ok(approved.approvedBy);assert.equal(approved.approvalReference,approval.reference)
  const book=(await json(await call('/playbooks'))).definitions.find(b=>b.id===approved.playbookId)
  assert.ok(book)
  let state=await json(await call('/state'));assert.equal(state.tasks.length,0,'Experiment approval enrolls work but each native task still requires human approval')
  const proposals=state.proposals.filter(p=>p.payload.playRun)
  assert.equal(proposals.length,16)
  for(const p of proposals)await json(await call('/proposals/'+p.id+'/approve','POST',{}))
  state=await json(await call('/state'));assert.equal(state.tasks.length,16)
  const enrolled=new Set(approved.assignments.filter(a=>a.cohort==='enrolled').map(a=>a.accountId))
  for(const t of state.tasks){assert.ok(enrolled.has(t.accountId));assert.match(t.title,/optional additional/);assert.match(t.title,/contracted services unchanged/)}
  for(const t of state.tasks)await json(await call('/tasks/'+t.id+'/complete','POST',{outcome:'Optional check-in offered',evidence:'Customer success work record'}))
  approved=await json(await command(grant.token,'experiment.report',{id:draft.id}));assert.equal(approved.health.difference,0);assert.equal(approved.renewal.difference,0,'Task completion is neither health nor retained revenue')
  for(const cohort of ['enrolled','comparison']){
   let index=0
   for(const subject of approved.assignments.filter(a=>a.cohort===cohort)){
    const history=seededHistory(cohort,index++),a=accounts.find(a=>a.id===subject.accountId)
    if(history.healthy){const current=(await json(await call('/state'))).accounts.find(c=>c.id===a.id);await json(await call('/accounts/'+a.id,'PUT',{...a,revision:current.revision,billing:{...a.billing,allocatedMinor:a.billing.totalMinor},support:{...a.support,urgentTickets:0}}))}
    if(history.renewed){const p=await json(await call('/proposals','POST',{accountId:a.id,kind:'renewal',payload:{outcome:'renewed',reason:'Customer accepted renewal independently of health',evidence:`synthetic-buoy-${8600+index}`}}),201);await json(await call('/proposals/'+p.id+'/approve','POST',{}))}
   }
  }
  const result=await json(await command(grant.token,'experiment.report',{id:draft.id}))
  for(const metric of ['health','renewal']){
   const measured=result[metric];assert.equal(measured.difference,.5);assert.ok(measured.difference>=.45&&measured.difference<=.55)
   assert.equal(measured.interventionN,16);assert.equal(measured.holdoutN,16)
   assert.ok(Math.abs(measured.interval[0]-0.1535414850017443)<0.000001);assert.ok(Math.abs(measured.interval[1]-0.7095572112025569)<0.000001);assert.ok(measured.interval[0]>=-1&&measured.interval[1]<=1)
   assert.equal(measured.confidence,.95);assert.match(measured.method,/Wilson/)
   assert.equal(measured.report.enrolled.filter(a=>a.reachedAt&&a.evidence).length,12)
   assert.equal(measured.report.comparison.filter(a=>a.reachedAt&&a.evidence).length,4)
   assert.ok(measured.report.enrolled.every(a=>a.runId));assert.ok(measured.report.comparison.every(a=>!a.runId))
  }
  assert.deepEqual(result.assignments,approved.assignments,'Assignments and source baselines survive later outcomes')
  assert.match(result.interpretation,/not proof of causation|never proves retained revenue/);assert.ok(result.biases.length)
  const replay=await json(await call('/experiments/'+draft.id+'/approve','POST',approval));assert.equal(replay.approvedAt,result.approvedAt)
  assert.deepEqual(replay.health,result.health);assert.deepEqual(replay.renewal,result.renewal)
  assert.equal((await json(await call('/state'))).tasks.length,16,'Approval replay never duplicates work')
  await json(await call('/agents/settings','PUT',{disabled:true}))
  assert.equal((await command(grant.token,'experiment.report',{id:draft.id})).status,403)
  await json(await call('/agents/settings','PUT',{disabled:false}))
  assert.equal((await command(legacy.token,'experiment.report',{id:draft.id})).status,403,'An existing grant cannot read newly introduced experiment records')
  await json(await call('/agent-tokens/'+grant.id,'DELETE'));assert.equal((await command(grant.token,'experiment.report',{id:draft.id})).status,401)
  const ledger=await json(await call('/agents'));assert.ok(ledger.entries.some(e=>e.command==='experiment.report'&&e.status==='succeeded'));assert.ok(ledger.entries.some(e=>e.command==='experiment.report'&&e.status==='refused'));assert.ok(ledger.entries.every(e=>e.spentMinor===0))
  if(process.env.BUOY_SCREENSHOTS){
   const {chromium}=await import('@playwright/test'),{mkdir}=await import('node:fs/promises'),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
   try{await mkdir(process.env.BUOY_SCREENSHOTS,{recursive:true});for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(app.cookie.split('; ').map(pair=>{const [name,...v]=pair.split('=');return {name,value:v.join('='),url:app.origin}}));const page=await context.newPage();await page.goto(app.origin+'/app/outcomes');await page.waitForLoadState('networkidle');assert.ok(await page.getByRole('heading',{name:input.name+' healthy',exact:true}).count());assert.match(await page.locator('main').innerText(),/75%/);assert.match(await page.locator('main').innerText(),/25%/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('heading',{name:input.name+' healthy',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:process.env.BUOY_SCREENSHOTS+'/experiment-outcomes-'+width+'.png'});await context.close()}}finally{await browser.close()}
  }
  const erased=result.assignments[0],source=accounts.find(a=>a.id===erased.accountId)
  await json(await call('/accounts/'+erased.accountId,'DELETE',{confirmation:source.name}))
  const remaining=await json(await call('/experiments/'+draft.id));assert.ok(!JSON.stringify(remaining).includes(erased.accountId));assert.equal(remaining.assignments.length,31)
  assert.deepEqual([...new Set(app.outbound)],['https://api.resend.com/emails'],'Only existing single-recipient internal mail reaches the network edge')
  console.log('AGENT-002: seeded effect 0.50 in both metrics; exact matches, approvals, native tasks, evidence, replay, safety, scoped credentials and erasure passed.')
 }finally{await app.close()}
}
