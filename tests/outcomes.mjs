// PLAY-004 real outcome setup, approved task cohort, observations and report at both widths.
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { startWorker } from './worker.mjs'
const app=await startWorker(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{
 const call=(path,method='GET',body)=>app.request('/api/buoy'+path,{method,body,cookie:app.cookie})
 const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()}
 for(const width of [1440,390]){
  const today=new Date().toISOString().slice(0,10),accounts=[]
  for(let i=0;i<4;i++){
   const a={id:`outcome-${width}-${i}`,name:['Harbour Software','Kestrel Labs','Beacon Systems','Northstar Software'][i]+` ${width}`,renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Customer-signed order form',billing:{observedAt:today,reference:`INV-${width}-${i}`,currency:'USD',totalMinor:6500000,creditsMinor:0,allocatedMinor:0,dueDate:today},support:{observedAt:today,reference:`CASE-${width}-${i}`,openTickets:3,urgentTickets:1}}
   await json(await call('/accounts','POST',a),201);accounts.push(a)
  }
  const segment=await json(await call('/segments','POST',{name:`Enterprise success ${width}`,mode:'static',rules:{match:'all',conditions:[]},accountIds:accounts.map(a=>a.id),tier:null,stage:null,playbook:null}),201),tasks=[]
  for(const a of accounts.slice(0,2)){const p=await json(await call('/proposals','POST',{accountId:a.id,kind:'playbook',payload:{title:'Customer recovery plan',dueDate:today}}),201);await json(await call(`/proposals/${p.id}/approve`,'POST',{}));tasks.push((await json(await call('/state'))).tasks.find(t=>t.proposalId===p.id).id)}
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.addCookies(app.cookie.split('; ').map(pair=>{const [name,...v]=pair.split('=');return {name,value:v.join('='),url:app.origin}}))
  const page=await context.newPage();await page.goto(app.origin+'/app/outcomes');await page.locator('#outcome-start-panel summary').click()
  const form=page.locator('#outcome-start-form');await form.getByLabel('Outcome report name').fill(`Enterprise recovery ${width}`);await form.getByLabel('Segment').selectOption(segment.id);await form.getByLabel('Outcome to observe').selectOption('healthy');await form.getByLabel('Observation window').fill('30');await form.getByLabel('Approved task IDs').fill(tasks.join(', '))
  await Promise.all([page.waitForURL(url=>url.searchParams.has('success')),form.getByRole('button',{name:'Start outcome tracking'}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('[data-form-error]').count(),0)
  const report=(await json(await call('/outcomes'))).reports.find(r=>r.name===`Enterprise recovery ${width}`);assert.equal(report.enrolled.length,2);assert.equal(report.comparison.length,2);assert.equal(report.rate,0)
  const current=(await json(await call('/state'))).accounts.find(a=>a.id===accounts[0].id)
  await json(await call('/accounts/'+current.id,'PUT',{...accounts[0],revision:current.revision,billing:{...accounts[0].billing,allocatedMinor:accounts[0].billing.totalMinor},support:{...accounts[0].support,urgentTickets:0}}))
  await page.reload();await page.waitForLoadState('networkidle')
  const section=page.locator('section').filter({has:page.getByRole('heading',{name:report.name,exact:true})})
  assert.match(await section.innerText(),/1 of 2 · 50%/);assert.match(await section.innerText(),/0 of 2 · 0%/);assert.match(await section.innerText(),/observational comparison/i);assert.match(await section.innerText(),/Healthy evidence at account revision/)
  const actual=await json(await call(`/outcomes/${report.id}/report`));assert.equal(actual.rate,0.5);assert.ok(actual.meanHours>=0);assert.equal(actual.enrolled.filter(a=>a.reachedAt).length,1);assert.equal((await json(await call('/state'))).tasks.find(t=>t.id===tasks[0]).completedAt,null)
  const csv=await call(`/outcomes/${report.id}/report.csv`);assert.match(await csv.text(),new RegExp(accounts[0].name))
  await section.getByRole('heading',{name:report.name,exact:true}).scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`PLAY-004 report fits ${width}`)
  if(process.env.BUOY_SCREENSHOTS){await mkdir(process.env.BUOY_SCREENSHOTS,{recursive:true});await page.screenshot({path:`${process.env.BUOY_SCREENSHOTS}/outcomes-report-${width}.png`});await section.getByRole('heading',{name:'Unenrolled comparison accounts',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`${process.env.BUOY_SCREENSHOTS}/outcomes-comparison-${width}.png`})}
  await context.close()
 }
 console.log('PLAY-004 setup form, approved task cohorts, 50% outcomes, timing/evidence, comparison, CSV and unchanged task completion passed at 1440 and 390.')
}finally{await browser.close();await app.close()}
