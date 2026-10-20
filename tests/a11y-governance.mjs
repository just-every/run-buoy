import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { focused, type, submit, openForms, scan } from './a11y-checks.mjs'

// GOVERN-001 owner controls and A11Y-001 keyboard access share the real Worker.
export async function governanceJourney(page, app, width) {
 const label = `Harbour renewal assistant ${width}`
 const credential = page.getByRole('textbox', { name: 'Agent credential', exact: true })
 const visit = async () => {
  const response = await page.goto(app.origin + '/app/audit', { waitUntil: 'networkidle' })
  assert.equal(response.status(), 200, 'Owner opens the shipped agent authority controls')
 }
 const policy = async () => {
  const response = await page.request.get(app.origin + '/api/buoy/agents')
  assert.equal(response.status(), 200, 'Owner can inspect public agent policy and ledger')
  return response.json()
 }
 const capture = async stage => {
  await openForms(page)
  await scan(page, `A11Y-001/GOVERN-001 ${stage} ${width}`)
  await page.screenshot({ path: `../screens/a11y-govern-${stage}-${width}.png`, fullPage: true,
   mask: [credential] })
 }
 const togglePause = async paused => {
  const form = page.locator('#agent-switch')
  const checkbox = form.getByRole('checkbox', { name: 'Pause all agents', exact: true })
  assert.equal(await checkbox.isChecked(), !paused, 'The switch starts in the previous saved state')
  await focused(page, checkbox, `A11Y-001/GOVERN-001 agent switch ${width}`)
  await page.keyboard.press('Space')
  assert.equal(await checkbox.isChecked(), paused, 'Space selects the requested agent access state')
  await submit(page, form.getByRole('button', { name: 'Save agent switch', exact: true }))
  assert.equal((await policy()).disabled, paused, 'Keyboard submission saves the real installation switch')
 }

 await mkdir('../screens', { recursive: true })
 await visit()
 assert.equal((await policy()).disabled, false, 'The journey starts with agent access enabled')
 const disclosure = page.locator('#agent-issue-panel > summary')
 await focused(page, disclosure, `A11Y-001/GOVERN-001 issue disclosure ${width}`)
 await page.keyboard.press('Enter')
 const form = page.locator('#agent-issue')
 await type(page, form.getByLabel('Agent label', { exact: true }), label)
 const scopes = [
  ['Read renewals', 'renewals.list'], ['Prepare playbooks', 'playbook.prepare'],
  ['Prepare renewal decisions', 'renewal.prepare']
 ]
 const classes = [
  ['Account terms', 'account'], ['Billing snapshots', 'billing'],
  ['Support snapshots', 'support'], ['CSM sentiment', 'sentiment']
 ]
 for (const [name] of [...scopes, ...classes]) {
  assert.ok(await form.getByRole('checkbox', { name, exact: true }).isChecked(), 'Default grant includes ' + name)
 }
 const defaults = {
  expiresDays: Number(await form.getByLabel('Expires after (days)', { exact: true }).inputValue()),
  requestsPerMinute: Number(await form.getByLabel('Requests per UTC minute', { exact: true }).inputValue()),
  budgetMinor: Number(await form.getByLabel('USD budget (cents)', { exact: true }).inputValue())
 }
 const issuedAt = Date.now()
 await submit(page, form.getByRole('button', { name: 'Issue agent credential', exact: true }))
 await credential.waitFor({ state: 'visible' })
 const token = await credential.inputValue()
 assert.ok(token, 'The issuer receives a usable one-time credential')
 const issuedPolicy = await policy()
 const agent = issuedPolicy.agents.find(item => item.label === label && !item.revokedAt)
 assert.ok(agent, 'The keyboard-issued agent appears in public policy')
 assert.deepEqual(agent.scopes, scopes.map(([, value]) => value), 'Issued command authority matches the form grants')
 assert.deepEqual(agent.dataClasses, classes.map(([, value]) => value), 'Issued data authority matches the form grants')
 assert.equal(agent.requestsPerMinute, defaults.requestsPerMinute, 'The form rate limit is persisted')
 assert.equal(agent.budgetMinor, defaults.budgetMinor, 'The form budget is persisted')
 assert.ok(agent.expiresAt >= issuedAt + defaults.expiresDays * 86400000 &&
  agent.expiresAt <= Date.now() + defaults.expiresDays * 86400000, 'Expiry follows the issued form duration')
 assert.ok(!JSON.stringify(issuedPolicy).includes(token), 'Public policy does not expose the credential')
 const command = () => app.request('/api/buoy/commands', {
  method: 'POST', token, body: { command: 'renewals.list' }
 })
 assert.equal((await command()).status, 200, 'The form-issued token authorizes an actual agent command')
 await capture('issued')

 // A fresh GET refreshes the view without replaying the credential-issuing POST.
 await visit()
 assert.equal(await credential.count(), 0, 'Refreshing does not redisplay the one-time credential')
 await togglePause(true)
 assert.equal((await command()).status, 403, 'Pausing refuses the issued agent immediately')
 await capture('paused')
 await togglePause(false)
 assert.equal((await command()).status, 200, 'Resuming restores the original token authority')

 const record = page.getByRole('article').filter({ has: page.getByRole('heading', { name: label, exact: true }) })
 await submit(page, record.getByRole('button', { name: 'Revoke credential', exact: true }))
 assert.equal((await command()).status, 401, 'Keyboard revocation invalidates the issued credential')
 const finalPolicy = await policy()
 assert.ok(finalPolicy.agents.find(item => item.id === agent.id)?.revokedAt, 'Public policy records revocation')
 const entries = finalPolicy.entries.filter(entry => entry.tokenId === agent.id)
 for (const status of ['attempt', 'succeeded', 'refused']) {
  assert.ok(entries.some(entry => entry.status === status), 'The public ledger records this agent’s ' + status)
 }
 assert.ok(!JSON.stringify(finalPolicy).includes(token), 'Policy and ledger retain no one-time credential')
 await capture('revoked')
}
