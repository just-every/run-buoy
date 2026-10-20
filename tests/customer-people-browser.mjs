// ACCOUNT-004 and USAGE-001 carrier: native forms against the public Worker.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {startWorker} from './worker.mjs'
import {scan,failures,manual,openForms,submit} from './a11y-checks.mjs'

const evidence=resolve(process.env.EVIDENCE_DIR??'../evidence/customer-people')
const app=await startWorker()
let browser
try{
 await mkdir(evidence,{recursive:true})
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const call=async(path,method='GET',body)=>{
  const response=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body})
  assert.ok(response.ok,await response.clone().text());return response.json()
 }
 const accounts=[]
 for(const [i,name] of ['Harbour Software','Cedar Logistics','Coastline Analytics','Juniper Health','Northstar Labs','Brightwater Group','Summit Design','Riverbank Systems','Golden Gate Studio','Maple Services'].entries()){
  accounts.push(await call('/accounts','POST',{id:'people-ui-'+i,name,renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Customer-confirmed contract; renewal clause 4',billing:null,support:null}))
 }
 // Actual stored records in the remaining eight accounts make the preview portfolio real.
 for(let i=2;i<10;i++)await call('/customer-people','POST',{kind:i%2?'user':'contact',name:'Customer '+accounts[i].name,accountIds:[accounts[i].id],source:'Reviewed customer directory'})
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage()
   const show=async id=>{const panel=page.locator('#'+id);if(!await panel.evaluate(element=>element.open))await panel.locator('summary').click()}
   const save=async(form,label)=>{await submit(page,form.getByRole('button',{name:label,exact:true}));assert.equal(await page.locator('[role=alert]').count(),0,await page.locator('#work').innerText())}
   const proof=async label=>{await scan(page,`${label} ${width}`);const stem=label.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-');await page.screenshot({path:join(evidence,`${stem}-${width}.png`),fullPage:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(evidence,`${stem}-viewport-${width}.png`)});const record=page.locator('#customer-record');if(await record.count())await record.screenshot({path:join(evidence,`${stem}-record-${width}.png`)})}
   await page.goto(app.origin+'/app/customer-people',{waitUntil:'networkidle'})
   const createField=async(key,label,type,options='',formula='')=>{
    await show('create-customer-field');const form=page.locator('#customer-field-definition')
    await form.getByLabel('Field key',{exact:true}).fill(key);await form.getByLabel('Field label',{exact:true}).fill(label)
    await form.getByLabel('Field type',{exact:true}).selectOption(type)
    await form.getByLabel('Options (one per line; picklist and multi-select)',{exact:true}).fill(options)
    await form.getByLabel('Formula (formula fields only)',{exact:true}).fill(formula)
    await save(form,'Create customer field')
   }
   if(width===1440){
    for(const [key,label,type,options] of [
     ['used','Seats used','number'],['purchased','Seats purchased','number'],['package','Contract package','picklist','Starter\nEnterprise'],
     ['contract','Contract value','currency'],['note','Customer note','text'],['started','Customer start','date'],
     ['products','Products used','multi-select','Reports\nExports'],['active','Active customer','boolean']
    ])await createField(key,label,type,options)
   }
   const people=[]
   for(const [index,kind] of ['contact','user'].entries()){
    await show('create-customer-person');const form=page.locator('#customer-person-create')
    await form.getByLabel('Customer name',{exact:true}).fill(`${kind==='contact'?'Avery Customer':'Morgan Product User'} ${width}`)
    await form.getByLabel('Record kind',{exact:true}).selectOption(kind)
    await form.getByLabel(accounts[index].name,{exact:true}).check()
    await form.getByLabel('Source reference',{exact:true}).fill('Administrator-reviewed customer directory '+width)
    await save(form,'Create customer record')
    const person=(await call('/customer-people')).records.find(record=>record.name===`${kind==='contact'?'Avery Customer':'Morgan Product User'} ${width}`)
    assert.ok(person);assert.equal(person.kind,kind);assert.deepEqual(person.accountIds,[accounts[index].id]);people.push(person)
    await show('edit-customer-field-values-'+person.id)
    const valuesForm=page.locator('#customer-field-values-'+person.id)
    await valuesForm.locator('[name=values]').fill(JSON.stringify({used:index?0:24,purchased:index?0:40,package:'Enterprise',contract:{currency:'USD',amountMinor:1800000},note:'Customer-confirmed license evidence',started:'2026-10-01',products:['Reports','Exports'],active:true}))
    await valuesForm.getByLabel('Source reference',{exact:true}).fill('Customer-approved license schedule '+width)
    await save(valuesForm,'Save customer field values')
    const saved=(await call('/customer-people')).records.find(record=>record.id===person.id)
    assert.deepEqual(saved.values.products,['Reports','Exports']);assert.equal(saved.values.active,true)
    assert.deepEqual(saved.values.contract,{currency:'USD',amountMinor:1800000});assert.equal(saved.values.started,'2026-10-01')
    assert.equal(saved.values.note,'Customer-confirmed license evidence');assert.equal(saved.values.package,'Enterprise')
   }
   const person=people[0],ratio={key:'ratio_'+width,label:'License utilization '+width,type:'formula',formula:'custom.used / custom.purchased'}
   await page.goto(app.origin+'/app/customer-people?person='+person.id,{waitUntil:'networkidle'})
   const beforePreview=await call('/customer-people')
   let form=page.locator('#customer-field-preview')
   await form.getByLabel('Customer field definition (JSON object)',{exact:true}).fill(JSON.stringify(ratio))
   await save(form,'Preview customer field')
   const preview=page.locator('#customer-field-preview-result')
   assert.equal(await preview.locator('#customer-preview-accounts > li').count(),10)
   assert.match(await preview.innerText(),/Nothing has been saved/);assert.match(await preview.innerText(),/0\.6/)
   assert.deepEqual(await call('/customer-people'),beforePreview,'Preview changes no definition, customer value, account revision or history')
   await proof('ACCOUNT-004 USAGE-001 real account and customer preview')
   await createField(ratio.key,ratio.label,'formula','',ratio.formula)
   let state=await call('/customer-people'),current=state.records.find(record=>record.id===person.id)
   assert.equal(current.values[ratio.key],.6);assert.match(current.explanations[ratio.key],/custom\.used=24/);assert.match(current.explanations[ratio.key],/custom\.purchased=40/)
   const zero=state.records.find(record=>record.id===people[1].id)
   assert.equal(zero.values[ratio.key]??null,null);assert.match(zero.explanations[ratio.key],/zero/i)
   await page.goto(app.origin+'/app/customer-people?person='+person.id,{waitUntil:'networkidle'})
   await show('edit-customer-field-values-'+person.id);form=page.locator('#customer-field-values-'+person.id)
   const values=JSON.parse(await form.locator('[name=values]').inputValue());values.used=32
   await form.locator('[name=values]').fill(JSON.stringify(values));await form.getByLabel('Source reference',{exact:true}).fill('Usage export confirmed '+width)
   await save(form,'Save customer field values')
   state=await call('/customer-people');current=state.records.find(record=>record.id===person.id);assert.equal(current.values[ratio.key],.8)
   const changes=state.history.filter(entry=>entry.personId===person.id)
   for(const key of ['used',ratio.key])assert.ok(changes.some(entry=>entry.key===key&&entry.actor&&entry.recordedAt&&entry.source==='Usage export confirmed '+width))
   assert.ok(changes.some(entry=>entry.key===ratio.key&&entry.oldValue===.6&&entry.newValue===.8))
   assert.match(await page.locator('#customer-field-history').innerText(),/Previous value/)
   assert.match(await page.locator('#customer-field-history').innerText(),/Usage export confirmed/)
   assert.match(await page.locator('#customer-record').innerText(),/0\.8/)
   // Membership editing is explicit and retains typed values through its public form.
   await show('edit-customer-person-'+person.id);form=page.locator('#customer-person-'+person.id)
   await form.getByLabel(accounts[1].name,{exact:true}).check();await form.getByLabel('Source reference',{exact:true}).fill('Reviewed second account membership '+width)
   await save(form,'Save customer record')
   current=(await call('/customer-people')).records.find(record=>record.id===person.id)
   assert.deepEqual([...current.accountIds].sort(),[accounts[0].id,accounts[1].id].sort());assert.equal(current.values[ratio.key],.8)
   await openForms(page);await proof('ACCOUNT-004 USAGE-001 typed records calculation and history')
   form=page.locator('#customer-field-preview')
   await form.getByLabel('Customer field definition (JSON object)',{exact:true}).fill(JSON.stringify({...ratio,key:'unsafe_'+width,formula:'globalThis.process.exit()'}))
   await submit(page,form.getByRole('button',{name:'Preview customer field',exact:true}))
   assert.equal(await page.locator('[role=alert]').count(),1,'Unsafe formula is refused with a native form error')
   assert.match(await form.locator('[name=definition]').inputValue(),/globalThis/)
   await proof('ACCOUNT-004 USAGE-001 invalid formula refusal')
  }finally{await context.close()}
 }
 assert.deepEqual(failures,[],'ACCOUNT-004 USAGE-001 inherited A11Y-001 checks')
 for(const entry of manual)for(const rule of entry.rules)assert.equal(rule.id,'color-contrast','Every other incomplete accessibility check fails; scan resolves contrast with painted-background measurement')
 console.log('ACCOUNT-004 USAGE-001 customer contact/user carrier: all typed native forms, explicit memberships, ten real accounts, calculation explanations/history and A11Y-001 at 1440/390 passed.')
}finally{if(browser)await browser.close();await app.close()}
