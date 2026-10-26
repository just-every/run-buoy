import {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {jsonBody} from '../access'
import {authority,insist,requirePerson,stmt,text,type Actor} from '../core'
import {auditRecord} from '../audit-records'
import {seal} from '../connectors/vault'
import {applyBinding,billingState,previewBinding,removeBinding,settings} from './storage'
import {syncBilling} from './sync'
import {receiveStripeWebhook} from './webhook'
export {reconcileBilling,syncBilling} from './sync'
export {billingState,billingAccountSignals} from './storage'
export type {BillingState,BindingPreview} from './types'
export const billingApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
billingApi.get('/api/buoy/billing',async c=>c.json(await billingState(c.env.DB,c.get('actor'),c.req.query('on'))))
billingApi.post('/api/buoy/billing/:id/bindings/preview',async c=>c.json(await previewBinding(c.env,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
billingApi.post('/api/buoy/billing/:id/bindings',async c=>c.json(await applyBinding(c.env,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw)),201))
billingApi.delete('/api/buoy/billing/bindings/:bindingId',async c=>c.json(await removeBinding(c.env,c.get('actor'),c.req.param('bindingId'),await jsonBody(c.req.raw))))
billingApi.put('/api/buoy/billing/:id/settings',async c=>{
 const actor=c.get('actor');requirePerson(actor);const body=await jsonBody(c.req.raw),connectionId=c.req.param('id'),days=body.staleDays
 insist(Number.isInteger(days)&&Number(days)>=1&&Number(days)<=365,'Stripe billing threshold must be 1 to 365 whole UTC days.')
 await settings(c.env.DB,connectionId)
 await c.env.DB.batch([authority(c.env.DB,actor,true),stmt(c.env.DB,'UPDATE buoy_billing_settings SET stale_days=?,version=version+1,lease_until=0 WHERE connection_id=?',days,connectionId),stmt(c.env.DB,'UPDATE buoy_connections SET stale_days=? WHERE id=?',days,connectionId),auditRecord(c.env.DB,actor,'billing.freshness-changed',connectionId),stmt(c.env.DB,'DELETE FROM buoy_assertions')])
 return c.json({status:'Stripe billing freshness threshold saved.'})
})
billingApi.put('/api/buoy/billing/:id/webhook-secret',async c=>{
 const actor=c.get('actor');requirePerson(actor);const body=await jsonBody(c.req.raw),connectionId=c.req.param('id'),secret=text(body.secret,'Stripe endpoint signing secret',256)
 insist(secret.length>=16&&!/[\s\x00-\x1f\x7f]/.test(secret),'Use the endpoint signing secret from Stripe.')
 await settings(c.env.DB,connectionId)
 await c.env.DB.batch([authority(c.env.DB,actor,true),stmt(c.env.DB,'INSERT INTO buoy_billing_webhook_credentials(connection_id,sealed) VALUES(?,?) ON CONFLICT(connection_id) DO UPDATE SET sealed=excluded.sealed',connectionId,await seal(c.env.SESSION_SECRET,'billing-webhook:'+connectionId,secret)),stmt(c.env.DB,'UPDATE buoy_billing_settings SET version=version+1,lease_until=0 WHERE connection_id=?',connectionId),auditRecord(c.env.DB,actor,'connector.webhook-credential-changed',connectionId),stmt(c.env.DB,'DELETE FROM buoy_assertions')])
 return c.json({status:'Stripe webhook signing secret saved.'})
})
billingApi.post('/api/buoy/billing/:id/sync',async c=>{const actor=c.get('actor');requirePerson(actor);await jsonBody(c.req.raw);return c.json(await syncBilling(c.env,c.req.param('id'),actor))})
// Mount this router before actorFor/CSRF. Its sole public door verifies the raw
// Stripe signature and a five-minute tolerance before storing any event.
export const billingIngest=new Hono<{Bindings:Bindings}>()
billingIngest.post('/api/buoy/billing/:id/webhook',async c=>c.json(await receiveStripeWebhook(c.env,c.req.param('id'),c.req.raw)))
