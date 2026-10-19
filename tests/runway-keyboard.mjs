// A11Y-001 partial: semantic runway data and real keyboard operation.
// The all-screen axe/keyboard acceptance remains required before DONE.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { startWorker } from './worker.mjs'
import { failures, focused } from './keyboard.mjs'

const app = await startWorker()
let browser
try {
 const call = (path, method = 'GET', body) => app.request('/api/buoy' + path, { method, body, cookie: app.cookie })
 const json = async (response, status = 200) => { assert.equal(response.status, status, await response.clone().text()); return response.json() }
 const today = new Date().toISOString().slice(0, 10)
 const day = offset => new Date(Date.parse(today) + offset * 86400000).toISOString().slice(0, 10)
 for (const [id, name, urgent, observed, currency, amount] of [
  ['harbour', 'Harbour Software', 2, today, 'USD', 4800000],
  ['summit', 'Summit Analytics', 0, today, 'KWD', 650125],
  ['cedar', 'Cedar & Co', null, today, 'USD', 0],
  ['north', 'North Research', 0, day(-45), 'JPY', 850000],
 ]) {
  await json(await call('/accounts', 'POST', { id, name, renewalDate: day(120), noticeDays: 30,
   renewalEvidence: 'Customer-signed renewal order',
   billing: urgent === null ? null : { observedAt: observed, reference: `Invoice ${name}`, currency, totalMinor: amount, creditsMinor: 0, allocatedMinor: amount, dueDate: today },
   support: urgent === null ? null : { observedAt: observed, reference: `Support review ${name}`, openTickets: urgent, urgentTickets: urgent } }), 201)
 }
 const accounts = (await json(await call('/state'))).accounts
 browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
 for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, ignoreHTTPSErrors: true })
  try {
   await context.addCookies(app.cookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: app.origin } }))
   const page = await context.newPage()
   await page.goto(app.origin + '/app?open=none', { waitUntil: 'networkidle' })
   const table = page.getByRole('table', { name: 'Renewal runway data', exact: true })
   assert.equal(await table.locator('tbody tr').count(), accounts.length, 'A11Y-001 every public account has a semantic row')
   assert.equal(await table.getByRole('columnheader').count(), 6)
   for (const account of accounts) {
    const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: account.name, exact: true }) })
    assert.equal(await row.count(), 1, 'A11Y-001 account names remain plain text in row headers')
    const invoice = await row.getByRole('cell').first().innerText()
    if (account.billing) {
     const { currency, totalMinor } = account.billing
     const digits = new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits
     const whole = totalMinor % 10 ** digits === 0
     assert.equal(invoice, new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: whole ? 0 : digits, maximumFractionDigits: whole ? 0 : digits }).format(totalMinor / 10 ** digits), 'A11Y-001 invoice uses its native currency units')
    } else assert.match(invoice, /no invoice/i)
    const text = await row.innerText()
    assert.ok(text.includes(({ 'at-risk': 'At risk', healthy: 'Healthy', unknown: 'Unknown' })[account.health.status]), 'A11Y-001 health has a text label')
    for (const reason of account.health.reasons) assert.ok(text.includes(reason), 'A11Y-001 every health reason is available in reading order')
    for (const source of account.health.evidence) assert.ok(text.includes(`${source.kind}: ${source.missing ? 'missing' : source.stale ? 'stale' : 'current'}`), 'A11Y-001 missing and stale sources are explicit')
    assert.deepEqual(await row.locator('time').evaluateAll(elements => elements.map(element => element.dateTime)), [account.renewalDate, account.noticeDate, ...account.outlook.slice(1).map(change => change.from)], 'A11Y-001 renewal, notice and projected-change dates match the public data')
    assert.ok(text.includes(`${account.noticeDays} days`))
    for (const change of account.outlook.slice(1)) assert.ok(text.includes(`health would read ${{ 'at-risk': 'At risk', healthy: 'Healthy', unknown: 'Unknown' }[change.status]}`), 'A11Y-001 projected health has a text explanation')
   }
   const region = page.getByRole('region', { name: 'Runway, scrolls sideways', exact: true })
   await focused(page, region, `A11Y-001 runway focus ${width}`)
   if (width === 390) {
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(() => document.querySelector('.rw-scroll').scrollLeft > 0)
    await page.keyboard.press('ArrowLeft')
    await page.waitForFunction(() => document.querySelector('.rw-scroll').scrollLeft === 0)
   }
   await focused(page, page.getByRole('link', { name: 'Open Harbour Software on the runway', exact: true }), `A11Y-001 expansion ${width}`)
   await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.keyboard.press('Enter')])
   assert.equal(await page.getByRole('link', { name: 'Close Harbour Software on the runway', exact: true }).getAttribute('aria-expanded'), 'true')
   await page.setViewportSize({ width: 320, height: 1000 })
   const reflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth, outside: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right })) }))
   assert.ok(reflow.page <= reflow.viewport, `A11Y-001 the semantic table does not widen the page at 320px: ${JSON.stringify(reflow)}`)
   await page.setViewportSize({ width, height: 1000 })
   await mkdir('../screens', { recursive: true })
   await page.screenshot({ path: `../screens/runway-keyboard-${width}.png`, fullPage: true })

   await page.goto(app.origin + '/app/accounts/harbour', { waitUntil: 'networkidle' })
   const opener = page.getByRole('button', { name: /Details\s*:\s*Account source details/ })
   await focused(page, opener, `A11Y-001 source dialog opener ${width}`)
   await page.keyboard.press('Enter')
   const dialog = page.getByRole('dialog', { name: 'Account source details' })
   await dialog.waitFor({ state: 'visible' })
   for (const key of ['Tab', 'Shift+Tab']) {
    await page.keyboard.press(key)
    assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), 'A11Y-001 forward and reverse Tab remain inside the modal')
   }
   await page.screenshot({ path: `../screens/runway-dialog-${width}.png`, fullPage: true })
   await page.keyboard.press('Escape')
   assert.ok(await opener.evaluate(element => element === document.activeElement), 'A11Y-001 Escape returns focus to the opener')
   assert.equal(await dialog.isVisible(), false)
  } finally { await context.close() }
 }
 assert.deepEqual(failures, [], 'A11Y-001 visible, unobscured keyboard focus')
 console.log('A11Y-001 partial: native-currency semantic table, current/missing/stale health, projected dates, keyboard scrolling/expansion and dialog focus at 1440/390 passed. Full all-screen axe/keyboard acceptance remains outstanding.')
} finally {
 await browser?.close()
 await app.close()
}
