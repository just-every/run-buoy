import {BILLING_EVIDENCE_SQL,stripeFreshness,type StripeEvidence} from '../billing-evidence'
import type {BillingDocument} from '../billing/types'
import {convertExactMinor,selectedRate,type RateTable} from './fx'
import {calculateRevenue} from './model'
import type {Revenue} from './types'

export {BILLING_EVIDENCE_SQL}
export const PROVIDER_HISTORY_SQL=`SELECT json_group_array(json_object('id',s.id,'changeId',(SELECT c.id FROM buoy_billing_changes c WHERE c.snapshot_id=s.id LIMIT 1),'accountId',s.account_id,'sourceReference',s.source_reference,'observedAt',s.observed_at,'receivedAt',s.received_at,'document',json(s.document))) FROM(SELECT * FROM buoy_billing_snapshots ORDER BY observed_at,received_at,id) s`
export interface ProviderVersion {id:string;changeId:string|null;accountId:string;sourceReference:string;observedAt:string;receivedAt:string;document:BillingDocument}
export function providerVersion(versions:ProviderVersion[],on:string){
 return versions.filter(v=>v.observedAt.slice(0,10)<=on).sort((a,b)=>b.observedAt.localeCompare(a.observedAt)||b.receivedAt.localeCompare(a.receivedAt)||b.id.localeCompare(a.id))[0]??null
}
export function providerAmounts(document:BillingDocument,table:RateTable,on:string){
 return document.revenue.map(r=>{const rate=selectedRate(table,r.currency,on);return {...r,reporting:{currency:'USD' as const,arrMinor:convertExactMinor(r.arr,r.currency,rate),mrrMinor:convertExactMinor(r.mrr,r.currency,rate),rate,rounding:'half-up to USD cents from exact provider fractions'}}})
}
export function providerArrMatches(document:BillingDocument,currency:string,minor:number){
 const rows=document.revenue;if(!rows.length)return minor===0
 return rows.length===1&&rows[0].currency===currency&&BigInt(rows[0].arr.numeratorMinor)===BigInt(minor)*BigInt(rows[0].arr.denominator)
}
export function providerRevenue(source:StripeEvidence,on:string,table:RateTable):Revenue{
 const rows=source.document?providerAmounts(source.document,table,on):[],single=rows.length===1?rows[0]:null,fresh=stripeFreshness(source,on)
 return {...calculateRevenue(null,on),arrMinor:single?.arr.roundedMinor??null,mrrMinor:single?.mrr.roundedMinor??null,currency:single?.currency??null,
  mrrExact:single?{numeratorMinor:single.mrr.numeratorMinor,denominator:single.mrr.denominator}:null,
  sourceKind:'billing',reference:source.reference,confirmedOn:source.observedAt?.slice(0,10)??null,
  products:source.document?[...new Set(source.document.subscriptions.flatMap(s=>s.lines.map(l=>l.productId)))]:null,
  seats:source.document?.subscriptions.filter(s=>['active','past_due'].includes(s.status)).reduce((n,s)=>n+s.lines.reduce((n,l)=>n+(l.quantity??0),0),0)??null,
  status:source.document?'active':'missing',freshness:!source.document?'missing':fresh==='current'?'current':fresh==='missing'?'missing':'stale',staleAfterDays:source.staleDays,
  reporting:{currency:'USD',arrMinor:single?.reporting.arrMinor??null,mrrMinor:single?.reporting.mrrMinor??null,rate:single?.reporting.rate??null,rounding:'half-up to USD cents; MRR converts exact ARR/12'}}
}
