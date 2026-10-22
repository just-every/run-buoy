import {insist} from '../core'
import type {BillingDocument,BillingRevenue,ExactAmount} from './types'
type Fraction={n:bigint;d:bigint}
const gcd=(a:bigint,b:bigint):bigint=>b===0n?a:gcd(b,a%b)
const reduced=(n:bigint,d:bigint):Fraction=>{const g=gcd(n,d);return {n:n/g,d:d/g}}
const add=(a:Fraction,b:Fraction)=>reduced(a.n*b.d+b.n*a.d,a.d*b.d)
const exact=(v:Fraction):ExactAmount=>{const rounded=(v.n*2n+v.d)/(v.d*2n);insist(rounded<=BigInt(Number.MAX_SAFE_INTEGER),'Invalid Stripe amount: calculated revenue exceeds safe minor units.',502);return {numeratorMinor:String(v.n),denominator:String(v.d),roundedMinor:Number(rounded)}}
// Annualized recurring price × quantity, without tax, usage or invoice proration.
// Past-due subscriptions retain their contractual price; the delinquency is separate.
export function financials(document:Omit<BillingDocument,'revenue'|'risks'>,observedAt:string):BillingDocument {
 const sums=new Map<string,{arr:Fraction;subscriptions:Set<string>;prices:Set<string>}>()
 for(const subscription of document.subscriptions){
  if(!['active','past_due'].includes(subscription.status))continue
  for(const line of subscription.lines){
   const [whole,decimal='']=line.unitAmountDecimal.split('.'),n=BigInt(whole+decimal)*BigInt(line.quantity),d=10n**BigInt(decimal.length)*BigInt(line.intervalCount)
   const annual=line.interval==='month'?reduced(n*12n,d):line.interval==='year'?reduced(n,d):line.interval==='week'?reduced(n*365n,d*7n):reduced(n*365n,d)
   const sum=sums.get(line.currency)??{arr:{n:0n,d:1n},subscriptions:new Set<string>(),prices:new Set<string>()}
   sum.arr=add(sum.arr,annual);sum.subscriptions.add(subscription.id);sum.prices.add(line.priceId);sums.set(line.currency,sum)
  }
 }
 const revenue:BillingRevenue[]=[...sums].sort(([a],[b])=>a.localeCompare(b)).map(([currency,sum])=>({currency,arr:exact(sum.arr),mrr:exact(reduced(sum.arr.n,sum.arr.d*12n)),subscriptionIds:[...sum.subscriptions].sort(),priceIds:[...sum.prices].sort()}))
 // An observed customer with no active recurring lines is known zero, retaining
 // invoice/subscription currencies instead of inventing a portfolio currency.
 if(!revenue.length){const currencies=new Set([...document.subscriptions.flatMap(s=>s.lines.map(l=>l.currency)),...document.invoices.map(i=>i.currency)]);for(const currency of [...currencies].sort())revenue.push({currency,arr:exact({n:0n,d:1n}),mrr:exact({n:0n,d:1n}),subscriptionIds:[],priceIds:[]})}
 const risks:BillingDocument['risks']=[],failedPayments=new Set(document.payments.filter(p=>p.failed).map(p=>p.id)),covered=new Set<string>()
 for(const invoice of document.invoices){
  if(invoice.status!=='open'||invoice.amountRemainingMinor===0)continue
  // An attempted open invoice can be processing or only partly paid. A
  // linked current payment error, rather than an attempt counter, proves failure.
  if(invoice.paymentIntentId&&failedPayments.has(invoice.paymentIntentId)){risks.push({kind:'failed-payment',reference:invoice.id,currency:invoice.currency,amountMinor:invoice.amountRemainingMinor,observedAt});covered.add(invoice.paymentIntentId)}
  if(invoice.dueAt&&Date.parse(invoice.dueAt)<Date.parse(observedAt))risks.push({kind:'overdue-invoice',reference:invoice.id,currency:invoice.currency,amountMinor:invoice.amountRemainingMinor,observedAt})
 }
 for(const payment of document.payments)if(payment.failed&&!covered.has(payment.id))risks.push({kind:'failed-payment',reference:payment.id,currency:payment.currency,amountMinor:Math.max(0,payment.amountMinor-payment.amountReceivedMinor),observedAt})
 return {...document,revenue,risks}
}
