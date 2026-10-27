import assert from 'node:assert/strict'
import {csvRows} from '../src/buoy/migrate/csv.ts'
import {totangoApiJourney,apiBrowserBundle,totangoReferenceJourney,referenceFiles} from './totango-api-journey.mjs'
import {test} from 'node:test'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {startWorker} from './worker.mjs'
import {importClient} from './import-door-client.mjs'
import {scan,failures,manual} from './a11y-checks.mjs'
const target=(source,id)=>'migration_'+createHash('sha256').update(JSON.stringify([source,id])).digest('hex').slice(0,40)
const account=(id,extra={})=>({id,name:'Synthetic account '+id,renewalDate:'2027-03-31',noticeDays:'30',renewalEvidence:'synthetic-buoy-1',...extra})
const client=(app,source)=>importClient((path,options)=>app.request(path,{...options,headers:{...options.headers,'x-buoy-import-source':source}}),app.cookie)
const state=async app=>(await (await app.request('/api/buoy/state',{cookie:app.cookie})).json()).accounts
const bundle=csv=>({format:'buoy-migration-v1',source:'csv',dateOrder:'day-first',csv,originalSha256:createHash('sha256').update(csv).digest('hex'),columns:{id:'Customer',name:'Company',renewalDate:'Renewal',noticeDays:'Notice',renewalEvidence:'Evidence',invoiceTotal:'Amount',invoiceCurrency:'Currency',invoiceObservedAt:'Observed',invoiceDueDate:'Due'}})
const churnzeroFactorKey=name=>'migration.churnzero.factor.'+createHash('sha256').update(name).digest('hex').slice(0,40)
const churnzeroScorecard={name:'Reviewed ChurnZero observations',measures:[{key:'source_score',name:'Source score',field:'migration.churnzero.score',min:0,max:100,weight:1,direction:'higher',missing:'unknown'},...['usage','engagement'].map(name=>({key:name,name,field:churnzeroFactorKey(name),min:0,max:20,weight:1,direction:'higher',missing:'unknown'}))],bands:{riskBelow:40,healthyAt:75},segments:[]}
const churnzeroHealthColumns={churnScore:'ChurnScore',churnScoreFactors:'ChurnScore Factors'}
const churnzeroColumns={id:'Account External ID',name:'Account Name',renewalDate:'Renewal Date',noticeDays:'Notice Days',renewalEvidence:'Contract Reference',invoiceTotal:'Invoice Amount',invoiceCurrency:'Currency',invoiceObservedAt:'Invoice Observed',invoiceDueDate:'Invoice Due'}
const header='Customer,Company,Renewal,Notice,Evidence,Amount,Currency,Observed,Due,Other\r\n'
const csvRow=(id,date='31/03/2027',currency='USD',amount='12.34')=>`${id},"Synthetic, ${id}",${date},30,synthetic-buoy-1,${amount},${currency},01/01/2026,31/01/2026,unmapped\r\n`

test('MIGRATE-005 versioned export account custody uses the existing reviewed door',async()=>{
 const app=await startWorker(),scratch=await mkdtemp(join(tmpdir(),'buoy-migrate-export-'))
 try {
  const before=await state(app)
  for(const source of ['vitally','velaris']) {
   const door=client(app,source), accounts=Array.from({length:20},(_,i)=>account('synthetic-buoy-'+(i+1),i===0?{customField:'retained source value'}:{}))
   const raw='\uFEFF'+JSON.stringify({accounts,users:[{id:'synthetic-buoy-21'}],projects:[{id:'synthetic-buoy-22'}]},null,2)+'\r\n'
   const original=join(scratch,source+'.json'),prepared=join(scratch,source+'-bundle.json')
   await writeFile(original,raw)
   execFileSync(process.execPath,['src/buoy/migrate/cli.mjs','--source',source,'--input',original,'--output',prepared])
   const input=JSON.parse(await readFile(prepared,'utf8'))
   assert.equal(input.exportText,raw);assert.equal(input.originalSha256,createHash('sha256').update(await readFile(original)).digest('hex'))
   const plan=await door.plan(input)
   assert.equal(plan.counts.mapped,20);assert.equal(plan.counts.unmapped,3)
   assert.ok(plan.diagnostics.some(d=>d.field==='customField'))
   assert.deepEqual(await state(app),before,'No native write while planning')
   assert.equal((await door.send('apply',{planId:plan.planId,reviewedFingerprint:'0'.repeat(64)})).status,403)
   const job=await door.apply(plan);assert.equal((await door.apply(plan)).id,job.id)
   const imported=(await state(app)).find(a=>a.id===target(source,'synthetic-buoy-1'))
   assert.equal(imported.name,'Synthetic account synthetic-buoy-1');assert.equal(imported.billing,null)
   const native=await state(app);assert.equal(native.length,before.length+20)
   for(const expected of accounts) {const actual=native.find(row=>row.id===target(source,expected.id));for(const field of ['name','renewalDate','renewalEvidence'])assert.equal(actual[field],expected[field]);assert.equal(actual.noticeDays,Number(expected.noticeDays))}
   assert.equal((await door.json('reconcile',{planId:plan.planId})).ok,true)
   const history=(await (await app.request('/api/operator/import-history',{cookie:app.cookie})).json()).history
   assert.equal(history.find(h=>h.planId===plan.planId).namespace,`buoy-migrate-${source}-v1`)
   const other=client(app,source==='vitally'?'velaris':'vitally')
   assert.equal((await other.send('status',{planId:plan.planId})).status,404,'Source namespace cannot inspect another source plan')
   assert.equal((await door.send('uploads',{}, {cookie:undefined})).status,401)
   assert.equal((await door.send('uploads',{}, {headers:{'x-buoy-import-source':source,origin:'https://foreign.invalid'}})).status,403)
   await door.undo(plan);assert.deepEqual(await state(app),before)
  }
  const door=client(app,'vitally'),input={format:'buoy-migration-v1',source:'vitally',dateOrder:'iso',data:{accounts:[account('synthetic-buoy-999')]}}
  const plan=await door.plan(input);await door.apply(plan)
  const current=(await state(app)).find(row=>row.id===target('vitally','synthetic-buoy-999'))
  const edited={id:current.id,name:'Synthetic owner edit',renewalDate:current.renewalDate,noticeDays:current.noticeDays,renewalEvidence:current.renewalEvidence,billing:current.billing,support:current.support,revision:current.revision}
  assert.equal((await app.request('/api/buoy/accounts/'+current.id,{method:'PUT',cookie:app.cookie,body:edited})).status,200)
  assert.equal((await door.send('undo',{planId:plan.planId})).status,409,'Migration undo protects subsequent owner edits')
  assert.equal((await app.request('/api/buoy/accounts/'+current.id,{method:'DELETE',cookie:app.cookie,body:{confirmation:edited.name}})).status,200)
  assert.equal((await door.send('reconcile',{planId:plan.planId})).status,410,'Native erasure withdraws migration snapshot custody')
  await assert.rejects(door.plan(input),/source_erased/,'Erased migration source cannot recreate a native account')
  assert.deepEqual(await state(app),before)
 } finally {await app.close();await rm(scratch,{recursive:true,force:true})}
})

test('MIGRATE-002 ChurnZero accounts reconcile twenty explicit mappings and protect reviewed custody',async()=>{
 const app=await startWorker({clock:Date.parse('2026-10-27T12:00:00Z')}),scratch=await mkdtemp(join(tmpdir(),'buoy-churnzero-'))
 try {
  const before=await state(app),door=client(app,'churnzero'),otherCookies=[]
  for(const role of ['member','admin']){
   const email=role+'@example.test'
   assert.equal((await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email,displayName:'Synthetic '+role,role}})).status,202)
   otherCookies.push(await app.signIn(email))
  }
  const outbound=app.outbound.length
  const original='fixtures/move-in/churnzero/accounts.csv',prepared=join(scratch,'bundle.json')
  execFileSync(process.execPath,['src/buoy/migrate/cli.mjs','--source','churnzero','--input',original,'--output',prepared,'--columns',JSON.stringify({...churnzeroColumns,...churnzeroHealthColumns})])
  const input=JSON.parse(await readFile(prepared,'utf8')),bytes=await readFile(original)
  assert.equal(input.csv,bytes.toString('utf8'));assert.equal(input.originalSha256,createHash('sha256').update(bytes).digest('hex'))
  const plan=await door.plan(input)
  assert.equal(plan.counts.input,20);assert.equal(plan.counts.mapped,20);assert.equal(plan.counts.rejected,0)
  assert.deepEqual(plan.diagnostics.map(d=>d.field).sort(),Array.from({length:20},()=>['Journey','Contact']).flat().sort())
  assert.deepEqual(await state(app),before,'Review creates no native records')
  for(const cookie of otherCookies)for(const action of ['uploads','apply','undo','reconcile','status'])assert.equal((await door.send(action,{planId:plan.planId,reviewedFingerprint:plan.fingerprint},{cookie})).status,401,'Only the owner manages ChurnZero imports')
  assert.equal((await door.send('apply',{planId:plan.planId,reviewedFingerprint:'0'.repeat(64)})).status,403)
  assert.equal((await door.send('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint},{cookie:undefined})).status,401)
  assert.equal((await door.send('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint},{headers:{'x-buoy-import-source':'churnzero',origin:'https://foreign.invalid'}})).status,403)
  const job=await door.apply(plan);assert.equal((await door.apply(plan)).id,job.id)
  const native=await state(app);assert.equal(native.length,before.length+20)
  assert.deepEqual(native.filter(row=>!before.some(old=>old.id===row.id)).map(row=>row.id).sort(),Array.from({length:20},(_,i)=>target('churnzero','synthetic-buoy-'+(i+1))).sort())
  for(let n=1;n<=20;n++){
   const actual=native.find(row=>row.id===target('churnzero','synthetic-buoy-'+n));assert.ok(actual)
   assert.equal(actual.name,'Synthetic ChurnZero '+n);assert.equal(actual.renewalDate,'2027-03-31');assert.equal(actual.noticeDays,n);assert.equal(actual.renewalEvidence,'synthetic-buoy-contract-'+n)
   assert.deepEqual(actual.migrationHealth,{source:'churnzero',sourceId:'synthetic-buoy-'+n,score:n*4,factors:{usage:n,engagement:20-n},fields:{score:'ChurnScore',factors:'ChurnScore Factors'}})
   assert.equal(actual.health.scorecard,undefined,'Source observations never activate a native scoring rule')
   assert.deepEqual(actual.billing,{observedAt:'2026-01-01',reference:'churnzero account synthetic-buoy-'+n,currency:'USD',totalMinor:n*100+25,creditsMinor:0,allocatedMinor:0,dueDate:'2026-01-31'});assert.equal(actual.support,null)
  }
  const previewResponse=await app.request('/api/buoy/scorecards/preview',{method:'POST',cookie:app.cookie,body:{config:churnzeroScorecard}})
  assert.equal(previewResponse.status,200);const preview=await previewResponse.json()
  assert.equal(preview.accounts.length,20)
  for(let n=1;n<=20;n++){
   const result=preview.accounts.find(row=>row.accountId===target('churnzero','synthetic-buoy-'+n));assert.ok(result)
   assert.deepEqual(result.breakdown.map(m=>m.rawValue),[n*4,n,20-n])
   assert.ok(Math.abs(result.score-(4*n+100)/3)<1e-10,'Native health follows explicitly reviewed bounds and weights')
   for(const measure of result.breakdown){assert.equal(measure.sources[0].freshness,'untracked');assert.equal(measure.sources[0].observedAt,null);assert.equal(measure.sources[0].reference,'churnzero account synthetic-buoy-'+n)}
  }
  assert.deepEqual(await state(app),native,'Scorecard preview does not publish or change native health')
  assert.equal((await door.json('reconcile',{planId:plan.planId})).ok,true)
  assert.equal((await client(app,'csv').send('status',{planId:plan.planId})).status,404)
  const history=(await (await app.request('/api/operator/import-history',{cookie:app.cookie})).json()).history
  assert.equal(history.find(row=>row.planId===plan.planId).namespace,'buoy-migrate-churnzero-v1')
  assert.equal(app.outbound.length,outbound,'Account import does not send or execute provider work')
  await door.undo(plan);assert.deepEqual(await state(app),before)
  // Isolate exported scores from invoice observations that legitimately affect native health.
  const scoreCsv=input.csv.replaceAll('synthetic-buoy-','synthetic-buoy-score-only-')
  const scorePlan=await door.plan({...input,csv:scoreCsv,originalSha256:createHash('sha256').update(scoreCsv).digest('hex'),columns:Object.fromEntries(Object.entries(churnzeroColumns).filter(([field])=>!field.startsWith('invoice')))})
  await door.apply(scorePlan)
  const scoreAccounts=await state(app)
  for(let n=1;n<=20;n++){
   const actual=scoreAccounts.find(row=>row.id===target('churnzero','synthetic-buoy-score-only-'+n));assert.ok(actual)
   assert.equal(actual.billing,null);assert.equal(actual.health.status,'unknown','An exported score cannot become native health without its configuration')
  }
  await door.undo(scorePlan);assert.deepEqual(await state(app),before)
  const [originalHeader,...originalRows]=csvRows(input.csv)
  const columnCsv=[[...originalHeader.slice(0,10),'Usage input','Engagement input',...originalHeader.slice(11)],...originalRows.map(values=>{const factors=JSON.parse(values[10]);return [...values.slice(0,10),factors.usage,factors.engagement,...values.slice(11)]})].map(values=>values.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n'
  const columnInput={...input,csv:columnCsv,originalSha256:createHash('sha256').update(columnCsv).digest('hex'),columns:{...input.columns,churnScoreFactors:{usage:'Usage input',engagement:'Engagement input'}}}
  const columnPlan=await door.plan(columnInput);assert.equal(columnPlan.counts.mapped,20);assert.equal(columnPlan.counts.rejected,0)
  assert.deepEqual(columnPlan.diagnostics.map(row=>row.field).sort(),Array.from({length:20},()=>['Journey','Contact']).flat().sort())
  await door.apply(columnPlan)
  for(let n=1;n<=20;n++){
   const row=(await state(app)).find(row=>row.id===target('churnzero','synthetic-buoy-'+n))
   assert.deepEqual(row.migrationHealth.factors,{usage:n,engagement:20-n})
   assert.deepEqual(row.migrationHealth.fields.factors,{usage:'Usage input',engagement:'Engagement input'})
  }
  assert.equal((await door.json('reconcile',{planId:columnPlan.planId})).ok,true)
  await door.undo(columnPlan);assert.deepEqual(await state(app),before)
  const malformed=await door.plan({...input,originalSha256:'0'.repeat(64)})
  assert.equal(malformed.counts.mapped,0);assert.match(malformed.rejected[0].reason,/digest/);await door.json('undo',{planId:malformed.planId})
  const mixed=await door.plan({...input,data:{accounts:[]}})
  assert.equal(mixed.counts.mapped,0);assert.match(mixed.rejected[0].reason,/second export representation/);await door.json('undo',{planId:mixed.planId})
  for(const replacement of ['{"usage":1,"usage":2}','{"usage":"1"}','[]','{}','{"usage":1e400}']){
   const [csvHeader,...csvRows]=input.csv.split('\r\n'),cells=csvRows[0].replace(/"\{.*?\}"/, '"'+replacement.replaceAll('"','""')+'"')
   const invalidCsv=[csvHeader,cells,...csvRows.slice(1)].join('\r\n')
   const invalid=await door.plan({...input,csv:invalidCsv,originalSha256:createHash('sha256').update(invalidCsv).digest('hex')})
   assert.equal(invalid.counts.mapped,19);assert.equal(invalid.counts.rejected,1,'Invalid factors cannot be silently dropped')
   await door.json('undo',{planId:invalid.planId})
  }
  const halfMapped=await door.plan({...input,columns:{...churnzeroColumns,churnScore:'ChurnScore'}})
  assert.equal(halfMapped.counts.mapped,0);assert.equal(halfMapped.counts.rejected,20);await door.json('undo',{planId:halfMapped.planId})
  const unavailableCsv=input.csv.replace(',4,"{""usage"":1,""engagement"":19}"',',,"{""usage"":null,""engagement"":0}"').replace('"{""usage"":2,""engagement"":18}"','"{""usage"":2}"')
  assert.notEqual(unavailableCsv,input.csv)
  const unavailable=await door.plan({...input,csv:unavailableCsv,originalSha256:createHash('sha256').update(unavailableCsv).digest('hex')})
  await door.apply(unavailable)
  const missingPreview=await (await app.request('/api/buoy/scorecards/preview',{method:'POST',cookie:app.cookie,body:{config:churnzeroScorecard}})).json()
  const missingResult=missingPreview.accounts.find(row=>row.accountId===target('churnzero','synthetic-buoy-1'))
  assert.equal(missingResult.score,null);assert.equal(missingResult.band,'unknown');assert.deepEqual(missingResult.breakdown.map(row=>row.rawValue),[null,null,0])
  const absentResult=missingPreview.accounts.find(row=>row.accountId===target('churnzero','synthetic-buoy-2'))
  assert.equal(absentResult.score,null);assert.deepEqual(absentResult.breakdown.map(row=>row.rawValue),[8,2,null],'A factor present on other accounts is not invented for this one')
  const observation=(await state(app)).find(row=>row.id===target('churnzero','synthetic-buoy-1')).migrationHealth
  assert.equal(observation.score,null);assert.deepEqual(observation.factors,{usage:null,engagement:0},'Missing and zero observations remain distinct')
  await door.undo(unavailable);assert.deepEqual(await state(app),before)
  const editedPlan=await door.plan(input);await door.apply(editedPlan)
  const current=(await state(app)).find(row=>row.id===target('churnzero','synthetic-buoy-1'))
  const edited={id:current.id,name:'Synthetic owner edit',renewalDate:current.renewalDate,noticeDays:current.noticeDays,renewalEvidence:current.renewalEvidence,billing:current.billing,support:current.support,revision:current.revision}
  assert.equal((await app.request('/api/buoy/accounts/'+current.id,{method:'PUT',cookie:app.cookie,body:edited})).status,200)
  assert.deepEqual((await state(app)).find(row=>row.id===current.id).migrationHealth,current.migrationHealth,'Native edits preserve the read-only incumbent observation')
  const tokenResponse=await app.request('/api/buoy/v1/tokens',{method:'POST',cookie:app.cookie,body:{scopes:['accounts.read','accounts.write'],accountIds:[current.id],requestsPerMinute:30,expiresDays:1}})
  assert.equal(tokenResponse.status,201);const credential=await tokenResponse.json()
  const integrationUpdate=new Request(app.origin+'/api/buoy/v1/accounts/'+current.id,{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer '+credential.token,'idempotency-key':'synthetic-buoy-health-edit'},body:JSON.stringify({...edited,name:'Synthetic integration edit',revision:(await state(app)).find(row=>row.id===current.id).revision})})
  assert.equal((await app.dispatch(integrationUpdate)).status,200)
  assert.deepEqual((await state(app)).find(row=>row.id===current.id).migrationHealth,current.migrationHealth,'Integration edits preserve the read-only incumbent observation')
  assert.equal((await app.request('/api/buoy/accounts/'+current.id,{method:'PUT',cookie:app.cookie,body:{...edited,migrationHealth:{score:0}}})).status,400,'Ordinary account writes cannot forge source observations')
  assert.equal((await door.send('undo',{planId:editedPlan.planId})).status,409,'Undo preserves later native edits')
  assert.equal((await app.request('/api/buoy/accounts/'+current.id,{method:'DELETE',cookie:app.cookie,body:{confirmation:'Synthetic integration edit'}})).status,200)
  assert.equal((await door.send('reconcile',{planId:editedPlan.planId})).status,410)
  await assert.rejects(door.plan(input),/source_erased/,'Erasure prevents ChurnZero replay')
  const dependencyCsv=input.csv.replaceAll('synthetic-buoy-','synthetic-buoy-dependency-')
  const dependencyPlan=await door.plan({...input,csv:dependencyCsv,originalSha256:createHash('sha256').update(dependencyCsv).digest('hex')});await door.apply(dependencyPlan)
  const dependentId=target('churnzero','synthetic-buoy-dependency-1')
  assert.equal((await app.request('/api/buoy/proposals',{method:'POST',cookie:app.cookie,body:{accountId:dependentId,kind:'renewal',payload:{outcome:'renewed',reason:'synthetic-buoy-1',evidence:'synthetic-buoy-2'}}})).status,201)
  const withDependency=await state(app)
  assert.equal((await door.send('undo',{planId:dependencyPlan.planId})).status,409,'Undo protects dependent reviewed work')
  assert.deepEqual(await state(app),withDependency,'Refused undo removes no account from the batch')
  const cardState=await (await app.request('/api/buoy/scorecards',{cookie:app.cookie})).json()
  assert.equal((await app.request('/api/buoy/scorecards/publish',{method:'POST',cookie:otherCookies[0],body:{revision:cardState.revision,config:churnzeroScorecard}})).status,403)
  assert.equal((await app.request('/api/buoy/scorecards/publish',{method:'POST',cookie:app.cookie,body:{revision:cardState.revision,config:churnzeroScorecard}})).status,201)
  const scored=(await state(app)).find(row=>row.id===dependentId)
  assert.ok(Math.abs(scored.health.score-104/3)<1e-10);assert.deepEqual(scored.health.scorecard.breakdown.map(row=>row.rawValue),[4,1,19])
  const published=await (await app.request('/api/buoy/scorecards',{cookie:app.cookie})).json(),retainedHistory=published.history.find(row=>row.accountId===dependentId)
  assert.ok(retainedHistory)
  assert.equal((await app.request('/api/buoy/accounts/'+dependentId,{method:'DELETE',cookie:app.cookie,body:{confirmation:scored.name}})).status,200)
  assert.equal((await app.request('/api/buoy/scorecards/preview',{method:'POST',cookie:app.cookie,body:{historyId:retainedHistory.id}})).status,404,'Erasure withdraws derived imported-health history')
  const afterErasure=await (await app.request('/api/buoy/scorecards',{cookie:app.cookie})).json()
  assert.equal(afterErasure.accounts.some(row=>row.accountId===dependentId),false)
  assert.equal((await door.send('reconcile',{planId:dependencyPlan.planId})).status,410)

 }finally{await app.close();await rm(scratch,{recursive:true,force:true})}
})

test('MIGRATE-003 Totango account CSV and API pages reconcile twenty accounts through reviewed owner imports',async()=>{
 const app=await startWorker({clock:Date.parse('2026-10-25T12:00:00Z')}),scratch=await mkdtemp(join(tmpdir(),'buoy-totango-'))
 try {
  const before=await state(app),original='fixtures/move-in/totango/accounts.csv',prepared=join(scratch,'bundle.json')
  const columns={id:'Account ID',name:'Account Name',renewalDate:'Contract Renewal Date',noticeDays:'Notice Days',renewalEvidence:'Contract Reference',invoiceTotal:'Invoice Total',invoiceCurrency:'Invoice Currency',invoiceObservedAt:'Invoice Observed',invoiceDueDate:'Invoice Due',supportObservedAt:'Support Observed',supportReference:'Support Reference',openTickets:'Open Tickets',urgentTickets:'Urgent Tickets'}
  execFileSync(process.execPath,['src/buoy/migrate/cli.mjs','--source','totango','--input',original,'--output',prepared,'--columns',JSON.stringify(columns)])
  const input=JSON.parse(await readFile(prepared,'utf8')),bytes=await readFile(original)
  assert.equal(input.csv,bytes.toString('utf8'));assert.equal(input.originalSha256,createHash('sha256').update(bytes).digest('hex'))
  const door=client(app,'totango'),plan=await door.plan(input)
  assert.equal(plan.counts.mapped,20);assert.equal(plan.counts.rejected,0)
  assert.equal(plan.diagnostics.filter(d=>d.field==='Health Profile').length,20)
  assert.deepEqual(await state(app),before)
  assert.equal((await door.send('apply',{planId:plan.planId,reviewedFingerprint:'0'.repeat(64)})).status,403)
  assert.equal((await door.send('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint},{cookie:undefined})).status,401)
  const job=await door.apply(plan);assert.equal((await door.apply(plan)).id,job.id)
  const accounts=await state(app);assert.equal(accounts.length,before.length+20)
  for(let n=1;n<=20;n++){
   const row=accounts.find(a=>a.id===target('totango','synthetic-buoy-'+n));assert.ok(row)
   assert.equal(row.name,'Synthetic Totango '+n);assert.equal(row.renewalDate,'2027-03-31');assert.equal(row.noticeDays,n);assert.equal(row.renewalEvidence,'synthetic-buoy-'+n)
   assert.deepEqual(row.billing,{observedAt:'2026-01-01',reference:'totango account synthetic-buoy-'+n,currency:'USD',totalMinor:n*100+25,creditsMinor:0,allocatedMinor:0,dueDate:'2026-01-31'})
   assert.deepEqual(row.support,{observedAt:'2026-01-01',reference:'synthetic-buoy-support-'+n,openTickets:n,urgentTickets:n%3})
  }
  assert.equal((await door.json('reconcile',{planId:plan.planId})).ok,true)
  const history=(await (await app.request('/api/operator/import-history',{cookie:app.cookie})).json()).history
  assert.equal(history.find(h=>h.planId===plan.planId).namespace,'buoy-migrate-totango-v1')
  assert.equal((await client(app,'csv').send('status',{planId:plan.planId})).status,404)
  await door.undo(plan);assert.deepEqual(await state(app),before)
  const malformed=await door.plan({...input,originalSha256:'0'.repeat(64)});assert.equal(malformed.counts.mapped,0);assert.match(malformed.rejected[0].reason,/digest/);await door.json('undo',{planId:malformed.planId})
  const mixed=await door.plan({...input,data:{accounts:[]}});assert.equal(mixed.counts.mapped,0);assert.match(mixed.rejected[0].reason,/second export representation/);await door.json('undo',{planId:mixed.planId})
  const invalidSupport={...input,csv:input.csv.replace('synthetic-buoy-support-1,1,1','synthetic-buoy-support-1,1,2')}
  invalidSupport.originalSha256=createHash('sha256').update(invalidSupport.csv).digest('hex')
  const rejected=await door.plan(invalidSupport);assert.equal(rejected.counts.mapped,19);assert.equal(rejected.counts.rejected,1);assert.match(rejected.rejected[0].reason,/urgentTickets cannot exceed openTickets/)
  await door.json('undo',{planId:rejected.planId})
  await totangoApiJourney({app,scratch,door,columns,state,before,target})
  await totangoReferenceJourney({app,scratch,input,door,state,before})
 }finally{await app.close();await rm(scratch,{recursive:true,force:true})}
})

test('MIGRATE-005 CSV mapping rejects bad rows and preserves exact money and source identities',async()=>{
 const app=await startWorker(),scratch=await mkdtemp(join(tmpdir(),'buoy-migrate-'))
 try {
  const csv='\uFEFF'+header+csvRow('synthetic-buoy-1')+csvRow('synthetic-buoy-2','31/03/2027','JPY','12')+csvRow('synthetic-buoy-3','31/03/2027','KWD','1.234')+csvRow('synthetic-buoy-4','31/02/2027')+csvRow('synthetic-buoy-5','31/03/2027','USD','1.001')+csvRow('synthetic-buoy-6','31/03/2027','BAD')+csvRow('synthetic-buoy-7')+csvRow('synthetic-buoy-7')
  const input=join(scratch,'source.csv'),output=join(scratch,'bundle.json')
  await writeFile(input,csv)
  execFileSync(process.execPath,['src/buoy/migrate/cli.mjs','--source','csv','--input',input,'--output',output,'--date-order','day-first','--columns',JSON.stringify(bundle(csv).columns)])
  const prepared=JSON.parse(await readFile(output,'utf8'))
  assert.equal(prepared.csv,csv);assert.equal(prepared.originalSha256,createHash('sha256').update(await readFile(input)).digest('hex'))
  const door=client(app,'csv'),before=await state(app),plan=await door.plan(prepared)
  assert.equal(plan.counts.mapped,3);assert.equal(plan.counts.rejected,5)
  assert.ok(plan.rejected.some(r=>/Duplicate source ID/.test(r.reason)))
  assert.deepEqual(await state(app),before)
  await door.apply(plan)
  const accounts=await state(app)
  for(const [id,currency,totalMinor] of [['synthetic-buoy-1','USD',1234],['synthetic-buoy-2','JPY',12],['synthetic-buoy-3','KWD',1234]]) {
   const row=accounts.find(a=>a.id===target('csv',id));assert.ok(row);assert.equal(row.billing.currency,currency);assert.equal(row.billing.totalMinor,totalMinor);assert.equal(row.renewalDate,'2027-03-31')
  }
  assert.equal(accounts.length,before.length+3)
  assert.equal((await door.json('reconcile',{planId:plan.planId})).ok,true)
  await door.undo(plan);assert.deepEqual(await state(app),before)
  const bad=await door.plan({...prepared,originalSha256:'0'.repeat(64)})
  assert.equal(bad.counts.mapped,0);assert.match(bad.rejected[0].reason,/digest/)
  assert.equal((await door.json('undo',{planId:bad.planId})).state,'cancelled')
  const malformed=await door.plan(bundle(header+'"unterminated'))
  assert.equal(malformed.counts.mapped,0);assert.match(malformed.rejected[0].reason,/Unclosed/)
  assert.equal((await door.json('undo',{planId:malformed.planId})).state,'cancelled')
  const large=await door.plan(bundle(header+Array.from({length:2000},(_,i)=>csvRow('synthetic-buoy-'+i,i<3?'31/03/2027':'31/02/2027')).join('')))
  assert.equal(large.counts.input,2000);assert.equal(large.counts.mapped,3);assert.equal(large.counts.rejected,1997)
  assert.deepEqual(await state(app),before,'A 2000-row preview changes no native records')
  await door.json('undo',{planId:large.planId})
 } finally {await app.close();await rm(scratch,{recursive:true,force:true})}
})

test('MIGRATE-003 and MIGRATE-005 existing Imports screen reviews migration bundles at 1440 and 390',async()=>{
 const app=await startWorker({clock:Date.parse('2026-10-27T12:00:00Z')}),browser=await chromium.launch({headless:true,...(process.env.BUOY_CHROMIUM_PATH?{executablePath:process.env.BUOY_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 const evidence=process.env.EVIDENCE_DIR??'../evidence/migrate';await mkdir(evidence,{recursive:true})
 try {
  for(const width of [Number(process.env.BUOY_MIGRATION_PROOF_WIDTH??1440)]) for(const source of (process.env.BUOY_MIGRATION_PROOF_SOURCE?[process.env.BUOY_MIGRATION_PROOF_SOURCE]:['csv','totango','totango-api','churnzero'])) {
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try {
    await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...value]=pair.split('=');return{name,value:value.join('='),url:app.origin}}))
    const page=await context.newPage(),before=await state(app)
    await page.goto(app.origin+'/app/imports',{waitUntil:'networkidle'})
    await page.waitForFunction(()=>!document.getElementById('import-settings-fields').disabled)
    const raw={...bundle(header+csvRow('synthetic-buoy-'+width)+csvRow('synthetic-buoy-invalid','31/02/2027')),source}
    const churnzeroCsv=source==='churnzero'?await readFile('fixtures/move-in/churnzero/accounts.csv','utf8'):undefined
    const badChurnzero=churnzeroCsv?.split('\r\n')[1].replace('synthetic-buoy-1,','synthetic-buoy-invalid,').replace('2027-03-31','2027-02-31')+'\r\n'
    const input=source==='totango-api'?apiBrowserBundle(raw):source==='churnzero'?{format:'buoy-migration-v1',source,dateOrder:'iso',columns:{...churnzeroColumns,...churnzeroHealthColumns},csv:churnzeroCsv+badChurnzero,originalSha256:createHash('sha256').update(churnzeroCsv+badChurnzero).digest('hex')}:raw
    if(source==='totango'||source==='totango-api')input.references=referenceFiles()
    await page.setInputFiles('#import-bundle',{name:'synthetic-buoy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(input))})
    await page.getByRole('button',{name:'Upload and review',exact:true}).click()
    await page.locator('#import-review').waitFor({state:'visible'})
    await page.waitForFunction(()=>!document.getElementById('import-confirmed').disabled)
    assert.match(await page.locator('#import-rejections').innerText(),/real calendar date/)
    if(width===1440&&input.references){const diagnostics=await page.locator('#import-diagnostics').innerText();assert.match(diagnostics,/definitions.json#\/actions\/1\/configuration\/a ~1 b~0c/);assert.match(diagnostics,/categories.json#\/associations\/0/);assert.match(diagnostics,/no playbook or automation is created/)}
    assert.deepEqual(await state(app),before)
    const proof=async stage=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Import remains within viewport');await scan(page,`Migration ${source} ${stage} ${width}`);await page.screenshot({path:join(evidence,`migration-${source}-${stage}-${width}.png`),fullPage:true})}
    // This screen uses text-labelled controls throughout; any future symbolic control must supply a tooltip.
    assert.deepEqual(await page.locator('#work button, #work a').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.querySelector('img[alt]')).map(n=>n.outerHTML)),[])
    if(source==='churnzero')for(const field of ['Journey','Contact'])assert.ok((await page.locator('#import-diagnostics').innerText()).includes(field))
    await proof('review')
    await page.getByLabel('I reviewed this plan and approve the changes for this fingerprint.',{exact:true}).check()
    await page.getByRole('button',{name:'Apply reviewed import',exact:true}).click()
    const ready=async title=>page.waitForFunction(expected=>document.getElementById('import-result-title').textContent===expected&&!document.getElementById('import-status').disabled,title)
    await ready('Import completed');assert.equal((await state(app)).length,before.length+(source==='churnzero'?20:1))
    const selectedPlanId=await page.evaluate(()=>sessionStorage.getItem('buoy:import:plan'))
    assert.ok(selectedPlanId)
    if(source==='churnzero'){
     const accountId=target(source,'synthetic-buoy-1')
     const detail=await context.newPage();await detail.goto(app.origin+'/app/accounts/'+accountId,{waitUntil:'networkidle'})
     await detail.locator('[data-open="account-source-details"]').click()
     const retained=JSON.parse(await detail.locator('#account-source-details pre').innerText())
     assert.deepEqual(retained.migrationHealth,{source:'churnzero',sourceId:'synthetic-buoy-1',score:4,factors:{usage:1,engagement:19},fields:{score:'ChurnScore',factors:'ChurnScore Factors'}})
     await scan(detail,`ChurnZero retained health ${width}`)
     assert.deepEqual(await detail.locator('#work button, #work a').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.querySelector('img[alt]')).map(n=>n.outerHTML)),[])
     assert.equal(await detail.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
     await detail.screenshot({path:join(evidence,`migration-churnzero-health-${width}.png`),fullPage:true})
     await detail.goto(app.origin+'/app',{waitUntil:'networkidle'})
     await detail.locator('#scorecard-configure > summary').click()
     await detail.getByLabel('Scorecard name',{exact:true}).fill(churnzeroScorecard.name)
     await detail.getByLabel('At risk below (0–100)',{exact:true}).fill('40');await detail.getByLabel('Healthy at or above (0–100)',{exact:true}).fill('75')
     for(const [index,measure]of churnzeroScorecard.measures.entries()){
      await detail.locator('#scorecard-measure-'+index+' > summary').click()
      await detail.getByLabel('Name for measure '+(index+1),{exact:true}).fill(measure.name)
      await detail.getByLabel('Input for measure '+(index+1),{exact:true}).selectOption(measure.field)
      for(const [label,key]of [['Minimum','min'],['Maximum','max'],['Weight','weight']])await detail.getByLabel(label+' for measure '+(index+1),{exact:true}).fill(String(measure[key]))
     }
     await detail.getByRole('button',{name:'Preview scorecard',exact:true}).click()
     await detail.locator('#scorecard-preview').waitFor({state:'visible'})
     const previewText=await detail.locator('#scorecard-preview').innerText()
     for(const value of ['observed value 4','observed value 1','observed value 19','untracked','churnzero account synthetic-buoy-1'])assert.ok(previewText.includes(value))
     assert.equal((await state(app)).find(row=>row.id===accountId).health.scorecard,undefined,'Native preview grants no published scoring authority')
     assert.equal(await detail.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
     await detail.screenshot({path:join(evidence,`migration-churnzero-scorecard-preview-${width}.png`),fullPage:true});await detail.close()
    }
    await proof('completed')
    await page.reload({waitUntil:'networkidle'});await ready('Import completed')
    if(source==='churnzero'){
     await page.evaluate(()=>{sessionStorage.removeItem('buoy:import:plan');sessionStorage.removeItem('buoy:import:plan:source')})
     await page.reload({waitUntil:'networkidle'})
     await page.locator('button[data-import-plan="'+selectedPlanId+'"]').click();await ready('Import completed')
     assert.equal(await page.evaluate(()=>sessionStorage.getItem('buoy:import:plan')),selectedPlanId,'History reopens the intended import even when approval timestamps tie')
    }
    await page.getByRole('button',{name:'Reconcile native records',exact:true}).click()
    await page.locator('#import-reconciliation').waitFor({state:'visible'})
    assert.equal(await page.locator('#import-reconcile-summary').innerText(),'Native records reconcile with this import.')
    await proof('reconciled')
    await page.getByRole('button',{name:'Undo import',exact:true}).click();await ready('Import undone')
    assert.deepEqual(await state(app),before);await proof('undone')
   } finally {await context.close()}
  }
  assert.deepEqual(failures,[])
  // scan independently measures every text foreground against the painted gradient.
  for(const entry of manual)for(const rule of entry.rules)assert.equal(rule.id,'color-contrast','Every other incomplete accessibility check remains a failure')
 } finally {await browser.close();await app.close()}
})
