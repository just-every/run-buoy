import assert from 'node:assert/strict'
import {join} from 'node:path'
import {planFixture} from './plan-fixture.mjs'
import {scan,submit,focused,failures} from './a11y-checks.mjs'
export async function planBrowser(browser,evidence){
 for(const width of [1440,390]){
  const f=await planFixture(),{app,api,accountId,champion}=f,context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage(),url=app.origin+'/app/accounts/'+accountId+'#success-plans'
   const proof=async name=>{await scan(page,'PLAN-001 '+name+' '+width);await page.locator('#success-plans').screenshot({path:join(evidence,'plan-'+name+'-'+width+'.png')})}
   await page.goto(url,{waitUntil:'networkidle'});await page.locator('#plan-editor-new > summary').click()
   let form=page.locator('#plan-edit-new');await focused(page,form.getByLabel('Plan name',{exact:true}),'Plan name focus');await form.getByLabel('Plan name',{exact:true}).fill('Native success plan '+width);await form.getByLabel('Customer owner',{exact:true}).selectOption(champion.id)
   await form.getByLabel('Objectives (JSON)',{exact:true}).fill('{invalid');await submit(page,form.getByRole('button',{name:'Save internal plan',exact:true}));assert.equal(await page.locator('[role=alert]').count(),1);assert.equal(await page.locator('#plan-edit-new textarea').inputValue(),'{invalid');await proof('invalid-objectives')
   form=page.locator('#plan-edit-new');await form.getByLabel('Objectives (JSON)',{exact:true}).fill(JSON.stringify(f.objectives));await submit(page,form.getByRole('button',{name:'Save internal plan',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)
   let plan=(await f.plans()).plans[0];assert.equal(plan.name,'Native success plan '+width);assert.match(await page.locator('#success-plans').innerText(),/Metric evidence unavailable/);assert.match(await page.locator('#success-plans').innerText(),/Awaiting customer confirmation/);await proof('recorded-draft')
   await page.locator('#plan-editor-'+plan.id+' > summary').click();form=page.locator('#plan-edit-'+plan.id);await form.getByLabel('Plan name',{exact:true}).fill('Retained stale draft '+width)
   await f.save({id:plan.id,revision:plan.revision,name:'Concurrent saved plan '+width})
   await submit(page,form.getByRole('button',{name:'Save internal plan',exact:true}));assert.equal(await page.locator('[role=alert]').count(),1);assert.equal(await page.locator('#plan-edit-'+plan.id+' input[name=name]').inputValue(),'Retained stale draft '+width);await proof('stale-refusal')
   // Explicit navigation after discarding the stale draft recovers current authority.
   await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}),page.locator('#plan-edit-'+plan.id).getByRole('link',{name:'Discard draft and reload plan',exact:true}).click()]);plan=(await f.plans()).plans[0];await page.locator('#plan-editor-'+plan.id+' > summary').click();form=page.locator('#plan-edit-'+plan.id);await form.getByLabel('Plan name',{exact:true}).fill('Recovered internal plan '+width);await submit(page,form.getByRole('button',{name:'Save internal plan',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0);assert.equal((await f.plans()).plans[0].name,'Recovered internal plan '+width)
   assert.match(await page.locator('#success-plans').innerText(),/Saving a draft sends no invitation/);await proof('recovered-draft')
   // Audit every visible symbolic control on this touched screen. Text controls need no tooltip.
   const symbolic=await page.locator('a[href],button').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).filter(node=>{const copy=node.cloneNode(true);copy.querySelectorAll('.sr-only,[aria-hidden=true]').forEach(el=>el.remove());return !/[A-Za-z0-9]{2}/.test(copy.textContent.trim())}).map(node=>({tag:node.tagName,label:node.getAttribute('aria-label'),text:node.textContent.trim()})))
   assert.equal(symbolic.length,1,'The existing account runway toggle is the sole icon-only control')
   assert.match(symbolic[0].label,/^Close .* on the runway$/)
   const toggle=page.locator('.rw-open'),tooltip=page.getByRole('tooltip')
   await page.getByRole('heading',{name:'Success plans',exact:true}).click();await toggle.hover();await page.waitForTimeout(150);assert.equal(await tooltip.isVisible(),false,'Hover hint waits approximately 300 ms');await page.waitForTimeout(200);assert.equal(await tooltip.isVisible(),true,'Hover hint appears after its delay');assert.equal(await tooltip.innerText(),'Close account')
   await page.mouse.move(0,0);await focused(page,toggle,'Symbolic account control focus');assert.equal(await tooltip.isVisible(),true,'Keyboard focus shows the hint immediately');assert.equal(await tooltip.innerText(),'Close account');await scan(page,'PLAN-001 existing symbolic control tooltip '+width);await page.getByRole('heading',{name:'Success plans',exact:true}).click();await focused(page,toggle,'Tooltip capture focus');await page.screenshot({path:join(evidence,'plan-tooltip-'+width+'.png'),fullPage:true})

  }finally{await context.close();await app.close()}
 }
 assert.deepEqual(failures,[],'Success plan refusal and recovery and recorded states retain inherited accessibility')
 console.log('PLAN-001 native form, invalid JSON retention, current owners, recorded draft, stale refusal and recovery, keyboard, symbolic control audit, axe, contrast and 320 reflow at 1440 and 390 passed.')
}
