import type {ContractVersion} from './types'
import type {ProviderVersion} from './provider'
import {providerVersion} from './provider'
import {convertExactMinor,selectedRate,type RateTable} from './fx'

type ProviderSource=Pick<ProviderVersion,'id'|'accountId'|'sourceReference'|'observedAt'>
const source=(v:ProviderVersion):ProviderSource=>({id:v.id,accountId:v.accountId,sourceReference:v.sourceReference,observedAt:v.observedAt})
export interface RetentionRow {
 accountId:string;name:string;currency:string;cohort:string|undefined;products:string[];inCohort:boolean;movement:string;
 startMinor:number;endMinor:number;usdStartMinor:number|null;usdEndConstantMinor:number|null;usdEndMinor:number|null;fxMinor:number|null;
 startRate:ReturnType<typeof selectedRate>;endRate:ReturnType<typeof selectedRate>;
 startSource:ContractVersion|ProviderSource|null;endSource:ContractVersion|ProviderSource;
 startReference:string;endReference:string;sourceLinks:{href:string;label:string}[];href:string
}
export interface SourceException {accountId:string;name:string;reason:string}
export function providerRetention(account:{accountId:string;name:string},versions:ProviderVersion[],window:{basisOn:string;start:string;end:string},rates:RateTable){
 const history=versions.filter(v=>v.accountId===account.accountId),start=providerVersion(history,window.basisOn),end=providerVersion(history,window.end),exceptions:SourceException[]=[],rows:RetentionRow[]=[]
 if(!end){exceptions.push({...account,reason:'Missing Stripe read at the period end. No recurring amount is inferred.'});return {rows,exceptions}}
 const subscriptions=end.document.subscriptions
 if(!start&&subscriptions.some(s=>s.createdAt.slice(0,10)<=window.basisOn)){
  exceptions.push({...account,reason:'Missing historical Stripe read at the starting boundary. Earlier ARR is unavailable; no zero balance is inferred.'});return {rows,exceptions}
 }
 const codes=[...new Set([...(start?.document.revenue??[]),...end.document.revenue].map(r=>r.currency))]
 for(const currency of codes){
  const a=start?.document.revenue.find(r=>r.currency===currency),b=end.document.revenue.find(r=>r.currency===currency)
  // An absent retained currency is not a cross-currency rewrite.
  const zero={numeratorMinor:'0',denominator:'1',roundedMinor:0},from=a?.arr??zero,to=b?.arr??zero,startMinor=from.roundedMinor,endMinor=to.roundedMinor,inCohort=startMinor>0
  const earlier=history.some(v=>v.observedAt.slice(0,10)<window.start&&v.document.revenue.some(r=>r.currency===currency&&r.arr.roundedMinor>0))
  const movement=inCohort?(endMinor===0?'churn':endMinor>startMinor?'expansion':endMinor<startMinor?'contraction':'unchanged'):endMinor>0?(earlier?'reactivation':'new'):'zero'
  const startRate=selectedRate(rates,currency,window.basisOn),endRate=selectedRate(rates,currency,window.end),usdStartMinor=convertExactMinor(from,currency,startRate),usdEndConstantMinor=convertExactMinor(to,currency,startRate),usdEndMinor=convertExactMinor(to,currency,endRate)
  if(!startRate||!endRate)exceptions.push({...account,reason:'Missing '+currency+' USD rate at '+(!startRate?window.basisOn:window.end)+'. Native Stripe amounts remain available; USD totals are unavailable.'})
  const sourceLinks=[...new Map(history.filter(v=>v.observedAt.slice(0,10)<=window.end).flatMap(v=>[
   ...v.document.invoices.filter(i=>i.createdAt.slice(0,10)>=window.start&&i.createdAt.slice(0,10)<=window.end).map(i=>({href:'/app/billing#billing-history-record-'+encodeURIComponent(v.id),label:'Invoice '+i.id})),
   {href:'/app/billing#billing-history-record-'+encodeURIComponent(v.id),label:'Subscription read '+v.sourceReference},
   ...(v.changeId?[{href:'/app/billing#billing-change-record-'+encodeURIComponent(v.changeId),label:'Subscription change '+v.sourceReference}]:[])
  ]).map(l=>[l.label,l])).values()]
  rows.push({...account,currency,cohort:subscriptions.map(s=>s.createdAt.slice(0,7)).sort()[0],products:[...new Set(subscriptions.flatMap(s=>s.lines.filter(l=>l.currency===currency).map(l=>l.productId)))],inCohort,movement,startMinor,endMinor,usdStartMinor,usdEndConstantMinor,usdEndMinor,fxMinor:usdEndMinor===null||usdEndConstantMinor===null?null:usdEndMinor-usdEndConstantMinor,startRate,endRate,startSource:start?source(start):null,endSource:source(end),startReference:start?.sourceReference??'No starting Stripe source',endReference:end.sourceReference,sourceLinks,href:'/app/billing#billing-history-record-'+encodeURIComponent(end.id)})
 }
 for(const invoice of end.document.invoices.filter(i=>i.createdAt.slice(0,10)>=window.start&&i.createdAt.slice(0,10)<=window.end)){
  if(!invoice.subscriptionId||!subscriptions.some(s=>s.id===invoice.subscriptionId))exceptions.push({...account,reason:'Unmatched Stripe invoice '+invoice.id+' ('+invoice.currency+' '+invoice.amountDueMinor+' native minor units): no retained subscription association. It does not supply recurring ARR.'})
 }
 return {rows,exceptions}
}
