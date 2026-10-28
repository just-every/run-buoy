// TEAM-001: owner uses the same public forms as a CS lead, at desktop and phone widths.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { startWorker } from './worker.mjs'
import {teamPlan,teamPlanRows,assertPlanHandover} from './team-plan-fixture.mjs'
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{
 if(process.env.BUOY_SCREENSHOTS)await mkdir(process.env.BUOY_SCREENSHOTS,{recursive:true})
 for(const width of [1440,390]){
  const app=await startWorker()
  let context
  try{
   const call=(path,method='GET',body)=>app.request('/api/buoy'+path,{cookie:app.cookie,method,body})
   const json=async(r,status=200)=>{assert.equal(r.status,status,await r.clone().text());return r.json()}
   for(const [displayName,email] of [['Maya Chen','maya@example.test'],['Owen Reed','owen@example.test']]){
    await json(await app.request('/auth/invite',{cookie:app.cookie,method:'POST',body:{email,displayName,role:'member'}}),202);await app.signIn(email)
   }
   const operators=await json(await app.request('/auth/operators',{cookie:app.cookie})), maya=operators.find(p=>p.displayName==='Maya Chen').id, owen=operators.find(p=>p.displayName==='Owen Reed').id
   const today=new Date().toISOString().slice(0,10)
   for(const [id,name] of [['northstar','Northstar Analytics'],['cedar','Cedar Logistics'],['summit','Summit Health Systems']])await json(await call('/accounts','POST',{id,name,renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Signed annual order form, section 4',billing:null,support:{observedAt:today,reference:'Support review SR-42',openTickets:3,urgentTickets:1}}),201)
   context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true})
   await context.addCookies(app.cookie.split('; ').map(pair=>{const [name,...value]=pair.split('=');return {name,value:value.join('='),url:app.origin}}))
   const page=await context.newPage();await page.goto(app.origin+'/app');await page.getByRole('link',{name:'Team',exact:true}).click()
   assert.equal(new URL(page.url()).pathname,'/app/team')
   const submit=async(id,button)=>{await Promise.all([page.waitForURL(/success=/),page.locator('#'+id).getByRole('button',{name:button,exact:true}).click()]);await page.goto(app.origin+'/app/team')}
   for(const person of [maya,owen]){
    await page.locator('#team-capacity select[name=personId]').selectOption(person);await page.locator('#team-capacity input[name=capacity]').fill('4');await submit('team-capacity','Save capacity')
   }
   await page.locator('#team-create input[name=name]').fill('Commercial CS');await page.locator('#team-create input[name=pod]').fill('Mid-market');await submit('team-create','Create team')
   const teamId=(await json(await call('/team'))).teams[0].id
   for(const person of [maya,owen]){
    await page.locator('#team-member select[name=teamId]').selectOption(teamId);await page.locator('#team-member select[name=personId]').selectOption(person);await submit('team-member','Save membership')
   }
   await page.locator('#team-rule input[name=name]').fill('Commercial round-robin');await page.locator('#team-rule select[name=teamId]').selectOption(teamId);await submit('team-rule','Add rule')
   await Promise.all([page.waitForLoadState('networkidle'),page.locator('#team-preview-rules button').click()])
   assert.ok(await page.getByRole('heading',{name:'Review assignment'}).isVisible())
   assert.ok(await page.getByText('3 accounts, 0 open tasks will move.',{exact:true}).isVisible())
   await submit('team-apply','Apply reviewed assignment')
   let state=await json(await call('/state'));assert.equal(state.accounts.filter(a=>a.ownerId).length,3)
   const fromId=[maya,owen].find(id=>state.accounts.filter(a=>a.ownerId===id).length===2),toId=[maya,owen].find(id=>id!==fromId),first=state.accounts.find(a=>a.ownerId===fromId)
   const task=await json(await call('/proposals','POST',{accountId:first.id,kind:'playbook',payload:{title:'Review adoption goals with the champion',dueDate:today}}),201);await json(await call(`/proposals/${task.id}/approve`,'POST',{}))
   const drafts=[]
   for(const account of state.accounts.filter(a=>a.ownerId===fromId))drafts.push(await teamPlan({call,json},account.id,fromId,{name:account.name+' rollout plan'}))
   await teamPlan({call,json},first.id,toId,{name:'Executive adoption plan',customerOwnerId:drafts.find(p=>p.accountId===first.id).row.customerOwnerId})
   const planAccounts=drafts.map(p=>p.accountId),beforePlans=await teamPlanRows({call,json},planAccounts)
   await page.goto(app.origin+'/app/team')
   await page.locator('#team-preview-handover select[name=fromId]').selectOption(fromId);await page.locator('#team-preview-handover select[name=toId]').selectOption(toId);await page.locator('#team-preview-handover textarea[name=note]').fill('New CSM: confirm the rollout workshop and review the adoption risks with the champion.')
   await Promise.all([page.waitForLoadState('networkidle'),page.locator('#team-preview-handover button').click()])
   assert.ok(await page.getByText('2 accounts, 1 open tasks will move.',{exact:true}).isVisible())
   assert.ok(await page.getByText('2 private plan drafts will move with their account. Customer owners and plan content stay unchanged.',{exact:true}).isVisible())
   for(const p of drafts)assert.ok(await page.getByText(p.row.name+' · '+operators.find(o=>o.id===fromId).displayName+' → '+operators.find(o=>o.id===toId).displayName,{exact:true}).isVisible())
   const capture=async(name)=>{await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} fits at ${width}`);if(process.env.BUOY_SCREENSHOTS)await page.screenshot({path:`${process.env.BUOY_SCREENSHOTS}/${name}-${width}.png`,fullPage:true})}
   await capture('team-preview')
   await submit('team-apply','Apply reviewed assignment')
   state=await json(await call('/state'));assert.ok(state.accounts.every(a=>a.ownerId===toId));assert.equal(state.tasks.find(t=>t.proposalId===task.id).ownerId,toId)
   assertPlanHandover(beforePlans,await teamPlanRows({call,json},planAccounts),new Set(drafts.map(p=>p.row.id)),toId)
   // A lower target is allowed and offers an actionable rebalance preview.
   await page.locator('#team-capacity select[name=personId]').selectOption(toId);await page.locator('#team-capacity input[name=capacity]').fill('2');await submit('team-capacity','Save capacity')
   assert.ok(await page.getByText(/over target by 1/).isVisible());await capture('team-over-target')
   await Promise.all([page.waitForLoadState('networkidle'),page.locator('#team-preview-rebalance button').click()]);assert.ok(await page.getByText('1 accounts, 1 open tasks will move.',{exact:true}).isVisible())
   await submit('team-apply','Apply reviewed assignment')
   assert.ok(!(await page.getByText(/over target by/).count()));await capture('team-books')
   await page.goto(app.origin+'/app/accounts/'+first.id+'#account-owner');assert.ok(await page.getByRole('heading',{name:'Account handovers'}).isVisible());assert.ok(await page.getByText('New CSM: confirm the rollout workshop and review the adoption risks with the champion.',{exact:true}).isVisible());await capture('team-account')
  }finally{if(context)await context.close();await app.close()}
 }
 console.log('TEAM-001: team/capacity/rule forms, assignment review, book handover, over-target rebalance and account handover end states passed at 1440 and 390.')
}finally{await browser.close()}
