import {insist} from '../core'
import type {BillingDocument,BillingRevenue,BillingLine,BillingDiscount,ExactAmount} from './types'
type Fraction={n:bigint;d:bigint}
const zero=():Fraction=>({n:0n,d:1n})
const gcd=(a:bigint,b:bigint):bigint=>b===0n?a:gcd(b,a%b)
const reduced=(n:bigint,d:bigint):Fraction=>{const g=gcd(n,d);return {n:n/g,d:d/g}}
const add=(a:Fraction,b:Fraction)=>reduced(a.n*b.d+b.n*a.d,a.d*b.d)
const multiply=(a:Fraction,b:Fraction)=>reduced(a.n*b.n,a.d*b.d)
const subtract=(a:Fraction,b:Fraction)=>a.n*b.d<=b.n*a.d?zero():reduced(a.n*b.d-b.n*a.d,a.d*b.d)
const decimal=(value:string):Fraction=>{const [whole,fraction='']=value.split('.');return reduced(BigInt(whole+fraction),10n**BigInt(fraction.length))}
const exact=(v:Fraction):ExactAmount=>{const rounded=(v.n*2n+v.d)/(v.d*2n);insist(rounded<=BigInt(Number.MAX_SAFE_INTEGER),'Invalid Stripe amount: calculated revenue exceeds safe minor units.',502);return {numeratorMinor:String(v.n),denominator:String(v.d),roundedMinor:Number(rounded)}}
function periodAmount(line:BillingLine):Fraction {
 const raw=BigInt(line.quantity!),transform=line.transformQuantity,q=transform?(transform.round==='up'?(raw+BigInt(transform.divideBy)-1n)/BigInt(transform.divideBy):raw/BigInt(transform.divideBy)):raw
 if(line.billingScheme==='per_unit')return multiply(decimal(line.unitAmountDecimal!),{n:q,d:1n})
 const amount=(tier:BillingLine['tiers'][number],units:bigint)=>add(tier.flatAmountDecimal===null?zero():decimal(tier.flatAmountDecimal),tier.unitAmountDecimal===null?zero():multiply(decimal(tier.unitAmountDecimal),{n:units,d:1n}))
 if(line.tiersMode==='volume'){const tier=line.tiers.find(t=>t.upTo===null||q<=BigInt(t.upTo))!;return amount(tier,q)}
 if(q===0n)return amount(line.tiers[0],0n) // Stripe bills the first flat tier at zero quantity.
 let total=zero(),lower=0n
 for(const tier of line.tiers){const upper=tier.upTo===null?q:BigInt(tier.upTo),units=(q<upper?q:upper)-lower;if(units>0n)total=add(total,amount(tier,units));if(q<=upper)break;lower=upper}
 return total
}
const annualize=(value:Fraction,line:BillingLine)=>multiply(value,line.interval==='month'?{n:12n,d:BigInt(line.intervalCount)}:line.interval==='year'?{n:1n,d:BigInt(line.intervalCount)}:line.interval==='week'?{n:365n,d:7n*BigInt(line.intervalCount)}:{n:365n,d:BigInt(line.intervalCount)})
const active=(discount:BillingDiscount,on:string)=>discount.duration!=='once'&&discount.startAt<=on&&(!discount.endAt||on<discount.endAt)
// Item discounts precede subscription discounts. Percentage/fixed stacking keeps
// provider order. A fixed subscription amount is deducted once from eligible
// period totals and proportionally allocated before each item's normalization.
function discounts(rows:{line:BillingLine;amount:Fraction}[],values:BillingDiscount[],on:string){
 for(const discount of values){
  if(!active(discount,on))continue
  const eligible=rows.filter(row=>(!discount.products||discount.products.includes(row.line.productId))&&(discount.percentOffDecimal!==null||discount.currency===row.line.currency||Object.hasOwn(discount.currencyAmounts,row.line.currency)))
  if(discount.percentOffDecimal!==null){const percent=decimal(discount.percentOffDecimal),factor=reduced(100n*percent.d-percent.n,100n*percent.d);for(const row of eligible)row.amount=multiply(row.amount,factor);continue}
  for(const code of new Set(eligible.map(row=>row.line.currency))){
   const group=eligible.filter(row=>row.line.currency===code)
   insist(new Set(group.map(row=>row.line.interval+':'+row.line.intervalCount)).size<=1,'Invalid Stripe fixed subscription discount across mixed billing intervals: its allocation is not established by this pinned API.',502)
   const sum=group.reduce((sum,row)=>add(sum,row.amount),zero()),amount=discount.currency===code?discount.amountOffMinor!:discount.currencyAmounts[code],net=subtract(sum,{n:BigInt(amount),d:1n})
   if(sum.n===0n)continue
   const ratio=reduced(net.n*sum.d,net.d*sum.n)
   for(const row of group)row.amount=multiply(row.amount,ratio)
  }
 }
}
export function financials(document:Omit<BillingDocument,'revenue'|'risks'>,observedAt:string):BillingDocument {
 const sums=new Map<string,{arr:Fraction;subscriptions:Set<string>;prices:Set<string>}>()
 for(const subscription of document.subscriptions){
  if(!['active','past_due'].includes(subscription.status))continue
  // Metered facts are retained, but no uncommitted usage enters contracted MRR.
  const rows=subscription.lines.filter(line=>line.usageType!=='metered').map(line=>({line,amount:periodAmount(line)}))
  for(const row of rows)discounts([row],row.line.discounts??[],observedAt)
  discounts(rows,subscription.discounts??[],observedAt)
  for(const {line,amount}of rows){const sum=sums.get(line.currency)??{arr:zero(),subscriptions:new Set<string>(),prices:new Set<string>()};sum.arr=add(sum.arr,annualize(amount,line));sum.subscriptions.add(subscription.id);sum.prices.add(line.priceId);sums.set(line.currency,sum)}
 }
 const revenue:BillingRevenue[]=[...sums].sort(([a],[b])=>a.localeCompare(b)).map(([currency,sum])=>({currency,arr:exact(sum.arr),mrr:exact(reduced(sum.arr.n,sum.arr.d*12n)),subscriptionIds:[...sum.subscriptions].sort(),priceIds:[...sum.prices].sort()}))
 for(const currency of new Set([...document.subscriptions.flatMap(s=>s.lines.map(l=>l.currency)),...document.invoices.map(i=>i.currency)]))if(!revenue.some(r=>r.currency===currency))revenue.push({currency,arr:exact(zero()),mrr:exact(zero()),subscriptionIds:[],priceIds:[]})
 revenue.sort((a,b)=>a.currency.localeCompare(b.currency))
 const risks:BillingDocument['risks']=[],failedPayments=new Set(document.payments.filter(p=>p.failed).map(p=>p.id)),covered=new Set<string>()
 for(const invoice of document.invoices){
  if(invoice.status!=='open'||invoice.amountRemainingMinor===0)continue
  if(invoice.paymentIntentId&&failedPayments.has(invoice.paymentIntentId)){risks.push({kind:'failed-payment',reference:invoice.id,currency:invoice.currency,amountMinor:invoice.amountRemainingMinor,observedAt});covered.add(invoice.paymentIntentId)}
  if(invoice.dueAt&&Date.parse(invoice.dueAt)<Date.parse(observedAt))risks.push({kind:'overdue-invoice',reference:invoice.id,currency:invoice.currency,amountMinor:invoice.amountRemainingMinor,observedAt})
 }
 for(const payment of document.payments)if(payment.failed&&!covered.has(payment.id))risks.push({kind:'failed-payment',reference:payment.id,currency:payment.currency,amountMinor:Math.max(0,payment.amountMinor-payment.amountReceivedMinor),observedAt})
 return {...document,revenue,risks}
}
