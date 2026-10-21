import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {scan,submit,failures} from './a11y-checks.mjs'
export async function surveyScorecardBrowser(app,{api,segment},{accountId,personId,config}){
 const evidence=process.env.EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage(),show=async id=>{const p=page.locator('#'+id);if(!await p.evaluate(e=>e.open))await p.locator(':scope > summary').click()}
   const proof=async(label,selector)=>{await scan(page,`Recorded survey scorecard ${label} ${width}`);if(evidence){await page.locator(selector).screenshot({path:join(evidence,`survey-${label}-${width}.png`)});if(await page.getByRole('alert').count())await page.getByRole('alert').screenshot({path:join(evidence,`survey-${label}-message-${width}.png`)})}}
   await page.goto(app.origin+'/app/accounts/'+accountId,{waitUntil:'networkidle'});await proof('account','#surveys')
   await show('survey-configure');const form=page.locator('#survey-response')
   await form.getByLabel('Survey respondent',{exact:true}).selectOption(personId)
   await form.getByLabel('Received survey name',{exact:true}).fill('Customer relationship review')
   await form.getByLabel('Survey response kind',{exact:true}).selectOption('csat')
   await form.getByLabel('Received survey score',{exact:true}).fill('6')
   await form.getByLabel('Response observed at (ISO UTC)',{exact:true}).fill(new Date(Date.now()-1000).toISOString())
   await form.getByLabel('Survey response source reference',{exact:true}).fill('Received customer relationship review')
   await form.getByLabel('Original survey response ID',{exact:true}).fill('synthetic-buoy-native-'+width)
   await proof('configuration','#survey-configure')
   await submit(page,form.getByRole('button',{name:'Record received response',exact:true}));assert.equal(await page.getByRole('alert').count(),1);assert.equal(await form.getByLabel('Received survey name',{exact:true}).inputValue(),'Customer relationship review');await proof('refusal','#survey-configure')
   const before=(await api('/scorecards')).accounts.find(a=>a.accountId===accountId)
   await form.getByLabel('Received survey score',{exact:true}).fill(width===1440?'4':'5')
   await submit(page,form.getByRole('button',{name:'Record received response',exact:true}));assert.equal(await page.getByRole('alert').count(),0)
   const after=(await api('/scorecards')).accounts.find(a=>a.accountId===accountId)
   assert.ok(Date.parse(after.calculatedAt)>=Date.parse(before.calculatedAt));assert.ok(after.breakdown.some(m=>m.field==='survey.csat'&&m.sources.some(s=>s.reference==='Received customer relationship review')))
   await show('survey-history');assert.match(await page.locator('#survey-history').innerText(),/Customer relationship review/);await proof('recorded','#survey-history')
   await page.goto(app.origin+'/app/customer-people?person='+personId,{waitUntil:'networkidle'});assert.match(await page.locator('#customer-survey-timeline').innerText(),/Received customer relationship review/);await proof('person','#customer-survey-timeline')
   await page.goto(app.origin+'/app',{waitUntil:'networkidle'});await show('scorecard-configure');const editor=page.locator('#scorecard-editor')
   for(const [i,m] of config.measures.entries()){
    await show('scorecard-measure-'+i)
    if(m.aggregate)await editor.getByLabel(`Related values for measure ${i+1}`,{exact:true}).selectOption(m.aggregate)
    await editor.getByLabel(`Category values for measure ${i+1} (optional JSON)`,{exact:true}).fill(m.categoryValues?JSON.stringify(m.categoryValues):'')
   }
   await editor.getByLabel('Category values for measure 1 (optional JSON)',{exact:true}).fill('{invalid')
   await submit(page,editor.getByRole('button',{name:'Preview scorecard',exact:true}));assert.equal(await page.getByRole('alert').count(),1);await proof('mapping-refusal','#scorecard-configure')
   await editor.getByLabel('Category values for measure 1 (optional JSON)',{exact:true}).fill(config.measures[0].categoryValues?JSON.stringify(config.measures[0].categoryValues):'')
   await submit(page,editor.getByRole('button',{name:'Preview scorecard',exact:true}));assert.equal(await page.getByRole('alert').count(),0)
   await proof('mapped-preview','#scorecard-preview')
   await show('scorecard-configure');await submit(page,editor.getByRole('button',{name:'Publish scorecard',exact:true}));assert.equal(await page.getByRole('alert').count(),0)
   await show('scorecard-result-'+accountId);await proof('mapped-published','#scorecard-result-'+accountId)
   const current=await api('/state'),task=current.tasks.find(t=>t.accountId===accountId)
   assert.ok(task,'An approved numeric health entry task is available for observational reporting')
   const outcome=await api('/outcomes','POST',{name:'Weighted health observations '+width,segmentId:segment.id,kind:'healthy',windowDays:30,taskIds:[task.id],operationKey:'synthetic-buoy-weighted-outcome-'+width})
   const report=await api('/outcomes/'+outcome.id+'/report'),assessment=report.enrolled[0].currentInputs.health
   assert.ok(assessment.scorecard.breakdown.some(m=>m.field==='survey.nps'));assert.ok(assessment.reasons.some(r=>r.includes('not a churn prediction')))
   const csv=await page.request.get(app.origin+'/api/buoy/outcomes/'+outcome.id+'/report.csv');assert.equal(csv.status(),200);assert.match(await csv.text(),/survey.nps/);
   await page.goto(app.origin+'/app/outcomes',{waitUntil:'networkidle'});assert.match(await page.locator('main').innerText(),/Staff-recorded NPS/);await proof('outcome','main')
   await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Recorded survey and category scorecard forms reflow at 320');await page.setViewportSize({width,height:1000})
  }finally{await context.close()}
 }}finally{await browser.close()}
 assert.deepEqual(failures,[],'Recorded survey and explicit-category native accessibility')
 console.log('Recorded survey forms/refusal/recovery/account/person evidence and category scorecard preview/publish passed at 1440/390.')
}
