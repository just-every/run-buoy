// GOVERN-001: the owner configures and uses the real credential/switch/revocation forms.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {startWorker} from './worker.mjs'
const app=await startWorker(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...value]=pair.split('=');return{name,value:value.join('='),url:app.origin}}))
   const page=await context.newPage();await page.goto(app.origin+'/app/audit',{waitUntil:'networkidle'})
   await page.locator('#agent-issue-panel > summary').click()
   const form=page.locator('#agent-issue')
   await form.getByLabel('Agent label',{exact:true}).fill('Renewal reader '+width)
   await form.getByLabel('Prepare playbooks',{exact:true}).uncheck()
   await form.getByLabel('Prepare renewal decisions',{exact:true}).uncheck()
   for(const label of ['Billing snapshots','Support snapshots','CSM sentiment'])await form.getByLabel(label,{exact:true}).uncheck()
   await form.getByLabel('Expires after (days)',{exact:true}).fill('14')
   await form.getByLabel('Requests per UTC minute',{exact:true}).fill('30')
   await form.getByLabel('USD budget (cents)',{exact:true}).fill('2500')
   await form.getByRole('button',{name:'Issue agent credential',exact:true}).click()
   await page.locator('#agent-credential').waitFor({state:'visible'})
   const token=await page.locator('#agent-credential').inputValue()
   assert.ok(token.length>=32,'GOVERN-001 the issuer sees the one-time secret')
   const listing=await page.request.get(app.origin+'/api/buoy/agents');assert.equal(listing.status(),200)
   const policy=(await listing.json()).agents.find(agent=>agent.label==='Renewal reader '+width)
   assert.deepEqual(policy.scopes,['renewals.list']);assert.deepEqual(policy.dataClasses,['account'])
   assert.equal(policy.requestsPerMinute,30);assert.equal(policy.budgetMinor,2500);assert.equal(policy.spentMinor,0)
   const command=()=>app.request('/api/buoy/commands',{method:'POST',token,body:{command:'renewals.list'}})
   assert.equal((await command()).status,200,'GOVERN-001 the form-issued grant works')
   await mkdir('../screens',{recursive:true});await page.screenshot({path:`../screens/govern-issued-${width}.png`,fullPage:true,mask:[page.locator('#agent-credential')]})
   await page.goto(app.origin+'/app/audit',{waitUntil:'networkidle'})
   assert.equal(await page.locator('#agent-credential').count(),0,'GOVERN-001 refreshing does not reveal the credential')
   const pause=page.locator('#agent-switch');await pause.getByLabel('Pause all agents',{exact:true}).check();await pause.getByRole('button',{name:'Save agent switch',exact:true}).click()
   assert.equal((await command()).status,403,'GOVERN-001 the owner switch stops the form-issued agent')
   await page.screenshot({path:`../screens/govern-paused-${width}.png`,fullPage:true})
   await pause.getByLabel('Pause all agents',{exact:true}).uncheck();await pause.getByRole('button',{name:'Save agent switch',exact:true}).click()
   assert.equal((await command()).status,200)
   await page.locator(`[id="agent-revoke-${policy.id}"]`).getByRole('button',{name:'Revoke credential',exact:true}).click()
   assert.equal((await command()).status,401,'GOVERN-001 the revoke form invalidates the credential')
   await page.screenshot({path:`../screens/govern-revoked-${width}.png`,fullPage:true})
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)
   assert.ok(overflow<=1,'GOVERN-001 owner controls reflow at '+width)
  }finally{await context.close()}
 }
 console.log('GOVERN-001 real owner forms passed at 1440/390: chosen grants/limits, one-time credential, pause/resume/revoke and native end states.')
}finally{await browser.close();await app.close()}
