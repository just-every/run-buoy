import {date} from '../core'
import {calculateRevenue} from './model'
import {providerVersion,type ProviderVersion} from './provider'
import type {ContractVersion} from './types'
import type {RateTable} from './fx'

export type MonthlyMovement='new'|'expansion'|'contraction'|'churn'|'reactivation'|'unchanged'
export interface MonthlySource {id:string;reference:string;on:string;href:string}
export interface MonthlyBoundary {on:string;arrMinor:number|null;source:MonthlySource|null;reason:string|null}
export interface MonthlyCurrency {
 currency:string;start:MonthlyBoundary;end:MonthlyBoundary;movement:MonthlyMovement|null;
 sourceLinks:{href:string;label:string}[]
}
export interface MonthlyWindow {
 month:string;start:string;end:string;basisOn:string;currencies:MonthlyCurrency[];
 exceptions:{currency:string|null;boundary:string;reason:string}[]
}
export interface MonthlyRevenueHistory {
 accountId:string;name:string;on:string;sourceKind:'confirmed-contract'|'reviewed-stripe';
 rateTable:{name:string;revision:RateTable['revision']};months:MonthlyWindow[];interpretation:string
}
const dayBefore=(day:string)=>new Date(Date.parse(day)-86400000).toISOString().slice(0,10)
const contractAt=(versions:ContractVersion[],on:string)=>versions.filter(v=>v.contract.source.confirmedOn<=on).sort((a,b)=>b.contract.source.confirmedOn.localeCompare(a.contract.source.confirmedOn)||b.recordedAt.localeCompare(a.recordedAt)||b.id.localeCompare(a.id))[0]??null
const providerSource=(v:ProviderVersion):MonthlySource=>({id:v.id,reference:v.sourceReference,on:v.observedAt,href:'/app/billing#billing-history-record-'+encodeURIComponent(v.id)})
const contractSource=(v:ContractVersion):MonthlySource=>({id:v.id,reference:v.contract.source.reference,on:v.contract.source.confirmedOn,href:'/app/accounts/'+encodeURIComponent(v.accountId)+'#contract-history'})
const unavailable=(on:string,reason:string,source:MonthlySource|null=null):MonthlyBoundary=>({on,arrMinor:null,reason,source})
const known=(on:string,arrMinor:number,source:MonthlySource|null,reason:string|null=null):MonthlyBoundary=>({on,arrMinor,source,reason})
function movement(start:number,end:number,earlier:boolean):MonthlyMovement {
 return start>0?(end===0?'churn':end>start?'expansion':end<start?'contraction':'unchanged'):end>0?(earlier?'reactivation':'new'):'unchanged'
}

/** The caller supplies authorized retained history; this function never reads or changes a source. */
export function monthlyRevenueHistory(account:{accountId:string;name:string},providerVersions:readonly ProviderVersion[],contractVersions:readonly ContractVersion[],rates:RateTable,on:string):MonthlyRevenueHistory {
 const day=date(on,'Monthly revenue measurement date'),asOf=new Date(day)
 const providers=providerVersions.filter(v=>v.accountId===account.accountId&&v.observedAt.slice(0,10)<=day)
 const contracts=contractVersions.filter(v=>v.accountId===account.accountId)
 const confirmed=contracts.length>0,contractHistory=contracts.filter(v=>v.contract.source.confirmedOn<=day)
 const currencies=[...new Set(confirmed?contractHistory.map(v=>v.contract.currency):providers.flatMap(v=>[...v.document.revenue.map(r=>r.currency),...v.document.subscriptions.flatMap(s=>s.lines.map(l=>l.currency))]))].sort()
 function contractBoundary(boundary:string,currency:string,endVersion:ContractVersion|null):MonthlyBoundary {
  const v=contractAt(contracts,boundary)
  if(!v){
   if(endVersion&&endVersion.contract.contractStart>boundary)return known(boundary,0,contractSource(endVersion),'Contract begins after this boundary.')
   return unavailable(boundary,'No confirmed contract history at this boundary; earlier ARR is unavailable.')
  }
  if(v.contract.currency!==currency)return unavailable(boundary,'Confirmed contract currency differs at this boundary; no cross-currency amount is inferred.',contractSource(v))
  return known(boundary,calculateRevenue(v.contract,boundary,v.sourceKind).arrMinor!,contractSource(v))
 }
 function providerBoundary(boundary:string,currency:string,endVersion:ProviderVersion|null):MonthlyBoundary {
  const v=providerVersion(providers,boundary)
  if(!v){
   if(endVersion&&endVersion.document.subscriptions.length>0&&endVersion.document.subscriptions.every(s=>s.createdAt.slice(0,10)>boundary))return known(boundary,0,providerSource(endVersion),'All retained subscriptions were created after this boundary.')
   return unavailable(boundary,'No retained Stripe read at this boundary; earlier ARR is unavailable.')
  }
  const amount=v.document.revenue.find(r=>r.currency===currency)
  return known(boundary,amount?.arr.roundedMinor??0,providerSource(v))
 }
 const months=Array.from({length:12},(_,index):MonthlyWindow=>{
  const start=new Date(Date.UTC(asOf.getUTCFullYear(),asOf.getUTCMonth()-11+index,1)).toISOString().slice(0,10)
  const calendarEnd=new Date(Date.UTC(asOf.getUTCFullYear(),asOf.getUTCMonth()-10+index,0)).toISOString().slice(0,10)
  const end=calendarEnd>day?day:calendarEnd,basisOn=dayBefore(start),exceptions:MonthlyWindow['exceptions']=[]
  const endContract=contractAt(contracts,end),endProvider=providerVersion(providers,end)
  const rows=currencies.map((currency):MonthlyCurrency=>{
   const a=confirmed?contractBoundary(basisOn,currency,endContract):providerBoundary(basisOn,currency,endProvider)
   const b=confirmed?contractBoundary(end,currency,null):providerBoundary(end,currency,null)
   for(const boundary of [a,b])if(boundary.arrMinor===null)exceptions.push({currency,boundary:boundary.on,reason:boundary.reason!})
   const earlier=confirmed?contractHistory.some(v=>v.contract.currency===currency&&v.contract.source.confirmedOn<basisOn&&calculateRevenue(v.contract,v.contract.source.confirmedOn,v.sourceKind).arrMinor!>0):providers.some(v=>v.observedAt.slice(0,10)<basisOn&&v.document.revenue.some(r=>r.currency===currency&&r.arr.roundedMinor>0))
   const sources=confirmed?contracts.filter(v=>v.contract.source.confirmedOn>=start&&v.contract.source.confirmedOn<=end).map(v=>({href:contractSource(v).href,label:'Contract confirmation '+v.contract.source.reference})):providers.filter(v=>v.observedAt.slice(0,10)>=start&&v.observedAt.slice(0,10)<=end).flatMap(v=>[
    {href:providerSource(v).href,label:'Subscription read '+v.sourceReference},
    ...(v.changeId?[{href:'/app/billing#billing-change-record-'+encodeURIComponent(v.changeId),label:'Subscription change '+v.sourceReference}]:[]),
    ...v.document.invoices.filter(i=>i.currency===currency&&i.createdAt.slice(0,10)>=start&&i.createdAt.slice(0,10)<=end).map(i=>({href:providerSource(v).href,label:'Invoice '+i.id}))
   ])
   for(const boundary of [a,b])if(boundary.source)sources.push({href:boundary.source.href,label:boundary.source.reference})
   return {currency,start:a,end:b,movement:a.arrMinor===null||b.arrMinor===null?null:movement(a.arrMinor,b.arrMinor,earlier),sourceLinks:[...new Map(sources.map(s=>[s.href+' '+s.label,s])).values()]}
  })
  if(!currencies.length)exceptions.push({currency:null,boundary:end,reason:confirmed?'No confirmed recurring source is available in this history window.':'No retained recurring Stripe currency is available; ARR is unavailable.'})
  return {month:start.slice(0,7),start,end,basisOn,currencies:rows,exceptions}
 })
 return {...account,on:day,sourceKind:confirmed?'confirmed-contract':'reviewed-stripe',rateTable:{name:rates.name,revision:rates.revision},months,
  interpretation:'Confirmed contract versions take precedence when present; otherwise reviewed Stripe observations supply ARR. Monthly starting ARR uses the preceding UTC day and ending ARR uses the latest retained source on or before the ending day. Current month ends on the measurement date. Stripe observations are never backdated. Missing boundary history is unavailable, except a source demonstrating a later contract or subscription creation can establish a zero baseline. Terms count through their inclusive end. Movements compare native rounded minor units; currencies remain separate. Reactivation requires retained earlier positive ARR. Invoice links are source evidence and do not supply recurring ARR.'}
}
