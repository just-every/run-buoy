// NOTIFY-001: use the real inbox forms as a signed-in teammate, at both widths.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { startWorker } from './worker.mjs'
const app = await startWorker(), browser = await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try {
 const call=(path,method='GET',body)=>app.request('/api/buoy'+path,{cookie:app.cookie,method,body})
 const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()}
 const today=new Date().toISOString().slice(0,10), owner=(await json(await call('/state'))).operator.id
 await json(await call('/accounts','POST',{id:'harbour',name:'Harbour Software',renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Signed annual agreement, section 4',billing:{observedAt:today,reference:'Invoice INV-1042',currency:'USD',totalMinor:120000,creditsMinor:0,allocatedMinor:0,dueDate:'2026-01-01'},support:{observedAt:today,reference:'Support case CS-42',openTickets:3,urgentTickets:1}}),201)
 await json(await call('/accounts/harbour/owner','PUT',{ownerId:owner}))
 const p=await json(await call('/proposals','POST',{accountId:'harbour',kind:'playbook',payload:{title:'Confirm rollout plan with Maya Chen',dueDate:today,ownerId:owner}}),201)
 await json(await call(`/proposals/${p.id}/approve`,'POST',{}))
 await app.scheduled()
 const cookies=app.cookie.split('; ').map(pair=>{const [name,...value]=pair.split('=');return {name,value:value.join('='),url:app.origin}})
 if(process.env.BUOY_SCREENSHOTS)await mkdir(process.env.BUOY_SCREENSHOTS,{recursive:true})
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});await context.addCookies(cookies)
  const page=await context.newPage()
  await page.goto(app.origin+'/app');await page.getByRole('link',{name:'Inbox',exact:true}).click()
  assert.equal(new URL(page.url()).pathname,'/app/notifications')
  const prefs=page.locator('#notification-preferences')
  await prefs.getByLabel('Email digest').selectOption('daily')
  await prefs.getByLabel('Signals').selectOption('digest')
  await Promise.all([page.waitForURL(/success=/),prefs.getByRole('button',{name:'Save your preferences'}).click()])
  assert.equal((await json(await call('/notifications'))).preferences.modes.signal,'digest')
  const mention=page.locator('#mention')
  await mention.getByLabel('Account', {exact:false}).first().selectOption('harbour')
  await mention.getByLabel('Teammate').selectOption(owner)
  await mention.getByLabel('Account note').fill(`Maya confirmed the rollout workshop. Please review the open risks (${width}).`)
  await Promise.all([page.waitForURL(/Mention/),mention.getByRole('button',{name:'Send mention'}).click()])
  assert.ok(await page.getByText(`Maya confirmed the rollout workshop. Please review the open risks (${width}).`,{exact:true}).isVisible())
  const row=page.locator('li.record').filter({hasText:`open risks (${width})`})
  await Promise.all([page.waitForURL(/marked/),row.getByRole('button',{name:'Mark read',exact:true}).click()])
  assert.ok(await row.getByText('Read',{exact:true}).isVisible())
  for(const [name,path] of [['inbox','/app/notifications'],['home','/app'],['account','/app/accounts/harbour']]){
   assert.equal((await page.goto(app.origin+path,{waitUntil:'networkidle'})).status(),200)
   await page.evaluate(()=>document.fonts.ready)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} ${width} fits`)
   if(process.env.BUOY_SCREENSHOTS)await page.screenshot({path:`${process.env.BUOY_SCREENSHOTS}/${name}-${width}.png`,fullPage:true})
  }
  await context.close()
 }
 console.log('NOTIFY-001: inbox navigation, personal preferences, mention and read end states passed at 1440 and 390.')
}finally{await browser.close();await app.close()}
