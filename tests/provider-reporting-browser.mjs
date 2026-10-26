import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {scan,failures} from './a11y-checks.mjs'
export async function providerReportingBrowser({app,cookie,api,accountIds,query}){
 const evidence=process.env.EVIDENCE_DIR??'../evidence/provider-reporting';await mkdir(evidence,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage(),proof=async label=>{await scan(page,'Provider reporting '+label+' '+width);await page.screenshot({path:join(evidence,label+'-'+width+'.png'),fullPage:true})}
   for(const id of accountIds){await page.goto(app.origin+'/app/accounts/'+id,{waitUntil:'networkidle'});const section=page.locator('#provider-revenue');assert.equal(await section.count(),1);assert.match(await section.innerText(),/Reporting ARR \(USD\)/);await section.scrollIntoViewIfNeeded();await proof('revenue-'+id)}
   await page.goto(app.origin+'/app/revenue'+query,{waitUntil:'networkidle'});assert.equal(await page.getByRole('heading',{name:'Retention summary',exact:true}).count(),1);assert.match(await page.locator('#retention-accounts').innerText(),/USD|EUR|GBP/);await proof('retention')
   const link=page.locator('#retention-accounts a').filter({hasText:'Invoice '}).first();assert.ok(await link.count());const invoiceId=(await link.innerText()).replace(/^Invoice /,'');await link.click();assert.equal(new URL(page.url()).pathname,'/app/billing');assert.equal(await page.locator(new URL(page.url()).hash).count(),1);const retained=page.locator(new URL(page.url()).hash);assert.equal(await retained.isVisible(),true);await retained.getByRole('button',{name:/Details/}).click();assert.ok((await page.locator('dialog[open]').innerText()).includes(invoiceId));await proof('invoice-drilldown');await page.keyboard.press('Escape')
   await page.setViewportSize({width:320,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Provider records reflow at 320');await page.setViewportSize({width,height:1000})
  }finally{await context.close()}
 }}finally{await browser.close()}
 assert.deepEqual(failures,[])
}

export async function monthlyRevenueBrowser({app,cookie,accountId}){
 const evidence=process.env.EVIDENCE_DIR??'../evidence/monthly-revenue';await mkdir(evidence,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  for(const phase of ['pending','resolved'])for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try{
    await context.addCookies(cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
    const page=await context.newPage();await page.goto(app.origin+'/app/accounts/'+accountId,{waitUntil:'networkidle'})
    const reconciliation=page.locator('#revenue-reconciliation');assert.equal(await reconciliation.count(),1)
    if(phase==='pending'){
     assert.match(await reconciliation.innerText(),/Pending/)
     await page.locator('#monthly-revenue-history-reviewed-stripe > summary').click();assert.equal(await page.locator('#monthly-revenue-history-reviewed-stripe h3').count(),12)
     await reconciliation.getByText('Resolve revenue mismatch',{exact:true}).first().click();assert.equal(await page.getByRole('textbox',{name:'Resolution explanation',exact:true}).isVisible(),true)
    }else assert.match(await reconciliation.innerText(),/Resolved/)
    await reconciliation.scrollIntoViewIfNeeded();await scan(page,'Monthly provider revenue '+phase+' '+width);await page.screenshot({path:join(evidence,phase+'-'+width+'.png'),fullPage:true})
    await page.setViewportSize({width:320,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize({width,height:1000})
    if(phase==='pending'&&width===390){await page.getByRole('textbox',{name:'Resolution explanation',exact:true}).fill('Reviewed signed order and billing schedule; retain their documented difference.');await page.getByRole('button',{name:'Resolve revenue mismatch',exact:true}).click();await page.waitForURL('**#revenue-reconciliation');assert.match(await page.locator('#revenue-reconciliation').innerText(),/Resolved/)}
   }finally{await context.close()}
  }
 }finally{await browser.close()}
 assert.deepEqual(failures,[])
}
