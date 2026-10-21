import {scorecardState,previewScorecard,publishScorecard,recalculateScorecards} from './scorecards'
import {search} from './search'
import {consumerState,saveConsumer} from './adoption/consumers'
import {recordAdoptionAlerts} from './adoption/consumers-alerts'
import {inappIngest,inappAdmin} from './inapp'
import {peopleApi,refreshPeople} from './people'
import { adoptionState, saveDefinition, saveSeats, savePersonLicense, adoptionCsv } from './adoption'
import { connectionsApi } from './connectors'
import {usageIngest,usageAdmin} from './usage';
import {fieldsState,saveField,saveValues,previewField,refreshFields} from './fields'
import { startOutcome } from './outcomes'
import { observeOutcomes } from './outcomes/observe'
import { outcomeState, outcomeReport, outcomeCsv } from './outcomes/report'
import { Hono } from 'hono'
import type { Bindings } from '../auth.server'
import { actorFor, jsonBody, mintAgent } from './access'
import { Problem, insist, text, date, object, requirePerson, stmt, type Actor } from './core'
import { saveAccount, account, state } from './accounts'
import { prepare, approve, completeTask } from './work'
import { recordSentiment, healthOn, today } from './sentiment'
import { setStaleness, setTaskTiming } from './settings'
import { assignAccount, setManager, setAway, tasksOn } from './tasks'
import { auditIfChanged } from './audit-records'
import { audit } from './audit'
import { teamState, saveTeamSettings, previewAssignment, applyAssignment } from './team'
import { inbox, setPreferences, markRead, mention } from './notify'
import { flushNotifications } from './notify-mail'
import { reconcile, segmentState, setTiers, saveSegment, setClassification, segmentReport, reportCsv } from './segments'
import * as imports from './imports/index'
import { COMMANDS, requireCommand, projectAccounts, type AgentCommand } from './agent-policy/policy'
import { beginRequest, checkRequest, finishRequest, refuseRequest } from './agent-policy/requests'
import { agentState, setAgentSettings } from './agent-policy/owner'

export const buoyApi = new Hono<{Bindings: Bindings; Variables: {actor: Actor}}>()
buoyApi.route('/',usageIngest)
buoyApi.route('/',inappIngest)
buoyApi.use('/api/buoy/*', async (c, next) => {
 c.header('cache-control', 'no-store')
 c.header('x-content-type-options', 'nosniff')
 c.header('referrer-policy', 'no-referrer')
 const actor = await actorFor(c.req.raw, c.env)
 c.set('actor', actor)
 // An authenticated agent always consumes one atomic minute reservation and
 // leaves an attempt and an outcome, including malformed or forbidden requests.
 if (actor.kind === 'agent') {
  const reservation = await beginRequest(c.env.DB, actor, c.req.raw)
  let status = 500
  try {
   if (reservation.requests > actor.agentPolicy!.requestsPerMinute) c.header('Retry-After', String(reservation.retryAfter))
   await checkRequest(c.env.DB, actor, reservation, c.req.raw)
   await next()
   status = c.res.status
   if(c.req.method!=='GET'&&status<400) await flushNotifications(c.env)
  } catch (error) { status = error instanceof Problem ? error.status : 500; throw error }
  finally { await finishRequest(c.env.DB, actor, status) }
  return
 }
 await refreshPeople(c.env.DB,actor)
 await refreshFields(c.env.DB,actor)
 if(!c.req.path.endsWith('/scorecards/preview'))await recalculateScorecards(c.env.DB)
 await reconcile(c.env.DB, actor)
 await observeOutcomes(c.env.DB,actor)
 await next()
 if(c.req.method!=='GET'&&c.res.status<400){await refreshPeople(c.env.DB,actor);await refreshFields(c.env.DB,actor);if(!c.req.path.endsWith('/scorecards/preview'))await recalculateScorecards(c.env.DB);await reconcile(c.env.DB,actor);await observeOutcomes(c.env.DB,actor)}
 if (c.req.method !== 'GET' && c.res.status < 400) {await recordAdoptionAlerts(c.env.DB);await flushNotifications(c.env)}
})
buoyApi.onError((error, c) => {
 if (error instanceof Problem) return c.json({error: error.message}, error.status as 400)
 if (/^(IMPORT_|NATIVE_|TARGET_|OPERATION_KEY_|REVIEWED_|JOB_|MAPPING_)/.test(error.message)) return c.json({error: `Move-in refused: ${error.message}. Review the current source and account changes.`}, 409)
 if (/^(account|accounts|upload|Upload|Duplicate account|A reviewed|A nonempty|Account limit)/.test(error.message)) return c.json({error: error.message}, 400)
 // A constraint refusal includes stale concurrent authority/evidence changes;
 // no SQL, bound values or credentials are exposed to the caller.
 if (/constraint|SQLITE_CONSTRAINT/i.test(error.message)) return c.json({error: 'The record or authority changed. Reload and review before trying again.'}, 409)
 console.error('Buoy request failed', error.name)
 return c.json({error: 'The operation could not be completed.'}, 500)
})
buoyApi.route('/',peopleApi)
buoyApi.route('/',usageAdmin)
buoyApi.route('/',inappAdmin)
buoyApi.route('/',connectionsApi)
buoyApi.get('/api/buoy/scorecards',async c=>c.json(await scorecardState(c.env.DB,c.get('actor'))))
buoyApi.post('/api/buoy/scorecards/preview',async c=>c.json(await previewScorecard(c.env.DB,c.get('actor'),await jsonBody(c.req.raw))))
buoyApi.post('/api/buoy/scorecards/publish',async c=>c.json(await publishScorecard(c.env.DB,c.get('actor'),await jsonBody(c.req.raw) as Record<string,unknown>&{revision:unknown;config:unknown}),201))
buoyApi.get('/api/buoy/adoption/consumers',async c=>c.json(await consumerState(c.env.DB,c.get('actor'))))
buoyApi.post('/api/buoy/adoption/consumers',async c=>c.json(await saveConsumer(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
buoyApi.get('/api/buoy/adoption',async c=>c.json(await adoptionState(c.env.DB,c.get('actor'),new URL(c.req.url).searchParams)))
buoyApi.get('/api/buoy/adoption/report.csv',async c=>c.body(adoptionCsv(await adoptionState(c.env.DB,c.get('actor'),new URL(c.req.url).searchParams)),200,{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename=adoption.csv'}))
buoyApi.post('/api/buoy/adoption/definitions',async c=>c.json(await saveDefinition(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
buoyApi.put('/api/buoy/adoption/person-licenses',async c=>c.json(await savePersonLicense(c.env.DB,c.get('actor'),await jsonBody(c.req.raw))))
buoyApi.put('/api/buoy/adoption/seats',async c=>c.json(await saveSeats(c.env.DB,c.get('actor'),await jsonBody(c.req.raw))))
buoyApi.get('/api/buoy/fields',async c=>c.json(await fieldsState(c.env.DB)))
buoyApi.post('/api/buoy/fields',async c=>c.json(await saveField(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
buoyApi.post('/api/buoy/fields/preview',async c=>c.json(await previewField(c.env.DB,c.get('actor'),await jsonBody(c.req.raw))))
buoyApi.put('/api/buoy/accounts/:id/fields',async c=>c.json(await saveValues(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
buoyApi.get('/api/buoy/outcomes',async c=>c.json(await outcomeState(c.env.DB)))
buoyApi.post('/api/buoy/outcomes',async c=>c.json(await startOutcome(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
buoyApi.get('/api/buoy/outcomes/:id/report',async c=>c.json(await outcomeReport(c.env.DB,c.req.param('id'))))
buoyApi.get('/api/buoy/outcomes/:id/report.csv',async c=>c.body(outcomeCsv(await outcomeReport(c.env.DB,c.req.param('id'))),200,{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename=playbook-outcomes.csv'}))
buoyApi.get('/api/buoy/segments',async c=>c.json(await segmentState(c.env.DB)))
buoyApi.put('/api/buoy/segments/tiers',async c=>c.json(await setTiers(c.env.DB,c.get('actor'),await jsonBody(c.req.raw))))
buoyApi.post('/api/buoy/segments',async c=>c.json(await saveSegment(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
buoyApi.put('/api/buoy/accounts/:id/classification',async c=>c.json(await setClassification(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
buoyApi.get('/api/buoy/segments/:id/report',async c=>c.json(await segmentReport(c.env.DB,c.req.param('id'))))
buoyApi.get('/api/buoy/segments/:id/report.csv',async c=>{const report=await segmentReport(c.env.DB,c.req.param('id'));return c.body(reportCsv(report),200,{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename=segment-report.csv'})})
buoyApi.get('/api/buoy/team', async c => c.json(await teamState(c.env.DB,c.get('actor'))))
buoyApi.put('/api/buoy/team/settings', async c => c.json(await saveTeamSettings(c.env.DB,c.get('actor'),await jsonBody(c.req.raw))))
buoyApi.post('/api/buoy/team/preview', async c => c.json(await previewAssignment(c.env.DB,c.get('actor'),await jsonBody(c.req.raw))))
buoyApi.post('/api/buoy/team/apply', async c => c.json(await applyAssignment(c.env.DB,c.get('actor'),await jsonBody(c.req.raw))))
buoyApi.get('/api/buoy/notifications', async c => c.json(await inbox(c.env.DB, c.get('actor'))))
buoyApi.put('/api/buoy/notifications/preferences', async c => c.json(await setPreferences(c.env.DB, c.get('actor'), await jsonBody(c.req.raw))))
buoyApi.post('/api/buoy/notifications/:id/read', async c => {await jsonBody(c.req.raw); return c.json(await markRead(c.env.DB,c.get('actor'),c.req.param('id')))})
buoyApi.post('/api/buoy/accounts/:id/mentions', async c => c.json(await mention(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw)),201))
buoyApi.get('/api/buoy/search',async c=>c.json(await search(c.env.DB,c.get('actor'),new URL(c.req.url).searchParams)))
buoyApi.get('/api/buoy/state', async c => c.json(await state(c.env.DB, c.get('actor'))))
buoyApi.post('/api/buoy/accounts', async c => c.json(await saveAccount(c.env.DB, c.get('actor'), await jsonBody(c.req.raw)), 201))
buoyApi.put('/api/buoy/accounts/:id', async c => c.json(await saveAccount(c.env.DB, c.get('actor'), await jsonBody(c.req.raw), c.req.param('id'))))
buoyApi.post('/api/buoy/accounts/:id/sentiment', async c => c.json(await recordSentiment(c.env.DB, c.get('actor'), c.req.param('id'), await jsonBody(c.req.raw)), 201))
buoyApi.get('/api/buoy/accounts/:id/health', async c => c.json(await healthOn(c.env.DB, c.req.param('id'), date(c.req.query('on') ?? today(), 'Health date'))))
buoyApi.put('/api/buoy/settings/staleness', async c => c.json(await setStaleness(c.env.DB, c.get('actor'), await jsonBody(c.req.raw))))
// PLAY-002: account CSM, manager, away cover, reminder timing and tasks as of a date.
buoyApi.put('/api/buoy/accounts/:id/owner', async c => c.json(await assignAccount(c.env.DB, c.get('actor'), c.req.param('id'), await jsonBody(c.req.raw))))
buoyApi.put('/api/buoy/people/:id/manager', async c => c.json(await setManager(c.env.DB, c.get('actor'), c.req.param('id'), await jsonBody(c.req.raw))))
buoyApi.post('/api/buoy/people/:id/away', async c => c.json(await setAway(c.env.DB, c.get('actor'), c.req.param('id'), await jsonBody(c.req.raw)), 201))
buoyApi.put('/api/buoy/settings/tasks', async c => c.json(await setTaskTiming(c.env.DB, c.get('actor'), await jsonBody(c.req.raw))))
buoyApi.get('/api/buoy/tasks', async c => c.json(await tasksOn(c.env.DB, c.req.query('on'))))
buoyApi.post('/api/buoy/proposals', async c => c.json(await prepare(c.env.DB, c.get('actor'), await jsonBody(c.req.raw)), 201))
buoyApi.post('/api/buoy/proposals/:id/approve', async c => {await jsonBody(c.req.raw); return c.json(await approve(c.env.DB, c.get('actor'), c.req.param('id')))})
buoyApi.post('/api/buoy/tasks/:id/complete', async c => c.json(await completeTask(c.env.DB, c.get('actor'), c.req.param('id'), await jsonBody(c.req.raw))))
buoyApi.delete('/api/buoy/accounts/:id', async c => {
 const actor = c.get('actor'); requirePerson(actor, true)
 const current = await account(c.env.DB, c.req.param('id')), body = await jsonBody(c.req.raw)
 insist(body.confirmation === current.name, 'Type the account name to confirm erasure.')
 return c.json(await imports.erase(c.env.DB, actor, current.id))
})
buoyApi.get('/api/buoy/imports', async c => {requirePerson(c.get('actor'), true); return c.json(await imports.history(c.env.DB, c.get('actor')))})
buoyApi.get('/api/buoy/imports/:id', async c => {requirePerson(c.get('actor'), true); return c.json(await imports.job(c.env.DB, c.get('actor'), c.req.param('id')))})
buoyApi.post('/api/buoy/imports/:id/undo', async c => {requirePerson(c.get('actor'), true); await jsonBody(c.req.raw); return c.json(await imports.undo(c.env.DB, c.get('actor'), c.req.param('id')))})
buoyApi.get('/api/buoy/agents', async c => c.json(await agentState(c.env.DB, c.get('actor'))))
buoyApi.put('/api/buoy/agents/settings', async c => c.json(await setAgentSettings(c.env.DB, c.get('actor'), await jsonBody(c.req.raw))))
buoyApi.post('/api/buoy/agent-tokens', async c => c.json(await mintAgent(c.env.DB, c.get('actor'), await jsonBody(c.req.raw)), 201))
buoyApi.delete('/api/buoy/agent-tokens/:id', async c => {
 const actor = c.get('actor'); requirePerson(actor, true)
 // AUDIT-001: the first revocation is recorded in the same transaction; a repeat adds nothing.
 await c.env.DB.batch([stmt(c.env.DB, 'UPDATE buoy_agent_tokens SET revoked_at=? WHERE id=? AND revoked_at IS NULL', Date.now(), c.req.param('id')),
  auditIfChanged(c.env.DB, actor, 'agent.credential-revoked', `agent:${c.req.param('id')}`)])
 return c.json({status: 'revoked'})
})
buoyApi.get('/api/buoy/commands', c => c.json({commands: c.get('actor').agentPolicy?.scopes ?? COMMANDS, approval: 'An active owner or admin reviews and approves in the app.'}))
// BOUNDARY-004: a preparation carries only these fields; anything else (a price,
// discount, credit or term change) is refused and, for an agent, recorded.
const PREPARATION: Record<string, string[]> = {'playbook.prepare': ['title', 'dueDate'], 'renewal.prepare': ['outcome', 'reason', 'evidence']}
buoyApi.post('/api/buoy/commands', async c => {
 const body = await jsonBody(c.req.raw), actor = c.get('actor'), db = c.env.DB
 if (actor.kind === 'agent' && COMMANDS.includes(body.command as AgentCommand)) {
  actor.agentRequest!.command = body.command as AgentCommand
  requireCommand(actor.agentPolicy!, body.command as AgentCommand)
 }
 if (body.command === 'renewals.list') {
  const accounts = (await state(db, actor)).accounts
  return c.json({accounts: actor.agentPolicy ? projectAccounts(accounts, actor.agentPolicy) : accounts})
 }
 const fields = Object.hasOwn(PREPARATION, String(body.command)) ? PREPARATION[String(body.command)] : undefined
 if (!fields) return refuseRequest(db, actor, `command ${String(body.command)}`, 'Unknown command. Agents can prepare; people approve.', 400)
 const input = object(body.input), payload = object(input.payload)
 const extra = [...Object.keys(input).filter(key => key !== 'accountId' && key !== 'payload'), ...Object.keys(payload).filter(key => !fields.includes(key))]
 if (extra.length) return refuseRequest(db, actor, `account ${String(input.accountId)}`, `Agents cannot set ${extra.join(', ')}. A preparation carries only ${fields.join(', ')}; prices, discounts and other commercial terms change only by a person in the billing system.`)
 return c.json(await prepare(db, actor, {...input, kind: body.command === 'playbook.prepare' ? 'playbook' : 'renewal'}), 201)
})
buoyApi.get('/api/buoy/audit', async c => c.json(await audit(c.env.DB, c.get('actor'), new URL(c.req.url).searchParams)))
// BOUNDARY-001/002: the route list, read from the router itself.
buoyApi.get('/api/buoy/routes', c => c.json({routes: buoyApi.routes.filter(route => route.method !== 'ALL').map(({method, path}) => ({method, path}))}))
