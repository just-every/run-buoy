// INAPP-001 native authoring plus shipped snippet on a real authenticated test-product relay.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {startWorker} from './worker.mjs'
import {inappFixture} from './inapp-fixture.mjs'
import {startInappProduct} from './inapp-product.mjs'
import {scan,failures,manual,submit,openForms,focused} from './a11y-checks.mjs'
const app=await startWorker({secure:false}),evidence=process.env.EVIDENCE_DIR
let browser
try{
 if(evidence)await mkdir(evidence,{recursive:true})
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 for(const width of [1440,390]){
  const f=await inappFixture(app,{tag:'browser-'+width,campaigns:false}),{api,source,segment,client,identity,outside,people}=f
  const context=await browser.newContext({viewport:{width,height:1000}}),buyer=await startInappProduct(client,identity)
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage(),proof=async(label,target=page)=>{await scan(target,`INAPP-001 ${label} ${width}`);if(evidence)await target.screenshot({path:join(evidence,`inapp-${label}-${width}.png`),fullPage:true})}
   await page.goto(app.origin+'/app/usage',{waitUntil:'networkidle'});await proof('usage-entry');await page.getByRole('link',{name:'In-app campaigns',exact:true}).click();await proof('entry')
   const show=async id=>{const panel=page.locator('#'+id);if(!await panel.evaluate(e=>e.open))await panel.locator('summary').click()}
   for(const [kind,title]of [['announcement','Reporting available'],['banner','Reporting workspace banner'],['checklist','Reporting launch checklist'],['walkthrough','Explore reporting']]){
    await show('inapp-create');const form=page.locator('#inapp-campaign')
    await form.getByLabel('Product source',{exact:true}).selectOption(source.id);await form.getByLabel('Account segment',{exact:true}).selectOption(segment.id)
    await form.getByLabel('Campaign format',{exact:true}).selectOption(kind);await form.getByLabel('Title (plain text)',{exact:true}).fill(title)
    await form.getByLabel('Body (plain text)',{exact:true}).fill('Your customer reporting workspace is ready. <em>Plain text only</em>')
    await form.getByLabel('Steps (one plain-text step per line)',{exact:true}).fill(['walkthrough','checklist'].includes(kind)?'Open the reporting workspace\nChoose a saved report':'')
    await form.getByLabel('Maximum views per person in the window',{exact:true}).fill('1');await form.getByLabel('Rolling window (UTC hours, 1–8760)',{exact:true}).fill('24');await form.getByLabel('Enable campaign',{exact:true}).check()
    await submit(page,form.getByRole('button',{name:'Create campaign',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)
   }
   await openForms(page);await proof('campaigns')
   // Genuine server refusal and preserved fields, then keyboard recovery.
   let form=page.locator('#inapp-campaign');await form.getByLabel('Product source',{exact:true}).selectOption(source.id);await form.getByLabel('Account segment',{exact:true}).selectOption(segment.id);await form.getByLabel('Campaign format',{exact:true}).selectOption('walkthrough');await form.getByLabel('Title (plain text)',{exact:true}).fill('Refused empty walkthrough');await form.getByLabel('Body (plain text)',{exact:true}).fill('Keep my entered message.');await form.getByLabel('Steps (one plain-text step per line)',{exact:true}).fill('');await submit(page,form.getByRole('button',{name:'Create campaign',exact:true}));assert.equal(await page.locator('[role=alert]').count(),1);assert.equal(await form.getByLabel('Title (plain text)',{exact:true}).inputValue(),'Refused empty walkthrough');await proof('refusal')
   await page.goto(app.origin+'/app/inapp',{waitUntil:'networkidle'});await show('inapp-issue');form=page.locator('#inapp-credential');await form.getByLabel('Product source',{exact:true}).selectOption(source.id);await form.getByLabel('Credential label',{exact:true}).fill('Revocable server '+width);await submit(page,form.getByRole('button',{name:'Issue in-app credential',exact:true}))
   assert.match(await page.getByLabel('In-app credential',{exact:true}).inputValue(),/^buoy_inapp_/)
   // Redact the one-time credential in exported visual evidence only.
   await scan(page,`INAPP-001 issued credential ${width}`);if(evidence)await page.screenshot({path:join(evidence,`inapp-issued-${width}.png`),fullPage:true,mask:[page.getByLabel('In-app credential',{exact:true})]})
   await page.goto(app.origin+'/app/inapp',{waitUntil:'networkidle'});assert.equal(await page.getByLabel('In-app credential',{exact:true}).count(),0)
   await submit(page,page.getByRole('button',{name:'Revoke Revocable server '+width,exact:true}));await proof('revoked')
   const product=await context.newPage();await product.goto(buyer.origin,{waitUntil:'networkidle'});await product.getByRole('button',{name:'Read product messages',exact:true}).click();await product.getByRole('alert').waitFor();assert.match(await product.getByRole('alert').innerText(),/Sign in/);await proof('signed-out',product)
   await context.addCookies([buyer.session(outside)]);await product.getByRole('button',{name:'Read product messages',exact:true}).click();await product.waitForFunction(()=>!document.querySelector('#messages').hasAttribute('aria-busy'));assert.equal(await product.locator('#messages section').count(),0);await proof('outside',product)
   await context.addCookies([buyer.cookie]);await product.getByRole('button',{name:'Read product messages',exact:true}).click();await product.locator('#messages section').nth(3).waitFor();await product.waitForFunction(()=>!document.querySelector('#messages').hasAttribute('aria-busy'))
   assert.equal(await product.locator('#messages section').count(),4);assert.equal(await product.locator('#messages em').count(),0,'INAPP-001 authored HTML renders as text')
   await proof('targeted',product)
   const checklist=product.getByRole('region',{name:'Reporting launch checklist',exact:true}),walkthrough=product.getByRole('region',{name:'Explore reporting',exact:true})
   assert.equal(await checklist.getByRole('button',{name:'Complete',exact:true}).isEnabled(),false);for(const box of await checklist.getByRole('checkbox').all())await box.check();await focused(product,checklist.getByRole('button',{name:'Complete',exact:true}),'INAPP-001 checklist complete keyboard');await product.keyboard.press('Enter');await checklist.waitFor({state:'detached'})
   await focused(product,walkthrough.getByRole('button',{name:'Next',exact:true}),'INAPP-001 walkthrough keyboard next');await product.keyboard.press('Enter');await walkthrough.getByRole('button',{name:'Complete',exact:true}).click();await walkthrough.waitFor({state:'detached'})
   await product.getByRole('region',{name:'Reporting workspace banner',exact:true}).getByRole('button',{name:'Dismiss',exact:true}).click();await product.getByRole('region',{name:'Reporting workspace banner',exact:true}).waitFor({state:'detached'})
   await product.getByRole('region',{name:'Reporting available',exact:true}).getByRole('button',{name:'Complete',exact:true}).click();await product.getByRole('region',{name:'Reporting available',exact:true}).waitFor({state:'detached'})
   await product.getByRole('button',{name:'Read product messages',exact:true}).click();await product.waitForFunction(()=>!document.querySelector('#messages').hasAttribute('aria-busy'));assert.equal(await product.locator('#messages section').count(),0);await proof('capped',product)
   const timeline=await api('/customer-people/'+people[0].id+'/timeline');assert.equal(timeline.events.filter(e=>e.kind==='view').length,4);assert.equal(timeline.events.filter(e=>e.kind==='completion').length,3);assert.equal(timeline.events.filter(e=>e.kind==='dismissal').length,1)
   await page.goto(app.origin+'/app/customer-people?person='+people[0].id,{waitUntil:'networkidle'});assert.match(await page.locator('#customer-usage-timeline').innerText(),/In-app completion/);await proof('timeline')
   if(evidence)await page.locator('#customer-usage-timeline').screenshot({path:join(evidence,`inapp-timeline-panel-${width}.png`)})
   await page.goto(app.origin+'/app/inapp',{waitUntil:'networkidle'});await submit(page,page.getByRole('button',{name:'Disable Reporting workspace banner',exact:true}));await proof('disabled');assert.equal((await api('/inapp')).receipts.filter(r=>r.personId===people[0].id).length,timeline.events.length)
  }catch(error){if(evidence)for(const [i,p]of context.pages().entries())await p.screenshot({path:join(evidence,`inapp-failure-${width}-${i}.png`),fullPage:true,mask:[p.locator('[data-secret]')]});throw error}finally{await context.close();await buyer.close()}
 }
 assert.deepEqual(failures,[],'INAPP-001 A11Y-001 all native and snippet screens/ends at 1440/390 and reflow320')
 for(const entry of manual)for(const rule of entry.rules)assert.equal(rule.id,'color-contrast')
 console.log('INAPP-001 native authoring/refusal/credential lifecycle, all four snippet formats, targeted/outside/signed-out users, cap, timelines and A11Y-001 at 1440/390 passed.')
}finally{if(browser)await browser.close();await app.close()}
