import assert from 'node:assert/strict'
import {totangoApiJourney,apiBrowserBundle} from './totango-api-journey.mjs'
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
  execFileSync(process.execPath,['src/buoy/migrate/cli.mjs','--source','churnzero','--input',original,'--output',prepared,'--columns',JSON.stringify(churnzeroColumns)])
  const input=JSON.parse(await readFile(prepared,'utf8')),bytes=await readFile(original)
  assert.equal(input.csv,bytes.toString('utf8'));assert.equal(input.originalSha256,createHash('sha256').update(bytes).digest('hex'))
  const plan=await door.plan(input)
  assert.equal(plan.counts.input,20);assert.equal(plan.counts.mapped,20);assert.equal(plan.counts.rejected,0)
  assert.deepEqual(plan.diagnostics.map(d=>d.field).sort(),Array.from({length:20},()=>['ChurnScore','ChurnScore Factors','Journey','Contact']).flat().sort())
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
   assert.deepEqual(actual.billing,{observedAt:'2026-01-01',reference:'churnzero account synthetic-buoy-'+n,currency:'USD',totalMinor:n*100+25,creditsMinor:0,allocatedMinor:0,dueDate:'2026-01-31'});assert.equal(actual.support,null)
  }
  assert.equal((await door.json('reconcile',{planId:plan.planId})).ok,true)
  assert.equal((await client(app,'csv').send('status',{planId:plan.planId})).status,404)
  const history=(await (await app.request('/api/operator/import-history',{cookie:app.cookie})).json()).history
  assert.equal(history.find(row=>row.planId===plan.planId).namespace,'buoy-migrate-churnzero-v1')
  assert.equal(app.outbound.length,outbound,'Account import does not send or execute provider work')
  await door.undo(plan);assert.deepEqual(await state(app),before)
  const malformed=await door.plan({...input,originalSha256:'0'.repeat(64)})
  assert.equal(malformed.counts.mapped,0);assert.match(malformed.rejected[0].reason,/digest/);await door.json('undo',{planId:malformed.planId})
  const mixed=await door.plan({...input,data:{accounts:[]}})
  assert.equal(mixed.counts.mapped,0);assert.match(mixed.rejected[0].reason,/second export representation/);await door.json('undo',{planId:mixed.planId})
  const editedPlan=await door.plan(input);await door.apply(editedPlan)
  const current=(await state(app)).find(row=>row.id===target('churnzero','synthetic-buoy-1'))
  const edited={id:current.id,name:'Synthetic owner edit',renewalDate:current.renewalDate,noticeDays:current.noticeDays,renewalEvidence:current.renewalEvidence,billing:current.billing,support:current.support,revision:current.revision}
  assert.equal((await app.request('/api/buoy/accounts/'+current.id,{method:'PUT',cookie:app.cookie,body:edited})).status,200)
  assert.equal((await door.send('undo',{planId:editedPlan.planId})).status,409,'Undo preserves later native edits')
  assert.equal((await app.request('/api/buoy/accounts/'+current.id,{method:'DELETE',cookie:app.cookie,body:{confirmation:edited.name}})).status,200)
  assert.equal((await door.send('reconcile',{planId:editedPlan.planId})).status,410)
  await assert.rejects(door.plan(input),/source_erased/,'Erasure prevents ChurnZero replay')
  const dependencyCsv=input.csv.replaceAll('synthetic-buoy-','synthetic-buoy-dependency-')
  const dependencyPlan=await door.plan({...input,csv:dependencyCsv,originalSha256:createHash('sha256').update(dependencyCsv).digest('hex')});await door.apply(dependencyPlan)
  const dependentId=target('churnzero','synthetic-buoy-dependency-1')
  assert.equal((await app.request('/api/buoy/proposals',{method:'POST',cookie:app.cookie,body:{accountId:dependentId,kind:'renewal',payload:{outcome:'renewed',reason:'synthetic-buoy-1',evidence:'synthetic-buoy-2'}}})).status,201)
  const withDependency=await state(app)
  assert.equal((await door.send('undo',{planId:dependencyPlan.planId})).status,409,'Undo protects dependent reviewed work')
  assert.deepEqual(await state(app),withDependency,'Refused undo removes no account from the batch')
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
    const churnzeroCsv=source==='churnzero'?(await readFile('fixtures/move-in/churnzero/accounts.csv','utf8')).split('\r\n').slice(0,2).join('\r\n')+'\r\n':undefined
    const badChurnzero=churnzeroCsv?.split('\r\n')[1].replace('synthetic-buoy-1,','synthetic-buoy-invalid,').replace('2027-03-31','2027-02-31')+'\r\n'
    const input=source==='totango-api'?apiBrowserBundle(raw):source==='churnzero'?{format:'buoy-migration-v1',source,dateOrder:'iso',columns:churnzeroColumns,csv:churnzeroCsv+badChurnzero,originalSha256:createHash('sha256').update(churnzeroCsv+badChurnzero).digest('hex')}:raw
    await page.setInputFiles('#import-bundle',{name:'synthetic-buoy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(input))})
    await page.getByRole('button',{name:'Upload and review',exact:true}).click()
    await page.locator('#import-review').waitFor({state:'visible'})
    await page.waitForFunction(()=>!document.getElementById('import-confirmed').disabled)
    assert.match(await page.locator('#import-rejections').innerText(),/real calendar date/)
    assert.deepEqual(await state(app),before)
    const proof=async stage=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Import remains within viewport');await scan(page,`Migration ${source} ${stage} ${width}`);await page.screenshot({path:join(evidence,`migration-${source}-${stage}-${width}.png`),fullPage:true})}
    // This screen uses text-labelled controls throughout; any future symbolic control must supply a tooltip.
    assert.deepEqual(await page.locator('#work button, #work a').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.querySelector('img[alt]')).map(n=>n.outerHTML)),[])
    if(source==='churnzero')for(const field of ['ChurnScore','ChurnScore Factors','Journey','Contact'])assert.ok((await page.locator('#import-diagnostics').innerText()).includes(field))
    await proof('review')
    await page.getByLabel('I reviewed this plan and approve the changes for this fingerprint.',{exact:true}).check()
    await page.getByRole('button',{name:'Apply reviewed import',exact:true}).click()
    const ready=async title=>page.waitForFunction(expected=>document.getElementById('import-result-title').textContent===expected&&!document.getElementById('import-status').disabled,title)
    await ready('Import completed');assert.equal((await state(app)).length,before.length+1)
    await proof('completed')
    await page.reload({waitUntil:'networkidle'});await ready('Import completed')
    if(source==='churnzero'){
     await page.evaluate(()=>{sessionStorage.removeItem('buoy:import:plan');sessionStorage.removeItem('buoy:import:plan:source')})
     await page.reload({waitUntil:'networkidle'})
     await page.getByRole('button',{name:'Open import',exact:true}).first().click();await ready('Import completed')
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
