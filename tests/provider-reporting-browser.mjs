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
