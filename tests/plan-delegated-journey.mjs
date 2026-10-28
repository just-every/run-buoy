import assert from 'node:assert/strict'
import {join} from 'node:path'
import {scan,submit} from './a11y-checks.mjs'
export async function planDelegatedJourney(f,browser,evidence){
 const {app,api,accountId,other}=f
 const address=n=>['synthetic-buoy-'+n,'example.test'].join('@')
 const csm=await f.invited(address(1990),'Account CSM'),manager=await f.invited(address(1991),'Team manager'),peer=await f.invited(address(1992),'Outside CSM')
 await api('/accounts/'+accountId+'/owner','PUT',{ownerId:csm.id})
 await api('/accounts/'+other+'/owner','PUT',{ownerId:peer.id})
 await api('/people/'+csm.id+'/manager','PUT',{managerId:manager.id})
 const grant=async(person,roleId,extra={})=>api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId,...extra})
 const ownPlan=(await f.plans()).plans[0]??await f.save()
 const review=await api('/reviews','POST',{accountId,name:'Retained plan business review',kind:'QBR'})
 await grant(csm,'csm');await grant(manager,'cs-manager',{scope:{kind:'team'}});await grant(peer,'csm')
 const request=(person,path,method='GET',body)=>app.request('/api/buoy'+path,{cookie:person.cookie,method,body})
 const read=async(person,path)=>{const r=await request(person,path);assert.equal(r.status,200,await r.clone().text());return r.json()}
 for(const person of [csm,manager]){
  let plan=(await read(person,'/accounts/'+accountId+'/plans')).plans.find(p=>p.id===ownPlan.id)
  const saved=await request(person,'/accounts/'+accountId+'/plans','POST',await f.body({id:plan.id,revision:plan.revision,staffOwnerId:csm.id,name:'Scoped authored business plan'}));assert.equal(saved.status,201,await saved.clone().text())
  const retained=await read(person,'/reviews?id='+review.id);assert.equal(retained.selected.accountId,accountId);assert.ok(retained.selected.document.slides.some(s=>s.title==='Success plans and goal evidence'))
  const edited=await request(person,'/reviews/'+review.id,'PUT',{revision:retained.selected.revision,slides:retained.selected.document.slides.map(s=>({title:s.title,commentary:'Customer evidence reviewed by permitted staff'}))});assert.equal(edited.status,200,await edited.clone().text())
  const denied=await request(person,'/accounts/'+other+'/plans');assert.equal(denied.status,403)
 }
 const before=(await f.plans()).plans.find(p=>p.id===ownPlan.id)
 assert.equal((await request(peer,'/accounts/'+accountId+'/plans')).status,403)
 assert.equal((await request(peer,'/reviews?id='+review.id)).status,404)
 assert.equal((await request(peer,'/reviews/'+review.id,'PUT',{revision:'synthetic-buoy-1993',slides:[]})).status,404)
 const invented=await request(csm,'/accounts/'+accountId+'/plans','POST',await f.body({id:before.id,revision:before.revision,objectives:[{...f.objectives[1],confirmed:true}]}));assert.equal(invented.status,400)
 assert.equal((await f.plans()).plans.find(p=>p.id===before.id).revision,before.revision,'Refused confirmation changes nothing')
 if(browser){
  const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(csm.cookie.split('; ').map(pair=>{const[name,...value]=pair.split('=');return{name,value:value.join('='),url:app.origin}}))
   const page=await context.newPage();await page.goto(app.origin+'/app/accounts/'+accountId+'#success-plans',{waitUntil:'networkidle'})
   assert.match(await page.locator('#success-plans').innerText(),/Scoped authored business plan/)
   await page.locator('#plan-editor-'+before.id+' > summary').click();const form=page.locator('#plan-edit-'+before.id)
   await form.getByLabel('Plan name',{exact:true}).fill('CSM plan edited through the native page');await submit(page,form.getByRole('button',{name:'Save internal plan',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)
   assert.equal((await f.plans()).plans.find(p=>p.id===before.id).name,'CSM plan edited through the native page')
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await scan(page,'PLAN-001 scoped author '+width);await page.screenshot({path:join(evidence,'plan-scoped-author-'+width+'.png'),fullPage:true})}
   await page.goto(app.origin+'/app/reviews?review='+review.id,{waitUntil:'networkidle'});assert.match(await page.locator('main').innerText(),/Retained plan business review/)
   const reviewForm=page.locator('#review-edit');await reviewForm.getByLabel('Slide 1 commentary').fill('CSM retained commentary from native screen');await submit(page,reviewForm.getByRole('button',{name:'Save slide edits'}));assert.equal(await page.locator('[role=alert]').count(),0)
   assert.equal((await read(csm,'/reviews?id='+review.id)).selected.document.slides[0].commentary,'CSM retained commentary from native screen')
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await scan(page,'PLAN-001 scoped retained review '+width);await page.screenshot({path:join(evidence,'plan-scoped-review-'+width+'.png'),fullPage:true})}
  }finally{await context.close()}
 }
 await grant(csm,'csm',{commercial:'none'})
 assert.equal((await request(csm,'/accounts/'+accountId+'/plans')).status,403,'Commercial field withdrawal also fences plan prose')
 assert.equal((await request(csm,'/reviews?id='+review.id)).status,404)
 await api('/people/'+csm.id+'/manager','PUT',{managerId:null})
 assert.equal((await request(manager,'/accounts/'+accountId+'/plans')).status,403,'Team reassignment withdraws plan access')
 assert.equal((await request(manager,'/reviews?id='+review.id)).status,404)
 console.log('PLAN-001 scoped CSM and team authoring, retained review editing, field and account refusal, and staff confirmation separation passed.')
}
