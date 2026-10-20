// A11Y-001: keyboard move-in custody and accessibility across every import end state.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { focused, openForms, scan } from './a11y-checks.mjs'

// The caller supplies an owner session on the real application at each width.
export async function importJourney(page, app, width) {
 const today = new Date().toISOString().slice(0, 10)
 const account = {
  id: `harbour-migration-${randomUUID()}`,
  name: `Harbour Migration ${width}`,
  renewalDate: new Date(Date.parse(today) + 120 * 86400000).toISOString().slice(0, 10),
  noticeDays: 30,
  renewalEvidence: 'Harbour signed renewal order, section 4',
  billing: { observedAt: today, reference: 'Harbour invoice HBR-1042', currency: 'USD',
   totalMinor: 120000, creditsMinor: 10000, allocatedMinor: 30000, dueDate: today },
  support: { observedAt: today, reference: 'Harbour support handover', openTickets: 3, urgentTickets: 1 }
 }
 const state = async () => {
  const response = await page.request.get(app.origin + '/api/buoy/state')
  assert.equal(response.status(), 200, 'Owner can inspect native import results through the public state API')
  return response.json()
 }
 const activate = async (target, label, key = 'Enter') => {
  await focused(page, target, `Import ${label} ${width}`)
  await page.keyboard.press(key)
 }
 const snapshot = async stage => {
  await openForms(page)
  await scan(page, `Import ${stage} ${width}`)
  await page.screenshot({ path: `../screens/a11y-import-${stage}-${width}.png`, fullPage: true })
 }
 const resultReady = async title => {
  await page.waitForFunction(expected => {
   const heading = document.getElementById('import-result-title')
   const status = document.getElementById('import-status')
   return heading?.textContent === expected && !document.getElementById('import-result')?.hidden && status && !status.disabled
  }, title)
 }

 await mkdir('../screens', { recursive: true })
 const response = await page.goto(app.origin + '/app/imports', { waitUntil: 'networkidle' })
 assert.equal(response.status(), 200, 'Owner opens the shipped Imports screen')
 await page.waitForFunction(() => !document.getElementById('import-settings-fields')?.disabled)
 const before = await state()
 assert.ok(!before.accounts.some(item => item.id === account.id), 'Migration starts with a new native account')

 // File selection is the sole non-keyboard input edge: the browser receives the
 // original JSON bytes, and the shipped client uploads and plans them itself.
 await focused(page, page.getByLabel('Account snapshot JSON', { exact: true }), `Import file input ${width}`)
 await page.setInputFiles('#import-bundle', {
  name: 'harbour-migration.json', mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({ accounts: [account] }, null, 2))
 })
 await activate(page.getByRole('button', { name: 'Upload and review', exact: true }), 'upload submission')
 await page.locator('#import-review').waitFor({ state: 'visible' })
 await page.waitForFunction(() => !document.getElementById('import-confirmed').disabled)
 assert.deepEqual(await state(), before, 'Uploading and reviewing a plan writes no native data')

 await activate(page.getByText('Reviewed fingerprint', { exact: true }), 'reviewed fingerprint disclosure')
 const fingerprint = (await page.locator('#import-fingerprint').innerText()).trim()
 assert.ok(fingerprint, 'The owner can read the fingerprint before approving')
 const approval = page.getByRole('checkbox', { name: 'I reviewed this plan and approve the changes for this fingerprint.', exact: true })
 const apply = page.getByRole('button', { name: 'Apply reviewed import', exact: true })
 assert.equal(await approval.isChecked(), false, 'Review requires explicit owner approval')
 assert.equal(await apply.isDisabled(), true, 'Import cannot apply before approval')
 await snapshot('review')

 await activate(approval, 'approval checkbox', 'Space')
 assert.ok(await approval.isChecked(), 'Space records explicit approval for this plan')
 assert.equal(await apply.isEnabled(), true, 'Explicit approval enables apply')
 assert.deepEqual(await state(), before, 'Checking approval alone writes no native data')
 await activate(apply, 'apply reviewed import')
 await resultReady('Import completed')
 const imported = (await state()).accounts.find(item => item.id === account.id)
 assert.ok(imported, 'Keyboard apply creates the native account')
 assert.deepEqual(Object.fromEntries(Object.keys(account).map(key => [key, imported[key]])), account,
  'The imported account preserves the reviewed account, invoice and support values')
 await openForms(page)
 assert.equal((await page.locator('#import-result-fingerprint').innerText()).trim(), fingerprint,
  'Completed import identifies the fingerprint the owner reviewed')
 await snapshot('completion')

 await activate(page.getByRole('button', { name: 'Reconcile native records', exact: true }), 'reconcile')
 await page.locator('#import-reconciliation').waitFor({ state: 'visible' })
 await page.waitForFunction(() => !document.getElementById('import-reconcile').disabled)
 assert.equal(await page.locator('#import-error').isVisible(), false, 'A11Y-001 reconciliation returns without a client error')
 assert.ok((await page.locator('#import-reconcile-summary').innerText()).trim(), 'A11Y-001 reconciliation feedback is available to the reader')
 assert.deepEqual((await state()).accounts.find(item => item.id === account.id), imported,
  'Reconciliation preserves the applied native account')
 await snapshot('reconciliation')

 await activate(page.getByRole('button', { name: 'Undo import', exact: true }), 'undo')
 await resultReady('Import undone')
 const undone = await state()
 assert.ok(!undone.accounts.some(item => item.id === account.id), 'Keyboard undo removes the imported native account')
 assert.deepEqual(undone.accounts, before.accounts, 'Undo preserves all pre-existing native accounts')
 await snapshot('undone')
}
