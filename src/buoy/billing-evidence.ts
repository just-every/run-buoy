import type {BillingDocument} from './billing/types'
import {majorAmount} from './currencies'
import type {ScorecardField} from './scorecards/types'

/** One non-secret image participates in segment and scorecard revision fences. */
export const BILLING_EVIDENCE_SQL=`SELECT json_group_array(json_object('accountId',b.account_id,'snapshotId',s.id,'reference',s.source_reference,'observedAt',s.observed_at,'document',json(s.document),'staleDays',COALESCE(t.stale_days,30),'disconnectedAt',c.disconnected_at,'credentialPresent',EXISTS(SELECT 1 FROM buoy_connection_credentials k WHERE k.connection_id=c.id),'lastError',t.last_error)) FROM buoy_billing_bindings b JOIN buoy_connections c ON c.id=b.connection_id LEFT JOIN buoy_billing_settings t ON t.connection_id=c.id LEFT JOIN buoy_billing_current p ON p.account_id=b.account_id LEFT JOIN buoy_billing_snapshots s ON s.id=p.snapshot_id ORDER BY b.account_id`
export interface StripeEvidence {accountId:string;snapshotId:string|null;reference:string|null;observedAt:string|null;document:BillingDocument|null;staleDays:number;disconnectedAt:string|null;credentialPresent:number;lastError:string|null}
export async function stripeEvidence(db:D1Database){const row=await db.prepare(BILLING_EVIDENCE_SQL+' AS snapshot').first<{snapshot:string}>();return JSON.parse(row?.snapshot??'[]') as StripeEvidence[]}
export function stripeFreshness(row:StripeEvidence,on:string){
 return row.disconnectedAt?'disconnected':!row.credentialPresent?'reconnect required':row.lastError?'failed':!row.observedAt?'missing':Date.parse(on.slice(0,10))-Date.parse(row.observedAt.slice(0,10))>row.staleDays*86400000?'stale':'current'
}
export function stripeValues(row:StripeEvidence|undefined,on:string){
 const revenue=row?.document?.revenue,single=revenue?.length===1?revenue[0]:null,current=!!row&&stripeFreshness(row,on)==='current'
 return {'stripe.arrMinor':current?single?.arr.roundedMinor??null:null,'stripe.mrrMinor':current?single?.mrr.roundedMinor??null:null,'stripe.currency':current?single?.currency??null:null,'stripe.failedPayments':current?row.document?.risks.filter(r=>r.kind==='failed-payment').length??null:null,'stripe.overdueInvoices':current?row.document?.risks.filter(r=>r.kind==='overdue-invoice').length??null:null,'stripe.freshness':row?stripeFreshness(row,on):'missing'}
}
export const STRIPE_FIELDS:ScorecardField[]=[
 {key:'stripe.arrMinor',name:'Stripe active subscription ARR',kind:'billing',valueType:'number',unit:'native minor currency units'},
 {key:'stripe.mrrMinor',name:'Stripe active subscription MRR',kind:'billing',valueType:'number',unit:'native minor currency units'},
 {key:'stripe.currency',name:'Stripe recurring currency',kind:'billing',valueType:'text'},
 {key:'stripe.failedPayments',name:'Stripe failed payments',kind:'billing',valueType:'number'},
 {key:'stripe.overdueInvoices',name:'Stripe overdue invoices',kind:'billing',valueType:'number'},
]
export function applyStripeHealth<T extends {status:string;reasons:string[];evidence:{kind:string;sourceSystem:string|null;staleAfterDays:number;missing:boolean;stale:boolean}[]}>(result:T,row:StripeEvidence|undefined,on:string):T{
 if(!row)return result
 const freshness=stripeFreshness(row,on),risks=row.document?.risks??[],reasons=result.reasons.filter(r=>!r.startsWith('Billing evidence is ')&&!r.startsWith('Current billing and support snapshots'))
 reasons.push(...risks.map(r=>'Stripe '+(r.kind==='failed-payment'?'failed payment':'overdue invoice')+' · '+r.currency+' '+majorAmount(r.amountMinor,r.currency)+' · '+r.reference+'.'))
 if(freshness!=='current')reasons.push('Stripe billing evidence is '+freshness+'; dependent confidence is reduced.')
 else if(!risks.length)reasons.push('Current Stripe billing observations show no failed or overdue payment signal.')
 const remainingGap=freshness!=='current'||result.evidence.some(e=>e.kind!=='billing'&&(e.missing||e.stale))
 return {...result,status:risks.length?'at-risk':remainingGap&&result.status!=='at-risk'?'unknown':result.status==='unknown'&&!remainingGap?'healthy':result.status,reasons,evidence:[...result.evidence.filter(e=>e.kind!=='billing'||!e.missing),{kind:'billing',sourceSystem:'stripe-test',staleAfterDays:row.staleDays,missing:!row.document,stale:freshness!=='current'}]}
}
