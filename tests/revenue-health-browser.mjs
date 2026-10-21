import assert from 'node:assert/strict'
import {join} from 'node:path'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {scan,submit,failures} from './a11y-checks.mjs'
export async function revenueHealthBrowser(app,{api},{accountId,segmentId,contract}){
 const evidence=process.env.EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage(),show=async id=>{const panel=page.locator('#'+id);if(!await panel.evaluate(e=>e.open))await panel.locator(':scope > summary').click()}
   const proof=async(label,selector)=>{await scan(page,`Recurring contract health ${label} ${width}`);if(evidence){await page.locator(selector).screenshot({path:join(evidence,`revenue-${label}-${width}.png`)});if(await page.getByRole('alert').count())await page.getByRole('alert').screenshot({path:join(evidence,`revenue-${label}-message-${width}.png`)})}}
   await page.goto(app.origin+'/app/accounts/'+accountId,{waitUntil:'networkidle'})
   assert.match(await page.locator('#revenue-result').innerText(),/Contracted ARR|60,000/)
   await proof('recorded','#revenue-result')
   await show('contract-configure');await show('revenue-line-0')
   const form=page.locator('#contract-editor')
   await form.getByLabel('Recurring contract currency',{exact:true}).fill('USD')
   await form.getByLabel('Recurring contract starts (UTC)',{exact:true}).fill(contract.contractStart)
   await form.getByLabel('Recurring contract ends (UTC)',{exact:true}).fill(contract.contractEnd)
   await form.getByLabel('Recurring contract confirmation reference',{exact:true}).fill('Customer-confirmed annual reporting contract')
   await form.getByLabel('Recurring terms confirmed on (UTC)',{exact:true}).fill(contract.source.confirmedOn)
   await form.getByLabel('Product for recurring line 1',{exact:true}).fill('Annual reporting workspace')
   await form.getByLabel('Purchased quantity for recurring line 1',{exact:true}).fill('20')
   await form.getByLabel('Total minor units per billing period for recurring line 1',{exact:true}).fill('6000000')
   await form.getByLabel('Billing frequency for recurring line 1',{exact:true}).selectOption('annual')
   await form.getByLabel('Entitlements for recurring line 1',{exact:true}).fill('20 reporting workspace seats')
   for(let i=2;i<=3;i++){const field=form.getByLabel('Product for recurring line '+i,{exact:true});if(await field.count()){await show('revenue-line-'+(i-1));await field.fill('')}}
   await proof('configuration','#contract-configure')
   await form.getByLabel('Recurring contract currency',{exact:true}).fill('ZZZ')
   await submit(page,form.getByRole('button',{name:'Confirm recurring contract',exact:true}))
   assert.equal(await page.getByRole('alert').count(),1);assert.equal(await form.getByLabel('Recurring contract confirmation reference',{exact:true}).inputValue(),'Customer-confirmed annual reporting contract')
   await proof('refusal','#contract-configure')
   await form.getByLabel('Recurring contract currency',{exact:true}).fill('USD')
   await submit(page,form.getByRole('button',{name:'Confirm recurring contract',exact:true}))
   assert.equal(await page.getByRole('alert').count(),0)
   assert.match(await page.locator('#revenue-result').innerText(),/60,000/)
   assert.match(await page.locator('#revenue-result').innerText(),/5,000/)
   await proof('confirmed','#revenue-result')
   await show('contract-history');assert.match(await page.locator('#contract-history').innerText(),/Customer-confirmed annual reporting contract/);await proof('history','#contract-history')
   await page.goto(app.origin+'/app/segments',{waitUntil:'networkidle'})
   const segment=page.locator('#segment-'+segmentId);assert.match(await segment.innerText(),/1 members/);await proof('numeric-segment','#segment-'+segmentId)
   const csv=await api('/segments/'+segmentId+'/report');assert.equal(csv.accounts.length,1);assert.equal(csv.accounts[0].accountId,accountId)
   await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Recurring contract and score segment reflow at 320');await page.setViewportSize({width,height:1000})
  }finally{await context.close()}
 }}finally{await browser.close()}
 assert.deepEqual(failures,[],'Recurring contract native accessibility')
 console.log('Person-confirmed ARR/MRR native form/refusal/recovery/history and numeric score segment report passed at 1440/390.')
}
