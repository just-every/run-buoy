// Configure, refuse, preview, publish and inspect real retained calculations.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {scan,submit,focused,failures} from './a11y-checks.mjs'
export async function healthScorecardBrowser(app,{api,accounts},{config,segment,accountId}){
 const evidence=process.env.EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage()
   const show=async id=>{const panel=page.locator('#'+id);if(!await panel.evaluate(e=>e.open))await panel.locator(':scope > summary').click()}
   const proof=async(label,selector)=>{await scan(page,`Weighted health ${label} ${width}`);if(evidence)await page.locator(selector).screenshot({path:join(evidence,`health-${label}-${width}.png`)})}
   await page.goto(app.origin+'/app/accounts/'+accountId,{waitUntil:'networkidle'})
   await page.getByRole('link',{name:'Weighted health configuration and history',exact:true}).click()
   await show('scorecard-configure')
   let form=page.locator('#scorecard-editor')
   await form.getByLabel('Scorecard name',{exact:true}).fill('Customer success weighted evidence')
   await form.getByLabel('At risk below (0–100)',{exact:true}).fill(String(config.bands.riskBelow))
   await form.getByLabel('Healthy at or above (0–100)',{exact:true}).fill(String(config.bands.healthyAt))
   for(const [i,m] of config.measures.entries()){
    await show('scorecard-measure-'+i)
    for(const [label,value] of [['Name',m.name],['Minimum',m.min],['Maximum',m.max],['Weight',m.weight]])await form.getByLabel(`${label} for measure ${i+1}`,{exact:true}).fill(String(value))
    await form.getByLabel(`Input for measure ${i+1}`,{exact:true}).selectOption(m.field)
    await form.getByLabel(`Direction for measure ${i+1}`,{exact:true}).selectOption(m.direction)
    await form.getByLabel(`Missing input for measure ${i+1}`,{exact:true}).selectOption(m.missing)
   }
   await show('scorecard-segment-weights-0')
   await form.getByLabel('Segment for weights 1',{exact:true}).selectOption(segment.id)
   for(const [i,m] of config.measures.entries())await form.getByLabel(`Segment 1 weight for measure ${i+1}`,{exact:true}).fill(String(config.segments[0].weights[m.key]??m.weight))
   await proof('configuration','#scorecard-configure')
   // Invalid numeric bounds reach the same server-side validation as HTTP.
   await form.getByLabel('Maximum for measure 1',{exact:true}).fill(String(config.measures[0].min))
   await submit(page,form.getByRole('button',{name:'Preview scorecard',exact:true}))
   assert.equal(await page.locator('[role=alert]').count(),1)
   assert.equal(await form.getByLabel('Scorecard name',{exact:true}).inputValue(),'Customer success weighted evidence')
   await proof('refusal','#scorecard-configure')
   await form.getByLabel('Maximum for measure 1',{exact:true}).fill(String(config.measures[0].max))
   const before=await api('/scorecards')
   await form.getByRole('button',{name:'Preview scorecard',exact:true}).focus();await focused(page,form.getByRole('button',{name:'Preview scorecard',exact:true}),`Weighted health preview keyboard ${width}`)
   await submit(page,form.getByRole('button',{name:'Preview scorecard',exact:true}))
   assert.equal(await page.locator('[role=alert]').count(),0)
   assert.match(await page.locator('#scorecard-preview').innerText(),/contribution|Missing treatment/)
   const previewed=await api('/scorecards');assert.equal(previewed.revision,before.revision);assert.equal(previewed.history.length,before.history.length)
   await proof('preview','#scorecard-preview')
   await show('scorecard-configure')
   await submit(page,form.getByRole('button',{name:'Publish scorecard',exact:true}))
   assert.equal(await page.locator('[role=alert]').count(),0)
   const published=await api('/scorecards');assert.notEqual(published.revision,before.revision)
   assert.equal(published.published.config.measures.length,5)
   await show('scorecard-result-'+accountId)
   const result=page.locator('#scorecard-result-'+accountId);assert.match(await result.innerText(),/Recalculated|recalculated/);assert.match(await result.innerText(),/reference|observed/)
   await proof('published','#scorecard-result-'+accountId)
   const unknown=published.accounts.find(a=>a.accountId!==accountId)
   if(unknown){await show('scorecard-result-'+unknown.accountId);assert.match(await page.locator('#scorecard-result-'+unknown.accountId).innerText(),/missing|Unknown|unknown/);await proof('missing','#scorecard-result-'+unknown.accountId)}
   await show('scorecard-version-preview')
   form=page.locator('#scorecard-history-preview')
   const retained=published.history.find(h=>h.accountId===accountId)
   await form.getByLabel('Scorecard version',{exact:true}).selectOption(retained.versionId)
   await form.getByLabel('Input snapshot',{exact:true}).selectOption(retained.id)
   await submit(page,form.getByRole('button',{name:'Preview retained version',exact:true}))
   assert.match(await page.locator('#scorecard-preview').innerText(),/Historical scorecard preview/)
   await proof('history','#scorecard-preview')
   await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Weighted health forms reflow at 320');await page.setViewportSize({width,height:1000})
   await page.goto(app.origin+'/app/accounts/'+accountId,{waitUntil:'networkidle'})
   assert.match(await page.locator('#health').innerText(),/Published weighted health|Score/)
   await proof('account','#health')
   await page.goto(app.origin+'/app',{waitUntil:'networkidle'});await proof('runway','#work')
  }finally{await context.close()}
 }}finally{await browser.close()}
 assert.deepEqual(failures,[],'Weighted scorecard native accessibility')
 console.log('Weighted health five-measure native preview/refusal/publish/history, account/runway and missing sources passed at 1440/390.')
}
