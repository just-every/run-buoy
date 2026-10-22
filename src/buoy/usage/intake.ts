import {replayKey,replayIdentities} from '../privacy/replay'
import {recalculateScorecards} from '../scorecards'
import { MAPPED_JOIN, ATTRIBUTED } from './mappings'
import { Hono } from 'hono'
import { runtimeBindings, type Bindings } from '../../auth.server'
import { jsonBody } from '../access'
import { guard, Problem } from '../core'
import { digest, insist, now, stmt, type Source } from './model'
import { parseEvents } from './parse'

export const usageIngest=new Hono<{Bindings:Bindings}>()
usageIngest.onError((error,c)=>{
 if(error instanceof Problem)return c.json({error:error.message},error.status as 400)
 if(/constraint|SQLITE_CONSTRAINT/i.test(error.message))return c.json({error:'Intake authority or source changed; no events were accepted.'},409)
 console.error('Usage intake failed',error.name)
 return c.json({error:'Usage intake could not be completed.'},503)
})
usageIngest.post('/api/buoy/usage/intake/:sourceId',async(c,next)=>{
 c.header('cache-control','no-store');c.header('x-content-type-options','nosniff');c.header('referrer-policy','no-referrer')
 const env=runtimeBindings(c.env),request=c.req.raw,url=new URL(request.url),sourceId=c.req.param('sourceId')
 const authorization=request.headers.get('authorization')
 // Scoped agent credentials must reach the parent policy middleware so its
 // normal attempt/refusal audit covers this forbidden door as well.
 if(authorization&&!authorization.startsWith('Bearer buoy_usage_')){await next();return c.res}
 insist(url.origin===env.AUTH_ORIGIN&&(!request.headers.has('host')||request.headers.get('host')===url.host),'Invalid request host.',403)
 // Node's built-in fetch adds Sec-Fetch-Mode alone. Browser site, destination
 // and user metadata (or any Origin) are refused; no CORS is enabled here.
 insist(!request.headers.has('origin')&&!['sec-fetch-site','sec-fetch-dest','sec-fetch-user'].some(k=>request.headers.has(k)),'Server intake only. Browser events must pass through the buyer’s authenticated server relay.',403)
 insist(authorization&&/^Bearer buoy_usage_[a-f0-9]{64}$/.test(authorization),'A server intake credential is required.',401)
 const hash=await digest(authorization.slice(7))
 const authentication=await stmt(env.DB,`SELECT c.id,c.scope,s.kind,s.reference FROM buoy_usage_credentials c JOIN buoy_usage_sources s ON s.id=c.source_id WHERE c.token_hash=? AND c.source_id=? AND c.revoked_at IS NULL`,hash,sourceId).first<{id:string;scope:string;kind:Source['kind'];reference:string}>()
 insist(authentication,'Intake credential is invalid or revoked for this source.',401)
 const stamp=now(),events=parseEvents(await jsonBody(request),authentication.kind,stamp),scope=JSON.parse(authentication.scope) as string[]
 insist(events.every(event=>scope.includes(event.type)),'Credential does not permit this event type.',403)
 const serialized=JSON.stringify(events)
 const replay=await replayKey(env.DB)
 const identityHashes=JSON.stringify((await Promise.all([...new Set(events.map(e=>e.userId).filter((v):v is string=>!!v))].map(user=>replayIdentities(replay.key,sourceId,user)))).flat())
 // Credential authority and the insert share one write transaction. No cache
 // can keep a revoked credential alive while a batch is waiting to commit.
 const results=await env.DB.batch([
  guard(env.DB,'EXISTS(SELECT 1 FROM buoy_usage_credentials c JOIN buoy_usage_sources s ON s.id=c.source_id WHERE c.id=? AND c.token_hash=? AND c.source_id=? AND c.revoked_at IS NULL AND c.scope=? AND s.kind=? AND s.reference=?)',authentication.id,hash,sourceId,authentication.scope,authentication.kind,authentication.reference),
  guard(env.DB,'NOT EXISTS(SELECT 1 FROM buoy_erased_usage_identities WHERE source_id=? AND identity_hash IN(SELECT value FROM json_each(?)))',sourceId,identityHashes),
  stmt(env.DB,`INSERT OR IGNORE INTO buoy_usage_events(id,source_id,message_id,type,event,user_id,group_id,observed_at,received_at,source_reference,source_system,payload)
   SELECT json_extract(value,'$.id'),?,json_extract(value,'$.messageId'),json_extract(value,'$.type'),json_extract(value,'$.event'),json_extract(value,'$.userId'),json_extract(value,'$.groupId'),json_extract(value,'$.observedAt'),?,?,?,json_extract(value,'$.payload') FROM json_each(?) ORDER BY CAST(key AS INTEGER)`,sourceId,stamp,authentication.reference,authentication.kind,serialized),
  stmt(env.DB,`UPDATE buoy_accounts SET revision=lower(hex(randomblob(16))) WHERE id IN (SELECT m.account_id FROM buoy_usage_events e ${MAPPED_JOIN} WHERE ${ATTRIBUTED} AND e.source_id=? AND e.id IN (SELECT json_extract(value,'$.id') FROM json_each(?)))`,sourceId,serialized),
  stmt(env.DB,`INSERT OR IGNORE INTO buoy_audit_subjects(account_id,subject) SELECT account_id,lower(hex(randomblob(16))) FROM (SELECT DISTINCT m.account_id FROM buoy_usage_events e ${MAPPED_JOIN} WHERE ${ATTRIBUTED} AND e.source_id=? AND e.id IN (SELECT json_extract(value,'$.id') FROM json_each(?)))`,sourceId,serialized),
  stmt(env.DB,`INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) SELECT lower(hex(randomblob(16))),?,'account.usage-refreshed',s.subject,'',? FROM buoy_audit_subjects s WHERE s.account_id IN (SELECT DISTINCT m.account_id FROM buoy_usage_events e ${MAPPED_JOIN} WHERE ${ATTRIBUTED} AND e.source_id=? AND e.id IN (SELECT json_extract(value,'$.id') FROM json_each(?)))`,'usage-source:'+sourceId,stamp,sourceId,serialized),
  stmt(env.DB,'UPDATE buoy_usage_credentials SET last_used_at=? WHERE id=?',stamp,authentication.id),
  replay.guard(),stmt(env.DB,'DELETE FROM buoy_assertions')
 ])
 await recalculateScorecards(env.DB)
 const accepted=results[2].meta.changes
 return c.json({received:events.length,accepted,duplicates:events.length-accepted,stored:accepted},202)
})
