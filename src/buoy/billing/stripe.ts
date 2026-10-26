import {insist} from '../core'
import {isCurrency} from '../currencies'
import {financials} from './model'
import type {BillingDocument,BillingLine,BillingSubscription,BillingDiscount,BillingTier,StripeRecord} from './types'
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
function typed(value:unknown,type:string,customerId?:string){const row=record(value);insist(row.object===type&&row.livemode===false,'Invalid Stripe test-mode '+type+' record.',502);if(type==='coupon')insist(typeof row.id==='string'&&row.id.length>0&&row.id.length<=255&&!/[\x00-\x1f\x7f]/.test(row.id)&&!['.','..'].includes(row.id),'Invalid Stripe coupon reference.',502);else sourceId(row.id);if(customerId!==undefined)insist(sourceId(row.customer)===customerId,'Invalid Stripe customer attribution.',502);return row}
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
const decimalAmount=(value:unknown):string=>{insist((typeof value==='string'||typeof value==='number')&&/^\d{1,30}(\.\d{1,12})?$/.test(String(value)),'Invalid Stripe decimal unit amount.',502);return String(value)}
const nullableAmount=(decimal:unknown,whole:unknown)=>decimal!==null&&decimal!==undefined?decimalAmount(decimal):whole!==null&&whole!==undefined?String(integer(whole)):null
interface PricingRead {secret:string;count:number;coupons:Map<string,StripeRecord>;prices:Map<string,StripeRecord>}
function rawDiscounts(row:StripeRecord){
 const values=row.discounts===null||row.discounts===undefined?[]:row.discounts
 insist(Array.isArray(values)&&values.length<=20,'Invalid Stripe discount array.',502)
 const result=[...values]
 if(row.discount!==null&&row.discount!==undefined&&!result.some(value=>sourceId(value)===sourceId(row.discount)))result.push(row.discount)
 insist(result.length<=20&&new Set(result.map(sourceId)).size===result.length,'Invalid Stripe duplicate discounts.',502)
 return result
}
async function discountRecords(values:unknown[],context:PricingRead,customerId:string,subscriptionId?:string,itemId?:string):Promise<BillingDiscount[]>{
 const result:BillingDiscount[]=[]
 for(const value of values){
  // Stripe has no discount retrieval endpoint: IDs must be expanded on their
  // owning subscription/item read. Coupon details have a fixed GET endpoint.
  const row=record(value);insist(row.object==='discount','Invalid Stripe expanded discount.',502)
  if(row.customer!==null&&row.customer!==undefined)insist(sourceId(row.customer)===customerId,'Invalid Stripe discount customer attribution.',502)
  if(row.subscription!==null&&row.subscription!==undefined)insist(sourceId(row.subscription)===subscriptionId,'Invalid Stripe discount subscription attribution.',502)
  if(row.subscription_item!==null&&row.subscription_item!==undefined)insist(sourceId(row.subscription_item)===itemId,'Invalid Stripe discount item attribution.',502)
  const couponValue=typeof row.coupon==='string'?row.coupon:record(row.coupon).id
  insist(typeof couponValue==='string'&&couponValue.length>0&&couponValue.length<=255&&!/[\x00-\x1f\x7f]/.test(couponValue)&&!['.','..'].includes(couponValue),'Invalid Stripe coupon reference.',502)
  const couponId=couponValue,cached=context.coupons.get(couponId)
  const coupon=cached??typed(await get(context.secret,'/v1/coupons/'+encodeURIComponent(couponId),{'expand[0]':'applies_to','expand[1]':'currency_options'}),'coupon')
  if(!cached){context.count++;context.coupons.set(couponId,coupon)}
  insist(coupon.id===couponId,'Invalid Stripe coupon identity.',502)
  const duration=state(coupon.duration,['forever','repeating','once']) as BillingDiscount['duration'],startAt=instant(row.start),endAt=nullableInstant(row.end)
  insist(!endAt||endAt>=startAt,'Invalid Stripe discount period.',502)
  const durationMonths=coupon.duration_in_months===null||coupon.duration_in_months===undefined?null:integer(coupon.duration_in_months)
  insist(duration!=='repeating'||durationMonths!==null&&durationMonths>0&&endAt!==null,'Invalid Stripe repeating discount duration.',502)
  const percent=coupon.percent_off===null||coupon.percent_off===undefined?null:decimalAmount(coupon.percent_off),amount=coupon.amount_off===null||coupon.amount_off===undefined?null:integer(coupon.amount_off)
  insist((percent!==null)!==(amount!==null)&&(!percent||Number(percent)<=100),'Invalid Stripe coupon amount.',502)
  const code=coupon.currency===null||coupon.currency===undefined?null:currency(coupon.currency),currencyAmounts:Record<string,number>={}
  if(coupon.currency_options!==null&&coupon.currency_options!==undefined)for(const [key,option]of Object.entries(record(coupon.currency_options)))currencyAmounts[currency(key)]=integer(record(option).amount_off)
  insist(amount===null||code!==null,'Invalid Stripe fixed coupon currency.',502)
  let products:string[]|null=null
  if(coupon.applies_to!==null&&coupon.applies_to!==undefined){const ids=record(coupon.applies_to).products;insist(Array.isArray(ids)&&ids.length<=10000,'Invalid Stripe coupon product scope.',502);products=ids.map(sourceId);insist(new Set(products).size===products.length,'Invalid Stripe duplicate coupon product.',502)}
  result.push({id:sourceId(row.id),couponId,promotionCodeId:optionalId(row.promotion_code),startAt,endAt,duration,durationMonths,percentOffDecimal:percent,amountOffMinor:amount,currency:code,currencyAmounts,products,couponRedeemable:bool(coupon.valid)})
 }
 return result
}
async function priceLine(value:unknown,subscriptionId:string,customerId:string,context:PricingRead,selectedCurrency?:string):Promise<BillingLine>{
 const row=record(value);insist(row.object==='subscription_item'&&sourceId(row.subscription)===subscriptionId,'Invalid Stripe subscription item.',502)
 let price:StripeRecord
 if(typeof row.price==='string'){const key=sourceId(row.price),cached=context.prices.get(key);price=cached??typed(await get(context.secret,'/v1/prices/'+encodeURIComponent(key),{'expand[0]':'tiers','expand[1]':'currency_options'}),'price');if(!cached){context.count++;context.prices.set(key,price)};insist(sourceId(price.id)===key,'Invalid Stripe price identity.',502)}else price=typed(row.price,'price')
 const priceId=sourceId(price.id),scheme=state(price.billing_scheme,['per_unit','tiered']) as BillingLine['billingScheme']
 if(scheme==='tiered')state(price.tiers_mode,['volume','graduated'])
 if(scheme==='tiered'&&!Array.isArray(price.tiers)||selectedCurrency&&selectedCurrency!==currency(price.currency)&&!price.currency_options){
  const cached=context.prices.get(priceId);price=cached??typed(await get(context.secret,'/v1/prices/'+encodeURIComponent(priceId),{'expand[0]':'tiers','expand[1]':'currency_options'}),'price')
  if(!cached){context.count++;context.prices.set(priceId,price)}
  insist(sourceId(price.id)===priceId&&price.billing_scheme===scheme,'Invalid Stripe price identity.',502)
 }
 const recurring=record(price.recurring),code=selectedCurrency??currency(price.currency)
 let amounts=price
 if(code!==currency(price.currency)){const option=record(record(price.currency_options)[code.toLowerCase()]);amounts=option}
 const usageType=state(recurring.usage_type,['licensed','metered']) as BillingLine['usageType'],interval=state(recurring.interval,['month','year','week','day']) as BillingLine['interval'],intervalCount=integer(recurring.interval_count)
 insist(intervalCount>0,'Invalid Stripe recurring interval.',502)
 const quantity=row.quantity===null||row.quantity===undefined?null:integer(row.quantity)
 insist(usageType==='metered'||quantity!==null,'Invalid Stripe licensed quantity.',502)
 let transformQuantity:BillingLine['transformQuantity']=null
 if(price.transform_quantity!==null&&price.transform_quantity!==undefined){const transform=record(price.transform_quantity),divideBy=integer(transform.divide_by);insist(divideBy>0,'Invalid Stripe quantity transform divisor.',502);transformQuantity={divideBy,round:state(transform.round,['up','down']) as 'up'|'down'}}
 const unitAmountDecimal=nullableAmount(amounts.unit_amount_decimal,amounts.unit_amount),tiers:BillingTier[]=[]
 let tiersMode:BillingLine['tiersMode']=null
 if(scheme==='tiered'){
  insist(!transformQuantity,'Invalid Stripe incompatible tiered quantity transform.',502)
  tiersMode=state(price.tiers_mode,['volume','graduated']) as 'volume'|'graduated'
  insist(Array.isArray(amounts.tiers)&&amounts.tiers.length>0&&amounts.tiers.length<=1000,'Invalid Stripe complete price tiers.',502)
  let previous=0
  for(const [index,value]of amounts.tiers.entries()){
   const tier=record(value),upTo=tier.up_to===null?null:integer(tier.up_to),unit=nullableAmount(tier.unit_amount_decimal,tier.unit_amount),flat=nullableAmount(tier.flat_amount_decimal,tier.flat_amount)
   insist((upTo===null?index===amounts.tiers.length-1:upTo>previous)&&(unit!==null||flat!==null),'Invalid Stripe price tier boundaries or amounts.',502)
   tiers.push({upTo,unitAmountDecimal:unit,flatAmountDecimal:flat});if(upTo!==null)previous=upTo
  }
  insist(usageType==='metered'||tiers.at(-1)!.upTo===null||quantity!<=tiers.at(-1)!.upTo!,'Invalid Stripe quantity outside defined price tiers.',502)
 }else insist(unitAmountDecimal!==null&&(price.tiers_mode===null||price.tiers_mode===undefined)&&(!amounts.tiers||Array.isArray(amounts.tiers)&&amounts.tiers.length===0),'Invalid Stripe per-unit pricing.',502)
 return {id:sourceId(row.id),priceId,productId:sourceId(price.product),quantity,currency:code,unitAmountDecimal,interval,intervalCount,usageType,billingScheme:scheme,tiersMode,tiers,transformQuantity,discounts:await discountRecords(rawDiscounts(row),context,customerId,subscriptionId,sourceId(row.id))}
}
export async function readStripeBilling(secret:string,customerId:string,observedAt:string):Promise<{document:BillingDocument;readCount:number}>{
 const customer=typed(await get(secret,'/v1/customers/'+encodeURIComponent(sourceId(customerId))),'customer')
 insist(sourceId(customer.id)===customerId&&!customer.deleted,'Invalid Stripe customer identity.',502);instant(customer.created)
 const pricing:PricingRead={secret,count:0,coupons:new Map(),prices:new Map()},customerDiscounts=await discountRecords(rawDiscounts(customer),pricing,customerId)
 // Keep a customer's reads bounded in memory and finish all validation before
 // the transaction. No partial provider page becomes an account observation.
 const subscriptions:BillingSubscription[]=[],rawSubscriptions=await list(secret,'subscriptions',{customer:customerId,status:'all','expand[0]':'data.discounts'})
 let readCount=1+rawSubscriptions.length
 for(const value of rawSubscriptions){
  const row=typed(value,'subscription',customerId),subscriptionId=sourceId(row.id)
  const items=await list(secret,'subscription_items',{subscription:subscriptionId,'expand[0]':'data.discounts'});readCount+=items.length
  const lines:BillingLine[]=[]
  for(const item of items)lines.push(await priceLine(item,subscriptionId,customerId,pricing,row.currency===undefined?undefined:currency(row.currency)))
  const ownDiscounts=rawDiscounts(row),discounts=ownDiscounts.length?await discountRecords(ownDiscounts,pricing,customerId,subscriptionId):customerDiscounts
  // Acacia has period instants on the subscription; all supported records must
  // provide actual instants rather than dates invented by the application.
  const periodStart=instant(row.current_period_start),periodEnd=instant(row.current_period_end)
  insist(periodEnd>=periodStart,'Invalid Stripe subscription period.',502)
  subscriptions.push({id:subscriptionId,status:state(row.status,['incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused']),createdAt:instant(row.created),cancelAtPeriodEnd:bool(row.cancel_at_period_end),canceledAt:nullableInstant(row.canceled_at),periodStart,periodEnd,lines,discounts})
 }
 const rawInvoices=await list(secret,'invoices',{customer:customerId}),rawPayments=await list(secret,'payment_intents',{customer:customerId}),rawCharges=await list(secret,'charges',{customer:customerId}),rawCredits=await list(secret,'credit_notes',{customer:customerId})
 readCount+=rawInvoices.length+rawPayments.length+rawCharges.length+rawCredits.length
 const invoices=rawInvoices.map(value=>{const r=typed(value,'invoice',customerId);return {id:sourceId(r.id),currency:currency(r.currency),status:state(r.status,['draft','open','paid','uncollectible','void']),amountDueMinor:integer(r.amount_due),amountPaidMinor:integer(r.amount_paid),amountRemainingMinor:integer(r.amount_remaining),dueAt:nullableInstant(r.due_date),attempted:bool(r.attempted),attemptCount:integer(r.attempt_count),paymentIntentId:optionalId(r.payment_intent),subscriptionId:optionalId(r.subscription),createdAt:instant(r.created)}})
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
 return {document:financials({customerId,subscriptions,invoices,payments,refunds:refunds.sort((a,b)=>a.id.localeCompare(b.id)),creditNotes},observedAt),readCount:readCount+pricing.count}
}
export async function webhookCustomer(secret:string,type:string,row:StripeRecord){
 if(row.object==='customer')return sourceId(row.id)
 if(row.customer)return sourceId(row.customer)
 if(row.charge){const charge=typed(await get(secret,'/v1/charges/'+encodeURIComponent(sourceId(row.charge))),'charge');return sourceId(charge.customer)}
 return null
}
