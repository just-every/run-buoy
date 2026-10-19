// BOUNDARY-003: every current health/report read explains recorded inputs and gaps.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { startWorker } from './worker.mjs'

const app = await startWorker()
let browser
try {
 const call = (path, method = 'GET', body) => app.request('/api/buoy' + path, { method, body, cookie: app.cookie })
 const json = async (response, status = 200) => { assert.equal(response.status, status, await response.clone().text()); return response.json() }
 const today = new Date().toISOString().slice(0, 10)
 const old = new Date(Date.parse(today) - 40 * 86400000).toISOString().slice(0, 10)
 const make = (id, name, urgent, observedAt = today) => ({ id, name, renewalDate: '2027-03-31', noticeDays: 30, renewalEvidence: 'Customer-signed order form',
  billing: urgent === null ? null : { observedAt, reference: `Invoice ${id}`, currency: 'USD', totalMinor: 4800000, creditsMinor: 0, allocatedMinor: 4800000, dueDate: today },
  support: urgent === null ? null : { observedAt, reference: `Support review ${id}`, openTickets: urgent + 1, urgentTickets: urgent } })
 const fixtures = [make('harbour', 'Harbour Software', 2), make('kestrel', 'Kestrel Labs', 1), make('cedar', 'Cedar Labs', null), make('beacon', 'Beacon Systems', 0, old), make('summit', 'Summit Analytics', 0)]
 for (const account of fixtures) await json(await call('/accounts', 'POST', account), 201)
 const state = () => jsonFrom('/state')
 const jsonFrom = async path => json(await call(path))
 const expected = new Map([['harbour', 'at-risk'], ['kestrel', 'at-risk'], ['cedar', 'unknown'], ['beacon', 'unknown'], ['summit', 'healthy']])
 function meaning(health) {
  assert.match(health.interpretation, /recorded evidence.*not a churn prediction.*causation/i)
  assert.ok(health.evaluatedOn)
  assert.ok(health.reasons.length)
 }
 const first = await state()
 const command = await json(await call('/commands', 'POST', { command: 'renewals.list', input: {} }))
 for (const account of first.accounts) {
  assert.equal(account.health.status, expected.get(account.id))
  meaning(account.health)
  assert.deepEqual(command.accounts.find(a => a.id === account.id).health, account.health)
  assert.deepEqual((await jsonFrom(`/accounts/${account.id}/health`)).health, account.health, 'BOUNDARY-003 date and state health doors agree')
  if (account.id === 'cedar') assert.ok(account.health.evidence.every(source => source.missing))
  if (account.id === 'beacon') assert.ok(account.health.evidence.every(source => source.stale && !source.missing))
  if (account.id === 'harbour') assert.ok(account.health.reasons.some(reason => reason.includes(account.support.reference)))
 }
 const sentiment = await json(await call('/accounts/summit/sentiment', 'POST', { rating: 'red', reason: 'Champion departure needs confirmation', days: 1 }), 201)
 meaning(sentiment.health)
 assert.equal(sentiment.health.status, 'at-risk')
 assert.ok(sentiment.health.reasons.some(reason => reason.includes('Champion departure needs confirmation')))
 const future = new Date(Date.parse(today) + 3 * 86400000).toISOString().slice(0, 10)
 const expired = (await jsonFrom(`/accounts/summit/health?on=${future}`)).health
 assert.equal(expired.evaluatedOn, future)
 assert.ok(expired.sentiment.expired)
 assert.ok(expired.reasons.some(reason => /expired.*missing/.test(reason)))
 const segment = await json(await call('/segments', 'POST', { name: 'Enterprise recovery', mode: 'static', rules: { match: 'all', conditions: [] }, accountIds: fixtures.map(a => a.id), tier: null, stage: null, playbook: null }), 201)
 const segmentReport = await jsonFrom(`/segments/${segment.id}/report`)
 for (const member of segmentReport.accounts) {
  meaning(member.assessment)
  assert.deepEqual(member.assessment, (await state()).accounts.find(a => a.id === member.accountId).health)
 }
 const segmentCsv = await (await call(`/segments/${segment.id}/report.csv`)).text()
 assert.ok(segmentCsv.includes('billing: missing') && segmentCsv.includes('support: stale'))
 const proposal = await json(await call('/proposals', 'POST', { accountId: 'harbour', kind: 'playbook', payload: { title: 'Confirm customer recovery', dueDate: today } }), 201)
 await json(await call(`/proposals/${proposal.id}/approve`, 'POST', {}))
 const task = (await state()).tasks.find(task => task.proposalId === proposal.id)
 const outcome = await json(await call('/outcomes', 'POST', { name: 'Customer recovery observations', segmentId: segment.id, kind: 'healthy', windowDays: 1, taskIds: [task.id], operationKey: 'boundary-recovery' }), 201)
 const risk = fixtures[0], current = (await state()).accounts.find(a => a.id === risk.id)
 await json(await call('/accounts/harbour', 'PUT', { ...risk, revision: current.revision, support: { ...risk.support, urgentTickets: 0 } }))
 let report = await jsonFrom(`/outcomes/${outcome.id}/report`)
 assert.equal(report.rate, 1)
 const reached = report.enrolled[0].evidence
 // Missing current evidence cannot be passed off as the earlier outcome's inputs.
 const healthy = (await state()).accounts.find(a => a.id === risk.id)
 await json(await call('/accounts/harbour', 'PUT', { ...risk, revision: healthy.revision, billing: null, support: null }))
 await app.scheduled('0 * * * *', Date.parse(report.deadline) + 1)
 report = await jsonFrom(`/outcomes/${outcome.id}/report`)
 assert.equal(report.enrolled[0].evidence, reached)
 assert.equal(report.rate, 1)
 assert.equal(report.enrolled[0].currentInputs.health.status, 'unknown')
 assert.ok(report.enrolled[0].currentInputs.health.evidence.every(source => source.missing))
 assert.match(report.interpretation, /observational comparison.*never proof of causation/i)
 assert.ok(report.comparison.some(account => account.status === 'missed'))
 assert.deepEqual((await jsonFrom('/outcomes')).reports.find(r => r.id === outcome.id), report)
 const csv = await (await call(`/outcomes/${outcome.id}/report.csv`)).text()
 assert.ok(csv.includes(reached) && csv.includes('not a churn prediction') && csv.includes('never proof of causation'))

 browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
 await mkdir('../screens', { recursive: true })
 for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, ignoreHTTPSErrors: true })
  try {
   await context.addCookies(app.cookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: app.origin } }))
   const page = await context.newPage()
   for (const path of ['/app', '/app/accounts/kestrel', '/app/segments', '/app/outcomes']) {
    assert.equal((await page.goto(app.origin + path, { waitUntil: 'networkidle' })).status(), 200)
    const text = await page.locator('main').innerText()
    assert.match(text, /not a churn prediction.*causation/i)
    if (path === '/app/segments') {
     for (const account of (await state()).accounts) {
      const record = page.locator('li.record').filter({ has: page.getByRole('heading', { name: account.name, exact: true }) })
      for (const reason of account.health.reasons) assert.ok((await record.innerText()).includes(reason))
     }
    }
    if (path === '/app/accounts/kestrel') assert.ok(text.includes(fixtures[1].support.reference))
    if (path === '/app/outcomes') {
     assert.match(text, /observational comparison.*never proof of causation/i)
     assert.ok(text.includes(reached) && text.includes('Billing: missing. Support: missing.'))
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `BOUNDARY-003 ${path} reflows at ${width}`)
    await page.screenshot({ path: `../screens/boundary-${path.replaceAll('/', '-')}-${width}.png`, fullPage: true })
   }
  } finally { await context.close() }
 }
 console.log('BOUNDARY-003 passed: every current health API, manual sentiment/expiry, segment and CSV, closed observational report and current-input gaps; four screens at 1440/390.')
} finally { await browser?.close(); await app.close() }
