import {join} from 'node:path'
import {scan} from './a11y-checks.mjs'
import assert from 'node:assert/strict'
import {planFixture} from './plan-fixture.mjs'
export async function planOutcomeJourney({browser,evidence}={}){
 let instant=Date.UTC(2026,9,27,12)
 const f=await planFixture({clock:()=>instant}),{api,accountId,other}=f
 try{
  await api('/fields','POST',{key:'window_goal',label:'Observed milestone measure',type:'number'})
  const metric={...f.objectives[0],field:'custom.window_goal',target:5},objectives=[metric,f.objectives[1]],put=async(aid,value)=>api('/accounts/'+aid+'/fields','PUT',{revision:(await api('/state')).accounts.find(a=>a.id===aid).revision,values:{window_goal:value},source:'synthetic-buoy-1970'})
  await put(accountId,0);await put(other,0)
  const plan=await f.save({objectives}),champion=await api('/customer-people','POST',{kind:'contact',name:'Control champion',accountIds:[other],source:'synthetic-buoy-1971'})
  const control=await api('/accounts/'+other+'/plans','POST',{accountRevision:(await api('/state')).accounts.find(a=>a.id===other).revision,name:'Comparison plan',staffOwnerId:f.ownerId,customerOwnerId:champion.id,objectives})
  const segmentBody={name:'Frozen milestone comparison',mode:'static',rules:{match:'all',conditions:[]},accountIds:[accountId,other],tier:null,stage:null,playbook:null},segment=await api('/segments','POST',segmentBody)
  const body={name:'Metric milestone',segmentId:segment.id,kind:'plan-objective',windowDays:1,planIds:[plan.id],objectiveId:'usage',operationKey:'synthetic-buoy-1972'},report=await api('/outcomes','POST',body)
  assert.deepEqual(await api('/outcomes','POST',body),report,'Starting the same observation is idempotent')
  assert.equal((await f.app.request('/api/buoy/outcomes',{cookie:f.app.cookie,method:'POST',body:{...body,windowDays:2}})).status,409,'A replay cannot silently substitute a different observation window')
  let data=await api('/outcomes/'+report.id+'/report');assert.deepEqual(data.enrolled.map(a=>a.accountId),[accountId]);assert.deepEqual(data.comparison.map(a=>a.accountId),[other]);assert.equal(data.rate,0);assert.equal(data.comparisonRate,0)
  assert.equal(Date.parse(data.deadline)-Date.parse(data.startedAt),86400000)
  const current=(await f.plans()).plans[0]
  await f.save({id:plan.id,revision:current.revision,objectives,milestones:[{id:'metric',title:'Agreed metric target',objectiveId:'usage',outcomeId:report.id}]})
  const seg=(await api('/segments')).segments.find(s=>s.id===segment.id);await api('/segments','POST',{...segmentBody,id:segment.id,revision:seg.revision,accountIds:[]})
  instant+=6*3600000;await put(accountId,5)
  data=await api('/outcomes/'+report.id+'/report');assert.equal(data.rate,1);assert.equal(data.comparisonRate,0);assert.equal(data.enrolled[0].elapsedHours,6);assert.equal(data.meanHours,6);assert.equal(data.enrolled[0].reachedAt,'2026-10-27T18:00:00.000Z');assert.deepEqual(data.comparison.map(a=>a.accountId),[other]);assert.equal((await f.plans()).plans[0].milestoneEvidence[0].status,'reached')
  instant+=19*3600000;await put(other,5)
  data=await api('/outcomes/'+report.id+'/report');assert.equal(data.comparison[0].status,'missed');assert.equal(data.comparison[0].reachedAt,null);assert.equal(data.comparisonRate,0);assert.equal(data.enrolled[0].elapsedHours,6,'Late evidence cannot move the first observed outcome')
  const csv=await f.app.request('/api/buoy/outcomes/'+report.id+'/report.csv',{cookie:f.app.cookie});assert.equal(csv.status,200);const text=await csv.text();assert.match(text,/2026-10-27T18:00:00.000Z/);assert.ok(text.includes('"6"'))
  const revision=(await f.plans()).plans[0].revision
  const latestSegment=(await api('/segments')).segments.find(s=>s.id===segment.id);await api('/segments','POST',{...segmentBody,id:segment.id,revision:latestSegment.revision})
  const rejected=await f.app.request('/api/buoy/outcomes',{cookie:f.app.cookie,method:'POST',body:{...body,operationKey:'synthetic-buoy-1973'}});assert.equal(rejected.status,400,'Satisfied baselines are refused')
  await planCohort(f,()=>instant,value=>{instant=value},objectives)
  if(browser){
   const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true})
   try{
    await context.addCookies(f.app.cookie.split('; ').map(pair=>{const[name,...value]=pair.split('=');return{name,value:value.join('='),url:f.app.origin}}))
    const page=await context.newPage();await page.goto(f.app.origin+'/app/outcomes',{waitUntil:'networkidle'})
    const reportView=page.getByRole('heading',{name:'Metric milestone',exact:true}).locator('..')
    assert.match(await reportView.innerText(),/6 hours/);assert.match(await reportView.innerText(),/1 of 1 · 100%/);assert.match(await reportView.innerText(),/0 of 1 · 0%/);assert.match(await reportView.innerText(),/Missed/)
    const csvLink=reportView.getByRole('link',{name:'Download outcome report (CSV)'})
    const response=await page.request.get(await csvLink.getAttribute('href'));assert.equal(response.status(),200);assert.equal(await response.text(),text,'Browser download returns the complete independently checked report')
    for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await reportView.scrollIntoViewIfNeeded();await scan(page,'PLAN-001 milestone report '+width);await reportView.screenshot({path:join(evidence,'plan-outcome-report-'+width+'.png')})}
   }finally{await context.close()}
  }
  await api('/accounts/'+accountId,'DELETE',{confirmation:f.customer(accountId).name})
  data=await api('/outcomes/'+report.id+'/report');assert.deepEqual(data.enrolled,[],'Erasure removes the milestone subject and its evidence')
  console.log('PLAN-001 objective milestones: public definition, stable linkage, frozen comparison, exact UTC clock, six-hour first evidence, CSV, late recovery refusal, baseline refusal and erasure passed.')
 }finally{await f.app.close()}
}

async function planCohort(f,clock,setClock,objectives){
 const {api}=f,accounts=[],planIds=[],on=new Date(clock()).toISOString().slice(0,10)
 for(let n=0;n<80;n++){
  const aid='synthetic-buoy-cohort-'+String(n).padStart(3,'0'),a=await api('/accounts','POST',{...f.customer(aid),billing:{...f.customer(aid).billing,observedAt:on,dueDate:on},support:{...f.customer(aid).support,observedAt:on}})
  const value=await api('/accounts/'+aid+'/fields','PUT',{revision:a.revision,values:{window_goal:0},source:'synthetic-buoy-1981'})
  accounts.push(aid)
 }
 const champion=await api('/customer-people','POST',{kind:'contact',name:'Synthetic cohort champions',accountIds:accounts,source:'synthetic-buoy-1982'})
 const revisions=new Map((await api('/state')).accounts.map(a=>[a.id,a.revision]))
 for(const aid of accounts){const plan=await api('/accounts/'+aid+'/plans','POST',{accountRevision:revisions.get(aid),name:'Comparable business objective',staffOwnerId:f.ownerId,customerOwnerId:champion.id,objectives});planIds.push(plan.id)}
 const segmentInput={name:'Forty plan interventions and forty controls',mode:'static',rules:{match:'all',conditions:[]},accountIds:accounts,tier:null,stage:null,playbook:null},segment=await api('/segments','POST',segmentInput)
 const request={name:'Compared plan objective attainment',kind:'plan-objective',segmentId:segment.id,objectiveId:'usage',planIds:planIds.slice(0,40),windowDays:2,operationKey:'synthetic-buoy-1983'}
 const report=await api('/outcomes','POST',request),path='/outcomes/'+report.id+'/report',baseline=await api(path)
 assert.deepEqual(baseline.enrolled.map(a=>a.accountId),accounts.slice(0,40));assert.deepEqual(baseline.comparison.map(a=>a.accountId),accounts.slice(40))
 const currentSegment=(await api('/segments')).segments.find(s=>s.id===segment.id);await api('/segments','POST',{...segmentInput,id:segment.id,revision:currentSegment.revision,accountIds:[]})
 const reached=[...accounts.slice(0,20),...accounts.slice(40,45)],observed=new Map()
 for(let n=0;n<reached.length;n++){
  const instant=Date.parse(baseline.startedAt)+(n+1)*3600000;setClock(instant);const aid=reached[n]
  await api('/accounts/'+aid+'/fields','PUT',{revision:(await api('/state')).accounts.find(a=>a.id===aid).revision,values:{window_goal:5},source:'synthetic-buoy-1984'});observed.set(aid,new Date(instant).toISOString())
 }
 const data=await api(path)
 assert.equal(data.rate,0.5);assert.equal(data.comparisonRate,0.125);assert.deepEqual(data.enrolled.map(a=>a.accountId),accounts.slice(0,40));assert.deepEqual(data.comparison.map(a=>a.accountId),accounts.slice(40))
 for(const subject of [...data.enrolled,...data.comparison]){assert.equal(subject.reachedAt,observed.get(subject.accountId)??null);if(subject.reachedAt)assert.equal(subject.elapsedHours,(Date.parse(observed.get(subject.accountId))-Date.parse(baseline.startedAt))/3600000)}
 assert.equal(data.meanHours,10.5);assert.equal(data.comparisonMeanHours,23)
 const response=await f.app.request('/api/buoy'+path+'.csv',{cookie:f.app.cookie});assert.equal(response.status,200)
 const {csvRows}=await import('../src/buoy/migrate/csv.ts'),[headers,...rows]=csvRows(await response.text());assert.equal(rows.length,80)
 const column=name=>headers.indexOf(name)
 for(const row of rows){const aid=row[column('Account id')],subject=[...data.enrolled,...data.comparison].find(a=>a.accountId===aid);assert.ok(subject);assert.equal(row[column('Cohort')],accounts.indexOf(aid)<40?'enrolled':'comparison');assert.equal(row[column('Status')],subject.status);assert.equal(row[column('First observed UTC')],observed.get(aid)??'');assert.equal(row[column('Elapsed hours')],subject.elapsedHours===null?'':String((Date.parse(observed.get(aid))-Date.parse(baseline.startedAt))/3600000))}
 const again=await api(path);assert.deepEqual(again.enrolled,data.enrolled);assert.deepEqual(again.comparison,data.comparison)
 console.log('PLAN-001 forty enrolled and forty frozen controls reconcile rates, independent observed hours, means and every CSV cohort record.')
}
