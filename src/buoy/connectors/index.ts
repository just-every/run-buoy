import { Hono } from 'hono'
import type { Bindings } from '../../auth.server'
import { jsonBody } from '../access'
import { authority,id,insist,now,requirePerson,stmt,text,type Actor } from '../core'
import { auditRecord } from '../audit-records'
import { seal } from './vault'
import { syncConnection } from './sync'
export const connectionsApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
connectionsApi.get('/api/buoy/connections',async c=>{
 requirePerson(c.get('actor'))
 const connections=(await c.env.DB.prepare('SELECT c.id,name,provider,creator_id,created_at,disconnected_at,cursor,last_success,last_error,stale_days,(SELECT count(*) FROM buoy_connection_records r WHERE r.connection_id=c.id) AS record_count, EXISTS(SELECT 1 FROM buoy_connection_credentials k WHERE k.connection_id=c.id) AS credential_present FROM buoy_connections c ORDER BY created_at,c.id').all()).results
 const runs=(await c.env.DB.prepare('SELECT * FROM buoy_connection_runs ORDER BY started_at DESC,id LIMIT 100').all()).results
 return c.json({connections:connections.map(row=>({...row,freshness:row.disconnected_at?'Disconnected':!row.credential_present?'Reconnect required':row.last_error?'Failed':!row.last_success?'Never synced':Date.now()-Date.parse(String(row.last_success))>Number(row.stale_days)*86400000?'Stale':'Last run succeeded'})),runs})
})
connectionsApi.get('/api/buoy/connections/:id/records',async c=>{
 requirePerson(c.get('actor'))
 const after=c.req.query('after')??''
 return c.json({records:(await stmt(c.env.DB,'SELECT source_id,observed_at FROM buoy_connection_records WHERE connection_id=? AND source_id>? ORDER BY source_id LIMIT 100',c.req.param('id'),after).all()).results})
})
connectionsApi.post('/api/buoy/connections',async c=>{
 const actor=c.get('actor');requirePerson(actor)
 const body=await jsonBody(c.req.raw), connectionId=id(), name=text(body.name,'Connection name',100), secret=text(body.key,'Stripe test key',256)
 insist(/^(rk|sk)_test_[A-Za-z0-9]+$/.test(secret),'Use a Stripe test-mode key; live keys are refused.')
 await c.env.DB.batch([authority(c.env.DB,actor,true),stmt(c.env.DB,'INSERT INTO buoy_connections(id,name,provider,creator_id,created_at) VALUES(?,?,?,?,?)',connectionId,name,'stripe',actor.id,now()),stmt(c.env.DB,'INSERT INTO buoy_connection_credentials VALUES(?,?)',connectionId,await seal(c.env.SESSION_SECRET,connectionId,secret)),auditRecord(c.env.DB,actor,'connector.connected',connectionId)])
 return c.json({id:connectionId},201)
})
connectionsApi.put('/api/buoy/connections/:id/credential',async c=>{
 const actor=c.get('actor');requirePerson(actor);const body=await jsonBody(c.req.raw),connectionId=c.req.param('id'),secret=text(body.key,'Stripe test key',256)
 insist(/^(rk|sk)_test_[A-Za-z0-9]+$/.test(secret),'Use a Stripe test-mode key; live keys are refused.')
 insist(await stmt(c.env.DB,'SELECT id FROM buoy_connections WHERE id=?',connectionId).first(),'Connection not found.',404)
 await c.env.DB.batch([authority(c.env.DB,actor,true),stmt(c.env.DB,'INSERT INTO buoy_connection_credentials VALUES(?,?) ON CONFLICT(connection_id) DO UPDATE SET sealed=excluded.sealed',connectionId,await seal(c.env.SESSION_SECRET,connectionId,secret)),stmt(c.env.DB,'UPDATE buoy_connections SET version=version+1,disconnected_at=NULL,lease_until=0 WHERE id=?',connectionId),auditRecord(c.env.DB,actor,'connector.reconnected',connectionId)])
 return c.json({status:'Credential replaced; run a sync to check it.'})
})
connectionsApi.delete('/api/buoy/connections/:id',async c=>{
 const actor=c.get('actor');requirePerson(actor);const connectionId=c.req.param('id');await jsonBody(c.req.raw)
 insist(await stmt(c.env.DB,'SELECT id FROM buoy_connections WHERE id=?',connectionId).first(),'Connection not found.',404)
 await c.env.DB.batch([authority(c.env.DB,actor,true),stmt(c.env.DB,'DELETE FROM buoy_connection_credentials WHERE connection_id=?',connectionId),stmt(c.env.DB,'UPDATE buoy_connections SET disconnected_at=?,version=version+1,lease_until=0 WHERE id=?',now(),connectionId),auditRecord(c.env.DB,actor,'connector.disconnected',connectionId)])
 return c.json({status:'Disconnected'})
})
connectionsApi.post('/api/buoy/connections/:id/sync',async c=>{
 const actor=c.get('actor');requirePerson(actor);await jsonBody(c.req.raw)
 return c.json(await syncConnection(c.env,c.req.param('id'),actor))
})
