import { Hono } from 'hono'
import { runtimeBindings, type Bindings } from '../../auth.server'
import { jsonBody } from '../access'
import { Problem, insist, guard, stmt, type Actor } from '../core'
import {replayKey,replayIdentities} from '../privacy/replay'
import { credentialFor, identity, mapping, mappingGuard, only } from './model'
import { deliveries } from './delivery'
import { receipt } from './receipts'
import { inappState, saveCampaign, toggleCampaign, issueInapp, revokeInapp, personTimeline } from './admin'
export const inappIngest=new Hono<{Bindings:Bindings}>()
inappIngest.onError((error,c)=>{
 if(error instanceof Problem)return c.json({error:error.message},error.status as 400)
 if(/constraint|SQLITE_CONSTRAINT/i.test(error.message))return c.json({error:'Delivery authority, audience or receipt changed. Reload and review.'},409)
 console.error('In-app request failed',error.name)
 return c.json({error:'In-app request could not be completed.'},503)
})
for(const action of ['deliver','receipts'] as const)inappIngest.post('/api/buoy/inapp/'+action+'/:sourceId',async(c,next)=>{
 c.header('cache-control','no-store');c.header('x-content-type-options','nosniff');c.header('referrer-policy','no-referrer')
 const authorization=c.req.header('authorization')??null
 if(authorization&&!authorization.startsWith('Bearer buoy_inapp_')){await next();return c.res}
 const env=runtimeBindings(c.env),request=c.req.raw,url=new URL(request.url),sourceId=c.req.param('sourceId')!
 insist(url.origin===env.AUTH_ORIGIN&&(!request.headers.has('host')||request.headers.get('host')===url.host),'Invalid request host.',403)
 insist(!request.headers.has('origin')&&!['sec-fetch-site','sec-fetch-dest','sec-fetch-user'].some(k=>request.headers.has(k)),'Server only. Use the buyer’s authenticated product relay.',403)
 const credential=await credentialFor(env.DB,sourceId,authorization),input=await jsonBody(request)
 only(input,action==='deliver'?['userId','groupId']:['userId','groupId','campaignId','deliveryId','kind','messageId'])
 const {userId,groupId}=identity(input)
 const replay=await replayKey(env.DB),identityHash=JSON.stringify(await replayIdentities(replay.key,sourceId,userId))
 const erased=await stmt(env.DB,'SELECT 1 FROM buoy_erased_usage_identities WHERE source_id=? AND identity_hash IN(SELECT value FROM json_each(?))',sourceId,identityHash).first()
 insist(!erased,'This source identity was erased; no intake or delivery is allowed.',409)
 const erasureGuard=guard(env.DB,'NOT EXISTS(SELECT 1 FROM buoy_erased_usage_identities WHERE source_id=? AND identity_hash IN(SELECT value FROM json_each(?)))',sourceId,identityHash)
 const m=await mapping(env.DB,sourceId,userId,groupId),fence=mappingGuard(env.DB,sourceId,userId,groupId,m)
 if(action==='deliver')return c.json(await deliveries(env.DB,sourceId,m,credential.guard,fence,credential.id,erasureGuard))
 return c.json(await receipt(env.DB,sourceId,userId,groupId,m,input,credential.guard,fence,credential.id,erasureGuard),202)
})
export const inappAdmin=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
inappAdmin.get('/api/buoy/inapp',async c=>c.json(await inappState(c.env.DB,c.get('actor'))))
inappAdmin.post('/api/buoy/inapp/campaigns',async c=>c.json(await saveCampaign(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
inappAdmin.put('/api/buoy/inapp/campaigns/:id',async c=>c.json(await toggleCampaign(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
inappAdmin.post('/api/buoy/inapp/credentials',async c=>c.json(await issueInapp(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
inappAdmin.delete('/api/buoy/inapp/credentials/:id',async c=>{await jsonBody(c.req.raw);return c.json(await revokeInapp(c.env.DB,c.get('actor'),c.req.param('id')))})
inappAdmin.get('/api/buoy/customer-people/:id/timeline',async c=>c.json(await personTimeline(c.env.DB,c.get('actor'),c.req.param('id'),c.req.query('cursor')??null)))
