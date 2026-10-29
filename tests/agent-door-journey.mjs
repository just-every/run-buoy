import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {personApi} from './agent-door-http.mjs'

const before = new Map()
const stepKey = ({origin, phase, step}) => `${origin}:${phase}:${step.id}`
const accountProjection = state => state.accounts.map(({id, revision}) => ({id, revision}))
const byId = rows => [...rows].sort((a, b) => a.id.localeCompare(b.id))
const proposalProjection = state => state.proposals.map(({id, accountId, kind, status, preparedBy}) => ({id, accountId, kind, status, preparedBy}))

function attributedAgent(preparedBy, operator) {
 const attribution = /^agent:([^:]+):(.+) \[person:([^\]]+)\]$/.exec(preparedBy)
 assert.ok(attribution, 'Native preparation retains both agent and sponsor attribution')
 assert.equal(attribution[3], operator.id, 'Native sponsor is the signed-in owner')
 assert.ok(attribution[2].endsWith(` for ${operator.displayName}`), 'Native label names the sponsoring person')
 assert.ok(attribution[2].length > ` for ${operator.displayName}`.length, 'Native label also names the preparing agent')
 return attribution[1]
}

export async function beforeStep(context) {
 const call = personApi(context)
 before.set(stepKey(context), await call('/state'))
}

async function proposalEvidence(call, context, state, prior) {
 const {args, result, step} = context
 const proposal = state.proposals.find(row => row.id === result.id)
 assert.ok(proposal, 'MCP preparation is a retained native proposal')
 assert.equal(proposal.accountId, args.accountId)
 assert.equal(proposal.kind, step.tool === 'buoy.playbook.prepare' ? 'playbook' : 'renewal')
 assert.equal(proposal.status, 'prepared')
 const agentId = attributedAgent(proposal.preparedBy, state.operator)
 assert.equal(proposal.approvedBy, null, 'Preparation never supplies person approval')
 assert.equal(proposal.approvedAt, null)
 assert.deepEqual(proposal.payload, result.payload)
 assert.equal(proposal.accountRevision, args.expected_revision)
 const account = prior.accounts.find(row => row.id === args.accountId)
 assert.ok(account)
 assert.equal(proposal.snapshot.billing.reference, account.billing.reference, 'Preparation keeps the exact billing evidence')
 assert.equal(proposal.snapshot.support.reference, account.support.reference, 'Preparation keeps the exact support evidence')
 assert.equal(state.accounts.find(row => row.id === args.accountId).revision, account.revision, 'An inert preparation does not change account evidence')
 assert.deepEqual(state.tasks, prior.tasks, 'Preparation does not create approved work')
 assert.deepEqual(state.decisions, prior.decisions, 'Preparation does not confirm commercial outcomes')
 const audit = await call('/audit?' + new URLSearchParams({action: `${proposal.kind}.prepared`}))
 assert.ok(audit.entries.some(row => row.actor === `agent:${agentId} for person:${state.operator.id}`), 'Native audit preserves both opaque actor identities')
 // Compare through the person's public action, with the same inputs and source
 // revision. Both drafts stay inert; their preparers remain distinct.
 const peer = await call('/proposals', 'POST', {accountId: args.accountId, kind: proposal.kind, payload: args.payload}, 201)
 assert.deepEqual({accountId: result.accountId, kind: result.kind, payload: result.payload, status: result.status},
  {accountId: peer.accountId, kind: peer.kind, payload: peer.payload, status: peer.status}, 'Native person and MCP preparation share the same action semantics')
}

async function experimentEvidence(call, result, operator) {
 const native = await call(`/experiments/${encodeURIComponent(result.id)}`)
 assert.deepEqual(result, native, 'MCP returns the retained native experiment report')
 assert.equal(native.status, 'proposed')
 const agentId = attributedAgent(native.preparedBy, operator)
 const audit = await call('/audit?' + new URLSearchParams({action: 'experiment.proposed'}))
 assert.ok(audit.entries.some(row => row.actor === `agent:${agentId} for person:${operator.id}`), 'Experiment audit preserves both opaque actor identities')
 assert.equal(native.approvedBy, null)
 assert.equal(native.playbookId, null, 'Preparation does not enroll an intervention')
 assert.equal(native.health, null)
 assert.equal(native.renewal, null, 'An inert draft has no measured outcome')
 assert.equal(native.assignments.length, 4)
 for (let index = 0; index < 2; index++) {
  const pair = native.assignments.filter(row => row.pairIndex === index)
  assert.equal(pair.length, 2)
  assert.deepEqual(pair.map(row => row.cohort).sort(), ['comparison', 'enrolled'])
  assert.notEqual(pair[0].accountId, pair[1].accountId)
  for (const key of ['segmentId', 'health', 'healthScore', 'arrMinor', 'currency', 'customerSince', 'tenureDays']) {
   assert.deepEqual(pair[0].baseline[key], pair[1].baseline[key], `Native experiment matches ${key}`)
  }
  for (const row of pair) {
   assert.equal(row.baseline.health, 'at-risk')
   assert.equal(row.baseline.arrMinor, 120000)
   assert.equal(row.baseline.currency, 'USD')
   assert.equal(row.baseline.customerSince, '2025-01-01')
   assert.ok(row.baseline.arrReference)
   assert.equal(row.runId, null)
  }
 }
}

export async function afterStep(context) {
 const call = personApi(context), state = await call('/state'), prior = before.get(stepKey(context))
 assert.ok(prior, 'Native observation precedes each successful step')
 const {step, args, result} = context
 if (step.tool === 'buoy.renewals.list') assert.deepEqual(result.accounts, state.accounts, 'MCP account read matches the current native owner view')
 if (['buoy.playbook.prepare', 'buoy.renewal.prepare'].includes(step.tool)) await proposalEvidence(call, context, state, prior)
 if (step.tool==='buoy.playbook.prepare' && context.phase==='autonomous') {
  const before=await call('/state')
  const conflict=await context.tool(step.tool,{...args,payload:{...args.payload,title:'Different work under the original operation key'}})
  assert.equal(conflict.result?._meta?.['com.runeditrun/error']?.code,'idempotency_conflict','Changed arguments cannot borrow a completed preparation key')
  const stale=await context.tool(step.tool,{...args,idempotency_key:randomUUID(),expected_revision:'stale:'+args.expected_revision})
  assert.equal(stale.result?._meta?.['com.runeditrun/error']?.code,'revision_conflict','A stale native string revision refuses before preparation')
  assert.deepEqual((await call('/state')).proposals,before.proposals,'Conflicting replay and stale evidence create no native proposal')
 }
 if (['buoy.experiment.prepare', 'buoy.experiment.report'].includes(step.tool)) await experimentEvidence(call, result, state.operator)
 if (step.tool === 'buoy.workspace.snapshot') {
  assert.deepEqual(byId(result.accounts), byId(accountProjection(state)))
  assert.deepEqual(byId(result.proposals), byId(proposalProjection(state)))
  for (const experiment of result.experiments) {
   const native = await call(`/experiments/${encodeURIComponent(experiment.id)}`)
   const {id, revision, status, preparedBy} = native
   assert.deepEqual(experiment, {id, revision, status, preparedBy})
  }
 }
 assert.deepEqual(state.tasks, prior.tasks, `${step.tool} leaves approved work unchanged`)
 assert.deepEqual(state.decisions, prior.decisions, `${step.tool} leaves confirmed outcomes unchanged`)
 before.delete(stepKey(context))
}

export default async function nativeJourney(context) {
 const state = await personApi(context)('/state'), fixtureIds = new Set(state.accounts.filter(row => row.id.startsWith('door-')).map(row => row.id))
 assert.ok(fixtureIds.size >= 4, 'Conformance used real native customer records')
 const prepared = state.proposals.filter(row => fixtureIds.has(row.accountId))
 assert.ok(prepared.some(row => row.kind === 'playbook' && row.preparedBy.startsWith('agent:')))
 assert.ok(prepared.some(row => row.kind === 'renewal' && row.preparedBy.startsWith('agent:')))
 assert.ok(prepared.every(row => row.status === 'prepared' && row.approvedBy === null))
 assert.ok(!state.tasks.some(row => fixtureIds.has(row.accountId)), 'Policy review does not stand in for native approval')
 assert.ok(!state.decisions.some(row => fixtureIds.has(row.accountId)), 'Agent preparation never becomes a confirmed renewal')
}
