import {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {jsonBody} from '../access'
import {type Actor} from '../core'
import {publish,enroll,advance,act,playState,alertFailures} from './engine'
export const playApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
playApi.get('/api/buoy/playbooks',async c=>c.json(await playState(c.env.DB,c.get('actor'),c.req.query('accountId'))))
playApi.post('/api/buoy/playbooks',async c=>c.json(await publish(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
playApi.post('/api/buoy/playbooks/:id/enroll',async c=>{const r=await enroll(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw));await advance(c.env.DB,r.id);return c.json(r,201)})
playApi.post('/api/buoy/playbook-runs/:id/action',async c=>{const r=await act(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw));await alertFailures(c.env.DB);return c.json(r)})
