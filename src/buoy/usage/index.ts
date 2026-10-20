import { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { jsonBody } from '../access'
import type { Actor } from '../core'
import { issueCredential, revokeCredential, saveSource } from './admin'
import { usageEvents, usageState } from './read'
export { usageIngest } from './intake'
export { usageEvents, usageState } from './read'
export { issueCredential, revokeCredential, saveSource } from './admin'
export const usageAdmin=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
usageAdmin.get('/api/buoy/usage',async c=>c.json(await usageState(c.env.DB,c.get('actor'))))
usageAdmin.get('/api/buoy/usage/events',async c=>c.json(await usageEvents(c.env.DB,c.get('actor'),new URL(c.req.url).searchParams)))
usageAdmin.post('/api/buoy/usage/sources',async c=>c.json(await saveSource(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
usageAdmin.put('/api/buoy/usage/sources/:id',async c=>c.json(await saveSource(c.env.DB,c.get('actor'),await jsonBody(c.req.raw),c.req.param('id'))))
usageAdmin.post('/api/buoy/usage/sources/:id/credentials',async c=>c.json(await issueCredential(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw)),201))
usageAdmin.delete('/api/buoy/usage/credentials/:id',async c=>{await jsonBody(c.req.raw);return c.json(await revokeCredential(c.env.DB,c.get('actor'),c.req.param('id')))})
