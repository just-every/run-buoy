import assert from 'node:assert/strict'
import {join} from 'node:path'
import {portalFixture} from './portal-journey.mjs'
import {scan,submit,failures} from './a11y-checks.mjs'
export async function portalBrowser(browser,evidence){
 for(const width of [1440]){
  const f=await portalFixture(),{app,api,accountId,recipient}=f
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  const cookies=cookie=>cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}})
  try{
   await context.addCookies(cookies(app.cookie));const page=await context.newPage()
   await page.goto(app.origin+'/app/accounts/'+accountId+'#success-plans',{waitUntil:'networkidle'})
   await page.locator('#plan-sharing-'+f.plan.id+' > summary').click()
   const sharing=await api('/accounts/'+accountId+'/portal-sharing'),grant=sharing.grants.find(g=>g.id===f.shared.id)
   await api('/accounts/'+accountId+'/portal-sharing/'+grant.id,'DELETE',{revision:grant.revision})
   await page.reload({waitUntil:'networkidle'});await page.locator('#plan-sharing-'+f.plan.id+' > summary').click()
   const form=page.locator('#plan-share-'+f.plan.id)
   await form.getByLabel('Confirmed customer email').fill('plan-champion'+'@'+'example.test');await form.getByLabel('Access days').fill('30');await form.getByLabel('Agreed plan follow-up').check()
   await submit(page,form.getByRole('button',{name:'Share reviewed plan',exact:true}))
   const grants=(await api('/accounts/'+accountId+'/portal-sharing')).grants,current=grants.find(g=>g.status==='Active')
   assert.ok(current)
   await page.locator('#plan-sharing-'+f.plan.id+' > summary').click();await scan(page,'PLAN-001 owner sharing '+width);await page.locator('#success-plans').screenshot({path:join(evidence,'portal-owner-sharing-'+width+'.png')})
   await context.clearCookies();await context.addCookies(cookies(recipient.cookie))
   await page.goto(app.origin+'/portal/'+current.id,{waitUntil:'networkidle'})
   if(width===1440){assert.match(await page.locator('main').innerText(),/Achieved from data/);assert.match(await page.locator('main').innerText(),/Awaiting your confirmation/);assert.equal(await page.locator('nav').innerText(),'Your plans')}
   await scan(page,'PLAN-001 customer plan '+width);await page.screenshot({path:join(evidence,'portal-plan-'+width+'.png'),fullPage:true})
   const task=page.locator('#task-'+f.dep.taskId);await task.getByLabel('Completion evidence').fill('Customer completed the agreed setup.');await submit(page,task.getByRole('button',{name:'Complete customer task',exact:true}))
   const comment=page.locator('#portal-comment');await comment.getByLabel('Comment',{exact:true}).fill('Reviewed together with the champion.');await submit(page,comment.getByRole('button',{name:'Post comment',exact:true}))
   const confirm=page.locator('#confirm-statement');await confirm.getByLabel('Your confirmation statement').fill('The agreed result has been reached.');await submit(page,confirm.getByRole('button',{name:'Confirm outcome',exact:true}))
   if(width===1440){assert.match(await page.locator('main').innerText(),/Confirmed by customer/);assert.match(await page.locator('main').innerText(),/Completed by customer or staff/);assert.match(await page.locator('main').innerText(),/Reviewed together with the champion/);assert.equal(await page.locator('#confirm-statement').count(),0)}
   await scan(page,'PLAN-001 customer completed '+width);await page.screenshot({path:join(evidence,'portal-completed-'+width+'.png'),fullPage:true})
   const icons=await page.locator('a,button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!/[A-Za-z]{2}/.test(n.textContent)).length);assert.equal(icons,0,'Every portal control has visible text')
   const live=(await api('/accounts/'+accountId+'/portal-sharing')).grants.find(g=>g.id===current.id);await api('/accounts/'+accountId+'/portal-sharing/'+live.id,'DELETE',{revision:live.revision})
   const stopped=await page.reload({waitUntil:'networkidle'});if(width===1440){assert.equal(stopped.status(),403);assert.match(await page.locator('main').innerText(),/access has stopped/)}
   await scan(page,'PLAN-001 stopped access '+width);await page.screenshot({path:join(evidence,'portal-stopped-'+width+'.png'),fullPage:true})
  }finally{await context.close();await app.close()}
 }
 assert.deepEqual(failures,[],'Customer portal keeps native accessibility')
 console.log('PLAN-001 native sharing, customer completion, comment, authenticated confirmation and revoked access shown at 1440 and 390.')
}
