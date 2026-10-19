// SEGMENT-001 real forms and their account/report/team end states at desktop and phone widths.
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { startWorker } from './worker.mjs'
const app=await startWorker(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{
 const today=new Date().toISOString().slice(0,10)
 const call=(path,method='GET',body)=>app.request('/api/buoy'+path,{method,body,cookie:app.cookie})
  for(const width of [1440,390]){
  const account={id:`harbour-${width}`,name:`Harbour Software ${width}`,renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Signed renewal order form section 4',billing:{observedAt:today,reference:`INV-${width}`,currency:'USD',totalMinor:6500000,creditsMinor:0,allocatedMinor:0,dueDate:today},support:{observedAt:today,reference:`SUP-${width}`,openTickets:4,urgentTickets:1}}
  assert.equal((await call('/accounts','POST',account)).status,201);
  const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true})
  await context.addCookies(app.cookie.split('; ').map(pair=>{const [name,...value]=pair.split('=');return {name,value:value.join('='),url:app.origin}}))
  const page=await context.newPage()
  const submit=async(form,label)=>{await Promise.all([page.waitForURL(url=>url.searchParams.has('success')),form.getByRole('button',{name:label,exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('[data-form-error]').count(),0,await page.locator('body').innerText())}
  const capture=async(name)=>{
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`SEGMENT-001 ${name} fits ${width}`)
   if(process.env.BUOY_SCREENSHOTS){await mkdir(process.env.BUOY_SCREENSHOTS,{recursive:true});await page.screenshot({path:`${process.env.BUOY_SCREENSHOTS}/${name}-${width}.png`})}
  }
  await page.goto(app.origin+'/app/segments');const tierForm=page.locator('#segment-tiers');await tierForm.getByLabel('Tier names').fill('high-touch\nscaled\ndigital\nStrategic partners');await tierForm.scrollIntoViewIfNeeded();await capture('tier-names');await submit(tierForm,'Save tier names');await page.locator('#create-segment summary').click()
  const create=page.locator('#segment-create')
  await create.getByLabel('Segment name',{exact:true}).fill(`Enterprise risk ${width}`)
  await create.getByLabel('Rule conditions').fill(JSON.stringify([{field:'id',op:'eq',value:account.id},{field:'billing.currency',op:'eq',value:'USD'},{field:'billing.totalMinor',op:'gt',value:5000000},{field:'health.status',op:'eq',value:'at-risk'}]))
  await create.getByLabel('Rule tier').selectOption('Strategic partners');await create.getByLabel('Rule stage').selectOption('renewal')
  await create.getByLabel('Entry playbook title').fill(`Customer risk review ${width}`);await create.getByLabel('Playbook due in days').fill('5')
  await submit(create,'Create segment')
  const data=await (await call('/segments')).json(),segment=data.segments.find(s=>s.name===`Enterprise risk ${width}`)
  assert.equal(segment.members.length,1);assert.equal(segment.history.length,1)
  const report=page.locator(`#segment-${segment.id}`);assert.match(await report.innerText(),/1 members/);assert.match(await report.innerText(),/Strategic partners/)
  await report.scrollIntoViewIfNeeded();await capture('segments-report')
  const csv=await call(`/segments/${segment.id}/report.csv`);assert.match(await csv.text(),new RegExp(account.name))
  await page.goto(app.origin+`/app/accounts/${account.id}`)
  const approval=page.locator(`form#approve-${segment.history[0].proposalId}`)
  await submit(approval,'Approve and create task')
  const state=await (await call('/state')).json();assert.equal(state.tasks.filter(t=>t.proposalId===segment.history[0].proposalId).length,1)
  await page.locator('#evidence').scrollIntoViewIfNeeded();assert.match(await page.locator('#evidence').innerText(),/Service tier: Strategic partners.*Lifecycle stage: renewal/);await capture('account-classification')
  await page.goto(app.origin+'/app/segments');const classify=page.locator('#segment-classify')
  await classify.getByLabel('Account').selectOption(account.id);await classify.getByLabel('Manual tier').selectOption('digital');await classify.getByLabel('Manual stage').selectOption('adoption');await submit(classify,'Save account classification')
  let effective=(await (await call('/state')).json()).accounts.find(a=>a.id===account.id);assert.equal(effective.tier,'digital');assert.equal(effective.stage,'adoption')
  const editPanel=page.locator(`#edit-segment-${segment.id}`);await editPanel.locator('summary').click()
  const edit=page.locator(`#segment-edit-${segment.id}`)
  await edit.getByLabel('Rule conditions').fill(JSON.stringify([{field:'id',op:'eq',value:'no-match'}]));await submit(edit,'Save segment')
  assert.equal((await (await call('/segments')).json()).segments.find(s=>s.id===segment.id).members.length,0)
  await page.locator(`#edit-segment-${segment.id} summary`).click();await page.locator(`#segment-edit-${segment.id}`).getByLabel('Rule conditions').fill(JSON.stringify([{field:'id',op:'eq',value:account.id}]))
  await submit(page.locator(`#segment-edit-${segment.id}`),'Save segment')
  const reentered=(await (await call('/segments')).json()).segments.find(s=>s.id===segment.id);assert.equal(reentered.history.length,2);assert.ok(reentered.history.some(e=>e.exitedAt));assert.equal(reentered.members.length,1)
  // A real team rule consumes the chosen segment through the new selector.
  const owner=(await (await call('/state')).json()).operator.id,team=await(await call('/team')).json()
  await call('/team/settings','PUT',{teams:[...team.teams,{id:`risk-${width}`,name:`Risk team ${width}`,pod:'Enterprise',personIds:[owner]}],capacities:[{personId:owner,capacity:500}],rules:team.rules,territories:team.territories})
  await page.goto(app.origin+'/app/team');const rule=page.locator('#team-rule')
  await rule.getByLabel('Rule name',{exact:true}).fill(`Enterprise segment ${width}`);await rule.getByLabel('Rule team').selectOption(`risk-${width}`);await rule.getByLabel('Match segment').selectOption(segment.id)
  await submit(rule,'Add rule');assert.ok((await(await call('/team')).json()).rules.some(r=>r.segmentId===segment.id));await page.getByRole('heading',{name:'Assignment rules',exact:true}).scrollIntoViewIfNeeded();await capture('team-segment-rule')
  await context.close()
 }
 console.log('SEGMENT-001 real create/edit/classify/entry approval/team forms and report, exit/reentry, CSV and account end states passed at 1440 and 390.')
}finally{await browser.close();await app.close()}
