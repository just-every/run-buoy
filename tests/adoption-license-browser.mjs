// ADOPT-001 existing native adoption door: individual license evidence and end states.
import assert from 'node:assert/strict'
import {join} from 'node:path'
import {adoptionOn} from './adoption-fixture.mjs'
import {scan,submit,focused} from './a11y-checks.mjs'
export async function adoptionLicenseBrowser({page,api,accounts,people,width,evidence,origin}){
 const show=async id=>{const panel=page.locator('#'+id);if(!await panel.evaluate(e=>e.open))await panel.locator('summary').click()}
 const proof=async label=>{
  await scan(page,`ADOPT-001 individual license ${label} ${width}`)
  if(evidence){await page.locator('#adoption-license-evidence').screenshot({path:join(evidence,`individual-license-${label}-${width}.png`)});if(await page.locator('#adoption-license-settings').evaluate(e=>e.open))await page.locator('#adoption-license-settings').screenshot({path:join(evidence,`individual-license-${label}-form-${width}.png`)})}
 }
 await page.goto(origin+'/app/adoption?on='+adoptionOn,{waitUntil:'networkidle'})
 await show('adoption-license-settings')
 let form=page.locator('#adoption-person-license')
 await form.getByLabel('License account',{exact:true}).selectOption(accounts[0].id)
 await form.getByLabel('Licensed customer person',{exact:true}).selectOption(people[10].id)
 await form.getByLabel('Individual license status',{exact:true}).selectOption('true')
 await form.getByLabel('Individual license source reference',{exact:true}).fill('Customer-approved individual license register')
 await form.getByLabel('Individual license observed on (UTC)',{exact:true}).fill('2026-09-01')
 await form.getByLabel('Individual license stale after (UTC days)',{exact:true}).fill('30')
 await submit(page,form.getByRole('button',{name:'Save individual license',exact:true}))
 assert.equal(await page.locator('[role=alert]').count(),1,'ADOPT-001 native unrelated membership refusal')
 assert.equal(await form.getByLabel('Individual license source reference',{exact:true}).inputValue(),'Customer-approved individual license register','ADOPT-001 refused native form preserves evidence')
 await proof('refusal')
 await form.getByLabel('Licensed customer person',{exact:true}).selectOption(people[0].id)
 await form.getByRole('button',{name:'Save individual license',exact:true}).focus();await focused(page,form.getByRole('button',{name:'Save individual license',exact:true}),`ADOPT-001 individual license keyboard submit ${width}`)
 await submit(page,form.getByRole('button',{name:'Save individual license',exact:true}))
 assert.equal(await page.locator('[role=alert]').count(),0)
 await page.goto(origin+'/app/adoption?on='+adoptionOn+'&personId='+people[0].id,{waitUntil:'networkidle'})
 await show('adoption-person-'+people[0].id)
 assert.match(await page.locator('#adoption-person-'+people[0].id).innerText(),/License utilization\n100%/)
 assert.match(await page.locator('#adoption-license-evidence').innerText(),/Licensed · current/)
 await proof('licensed')
 await page.goto(origin+'/app/adoption?on=2020-01-01&personId='+people[0].id,{waitUntil:'networkidle'})
 await show('adoption-person-'+people[0].id)
 assert.match(await page.locator('#adoption-person-'+people[0].id).innerText(),/License utilization\n0%/)
 await proof('inactive')
 await page.goto(origin+'/app/adoption?on=2026-10-02&personId='+people[0].id,{waitUntil:'networkidle'})
 assert.match(await page.locator('#adoption-license-evidence').innerText(),/Licensed · stale/)
 await proof('stale')
 await page.goto(origin+'/app/adoption?on='+adoptionOn+'&personId='+people[0].id,{waitUntil:'networkidle'})
 await show('adoption-license-settings');form=page.locator('#adoption-person-license')
 const fill=async status=>{
  await form.getByLabel('License account',{exact:true}).selectOption(accounts[0].id);await form.getByLabel('Licensed customer person',{exact:true}).selectOption(people[0].id)
  await form.getByLabel('Individual license status',{exact:true}).selectOption(status);await form.getByLabel('Individual license source reference',{exact:true}).fill(status?'Customer-confirmed no individual license':'')
  await form.getByLabel('Individual license observed on (UTC)',{exact:true}).fill(status?adoptionOn:'');await submit(page,form.getByRole('button',{name:'Save individual license',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)
 }
 await fill('false')
 let report=await api('/adoption?on='+adoptionOn+'&personId='+people[0].id)
 assert.equal(report.people[0].metrics.current.utilization,null)
 await show('adoption-person-'+people[0].id);assert.match(await page.locator('#adoption-person-'+people[0].id).innerText(),/License utilization\nNot available/)
 await proof('unlicensed')
 await show('adoption-license-settings');await fill('')
 report=await api('/adoption?on='+adoptionOn+'&personId='+people[0].id);assert.equal(report.personLicenses.length,0);assert.equal(report.people[0].seats,null)
 await show('adoption-license-history');assert.match(await page.locator('#adoption-license-history').innerText(),/License evidence cleared/)
 await proof('cleared')
 const exported=await page.getByRole('link',{name:'Export this report as CSV',exact:true}).getAttribute('href')
 const csv=await page.request.get(origin+exported);assert.equal(csv.status(),200);assert.match(await csv.text(),/Customer-approved individual license register/)
 await show('adoption-license-settings');await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'ADOPT-001 individual license native forms reflow at 320')
 await page.setViewportSize({width,height:1000})
}
