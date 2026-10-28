// Native setup, deterministic source observations and downloaded report at both widths.
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { startWorker } from './worker.mjs'
import { assertOutcomeRows, assertOutcomeCsv } from './outcome-checks.mjs'

const startedAt = '2026-10-25T10:00:00.000Z', today = startedAt.slice(0, 10)
const browser = await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try {
 for (const width of [1440, 390]) {
  let instant = Date.parse(startedAt)
  const app = await startWorker({clock: () => instant})
  const context = await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true,acceptDownloads:true})
  try {
   const call = (path, method='GET', body) => app.request('/api/buoy'+path, {method,body,cookie:app.cookie})
   const json = async (response, status=200) => {assert.equal(response.status,status,await response.clone().text());return response.json()}
   const accounts = [], tasks = [], expected = []
   for (let i=0; i<80; i++) {
    const account = {id:`synthetic-buoy-${width*100+i}`,name:['Harbour Software','Kestrel "Customer" Labs','Beacon, Systems','Northstar Software'][i%4]+` ${i+1}`,renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Customer-signed order form',billing:{observedAt:today,reference:`synthetic-buoy-${9000+i}`,currency:'USD',totalMinor:6500000,creditsMinor:0,allocatedMinor:0,dueDate:today},support:{observedAt:today,reference:`synthetic-buoy-${9100+i}`,openTickets:3,urgentTickets:1}}
    accounts.push(await json(await call('/accounts','POST',account),201))
    expected.push({cohort:i<40?'enrolled':'comparison',accountId:account.id,name:account.name,status:'observing',reachedAt:null,elapsedHours:null,evidence:null})
   }
   const segmentInput = {name:`Enterprise success ${width}`,mode:'static',rules:{match:'all',conditions:[]},accountIds:accounts.map(a=>a.id),tier:null,stage:null,playbook:null}
   const segment = await json(await call('/segments','POST',segmentInput),201)
   for (const account of accounts.slice(0,40)) {
    const proposal = await json(await call('/proposals','POST',{accountId:account.id,kind:'playbook',payload:{title:'Customer recovery plan',dueDate:today}}),201)
    await json(await call(`/proposals/${proposal.id}/approve`,'POST',{}))
    tasks.push((await json(await call('/state'))).tasks.find(task=>task.proposalId===proposal.id).id)
   }
   await context.addCookies(app.cookie.split('; ').map(pair=>{const [name,...value]=pair.split('=');return {name,value:value.join('='),url:app.origin}}))
   const page = await context.newPage()
   const proof = async name => {
    if (!process.env.BUOY_SCREENSHOTS) return
    await mkdir(process.env.BUOY_SCREENSHOTS,{recursive:true})
    await page.screenshot({path:`${process.env.BUOY_SCREENSHOTS}/outcomes-${name}-${width}.png`})
   }
   await context.setExtraHTTPHeaders({'x-buoy-test-time':String(instant)})
   await page.goto(app.origin+'/app/outcomes')
   await page.locator('#outcome-start-panel summary').click()
   const form = page.locator('#outcome-start-form')
   await form.getByLabel('Outcome report name').fill(`Enterprise recovery ${width}`)
   await form.getByLabel('Segment').selectOption(segment.id)
   await form.getByLabel('Outcome to observe').selectOption('healthy')
   await form.getByLabel('Observation window').fill('2')
   await form.getByLabel('Approved task IDs').fill(tasks.join(', '))
   await form.getByRole('button',{name:'Start outcome tracking'}).scrollIntoViewIfNeeded()
   await proof('setup')
   await Promise.all([page.waitForURL(url=>url.searchParams.has('success')),form.getByRole('button',{name:'Start outcome tracking'}).click()])
   await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('[data-form-error]').count(),0)
   const initial = (await json(await call('/outcomes'))).reports.find(report=>report.name===`Enterprise recovery ${width}`)
   assert.equal(initial.startedAt,startedAt)
   assert.equal(initial.deadline,'2026-10-27T10:00:00.000Z')
   assertOutcomeRows(initial,expected)
   // Completing work has no power to invent a healthy source observation.
   await json(await call(`/tasks/${tasks[0]}/complete`,'POST',{outcome:'Review conducted',evidence:'Customer review minutes retained'}))
   assertOutcomeRows(await json(await call(`/outcomes/${initial.id}/report`)),expected)
   const sourceState = await json(await call('/state'))
   for (const account of accounts) account.revision = sourceState.accounts.find(item=>item.id===account.id).revision
   const schedule = [...Array.from({length:20},(_,index)=>({index,offset:3600000+index*139111})),...Array.from({length:5},(_,index)=>({index:40+index,offset:1800000+index*487321}))].sort((a,b)=>a.offset-b.offset)
   for (const observation of schedule) {
    instant = Date.parse(startedAt)+observation.offset
    const original = accounts[observation.index]
    const updated = await json(await call('/accounts/'+original.id,'PUT',{...original,billing:{...original.billing,allocatedMinor:original.billing.totalMinor},support:{...original.support,urgentTickets:0}}))
    accounts[observation.index] = updated
    Object.assign(expected[observation.index],{status:'reached',reachedAt:new Date(instant).toISOString(),elapsedHours:(instant-Date.parse(startedAt))/3600000,evidence:`Healthy evidence at account revision ${updated.revision}: Current billing and support snapshots show no defined risk signal.`})
   }
   // Removing live membership must not alter either frozen report cohort.
   const currentSegment = (await json(await call('/segments'))).segments.find(item=>item.id===segment.id)
   await json(await call('/segments','POST',{...segmentInput,id:segment.id,revision:currentSegment.revision,accountIds:[]}),201)
   instant += 300000
   await context.setExtraHTTPHeaders({'x-buoy-test-time':String(instant)})
   await page.reload();await page.waitForLoadState('networkidle')
   const actual = await json(await call(`/outcomes/${initial.id}/report`))
   assertOutcomeRows(actual,expected)
   assert.equal(actual.rate,0.5);assert.equal(actual.comparisonRate,0.125)
   const section = page.locator('section').filter({has:page.getByRole('heading',{name:initial.name,exact:true})})
   assert.match(await section.innerText(),/observational comparison/i)
   const value = (scope,label) => scope.locator('dt').filter({hasText:new RegExp('^'+label+'$')}).locator('xpath=following-sibling::dd[1]')
   // Round independent millisecond calculations; keep full export precision.
   const hours = number => `${Number(number.toFixed(2))} hours`
   for (const [cohort,title,rate] of [['enrolled','Enrolled accounts','50%'],['comparison','Unenrolled comparison accounts','12.5%']]) {
    const heading = section.getByRole('heading',{name:title,exact:true})
    const summary = heading.locator('xpath=following-sibling::dl[1]')
    const wanted = expected.filter(row=>row.cohort===cohort), reached = wanted.filter(row=>row.reachedAt)
    const mean = reached.reduce((sum,row)=>sum+row.elapsedHours,0)/reached.length
    assert.equal(await value(summary,'Reached outcome').innerText(),`${reached.length} of 40 · ${rate}`)
    assert.equal(await value(summary,'Mean elapsed UTC hours among reached accounts').innerText(),hours(mean))
    await heading.scrollIntoViewIfNeeded();await proof(cohort+'-summary')
    const records = heading.locator('xpath=following-sibling::ul[1]').locator('li.record')
    assert.equal(await records.count(),wanted.length)
    for (const row of wanted) {
     const record = records.filter({has:page.getByRole('link',{name:row.name,exact:true})})
     assert.equal(await record.count(),1)
     assert.equal(await value(record,'Status').innerText(),row.status==='reached'?'Reached':'Observing')
     assert.equal(await value(record,'Elapsed UTC hours').innerText(),row.elapsedHours===null?'No observed outcomes':hours(row.elapsedHours))
     assert.equal(await value(record,'First observed outcome \\(UTC\\)').innerText(),row.reachedAt??'No observed outcomes')
     if(row.reachedAt) assert.equal(await record.locator('time').getAttribute('datetime'),row.reachedAt)
     assert.equal(await value(record,'Outcome evidence').innerText(),row.evidence??'No observed evidence')
     const input = actual[cohort].find(item=>item.accountId===row.accountId).currentInputs, seeded = accounts.find(item=>item.id===row.accountId)
     assert.deepEqual(input.billing,seeded.billing);assert.deepEqual(input.support,seeded.support);assert.equal(input.revision,seeded.revision);assert.equal(input.asOf,today)
    }
    await records.first().scrollIntoViewIfNeeded();await proof(cohort+'-evidence')
   }
   assert.equal((await json(await call('/state'))).tasks.find(task=>task.id===tasks[1]).completedAt,null)
   const downloadLink = section.getByRole('link',{name:'Download outcome report (CSV)'})
   await downloadLink.scrollIntoViewIfNeeded()
   const [download] = await Promise.all([page.waitForEvent('download'),downloadLink.click()])
   assert.equal(await download.failure(),null)
   const stream = await download.createReadStream(), chunks = []
   for await (const chunk of stream) chunks.push(chunk)
   const csv = Buffer.concat(chunks).toString('utf8')
   assertOutcomeCsv(csv,expected,actual)
   assert.match(csv,/Harbour Software/)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Outcome report fits ${width}`)
   await proof('download')
  } finally {await context.close();await app.close()}
 }
 console.log('Outcome setup, frozen 40-account cohorts, 50% and 12.5% rates, independently timed observations, rendered rounding, evidence and complete browser CSV reconciliation passed at 1440 and 390.')
} finally {await browser.close()}
