import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {personApi} from './agent-door-http.mjs'

const tenureKey = 'door_customer_since'

// Rebuild native prerequisites for each policy phase. These are real records
// created by the owner; preparation never approves an experiment or proposal.
export default async function prepare(context) {
 const call = personApi(context), stamp = randomUUID(), today = new Date().toISOString().slice(0, 10)
 const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
 const contractEnd = new Date(Date.now() + 730 * 86400000).toISOString().slice(0, 10)
 const fields = await call('/fields')
 if (!fields.definitions.some(field => field.key === tenureKey)) {
  await call('/fields', 'POST', {key: tenureKey, label: 'Customer since', type: 'date'}, 201)
 }
 const ids = []
 for (let i = 0; i < 4; i++) {
  const id = `door-${stamp}-${i}`
  const account = await call('/accounts', 'POST', {
   id, name: `Door customer ${stamp.slice(0, 8)} ${i + 1}`, renewalDate: contractEnd, noticeDays: 30,
   renewalEvidence: `Synthetic signed order ${id}`,
   billing: {observedAt: today, reference: `Synthetic invoice ${id}`, currency: 'USD', totalMinor: 10000, creditsMinor: 0, allocatedMinor: 0, dueDate: today},
   support: {observedAt: today, reference: `Synthetic urgent incident ${id}`, openTickets: 4, urgentTickets: 1},
  }, 201)
  await call(`/accounts/${id}/contract`, 'POST', {
   revision: account.revision,
   contract: {currency: 'USD', contractStart: '2025-01-01', contractEnd,
    lines: [{product: 'Customer success', quantity: 1, amountMinor: 120000, frequency: 'annual', entitlements: 'All contracted service remains unchanged'}],
    source: {reference: `Synthetic order ${id}`, confirmedOn: today}},
  }, 201)
  const current = (await call('/fields')).accounts.find(row => row.id === id)
  assert.ok(current, 'Created account is available to its owner')
  await call(`/accounts/${id}/fields`, 'PUT', {
   revision: current.revision, values: {[tenureKey]: '2025-01-01'}, source: `Synthetic customer-since order ${id}`,
  })
  ids.push(id)
 }
 const segment = await call('/segments', 'POST', {
  name: `Door cohort ${stamp.slice(0, 8)}`, mode: 'static', rules: {match: 'all', conditions: []},
  accountIds: ids, tier: null, stage: null, playbook: null,
 }, 201)
 const state = await call('/state'), account = state.accounts.find(row => row.id === ids[0])
 for (const id of ids) assert.equal(state.accounts.find(row => row.id === id)?.health.status, 'at-risk', 'Native source evidence creates a matching at-risk cohort')
 return {values: {
  account,
  playbook: {title: 'Review the cited incident with the customer', dueDate},
  renewal: {outcome: 'deferred', reason: 'Recovery evidence still needs review', evidence: `Synthetic incident review ${account.id}`},
  experiment: {name: `Optional check-ins ${stamp.slice(0, 8)}`, segmentId: segment.id, tenureField: `custom.${tenureKey}`,
   pairs: 2, windowDays: 30, successMetric: 'renewed', intervention: 'additional-check-in', operationKey: `door-${stamp}`},
 }, clients: {}}
}
