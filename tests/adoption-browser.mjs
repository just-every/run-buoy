// ADOPT-001 native report/configuration/filter/export with inherited A11Y-001.
import {adoptionSegmentBrowser} from './adoption-segment-browser.mjs'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {startWorker} from './worker.mjs'
import {adoptionFixture,adoptionOn} from './adoption-fixture.mjs'
import {scan,failures,manual,submit,focused,openForms} from './a11y-checks.mjs'
const app=await startWorker({secure:false})
let browser
try{
 const {api,accounts,people,sdk}=await adoptionFixture(app,{count:2})
 const evidence=process.env.EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true})
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}})
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage(),proof=async label=>{
    await scan(page,`ADOPT-001 ${label} ${width}`)
    if(evidence){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(evidence,`adoption-${label}-${width}.png`)});await page.locator('#adoption-summary').screenshot({path:join(evidence,`adoption-${label}-summary-${width}.png`)})}
   }
   const show=async id=>{const panel=page.locator('#'+id);if(!await panel.evaluate(e=>e.open))await panel.locator('summary').click()}
   await page.goto(app.origin+'/app/usage',{waitUntil:'networkidle'})
   await page.getByRole('link',{name:'Product adoption metrics',exact:true}).click()
   await page.locator('#adoption-filter').getByLabel('Through UTC date').fill(adoptionOn)
   await submit(page,page.getByRole('button',{name:'Read adoption report',exact:true}))
   await proof('entry')
   for(const [kind,key,name,events] of [['feature','reports','Reports','Report generated'],['feature','exports','Exports','File exported'],['module','analytics','Analytics module','Report generated\nFile exported']]){
    await show('adoption-define');const form=page.locator('#adoption-definition')
    await form.getByLabel('Event set kind',{exact:true}).selectOption(kind);await form.getByLabel('Event set key',{exact:true}).fill(key);await form.getByLabel('Event set name',{exact:true}).fill(name)
    await form.getByLabel('Exact event names (one per line)',{exact:true}).fill(events)
    await submit(page,form.getByRole('button',{name:'Save event set',exact:true}))
    assert.equal(await page.locator('[role=alert]').count(),0)
   }
   await show('adoption-seat-settings');let form=page.locator('#adoption-seats')
   await form.getByLabel('Seat account',{exact:true}).selectOption(accounts[0].id);await form.getByLabel('Purchased seats',{exact:true}).fill('5');await form.getByLabel('Seat source reference',{exact:true}).fill('Customer-confirmed five-seat schedule');await form.getByLabel('Seats observed on (UTC)',{exact:true}).fill(adoptionOn);await form.getByLabel('Seat evidence stale after (UTC days)',{exact:true}).fill('30')
   await submit(page,form.getByRole('button',{name:'Save purchased seats',exact:true}))
   assert.equal((await api('/adoption?on='+adoptionOn+'&accountId='+accounts[0].id)).summary.metrics.current.utilization,2,'ADOPT-001 purchased-seat utilization is not clamped at 100%')
   await page.goto(app.origin+'/app/adoption?on='+adoptionOn+'&accountId='+accounts[0].id,{waitUntil:'networkidle'})
   let report=await api('/adoption?on='+adoptionOn+'&accountId='+accounts[0].id)
   assert.equal(report.summary.metrics.current.wau,7)
   const summary=await page.locator('#adoption-summary').innerText();assert.match(summary,/Weekly active users\n7/);assert.match(summary,/dropped at least 30%/);assert.match(summary,/200%/);assert.match(summary,/Reports/);assert.match(summary,/3,600/)
   await show('adoption-account-'+accounts[0].id);await show('adoption-person-'+people[0].id)
   await proof('report')
   const exported=await page.getByRole('link',{name:'Export this report as CSV',exact:true}).getAttribute('href')
   const csv=await context.request.get(app.origin+exported);assert.equal(csv.status(),200);const text=await csv.text();assert.match(text,/Harbour Software/);assert.doesNotMatch(text,/Cedar Logistics/)
   form=page.locator('#adoption-filter');await form.getByLabel('Customer person filter',{exact:true}).selectOption(people[0].id)
   await submit(page,form.getByRole('button',{name:'Read adoption report',exact:true}))
   assert.match(await page.locator('#adoption-summary').innerText(),/Monthly active users\n1/)
   await proof('person')
   await show('adoption-define');form=page.locator('#adoption-definition')
   await form.getByLabel('Event set kind',{exact:true}).selectOption('module');await form.getByLabel('Event set key',{exact:true}).fill('invalid');await form.getByLabel('Event set name',{exact:true}).fill('Invalid duplicate set');await form.getByLabel('Exact event names (one per line)',{exact:true}).fill('Report generated\nReport generated')
   await submit(page,form.getByRole('button',{name:'Save event set',exact:true}))
   assert.equal(await page.locator('[role=alert]').count(),1);assert.equal(await form.getByLabel('Event set name',{exact:true}).inputValue(),'Invalid duplicate set');assert.equal(await form.getByLabel('Event set kind',{exact:true}).inputValue(),'module')
   await proof('refusal')
   await form.getByLabel('Event set kind',{exact:true}).selectOption('feature');await form.getByLabel('Exact event names (one per line)',{exact:true}).fill('Report generated');await form.getByLabel('Event set key',{exact:true}).fill('reports');await form.getByLabel('Event set name',{exact:true}).fill('Reports')
   await submit(page,form.getByRole('button',{name:'Save event set',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)
   await page.goto(app.origin+'/app/adoption?on='+adoptionOn,{waitUntil:'networkidle'});await openForms(page)
   if(evidence)await page.locator('#adoption-define').screenshot({path:join(evidence,`adoption-configuration-${width}.png`)})
   await page.getByRole('button',{name:'Read adoption report',exact:true}).focus();await focused(page,page.getByRole('button',{name:'Read adoption report',exact:true}),`ADOPT-001 keyboard report filter ${width}`);await submit(page,page.getByRole('button',{name:'Read adoption report',exact:true}))
   await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'ADOPT-001 reflows to 320')
   await page.setViewportSize({width,height:1000})
   await show('adoption-seat-settings');form=page.locator('#adoption-seats')
   await form.getByLabel('Seat account',{exact:true}).selectOption(accounts[0].id);await form.getByLabel('Purchased seats',{exact:true}).fill('');await form.getByLabel('Seat source reference',{exact:true}).fill('');await form.getByLabel('Seats observed on (UTC)',{exact:true}).fill('')
   await submit(page,form.getByRole('button',{name:'Save purchased seats',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)
   const cleared=await api('/adoption?on='+adoptionOn+'&accountId='+accounts[0].id);assert.equal(cleared.summary.metrics.current.utilization,null);assert.equal(cleared.seatHistory[0].cleared,true)
   await show('adoption-seat-history');await proof('seat-cleared')
   const invalid=await page.goto(app.origin+'/app/adoption?on=2026-02-30',{waitUntil:'networkidle'});assert.equal(invalid.status(),400)
   assert.equal(await page.getByRole('heading',{name:'Adoption report unavailable',exact:true}).count(),1)
   await scan(page,`ADOPT-001 invalid report recovery ${width}`)
   if(evidence)await page.screenshot({path:join(evidence,`adoption-invalid-report-${width}.png`)})
   await page.getByRole('link',{name:'Clear report filters',exact:true}).click();assert.equal(await page.locator('#adoption-summary').count(),1)
   await adoptionSegmentBrowser({page,api,accounts,people,sdk,width,evidence,origin:app.origin})
   await page.goto(app.origin+'/app/usage',{waitUntil:'networkidle'});await scan(page,`ADOPT-001 usage entry link ${width}`)
   if(evidence){await page.locator('#work > section').first().screenshot({path:join(evidence,`adoption-usage-link-${width}.png`)})}
  }finally{await context.close()}
 }
 assert.deepEqual(failures,[],'ADOPT-001 A11Y-001 native screens and end states')
 for(const entry of manual)for(const rule of entry.rules)assert.equal(rule.id,'color-contrast')
 console.log('ADOPT-001 native event sets/seats, 30% decline, account/person filters, CSV, refusal/recovery, keyboard/axe/reflow and 1440/390 end states passed.')
}finally{if(browser)await browser.close();await app.close()}
