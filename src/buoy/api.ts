import { Hono } from 'hono'
import type { Bindings } from '../auth.server'
import { actorFor, jsonBody, mintAgent } from './access'
import { Problem, insist, text, date, object, requirePerson, stmt, type Actor } from './core'
import { saveAccount, account, state } from './accounts'
import { prepare, approve, completeTask } from './work'
import { recordSentiment, healthOn, today } from './sentiment'
import * as imports from './imports/index'

export const buoyApi = new Hono<{Bindings: Bindings; Variables: {actor: Actor}}>()
buoyApi.use('/api/buoy/*', async (c, next) => {
 c.header('cache-control', 'no-store')
 c.header('x-content-type-options', 'nosniff')
 c.header('referrer-policy', 'no-referrer')
 c.set('actor', await actorFor(c.req.raw, c.env))
 await next()
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
buoyApi.get('/api/buoy/state', async c => c.json(await state(c.env.DB, c.get('actor'))))
buoyApi.post('/api/buoy/accounts', async c => c.json(await saveAccount(c.env.DB, c.get('actor'), await jsonBody(c.req.raw)), 201))
buoyApi.put('/api/buoy/accounts/:id', async c => c.json(await saveAccount(c.env.DB, c.get('actor'), await jsonBody(c.req.raw), c.req.param('id'))))
buoyApi.post('/api/buoy/accounts/:id/sentiment', async c => c.json(await recordSentiment(c.env.DB, c.get('actor'), c.req.param('id'), await jsonBody(c.req.raw)), 201))
buoyApi.get('/api/buoy/accounts/:id/health', async c => c.json(await healthOn(c.env.DB, c.req.param('id'), date(c.req.query('on') ?? today(), 'Health date'))))
buoyApi.post('/api/buoy/proposals', async c => c.json(await prepare(c.env.DB, c.get('actor'), await jsonBody(c.req.raw)), 201))
buoyApi.post('/api/buoy/proposals/:id/approve', async c => {await jsonBody(c.req.raw); return c.json(await approve(c.env.DB, c.get('actor'), c.req.param('id')))})
buoyApi.post('/api/buoy/tasks/:id/complete', async c => c.json(await completeTask(c.env.DB, c.get('actor'), c.req.param('id'), await jsonBody(c.req.raw))))
buoyApi.delete('/api/buoy/accounts/:id', async c => {
 const actor = c.get('actor'); requirePerson(actor, true)
 const current = await account(c.env.DB, c.req.param('id')), body = await jsonBody(c.req.raw)
 insist(body.confirmation === current.name, 'Type the account name to confirm erasure.')
 return c.json(await imports.erase(c.env.DB, actor, current.id))
})
buoyApi.get('/api/buoy/imports', async c => {requirePerson(c.get('actor')); return c.json(await imports.history(c.env.DB, c.get('actor')))})
buoyApi.post('/api/buoy/imports/preview', async c => {requirePerson(c.get('actor')); return c.json(await imports.preview(c.env.DB, c.get('actor'), await jsonBody(c.req.raw)))})
buoyApi.post('/api/buoy/imports/apply', async c => {
 const actor = c.get('actor'); requirePerson(actor); const body = await jsonBody(c.req.raw)
 return c.json(await imports.apply(c.env.DB, actor, {accounts: body.accounts, fingerprint: text(body.fingerprint, 'Reviewed fingerprint', 64), operationKey: text(body.operationKey, 'Operation key', 200)}))
})
buoyApi.get('/api/buoy/imports/:id', async c => {requirePerson(c.get('actor')); return c.json(await imports.job(c.env.DB, c.get('actor'), c.req.param('id')))})
buoyApi.post('/api/buoy/imports/:id/undo', async c => {requirePerson(c.get('actor')); await jsonBody(c.req.raw); return c.json(await imports.undo(c.env.DB, c.get('actor'), c.req.param('id')))})
buoyApi.post('/api/buoy/agent-tokens', async c => c.json(await mintAgent(c.env.DB, c.get('actor'), await jsonBody(c.req.raw)), 201))
buoyApi.delete('/api/buoy/agent-tokens/:id', async c => {
 const actor = c.get('actor'); requirePerson(actor, true)
 await stmt(c.env.DB, 'UPDATE buoy_agent_tokens SET revoked_at=? WHERE id=?', Date.now(), c.req.param('id')).run()
 return c.json({status: 'revoked'})
})
buoyApi.get('/api/buoy/commands', c => c.json({commands: ['renewals.list','playbook.prepare','renewal.prepare'], approval: 'An active owner or admin reviews and approves in the app.'}))
buoyApi.post('/api/buoy/commands', async c => {
 const body = await jsonBody(c.req.raw), actor = c.get('actor')
 if (body.command === 'renewals.list') return c.json({accounts: (await state(c.env.DB, actor)).accounts})
 insist(body.command === 'playbook.prepare' || body.command === 'renewal.prepare', 'Unknown command. Agents can prepare; people approve.')
 const input = object(body.input)
 return c.json(await prepare(c.env.DB, actor, {...input, kind: body.command === 'playbook.prepare' ? 'playbook' : 'renewal'}), 201)
})
