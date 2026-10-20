// A11Y-001: current product screens and real keyboard work through the built Worker.
// Axe and these measurable checks support, but do not establish, WCAG 2.2 AA.
// Portal, native mobile and future builders need their own acceptance before shipping.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { startWorker } from './worker.mjs'
import { authJourney } from './a11y-auth.mjs'
import { importJourney } from './a11y-import.mjs'
import { governanceJourney } from './a11y-governance.mjs'

import { failures, manual, scans, check, focused, type, submit, openForms, scan } from './a11y-checks.mjs'

const app = await startWorker()
let browser
try {
 browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
 await authJourney(browser)
 const call = (path, method = 'GET', body) => app.request('/api/buoy' + path, { method, body, cookie: app.cookie })
 const json = async (response, status = 200) => { assert.equal(response.status, status, await response.clone().text()); return response.json() }
 const today = new Date().toISOString().slice(0, 10)
 const renewal = new Date(Date.parse(today) + 120 * 86400000).toISOString().slice(0, 10)
 for (const width of [1440, 390]) {
  const makeAccount = (suffix, urgentTickets, sources = true) => ({ id: `a11y-${width}-${suffix}`, name: `Harbour ${suffix} ${width}`, renewalDate: renewal,
   noticeDays: 30, renewalEvidence: 'Customer-signed renewal order',
   billing: sources ? { observedAt: today, reference: `INV-${width}-${suffix}`, currency: 'USD', totalMinor: 6500000, creditsMinor: 0, allocatedMinor: 6500000, dueDate: today } : null,
   support: sources ? { observedAt: today, reference: `CASE-${width}-${suffix}`, openTickets: urgentTickets, urgentTickets } : null })
  const risk = makeAccount('risk', 1), control = makeAccount('control', 1)
  for (const account of [risk, control, makeAccount('healthy', 0), makeAccount('unknown', 0, false)]) await json(await call('/accounts', 'POST', account), 201)
  const segment = await json(await call('/segments', 'POST', { name: `Recovery cohort ${width}`, mode: 'static', rules: { match: 'all', conditions: [] },
   accountIds: [risk.id, control.id], tier: null, stage: null, playbook: null }), 201)
  const context = await browser.newContext({ viewport: { width, height: 1000 }, ignoreHTTPSErrors: true })
  try {
   await context.addCookies(app.cookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: app.origin } }))
   const page = await context.newPage()
   const capture = async stage => { await mkdir('../screens', {recursive:true}); await page.screenshot({path:`../screens/a11y-${stage}-${width}.png`,fullPage:true}) }
   const visit = async path => { const response = await page.goto(app.origin + path, { waitUntil: 'networkidle' }); assert.equal(response.status(), 200, path) }
   await visit('/app?open=none')
   const runwayRegion = page.getByRole('region', { name: 'Runway, scrolls sideways', exact: true })
   await focused(page, runwayRegion, `Runway scroll region at ${width}`)
   if (width === 390) {
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(() => document.querySelector('.rw-scroll').scrollLeft > 0)
    await page.keyboard.press('ArrowLeft')
    await page.waitForFunction(() => document.querySelector('.rw-scroll').scrollLeft === 0)
   }
   const toggle = page.getByRole('link', { name: `Open ${risk.name} on the runway`, exact: true })
   await focused(page, toggle, `Runway toggle at ${width}`)
   await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.keyboard.press('Enter')])
   assert.equal(await page.getByRole('link', { name: `Close ${risk.name} on the runway`, exact: true }).getAttribute('aria-expanded'), 'true')
   await scan(page, `Expanded renewal runway ${width}`)
   await capture('expanded-runway')
   const publicAccounts = (await json(await call('/state'))).accounts
   const table = page.getByRole('table', { name: 'Renewal runway data', exact: true })
   for (const account of publicAccounts) {
    const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: account.name, exact: true }) })
    assert.equal(await row.count(), 1, 'A11Y-001 each public account has one table row')
    const invoice = await row.getByRole('cell').first().innerText()
    if (account.billing) assert.equal(invoice, new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(account.billing.totalMinor / 100), 'A11Y-001 table invoice matches the USD fixture amount')
    else assert.match(invoice, /no invoice/i, 'A11Y-001 missing invoices are named')
    assert.match(await row.innerText(), new RegExp(({ 'at-risk': 'At risk', healthy: 'Healthy', unknown: 'Unknown' })[account.health.status]))
    assert.deepEqual(await row.locator('time').evaluateAll(elements => elements.map(element => element.dateTime)), [account.renewalDate, account.noticeDate, ...account.outlook.slice(1).map(change => change.from)], 'A11Y-001 table dates and projected changes match public account data')
    for (const reason of account.health.reasons) assert.ok((await row.innerText()).includes(reason), 'A11Y-001 table includes every health reason')
    for (const source of account.health.evidence) assert.ok((await row.innerText()).includes(`${source.kind}: ${source.missing ? 'missing' : source.stale ? 'stale' : 'current'}`), 'A11Y-001 table names missing and stale sources')
   }


   await visit(`/app/accounts/${risk.id}`)
   const opener = page.getByRole('button', { name: /Details\s*:\s*Account source details/ })
   await focused(page, opener, `Dialog opener at ${width}`)
   await page.keyboard.press('Enter')
   const dialog = page.getByRole('dialog', { name: 'Account source details' })
   await dialog.waitFor({ state: 'visible' })
   await check(`Dialog traps focus at ${width}`, async () => {
    for (const key of ['Tab', 'Shift+Tab']) { await page.keyboard.press(key); assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), 'Focus remains in the modal') }
   })
   await scan(page, `Account source dialog ${width}`)
   await capture('source-dialog')
   await page.keyboard.press('Escape')
   assert.ok(await opener.evaluate(element => element === document.activeElement), 'Escape returns focus to the dialog opener')

   await focused(page, page.locator('#prepare-playbook > summary'), `Playbook disclosure at ${width}`)
   await page.keyboard.press('Enter')
   let form = page.locator('#playbook')
   await type(page, form.getByLabel('Task title', { exact: true }), '   ')
   // Initialize the three native date segments through the keyboard.
   const dueDate = form.getByLabel('Task due date')
   await focused(page, dueDate, `Native date keyboard focus at ${width}`)
   for (const key of ['ArrowUp', 'ArrowRight', 'ArrowUp', 'ArrowRight', 'ArrowUp', 'Tab']) await page.keyboard.press(key)
   assert.match(await dueDate.inputValue(), /^\d{4}-\d{2}-\d{2}$/, 'A11Y-001 the native date control accepts keyboard entry')
   await submit(page, form.getByRole('button', { name: 'Prepare playbook', exact: true }))
   await page.locator('[data-form-error]').waitFor({ state: 'visible' })
   assert.ok(await page.locator('[data-form-error]').evaluate(element => element === document.activeElement), 'Server validation moves focus to its alert')
   assert.equal(await page.locator('#playbook').getAttribute('aria-describedby'), 'form-error')
   await scan(page, `Playbook validation ${width}`)
   await capture('validation')
   form = page.locator('#playbook')
   const taskTitle = `Customer recovery review ${width}`
   await type(page, form.getByLabel('Task title', { exact: true }), taskTitle)
   await submit(page, form.getByRole('button', { name: 'Prepare playbook', exact: true }))
   assert.equal(await page.locator('[data-form-error]').count(), 0)
   const prepared = (await json(await call('/state'))).proposals.find(proposal => proposal.accountId === risk.id && proposal.payload.title === taskTitle)
   assert.ok(prepared, 'The real preparation form created a proposal')
   await scan(page, `Pending playbook approval ${width}`)
   await capture('pending-approval')
   await submit(page, page.locator(`#approve-${prepared.id}`).getByRole('button', { name: 'Approve and create task', exact: true }))
   const task = (await json(await call('/state'))).tasks.find(item => item.proposalId === prepared.id)
   assert.ok(task, 'Keyboard approval creates the approved task')
   await scan(page, `Approved playbook ${width}`)
   await capture('approved-task')

   await visit('/app/outcomes')
   await focused(page, page.locator('#outcome-start-panel > summary'), `Outcome disclosure at ${width}`)
   await page.keyboard.press('Enter')
   form = page.locator('#outcome-start-form')
   await type(page, form.getByLabel('Outcome report name'), `Recovery results ${width}`)
   const segmentSelect = form.getByRole('combobox', { name: /^Segment/ })
   await focused(page, segmentSelect, 'Report segment select keyboard focus')
   const option = await segmentSelect.evaluate((element, value) => [...element.options].findIndex(item => item.value === value), segment.id)
   assert.ok(option > 0, 'The real cohort is offered by the report form')
   const choices = await segmentSelect.locator('option').allTextContents()
   const initial = choices[option].trim()[0].toLowerCase()
   for (const choice of choices.slice(0, option + 1).filter(text => text.trim().toLowerCase().startsWith(initial))) await page.keyboard.press(initial)
   await page.keyboard.press('Tab')
   assert.equal(await segmentSelect.inputValue(), segment.id, 'Keyboard selects the real report cohort')
   await type(page, form.getByLabel('Approved task IDs'), task.id)
   await scan(page, `Outcome setup ${width}`)
   await capture('outcome-setup')
   await submit(page, form.getByRole('button', { name: 'Start outcome tracking', exact: true }))
   assert.equal(await page.locator('[data-form-error]').count(), 0)
   const current = (await json(await call('/state'))).accounts.find(account => account.id === risk.id)
   await json(await call(`/accounts/${risk.id}`, 'PUT', { ...risk, revision: current.revision, support: { ...risk.support, urgentTickets: 0 } }))
   await visit('/app/outcomes')
   const report = page.locator('section').filter({ has: page.getByRole('heading', { name: `Recovery results ${width}`, exact: true }) })
   assert.match(await report.innerText(), /1 of 1 · 100%/)
   assert.match(await report.innerText(), /0 of 1 · 0%/)
   const csv = report.getByRole('link', { name: 'Download outcome report (CSV)' })
   await focused(page, csv, `Report export at ${width}`)
   const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')])
   assert.equal(await download.failure(), null, 'The report CSV is downloadable with the keyboard')
   await scan(page, `Outcome report ${width}`)
   await capture('outcome-report')

   await visit(`/app/accounts/${risk.id}`)
   form = page.locator(`#complete-${task.id}`)
   await type(page, form.getByLabel('Outcome reason'), 'Customer recovery reviewed with the CSM')
   await type(page, form.getByLabel('Completion evidence'), 'Customer-confirmed support review')
   await submit(page, form.getByRole('button', { name: 'Record completion', exact: true }))
   assert.ok((await json(await call('/state'))).tasks.find(item => item.id === task.id).completedAt, 'Keyboard completion records real work')
   await scan(page, `Completed task ${width}`)
   await capture('completed-task')
   await importJourney(page, app, width)
   await governanceJourney(page, app, width)

   const screens = ['/app', `/app/accounts/${risk.id}`, '/app/imports', '/app/backups', '/app/notifications', '/app/team', '/app/audit', '/app/segments', '/app/outcomes']
   for (const path of screens) {
    await visit(path)
    await focused(page, page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link').first(), `${path} navigation at ${width}`)
    await openForms(page)
    await scan(page, `${path} ${width}`)
    await mkdir('../screens',{recursive:true});await page.screenshot({path:`../screens/a11y-${path.split('/').filter(Boolean).join('-')}-${width}.png`,fullPage:true})
   }
  } finally { await context.close() }
 }
 // Incomplete axe checks remain explicit evidence for a human accessibility pass.
 console.log(`A11Y-001: ${scans} browser scans; keyboard runway, dialogs, validation, preparation, approval, completion and report export; reflow down to 320px. Manual review: ${JSON.stringify(manual)}`)
 assert.deepEqual(failures, [], 'A11Y-001 current product browser findings')
 console.log('A11Y-001 measurable current-screen checks passed. Axe is not proof of full WCAG 2.2 AA conformance.')
} catch(error) { console.error('A11Y-001 findings before journey stopped:',JSON.stringify(failures)); throw error } finally {
 await browser?.close()
 await app.close()
}
