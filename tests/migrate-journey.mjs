import assert from 'node:assert/strict'
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

test('MIGRATE-005 existing Imports screen reviews migration bundles at 1440 and 390',async()=>{
 const app=await startWorker(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const evidence=process.env.EVIDENCE_DIR??'../evidence/migrate';await mkdir(evidence,{recursive:true})
 try {
  for(const width of [1440,390]) {
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try {
    await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...value]=pair.split('=');return{name,value:value.join('='),url:app.origin}}))
    const page=await context.newPage(),before=await state(app)
    await page.goto(app.origin+'/app/imports',{waitUntil:'networkidle'})
    await page.waitForFunction(()=>!document.getElementById('import-settings-fields').disabled)
    const input=bundle(header+csvRow('synthetic-buoy-'+width)+csvRow('synthetic-buoy-invalid','31/02/2027'))
    await page.setInputFiles('#import-bundle',{name:'synthetic-buoy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(input))})
    await page.getByRole('button',{name:'Upload and review',exact:true}).click()
    await page.locator('#import-review').waitFor({state:'visible'})
    await page.waitForFunction(()=>!document.getElementById('import-confirmed').disabled)
    assert.match(await page.locator('#import-rejections').innerText(),/real calendar date/)
    assert.deepEqual(await state(app),before)
    const proof=async stage=>{await scan(page,`Migration ${stage} ${width}`);await page.screenshot({path:join(evidence,`migration-${stage}-${width}.png`),fullPage:true})}
    // This screen uses text-labelled controls throughout; any future symbolic control must supply a tooltip.
    assert.deepEqual(await page.locator('#work button, #work a').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.querySelector('img[alt]')).map(n=>n.outerHTML)),[])
    await proof('review')
    await page.getByLabel('I reviewed this plan and approve the changes for this fingerprint.',{exact:true}).check()
    await page.getByRole('button',{name:'Apply reviewed import',exact:true}).click()
    const ready=async title=>page.waitForFunction(expected=>document.getElementById('import-result-title').textContent===expected&&!document.getElementById('import-status').disabled,title)
    await ready('Import completed');assert.equal((await state(app)).length,before.length+1)
    await proof('completed')
    await page.reload({waitUntil:'networkidle'});await ready('Import completed')
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
