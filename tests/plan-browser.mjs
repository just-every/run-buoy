import assert from 'node:assert/strict'
import {join} from 'node:path'
import {planFixture,planDependencies,planRenewal} from './plan-fixture.mjs'
import {scan,submit,focused,failures} from './a11y-checks.mjs'
export async function planBrowser(browser,evidence){
 for(const width of [1440]){
  const f=await planFixture(),{app,api,accountId,champion}=f,context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   const dep=await planDependencies(f)
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage(),url=app.origin+'/app/accounts/'+accountId+'#success-plans'
   const proof=async name=>{await scan(page,'PLAN-001 '+name+' '+width);await page.locator('#success-plans').screenshot({path:join(evidence,'plan-'+name+'-'+width+'.png')})}
   await page.goto(url,{waitUntil:'networkidle'});await page.locator('#plan-editor-new > summary').click()
   let form=page.locator('#plan-edit-new');await focused(page,form.getByLabel('Plan name',{exact:true}),'Plan name focus');await form.getByLabel('Plan name',{exact:true}).fill('Native success plan '+width);await form.getByLabel('Customer owner',{exact:true}).selectOption(champion.id)
   await form.getByLabel('Objectives (JSON)',{exact:true}).fill('{invalid');await submit(page,form.getByRole('button',{name:'Save internal plan',exact:true}));assert.equal(await page.locator('[role=alert]').count(),1);assert.equal(await page.locator('#plan-edit-new textarea').inputValue(),'{invalid');await proof('invalid-objectives')
   form=page.locator('#plan-edit-new');await form.getByLabel('Objectives (JSON)',{exact:true}).fill(JSON.stringify(f.objectives));await form.getByLabel('Milestone title',{exact:true}).fill('Native health milestone');await form.getByLabel('Milestone objective',{exact:true}).selectOption('usage');await form.getByLabel('Outcome report',{exact:true}).selectOption(dep.outcomeId);await form.getByLabel('Agreed plan follow-up',{exact:true}).first().check();await submit(page,form.getByRole('button',{name:'Save internal plan',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)
   let plan=(await f.plans()).plans[0];assert.equal(plan.name,'Native success plan '+width);if(width===1440){assert.deepEqual(plan.taskIds,[dep.taskId]);assert.equal(plan.milestones[0].outcomeId,dep.outcomeId);assert.match(await page.locator('#success-plans').innerText(),/Native health milestone/);assert.match(await page.locator('#success-plans').innerText(),/Enrolled rate 0%/)};assert.match(await page.locator('#success-plans').innerText(),/Metric evidence unavailable/);assert.match(await page.locator('#success-plans').innerText(),/Awaiting customer confirmation/);await proof('recorded-draft')
   // The API accepts arbitrary nonempty milestone IDs, including the former editor placeholder.
   await f.save({id:plan.id,revision:plan.revision,taskIds:plan.taskIds,milestones:plan.milestones.map(m=>({...m,id:'new'}))})
   await page.goto(url,{waitUntil:'networkidle'});plan=(await f.plans()).plans[0]
   if(width===1440)assert.deepEqual(plan.milestones,[{id:'new',title:'Native health milestone',objectiveId:'usage',outcomeId:dep.outcomeId}],'The public API retained the accepted milestone before the unrelated edit')
   await page.locator('#plan-editor-'+plan.id+' > summary').click();form=page.locator('#plan-edit-'+plan.id);await form.getByLabel('Plan name',{exact:true}).fill('Retained stale draft '+width)
   await f.save({id:plan.id,revision:plan.revision,name:'Concurrent saved plan '+width,taskIds:plan.taskIds,milestones:plan.milestones})
   await submit(page,form.getByRole('button',{name:'Save internal plan',exact:true}));assert.equal(await page.locator('[role=alert]').count(),1);assert.equal(await page.locator('#plan-edit-'+plan.id+' input[name=name]').inputValue(),'Retained stale draft '+width);await proof('stale-refusal')
   // Explicit navigation after discarding the stale draft recovers current authority.
   await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}),page.locator('#plan-edit-'+plan.id).getByRole('link',{name:'Discard draft and reload plan',exact:true}).click()]);plan=(await f.plans()).plans[0];await page.locator('#plan-editor-'+plan.id+' > summary').click();form=page.locator('#plan-edit-'+plan.id);await form.getByLabel('Plan name',{exact:true}).fill('Recovered internal plan '+width);await submit(page,form.getByRole('button',{name:'Save internal plan',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0);const recovered=(await f.plans()).plans[0];assert.equal(recovered.name,'Recovered internal plan '+width)
   if(width===1440){assert.deepEqual(recovered.milestones,plan.milestones,'Saving an unrelated field preserves every accepted milestone, including ID new');assert.deepEqual(recovered.taskIds,plan.taskIds)}
   assert.match(await page.locator('#success-plans').innerText(),/Saving a draft sends no invitation/);await proof('recovered-draft')
   await page.locator('#plan-milestone-start-'+plan.id+' > summary').click()
   const observe=page.locator('#plan-milestone-'+plan.id);await observe.getByLabel('Milestone report name').fill('Native confirmed-outcome window');await observe.getByLabel('Objective to observe').selectOption('statement');await observe.getByLabel('Comparison segment').selectOption(dep.segment.id);await observe.getByLabel('UTC window days').fill('2');await submit(page,observe.getByRole('button',{name:'Start objective observation',exact:true}))
   const report=(await api('/outcomes')).reports.find(r=>r.name==='Native confirmed-outcome window');if(width===1440){assert.equal(report.kind,'plan-objective');assert.equal(report.objectiveId,'statement');assert.equal(report.windowDays,2);assert.deepEqual(report.enrolled.map(a=>a.accountId),[accountId])}
   const review=await api('/reviews','POST',{accountId,name:'Native plan review',kind:'QBR'})
   await page.goto(app.origin+'/app/reviews?review='+review.id,{waitUntil:'networkidle'})
   if(width===1440){assert.match(await page.locator('main').innerText(),/Native health milestone/);assert.match(await page.locator('main').innerText(),/awaiting-customer-confirmation/)}
   await scan(page,'PLAN-001 review inclusion '+width);await page.screenshot({path:join(evidence,'plan-review-'+width+'.png'),fullPage:true})
   const renewal=await planRenewal(f);await page.goto(app.origin+'/app/renewals?renewal='+renewal.id,{waitUntil:'networkidle'})
   if(width===1440){const text=await page.locator('#renewal-record').innerText();assert.ok(text.includes('Success goal readiness: evidence-unavailable'));assert.ok(text.includes('0 of 2 achieved'));assert.ok(text.includes('1 awaiting customer confirmation'))}
   await scan(page,'PLAN-001 renewal readiness '+width);await page.screenshot({path:join(evidence,'plan-renewal-'+width+'.png'),fullPage:true})

  }finally{await context.close();await app.close()}
 }
 assert.deepEqual(failures,[],'Success plan refusal and recovery and recorded states retain inherited accessibility')
 console.log('PLAN-001 native form, invalid JSON retention, current owners, recorded draft, stale refusal and recovery, keyboard, axe, contrast and reflow at 1440 passed.')
}
