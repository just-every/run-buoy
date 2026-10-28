import assert from 'node:assert/strict'
import {join} from 'node:path'
import {portalFixture} from './portal-journey.mjs'
import {scan,submit,focused,type,failures} from './a11y-checks.mjs'
import {show} from './native-keyboard.mjs'
export async function portalBrowser(browser,evidence){
 for(const width of [1440,390]){
  const f=await portalFixture(),{app,api,accountId,recipient}=f
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  const capture=async(page,name,target=page)=>{await scan(page,'PLAN-001 '+name+' '+width);await target.screenshot({path:join(evidence,'portal-'+name+'-'+width+'.png'),...(target===page?{fullPage:true}:{})})}
  const cookies=cookie=>cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}})
  try{
   await context.addCookies(cookies(app.cookie));const page=await context.newPage()
   await page.goto(app.origin+'/app/accounts/'+accountId+'#success-plans',{waitUntil:'networkidle'})
   await show(page,page.locator('#plan-sharing-'+f.plan.id))
   const sharing=await api('/accounts/'+accountId+'/portal-sharing'),grant=sharing.grants.find(g=>g.id===f.shared.id)
   await api('/accounts/'+accountId+'/portal-sharing/'+grant.id,'DELETE',{revision:grant.revision})
   await page.reload({waitUntil:'networkidle'});await show(page,page.locator('#plan-sharing-'+f.plan.id))
   const form=page.locator('#plan-share-'+f.plan.id)
   await type(page,form.getByLabel('Confirmed customer email'),'plan-champion'+'@'+'example.test');await type(page,form.getByLabel('Access days'),'30');const checkbox=form.getByLabel('Agreed plan follow-up');await focused(page,checkbox,'Shared task checkbox keyboard focus');await page.keyboard.press('Space');assert.equal(await checkbox.isChecked(),true,'Keyboard includes the reviewed customer task')
   await submit(page,form.getByRole('button',{name:'Share reviewed plan',exact:true}))
   const grants=(await api('/accounts/'+accountId+'/portal-sharing')).grants,current=grants.find(g=>g.status==='Active')
   assert.ok(current)
   await show(page,page.locator('#plan-sharing-'+f.plan.id));await capture(page,'owner-sharing',page.locator('#success-plans'))
   await context.clearCookies();await context.addCookies(cookies(recipient.cookie))
   await page.goto(app.origin+'/portal/'+current.id,{waitUntil:'networkidle'})
   {assert.match(await page.locator('main').innerText(),/Achieved from data/);assert.match(await page.locator('main').innerText(),/Awaiting your confirmation/);assert.equal(await page.locator('nav').innerText(),'Your plans')}
   await capture(page,'plan')
   await submit(page,page.getByRole('link',{name:'Your plans',exact:true}))
   assert.equal(new URL(page.url()).pathname,'/portal')
   const planLinks=page.locator('main a[href^="/portal/"]')
   assert.deepEqual(await planLinks.evaluateAll(links=>links.map(link=>link.getAttribute('href'))),['/portal/'+current.id],'Portal home exposes only this recipient’s active plan')
   await capture(page,'home')
   await submit(page,planLinks)
   assert.equal(new URL(page.url()).pathname,'/portal/'+current.id)
   // Whitespace passes native required validation but is refused by the real action.
   const invalidComment=page.locator('#portal-comment')
   await type(page,invalidComment.getByLabel('Comment',{exact:true}),'   ')
   await submit(page,invalidComment.getByRole('button',{name:'Post comment',exact:true}))
   assert.equal(await page.locator('[role=alert]').count(),1)
   assert.equal(await page.locator('#portal-comment').getByLabel('Comment',{exact:true}).inputValue(),'   ','A refused comment retains the keyboard input')
   const refused=await app.request('/api/buoy/portal/'+current.id,{cookie:recipient.cookie})
   assert.equal(refused.status,200)
   const unchanged=await refused.json()
   assert.equal(unchanged.comments.length,0,'Invalid input creates no customer comment')
   assert.equal(unchanged.tasks.find(t=>t.id===f.dep.taskId).completedAt,null,'Invalid comment does not complete a customer task')
   assert.equal(unchanged.objectives.find(o=>o.id==='statement').status,'awaiting-customer-confirmation')
   await capture(page,'comment-refusal')
   await type(page,page.locator('#portal-comment').getByLabel('Comment',{exact:true}),'Reviewed together with the champion.')
   await submit(page,page.locator('#portal-comment').getByRole('button',{name:'Post comment',exact:true}))
   assert.equal(await page.locator('[role=alert]').count(),0,'Keyboard correction recovers from the refusal')
   const recovered=await app.request('/api/buoy/portal/'+current.id,{cookie:recipient.cookie})
   assert.equal(recovered.status,200)
   assert.deepEqual((await recovered.json()).comments.map(c=>c.body),['Reviewed together with the champion.'],'Only the corrected comment is recorded')
   const task=page.locator('#task-'+f.dep.taskId);await type(page,task.getByLabel('Completion evidence'),'Customer completed the agreed setup.');await submit(page,task.getByRole('button',{name:'Complete customer task',exact:true}))
   const confirm=page.locator('#confirm-statement');await type(page,confirm.getByLabel('Your confirmation statement'),'The agreed result has been reached.');await submit(page,confirm.getByRole('button',{name:'Confirm outcome',exact:true}))
   {assert.match(await page.locator('main').innerText(),/Confirmed by customer/);assert.match(await page.locator('main').innerText(),/Completed by customer or staff/);assert.match(await page.locator('main').innerText(),/Reviewed together with the champion/);assert.equal(await page.locator('#confirm-statement').count(),0)}
   await capture(page,'completed')
   const icons=await page.locator('a,button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!/[A-Za-z]{2}/.test(n.textContent)).length);assert.equal(icons,0,'Every portal control has visible text')
   await context.clearCookies();await context.addCookies(cookies(app.cookie))
   const ownerPage=await context.newPage()
   try{
    await ownerPage.goto(app.origin+'/app/accounts/'+accountId+'#success-plans',{waitUntil:'networkidle'})
    await show(ownerPage,ownerPage.locator('#plan-sharing-'+f.plan.id))
    await submit(ownerPage,ownerPage.locator('#plan-revoke-'+current.id).getByRole('button',{name:'Revoke customer access',exact:true}))
    assert.equal((await api('/accounts/'+accountId+'/portal-sharing')).grants.find(g=>g.id===current.id).status,'Revoked','Keyboard revocation withdraws the active grant')
   }finally{await ownerPage.close()}
   await context.clearCookies();await context.addCookies(cookies(recipient.cookie))
   const stopped=await page.reload({waitUntil:'networkidle'});{assert.equal(stopped.status(),403);assert.match(await page.locator('main').innerText(),/access has stopped/)}
   await capture(page,'stopped')
  }finally{await context.close();await app.close()}
 }
 assert.deepEqual(failures,[],'Customer portal keeps native accessibility')
 console.log('PLAN-001 keyboard sharing, portal home navigation, invalid comment recovery, customer completion, authenticated confirmation and keyboard-revoked access shown at 1440 and 390.')
}
