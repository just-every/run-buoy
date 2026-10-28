import assert from 'node:assert/strict'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {mkdir} from 'node:fs/promises'
import {portalFixture} from './portal-journey.mjs'
import {scan,submit,failures} from './a11y-checks.mjs'
export async function portalBrowser(browser,evidence){
 for(const width of [1440,390]){
  const f=await portalFixture({onboarding:false,trace:step=>console.log('Portal browser '+width+': '+step)}),{app,api,accountId,recipient}=f
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  const capture=async(page,name,target=page)=>{await scan(page,'PORTAL-001 '+name+' '+width);await target.screenshot({path:join(evidence,'portal-'+name+'-'+width+'.png'),...(target===page?{fullPage:true}:{})})}
  const cookies=cookie=>cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}})
  try{
   await context.addCookies(cookies(app.cookie));const page=await context.newPage()
   await page.goto(app.origin+'/app/accounts/'+accountId+'#success-plans',{waitUntil:'networkidle'})
   console.log('Portal browser '+width+': native project form')
   await page.locator('#onboarding-project-'+f.plan.id+' > summary').click()
   const projectForm=page.locator('#onboarding-start-'+f.plan.id)
   await projectForm.getByLabel('Project name').fill('Champion rollout');await projectForm.getByLabel('Agreed plan follow-up').check()
   await scan(page,'PORTAL-001 native onboarding project '+width);await projectForm.screenshot({path:join(evidence,'portal-onboarding-'+width+'.png')})
   await submit(page,projectForm.getByRole('button',{name:'Start customer onboarding',exact:true}))
   assert.equal((await f.plans()).onboardingProjects[0].name,'Champion rollout')
   await page.locator('#plan-sharing-'+f.plan.id+' > summary').click()
   const sharing=await api('/accounts/'+accountId+'/portal-sharing'),grant=sharing.grants.find(g=>g.id===f.shared.id)
   await api('/accounts/'+accountId+'/portal-sharing/'+grant.id,'DELETE',{revision:grant.revision})
   await page.reload({waitUntil:'networkidle'});await page.locator('#plan-sharing-'+f.plan.id+' > summary').click()
   const form=page.locator('#plan-share-'+f.plan.id)
   await form.getByLabel('Confirmed customer email').fill('plan-champion'+'@'+'example.test');await form.getByLabel('Access days').fill('30');await form.getByLabel('Agreed plan follow-up').check()
   await submit(page,form.getByRole('button',{name:'Share reviewed plan',exact:true}))
   const grants=(await api('/accounts/'+accountId+'/portal-sharing')).grants,current=grants.find(g=>g.status==='Active')
   assert.ok(current)
   await page.locator('#plan-sharing-'+f.plan.id+' > summary').click();await capture(page,'owner-sharing',page.locator('#success-plans'))
   await context.clearCookies();await context.addCookies(cookies(recipient.cookie))
   await page.goto(app.origin+'/portal',{waitUntil:'networkidle'})
   assert.equal(await page.getByRole('link',{name:'Customer success draft',exact:true}).count(),1)
   await scan(page,'PORTAL-001 customer home '+width);await page.screenshot({path:join(evidence,'portal-home-'+width+'.png'),fullPage:true})
   await page.goto(app.origin+'/portal/'+current.id,{waitUntil:'networkidle'})
   {assert.match(await page.locator('main').innerText(),/Achieved from data/);assert.match(await page.locator('main').innerText(),/Awaiting your confirmation/);assert.equal(await page.locator('nav').innerText(),'Your plans')}
   await scan(page,'PLAN-001 customer plan '+width);await page.screenshot({path:join(evidence,'portal-plan-'+width+'.png'),fullPage:true})
   const upload=page.locator('#portal-upload')
   await upload.getByLabel('File for the account owner').setInputFiles({name:'rollout-checklist.txt',mimeType:'text/plain',buffer:Buffer.from('The champion completed the rollout checklist.')})
   await submit(page,upload.getByRole('button',{name:'Upload file',exact:true}))
   const fileLink=page.getByRole('link',{name:'rollout-checklist.txt',exact:true})
   assert.equal(await fileLink.count(),1)
   const download=await Promise.all([page.waitForEvent('download'),fileLink.click()]);assert.equal(download[0].suggestedFilename(),'rollout-checklist.txt')
   await scan(page,'PORTAL-001 customer file '+width);await page.screenshot({path:join(evidence,'portal-file-'+width+'.png'),fullPage:true})
   const task=page.locator('#task-'+f.dep.taskId);await task.getByLabel('Completion evidence').fill('Customer completed the agreed setup.');await submit(page,task.getByRole('button',{name:'Complete customer task',exact:true}))
   const comment=page.locator('#portal-comment');await comment.getByLabel('Comment',{exact:true}).fill('Reviewed together with the champion.');await submit(page,comment.getByRole('button',{name:'Post comment',exact:true}))
   const confirm=page.locator('#confirm-statement');await confirm.getByLabel('Your confirmation statement').fill('The agreed result has been reached.');await submit(page,confirm.getByRole('button',{name:'Confirm outcome',exact:true}))
   {assert.match(await page.locator('main').innerText(),/Confirmed by customer/);assert.match(await page.locator('main').innerText(),/Completed by customer or staff/);assert.match(await page.locator('main').innerText(),/Reviewed together with the champion/);assert.equal(await page.locator('#confirm-statement').count(),0)}
   await scan(page,'PLAN-001 customer completed '+width);await page.screenshot({path:join(evidence,'portal-completed-'+width+'.png'),fullPage:true})
   const records=(await api('/accounts/'+accountId+'/activity?source=customer-portal')).records
   assert.ok(records.some(record=>record.kind==='customer-comment'&&record.reference==='Reviewed together with the champion.'))
   assert.ok(records.some(record=>record.kind==='customer-task-completed'))
   for(const path of ['/portal/'+f.otherShared.id,'/app/accounts/'+accountId+'?activityKind=success-plan']){
    const denied=await page.goto(app.origin+path,{waitUntil:'networkidle'});assert.equal(denied.status(),403)
    assert.doesNotMatch(await page.locator('main').innerText(),/Other private plan|Confirmed recurring contract|synthetic-buoy-1901/)
   }
   await context.clearCookies();await context.addCookies(cookies(app.cookie))
   await page.goto(app.origin+'/app/accounts/'+accountId+'#record-activity',{waitUntil:'networkidle'})
   assert.match(await page.locator('main').innerText(),/Reviewed together with the champion/)
   assert.match(await page.locator('#record-activity').innerText(),/Reviewed together with the champion/)
   await scan(page,'PORTAL-001 staff timeline '+width);await page.locator('#record-activity').screenshot({path:join(evidence,'portal-timeline-'+width+'.png')})
   await context.clearCookies();await context.addCookies(cookies(recipient.cookie))
   await page.goto(app.origin+'/portal/'+current.id,{waitUntil:'networkidle'})
   const icons=await page.locator('a,button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!/[A-Za-z]{2}/.test(n.textContent)).length);assert.equal(icons,0,'Every portal control has visible text')
   const live=(await api('/accounts/'+accountId+'/portal-sharing')).grants.find(g=>g.id===current.id);await api('/accounts/'+accountId+'/portal-sharing/'+live.id,'DELETE',{revision:live.revision})
   const stopped=await page.reload({waitUntil:'networkidle'});{assert.equal(stopped.status(),403);assert.match(await page.locator('main').innerText(),/access has stopped/)}
   await scan(page,'PLAN-001 stopped access '+width);await page.screenshot({path:join(evidence,'portal-stopped-'+width+'.png'),fullPage:true})
   const editable=await api('/accounts/'+accountId+'/portal-sharing','POST',f.shareBody())
   await page.goto(app.origin+'/portal/'+editable.id,{waitUntil:'networkidle'})
   await page.locator('#portal-editor > summary').click();const edit=page.locator('#portal-edit')
   await edit.getByLabel('Plan name',{exact:true}).fill('Champion updated rollout')
   await edit.locator('input[name="title:statement"]').fill('Confirm the revised business outcome')
   await edit.locator('input[name="due:statement"]').fill('2027-03-02')
   await scan(page,'PORTAL-001 customer edit draft '+width);await page.screenshot({path:join(evidence,'portal-edit-draft-'+width+'.png'),fullPage:true})
   await submit(page,edit.getByRole('button',{name:'Save plan changes',exact:true}))
   assert.equal(new URL(page.url()).pathname,'/portal');assert.equal(await page.getByRole('status').count(),1)
   const changed=(await f.plans()).plans[0];assert.equal(changed.name,'Champion updated rollout');assert.equal(changed.objectives[1].title,'Confirm the revised business outcome');assert.equal(changed.objectives[1].status,'awaiting-customer-confirmation')
   assert.equal((await app.request('/api/buoy/portal/'+editable.id,{cookie:recipient.cookie})).status,403)
   await scan(page,'PORTAL-001 customer edit saved '+width);await page.screenshot({path:join(evidence,'portal-edit-saved-'+width+'.png'),fullPage:true})
   const republished=await api('/accounts/'+accountId+'/portal-sharing','POST',{...f.shareBody(),planRevision:changed.revision})
   await page.goto(app.origin+'/portal/'+republished.id,{waitUntil:'networkidle'})
   assert.match(await page.locator('main').innerText(),/Champion updated rollout/);assert.equal(await page.getByRole('link',{name:'rollout-checklist.txt',exact:true}).count(),0)
   await scan(page,'PORTAL-001 reviewed customer edit '+width);await page.screenshot({path:join(evidence,'portal-edit-reviewed-'+width+'.png'),fullPage:true})
  }catch(error){console.error('Portal browser '+width+' failed: '+error.message);throw error}
  finally{await context.close();await app.close()}
 }
 assert.deepEqual(failures,[],'Customer portal keeps native accessibility')
 console.log('PORTAL-001 native sharing, home, customer completion, comment, authenticated confirmation, staff timeline, refused private reads and revoked access at 1440 and 390.')
}

// A file entry point keeps the native database proxy thread in its own CommonJS mode.
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const {chromium}=await import('@playwright/test')
 const evidence=resolve(process.env.EVIDENCE_DIR??'../evidence/portal');await mkdir(evidence,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{await portalBrowser(browser,evidence)}finally{await browser.close()}
}
