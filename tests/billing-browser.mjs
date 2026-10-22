import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {scan,submit,failures} from './a11y-checks.mjs'
import {billingFixtureKey,billingWebhookSecret} from './billing-fixture.mjs'
export async function billingBrowser(app,{connectionId,accountId,otherAccountId,unmappedAccountId,source}){
 const evidence=process.env.EVIDENCE_DIR??process.env.BUOY_PROOF_DIR;if(evidence)await mkdir(evidence,{recursive:true})
 console.log('Stripe billing browser: launching Chromium')
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const api=async(path,method='GET',body)=>{const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.equal(r.status,200,await r.clone().text());return r.json()}
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return {name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage(),show=async id=>{const e=page.locator('#'+id);if(!await e.evaluate(e=>e.open))await e.locator(':scope > summary').click()}
   const proof=async(name,selector)=>{await scan(page,`Stripe billing ${name} ${width}`);if(evidence)await page.locator(selector).screenshot({path:join(evidence,`billing-${name}-${width}.png`),mask:[page.locator('[data-secret]:visible')]})}
   console.log('Stripe billing browser: opening native screen '+width)
   await page.goto(app.origin+'/app/connections',{waitUntil:'networkidle'});await submit(page,page.getByRole('link',{name:'Review Stripe billing and account bindings',exact:true}))
   assert.equal(await page.getByRole('heading',{name:'Stripe billing',exact:true,level:2}).count(),1)
   assert.ok((await page.locator('#billing-evidence').innerText()).includes('Monthly Stripe customer'))
   assert.ok((await page.locator('#billing-evidence').innerText()).includes('Annual Stripe customer'))
   await proof('observations','#billing-evidence');const change=page.locator('#billing-changes details').first();await change.locator('summary').click();assert.match(await change.innerText(),/before|after/);await proof('changes','#billing-changes');await change.locator('summary').click()
   const before=(await api('/billing')).bindings.length
   await show('billing-bind-panel-'+connectionId)
   let form=page.locator('#billing-bind-preview--'+connectionId)
   await form.getByLabel('Stripe customer ID',{exact:true}).fill('synthetic-buoy-103')
   await form.getByLabel('Existing account',{exact:true}).selectOption(unmappedAccountId)
   await submit(page,form.getByRole('button',{name:'Preview exact customer binding',exact:true}))
   assert.equal((await api('/billing')).bindings.length,before)
   assert.match(await page.locator('#billing-binding-preview').innerText(),/synthetic-buoy-103/)
   await proof('binding-preview','#billing-binding-preview')
   await submit(page,page.locator('#billing-bind').getByRole('button',{name:'Approve exact customer binding',exact:true}))
   const binding=(await api('/billing')).bindings.find(b=>b.accountId===unmappedAccountId);assert.ok(binding)
   assert.match(await page.locator('#billing-bindings').innerText(),/Missing: no successful/)
   await proof('binding-approved','#billing-bindings')
   await submit(page,page.locator('#billing-unbind--'+binding.id).getByRole('button',{name:'Remove reviewed binding',exact:true}))
   assert.equal((await api('/billing')).bindings.length,before)
   await show('billing-settings-panel-'+connectionId);form=page.locator('#billing-settings--'+connectionId)
   await form.getByLabel('Stripe billing stale after (UTC days)',{exact:true}).fill('7')
   await submit(page,form.getByRole('button',{name:'Save billing freshness',exact:true}))
   assert.equal((await api('/billing')).connections.find(c=>c.id===connectionId).stale_days,7)
   await proof('freshness-settings','#billing-connection-'+connectionId)
   await api('/billing/'+connectionId+'/settings','PUT',{staleDays:30})
   await show('billing-webhook-panel-'+connectionId);form=page.locator('#billing-webhook--'+connectionId)
   await form.getByLabel('Stripe endpoint signing secret',{exact:true}).fill(billingWebhookSecret)
   assert.equal(await form.getAttribute('data-draft'),null,'Webhook credential form never persists local drafts')
   assert.equal(await page.evaluate(secret=>Object.values(localStorage).some(value=>value.includes(secret)),billingWebhookSecret),false)
   await submit(page,form.getByRole('button',{name:'Save webhook signing secret',exact:true}))
   assert.equal(await page.locator('input[data-secret]').inputValue(),'')
   source.fail=true
   await submit(page,page.locator('#billing-sync--'+connectionId).getByRole('button',{name:'Sync next customer for Stripe billing sandbox',exact:true}))
   assert.match(await page.locator('#billing-connection-'+connectionId).innerText(),/Failed|refused/)
   await proof('source-failure','#billing-connection-'+connectionId)
   assert.doesNotMatch(await page.locator('body').innerText(),new RegExp('\\b'+billingFixtureKey+'\\b'))
   source.fail=false
   await api('/connections/'+connectionId+'/credential','PUT',{key:billingFixtureKey})
   await submit(page,page.locator('#billing-sync--'+connectionId).getByRole('button',{name:'Sync next customer for Stripe billing sandbox',exact:true}))
   assert.match(await page.locator('#billing-connection-'+connectionId).innerText(),/Current/)
   await proof('reconciled','#billing-evidence')
   await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Stripe billing source references and forms reflow at 320')
   await page.setViewportSize({width,height:1000})
   for(const id of [accountId,otherAccountId]){await page.goto(app.origin+'/app/accounts/'+id,{waitUntil:'networkidle'});assert.match(await page.locator('body').innerText(),/Stripe|stripe-test/);await proof('account-'+(id===accountId?'monthly':'annual'),'#stripe-billing');await proof('header-'+(id===accountId?'monthly':'annual'),'.head-row')}
  }finally{source.fail=false;await context.close()}
 }}finally{await browser.close()}
 assert.deepEqual(failures,[],'Stripe billing native accessibility')
 console.log('Stripe billing native review/approve/remove binding, missing/current evidence, pricing history, source freshness, secret custody and failure/reconnect passed at 1440 and 390.')
}
