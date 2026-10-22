import {insist} from '../core'
import {isCurrency} from '../currencies'
import {financials} from './model'
import type {BillingDocument,BillingLine,BillingSubscription,StripeRecord} from './types'
const VERSION='2025-02-24.acacia'
const record=(value:unknown):StripeRecord=>{insist(!!value&&typeof value==='object'&&!Array.isArray(value),'Invalid Stripe object.',502);return value as StripeRecord}
export const sourceId=(value:unknown):string=>{const id=typeof value==='string'?value:record(value).id;insist(typeof id==='string'&&/^[A-Za-z0-9_-]{1,255}$/.test(id),'Invalid Stripe source reference.',502);return id}
const optionalId=(value:unknown)=>value===null||value===undefined?null:sourceId(value)
const integer=(value:unknown):number=>{insist(Number.isSafeInteger(value)&&Number(value)>=0,'Invalid Stripe nonnegative minor amount or quantity.',502);return Number(value)}
const state=(value:unknown,allowed:string[])=>{insist(typeof value==='string'&&allowed.includes(value),'Invalid Stripe record status.',502);return value}
export const instant=(value:unknown)=>{const n=integer(value),d=new Date(n*1000);insist(Number.isFinite(d.getTime()),'Invalid Stripe observed instant.',502);return d.toISOString()}
const nullableInstant=(value:unknown)=>value===null||value===undefined?null:instant(value)
const currency=(value:unknown)=>{insist(typeof value==='string'&&/^[a-z]{3}$/.test(value)&&isCurrency(value.toUpperCase()),'Invalid Stripe currency.',502);return value.toUpperCase()}
const bool=(value:unknown)=>{insist(typeof value==='boolean','Invalid Stripe boolean.',502);return value}
function typed(value:unknown,type:string,customerId?:string){const row=record(value);insist(row.object===type&&row.livemode===false,'Invalid Stripe test-mode '+type+' record.',502);sourceId(row.id);if(customerId!==undefined)insist(sourceId(row.customer)===customerId,'Invalid Stripe customer attribution.',502);return row}
// Only these literal GET paths exist. No URL, method, host, expansion or search
// supplied by a caller or a provider response is forwarded to the network.
type Collection='subscriptions'|'subscription_items'|'invoices'|'payment_intents'|'charges'|'refunds'|'credit_notes'
async function get(secret:string,path:string,params:Record<string,string>={}){
 insist(secret.length>0&&secret.length<=256&&!/[\s\x00-\x1f\x7f]/.test(secret)&&! /^(rk|sk)_live_/.test(secret),'Stripe test-mode credential required.',409)
 const url=new URL('https://api.stripe.com'+path)
 for(const [key,value]of Object.entries(params))url.searchParams.set(key,value)
 let response:Response
 try{response=await fetch(url,{method:'GET',redirect:'manual',headers:{Authorization:'Bearer '+secret,'Stripe-Version':VERSION},signal:AbortSignal.timeout(20000)})}catch{throw new Error('Stripe billing could not be reached. Reconnect and retry.')}
 if(!response.ok)throw new Error(response.status===401||response.status===403?'Stripe billing refused the credential. Reconnect with read access to billing records.':response.status===429?'Stripe billing rate limit reached. The next run will recheck.':'Stripe billing request failed (HTTP '+response.status+').')
 try{return record(await response.json())}catch{throw new Error('Invalid Stripe billing response.')}
}
async function list(secret:string,collection:Collection,params:Record<string,string>){
 const result:StripeRecord[]=[],seen=new Set<string>();let after:string|undefined
 for(let page=0;page<100;page++){
  const body=await get(secret,'/v1/'+collection,{...params,limit:'100',...(after?{starting_after:after}:{})})
  insist(body.object==='list'&&Array.isArray(body.data)&&typeof body.has_more==='boolean','Invalid Stripe billing page.',502)
  for(const value of body.data){const row=record(value),id=sourceId(row.id);insist(!seen.has(id),'Invalid Stripe repeated pagination record.',502);seen.add(id);result.push(row)}
  if(!body.has_more)return result.sort((a,b)=>sourceId(a.id).localeCompare(sourceId(b.id)))
  insist(body.data.length>0,'Invalid Stripe empty continuation page.',502);after=sourceId(record(body.data.at(-1)).id)
 }
 throw new Error('Stripe billing collection exceeds the supported 10,000-record reconciliation window.')
}
export async function stripeCustomer(secret:string,customerId:string){
 sourceId(customerId)
 const customer=typed(await get(secret,'/v1/customers/'+encodeURIComponent(customerId)),'customer')
 insist(sourceId(customer.id)===customerId&&!customer.deleted,'Invalid Stripe customer identity.',502)
 return {id:customerId,createdAt:instant(customer.created)}
}
function priceLine(value:unknown,subscriptionId:string):BillingLine{
 const row=record(value);insist(row.object==='subscription_item'&&sourceId(row.subscription)===subscriptionId,'Invalid Stripe subscription item.',502)
 const price=typed(row.price,'price'),recurring=record(price.recurring)
 insist(price.billing_scheme==='per_unit'&&!price.transform_quantity&&!price.tiers_mode&&recurring.usage_type==='licensed','Invalid Stripe unsupported recurring price: tiered, transformed and metered prices require a separately supported calculation.',502)
 const decimal=price.unit_amount_decimal??price.unit_amount
 insist((typeof decimal==='string'||typeof decimal==='number')&&/^\d+(\.\d{1,12})?$/.test(String(decimal)),'Invalid Stripe decimal unit amount.',502)
 const interval=state(recurring.interval,['month','year','week','day']) as BillingLine['interval'],intervalCount=integer(recurring.interval_count)
 insist(intervalCount>0,'Invalid Stripe recurring interval.',502)
 return {id:sourceId(row.id),priceId:sourceId(price.id),productId:sourceId(price.product),quantity:integer(row.quantity),currency:currency(price.currency),unitAmountDecimal:String(decimal),interval,intervalCount}
}
export async function readStripeBilling(secret:string,customerId:string,observedAt:string):Promise<{document:BillingDocument;readCount:number}>{
 await stripeCustomer(secret,customerId)
 // Keep a customer's reads bounded in memory and finish all validation before
 // the transaction. No partial provider page becomes an account observation.
 const subscriptions:BillingSubscription[]=[],rawSubscriptions=await list(secret,'subscriptions',{customer:customerId,status:'all'})
 let readCount=1+rawSubscriptions.length
 for(const value of rawSubscriptions){
  const row=typed(value,'subscription',customerId),subscriptionId=sourceId(row.id)
  insist((!row.discounts||Array.isArray(row.discounts)&&row.discounts.length===0)&&!row.discount,'Invalid Stripe unsupported subscription discount; ARR cannot be inferred safely.',502)
  const items=await list(secret,'subscription_items',{subscription:subscriptionId});readCount+=items.length
  const lines=items.map(item=>priceLine(item,subscriptionId))
  // Acacia has period instants on the subscription; all supported records must
  // provide actual instants rather than dates invented by the application.
  const periodStart=instant(row.current_period_start),periodEnd=instant(row.current_period_end)
  insist(periodEnd>=periodStart,'Invalid Stripe subscription period.',502)
  subscriptions.push({id:subscriptionId,status:state(row.status,['incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused']),createdAt:instant(row.created),cancelAtPeriodEnd:bool(row.cancel_at_period_end),canceledAt:nullableInstant(row.canceled_at),periodStart,periodEnd,lines})
 }
 const rawInvoices=await list(secret,'invoices',{customer:customerId}),rawPayments=await list(secret,'payment_intents',{customer:customerId}),rawCharges=await list(secret,'charges',{customer:customerId}),rawCredits=await list(secret,'credit_notes',{customer:customerId})
 readCount+=rawInvoices.length+rawPayments.length+rawCharges.length+rawCredits.length
 const invoices=rawInvoices.map(value=>{const r=typed(value,'invoice',customerId);return {id:sourceId(r.id),currency:currency(r.currency),status:state(r.status,['draft','open','paid','uncollectible','void']),amountDueMinor:integer(r.amount_due),amountPaidMinor:integer(r.amount_paid),amountRemainingMinor:integer(r.amount_remaining),dueAt:nullableInstant(r.due_date),attempted:bool(r.attempted),attemptCount:integer(r.attempt_count),paymentIntentId:optionalId(r.payment_intent),createdAt:instant(r.created)}})
 const payments=rawPayments.map(value=>{const r=typed(value,'payment_intent',customerId);return {id:sourceId(r.id),currency:currency(r.currency),amountMinor:integer(r.amount),amountReceivedMinor:integer(r.amount_received),status:state(r.status,['requires_payment_method','requires_confirmation','requires_action','processing','requires_capture','canceled','succeeded']),failed:r.status==='requires_payment_method'&&!!r.last_payment_error,createdAt:instant(r.created)}})
 const refunds:BillingDocument['refunds']=[]
 for(const value of rawCharges){
  const charge=typed(value,'charge',customerId),chargeId=sourceId(charge.id)
  // Fetch every refund page instead of relying on the truncated embedded list.
  for(const value of await list(secret,'refunds',{charge:chargeId})){
   const r=record(value);insist(r.object==='refund'&&r.livemode!==true,'Invalid Stripe refund record.',502);insist(sourceId(r.charge)===chargeId,'Invalid Stripe refund attribution.',502);readCount++
   refunds.push({id:sourceId(r.id),chargeId,currency:currency(r.currency),amountMinor:integer(r.amount),status:state(r.status,['pending','requires_action','succeeded','failed','canceled']),createdAt:instant(r.created)})
  }
 }
 const creditNotes=rawCredits.map(value=>{const r=typed(value,'credit_note',customerId);return {id:sourceId(r.id),invoiceId:sourceId(r.invoice),currency:currency(r.currency),amountMinor:integer(r.amount),status:state(r.status,['issued','void']),createdAt:instant(r.created)}})
 return {document:financials({customerId,subscriptions,invoices,payments,refunds:refunds.sort((a,b)=>a.id.localeCompare(b.id)),creditNotes},observedAt),readCount}
}
export async function webhookCustomer(secret:string,type:string,row:StripeRecord){
 if(type.startsWith('customer.')&&!type.startsWith('customer.subscription.'))return sourceId(row.id)
 if(row.customer)return sourceId(row.customer)
 if(row.charge){const charge=typed(await get(secret,'/v1/charges/'+encodeURIComponent(sourceId(row.charge))),'charge');return sourceId(charge.customer)}
 return null
}
