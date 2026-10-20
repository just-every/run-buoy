// ACCOUNT-004 and inherited A11Y-001: real native forms and end states.
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {startWorker} from './worker.mjs'
import {scan,failures,manual,openForms,submit} from './a11y-checks.mjs'
const app=await startWorker(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{
 const call=async(path,method='GET',body)=>{const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()}
 for(let i=0;i<10;i++)await call('/accounts','POST',{id:'field-ui-'+i,name:['Harbour Software','Cedar Logistics','Coastline Analytics','Juniper Health','Northstar Labs','Brightwater Group','Summit Design','Riverbank Systems','Golden Gate Studio','Maple Services'][i],renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Customer-confirmed contract; renewal clause 4',billing:null,support:null})
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage();await page.goto(app.origin+'/app/fields',{waitUntil:'networkidle'})
   const create=async(key,label,type,options='',formula='')=>{
    const panel=page.locator('#create-field');if(!await panel.evaluate(e=>e.open))await panel.locator('summary').click()
    const form=page.locator('#field-definition')
    await form.getByLabel('Field key',{exact:true}).fill(key);await form.getByLabel('Field label',{exact:true}).fill(label);await form.getByLabel('Field type',{exact:true}).selectOption(type)
    await form.getByLabel('Options (one per line; picklist and multi-select)',{exact:true}).fill(options)
    await form.getByLabel('Formula (formula fields only)',{exact:true}).fill(formula)
    await submit(page,form.getByRole('button',{name:'Create field',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)
   }
   const suffix=String(width)
   await create('used_'+suffix,'Seats used '+width,'number');await create('purchased_'+suffix,'Seats purchased '+width,'number')
   await create('tier_'+suffix,'Contract package '+width,'picklist','Starter\nEnterprise')
   await create('contract_'+suffix,'Contract value '+width,'currency')
   const values={['used_'+suffix]:24,['purchased_'+suffix]:40,['tier_'+suffix]:'Enterprise',['contract_'+suffix]:{currency:'USD',amountMinor:1800000}}
   const edit=page.locator('#edit-field-values-field-ui-0');await edit.locator('summary').click()
   let form=page.locator('#field-values-field-ui-0')
   // Preserve values from the other viewport's actual prior form round.
   const merged={...JSON.parse(await form.locator('[name=values]').inputValue()),...values}
   await form.locator('[name=values]').fill(JSON.stringify(merged));await form.getByLabel('Source reference',{exact:true}).fill('Customer-approved license schedule 2026-10')
   await submit(page,form.getByRole('button',{name:'Save field values',exact:true}))
   const definition={key:'ratio_'+suffix,label:'License utilization '+width,type:'formula',formula:`custom.used_${suffix} / custom.purchased_${suffix}`}
   form=page.locator('#field-preview');await form.getByLabel('Field definition (JSON object)',{exact:true}).fill(JSON.stringify(definition));await submit(page,form.getByRole('button',{name:'Preview field',exact:true}))
   const preview=page.locator('#field-preview-result');assert.equal(await preview.locator('li.record').count(),10)
   assert.match(await preview.innerText(),/0\.6/);assert.match(await preview.innerText(),/Nothing has been saved/)
   assert.ok(!(await call('/fields')).definitions.some(d=>d.key===definition.key))
   await scan(page,`ACCOUNT-004 preview ${width}`)
   await create(definition.key,definition.label,'formula','',definition.formula)
   let current=(await call('/fields')).accounts.find(a=>a.id==='field-ui-0');assert.equal(current.values[definition.key],.6)
   await page.locator('#edit-field-values-field-ui-0 > summary').click();form=page.locator('#field-values-field-ui-0')
   const all=JSON.parse(await form.locator('[name=values]').inputValue());all['used_'+suffix]=32
   await form.locator('[name=values]').fill(JSON.stringify(all));await form.getByLabel('Source reference',{exact:true}).fill('Usage export confirmed 2026-10-20')
   await submit(page,form.getByRole('button',{name:'Save field values',exact:true}))
   current=(await call('/fields')).accounts.find(a=>a.id==='field-ui-0');assert.equal(current.values[definition.key],.8)
   const history=(await call('/fields')).history.filter(h=>h.accountId===current.id&&h.key===definition.key)
   assert.ok(history.some(h=>h.oldValue===.6&&h.newValue===.8&&h.source==='Usage export confirmed 2026-10-20'))
   await openForms(page);await scan(page,`ACCOUNT-004 saved calculation history ${width}`)
   assert.match(await page.locator('#work').innerText(),/0\.8/)
  }finally{await context.close()}
 }
 assert.deepEqual(failures,[],'ACCOUNT-004 inherited A11Y-001 checks');assert.deepEqual(manual,[],'ACCOUNT-004 no unresolved accessibility checks')
 console.log('ACCOUNT-004 native typed-field/preview/calculation/history forms, ten-account end states and A11Y-001 passed at 1440/390.')
}finally{await browser.close();await app.close()}
