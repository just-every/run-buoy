import type {Bindings} from '../../auth.server'
import {digest} from '../access'
import {guard,insist,now,object,stmt} from '../core'
import {unseal} from '../connectors/vault'
import {credential} from './storage'
import {sourceId,webhookCustomer} from './stripe'
import {syncBilling} from './sync'
const utf8=new TextEncoder()
export async function receiveStripeWebhook(env:Bindings,connectionId:string,request:Request){
 const connection=await credential(env,connectionId)
 const stored=await stmt(env.DB,'SELECT sealed FROM buoy_billing_webhook_credentials WHERE connection_id=?',connectionId).first<{sealed:string}>()
 insist(stored,'Configure the endpoint signing secret before receiving Stripe events.',409)
 const header=request.headers.get('stripe-signature')??'',parts=header.split(',').map(p=>p.trim().split('=')),timestamps=parts.filter(([key])=>key==='t').map(([,value])=>value),signatures=parts.filter(([key,value])=>key==='v1'&&/^[a-f0-9]{64}$/.test(value)).map(([,value])=>value)
 insist(timestamps.length===1&&/^\d+$/.test(timestamps[0])&&Math.abs(Date.now()/1000-Number(timestamps[0]))<=300&&signatures.length>0,'Invalid Stripe webhook signature.',400)
 const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0
 if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>256000){await reader.cancel();insist(false,'Stripe webhook exceeds 256 KB.',413)}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes),secret=await unseal(env.SESSION_SECRET,'billing-webhook:'+connectionId,stored.sealed),key=await crypto.subtle.importKey('raw',utf8.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify'])
 const verified=await Promise.all(signatures.map(signature=>crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g)!,x=>parseInt(x,16)),utf8.encode(timestamps[0]+'.'+raw))))
 insist(verified.some(Boolean),'Invalid Stripe webhook signature.',400)
 let event:Record<string,unknown>;try{event=object(JSON.parse(raw))}catch{insist(false,'Invalid Stripe event.',400)}
 insist(event.object==='event'&&event.livemode===false&&typeof event.type==='string','Invalid Stripe test-mode event.',400)
 const eventId=sourceId(event.id),type=event.type,payloadDigest=await digest(raw),prior=await stmt(env.DB,'SELECT payload_digest,status FROM buoy_billing_webhook_events WHERE connection_id=? AND event_id=?',connectionId,eventId).first<{payload_digest:string;status:string}>()
 if(prior){insist(prior.payload_digest===payloadDigest,'Stripe event ID was reused with different content.',409);if(prior.status!=='pending')return {received:true,duplicate:true}}
 const supported=/^(customer\.(created|updated|deleted|subscription\.(created|updated|deleted|paused|resumed))|invoice\.(created|updated|finalized|paid|payment_failed|payment_action_required|voided|marked_uncollectible)|payment_intent\.(created|succeeded|payment_failed|canceled|requires_action)|charge\.(succeeded|failed|refunded|updated)|refund\.(created|updated|failed)|credit_note\.(created|updated|voided))$/.test(type)
 const customerId=supported?await webhookCustomer(connection.secret,type,object(object(event.data).object)):null
 const binding=customerId?await stmt(env.DB,'SELECT id FROM buoy_billing_bindings WHERE connection_id=? AND customer_id=?',connectionId,customerId).first():null
 if(!prior)await env.DB.batch([guard(env.DB,'EXISTS(SELECT 1 FROM buoy_billing_webhook_credentials WHERE connection_id=? AND sealed=?)',connectionId,stored.sealed),guard(env.DB,'EXISTS(SELECT 1 FROM buoy_connections c JOIN buoy_connection_credentials k ON k.connection_id=c.id WHERE c.id=? AND c.version=? AND c.disconnected_at IS NULL)',connectionId,connection.version),stmt(env.DB,'INSERT OR IGNORE INTO buoy_billing_webhook_events(connection_id,event_id,event_type,payload_digest,received_at,customer_id,status) VALUES(?,?,?,?,?,?,?)',connectionId,eventId,type,payloadDigest,now(),binding?customerId:null,binding?'pending':'ignored'),stmt(env.DB,'DELETE FROM buoy_assertions')])
 if(!binding)return {received:true,ignored:true}
 // Re-fetch the customer's present provider state: duplicate, late and unordered
 // payloads never overwrite a newer subscription with the payload's old state.
 try{const run=await syncBilling(env,connectionId,undefined,customerId!,eventId) as {status:string}|null;insist(run?.status==='succeeded','Stripe billing webhook awaits reconciliation.',503)}catch(error){if(error instanceof Error&&error.message==='Stripe billing webhook awaits reconciliation.')throw error;insist(false,'Stripe billing webhook awaits reconciliation.',503)}
 return {received:true,duplicate:!!prior}
}
