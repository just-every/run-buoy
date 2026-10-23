import {guard,id,insist,now,stmt,text,type Actor} from '../core'
import type {Renewal} from './index'
export const RENEWAL_OUTCOMES=['renewed','renewed-with-expansion','renewed-with-contraction','churned','deferred']
export async function linkedRenewal(db:D1Database,accountId:string,recordId:unknown){
 const key=text(recordId,'Renewal opportunity',100),row=await stmt(db,'SELECT document,revision FROM buoy_renewals WHERE id=? AND account_id=?',key,accountId).first<{document:string;revision:string}>();insist(row,'Renewal opportunity not found on this account.',404);return {id:key,revision:row.revision,document:JSON.parse(row.document) as Renewal}
}
export async function renewalPreparation(db:D1Database,accountId:string,payload:Record<string,unknown>):Promise<Record<string,string>>{
 if(payload.renewalId===undefined)return {}
 const current=await linkedRenewal(db,accountId,payload.renewalId),outcome=String(payload.outcome),value=payload.resultArrMinor
 insist(!current.document.outcome,'This renewal already has an approved outcome.',409)
 insist(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0,'Record expected outcome ARR in nonnegative native minor units.')
 const prior=current.document.expectedArrMinor
 if(outcome==='renewed')insist(value===prior,'A plain renewal keeps expected ARR; choose expansion or contraction for a change.')
 if(outcome==='renewed-with-expansion')insist(value>prior,'An expansion must exceed the source expected ARR.')
 if(outcome==='renewed-with-contraction')insist(value<prior,'A contraction must be below the source expected ARR.')
 if(outcome==='churned')insist(value===0,'A churned renewal has zero expected outcome ARR.')
 if(outcome==='deferred')insist(value===prior,'A deferred renewal retains the source expected ARR pending a later decision.')
 return {renewalId:current.id,renewalRevision:current.revision,resultArrMinor:String(value),currency:current.document.currency}
}
export async function renewalApproval(db:D1Database,actor:Actor,accountId:string,payload:Record<string,string>){
 if(!payload.renewalId)return []
 const current=await linkedRenewal(db,accountId,payload.renewalId)
 insist(current.revision===payload.renewalRevision&&!current.document.outcome,'Renewal opportunity changed. Prepare a new outcome.',409)
 const baseline=current.document.sourceKind==='stripe-test'?await stmt(db,'SELECT snapshot_id AS id FROM buoy_billing_current WHERE account_id=?',accountId).first<{id:string}>():null
 const next={...current.document,billingBaselineSnapshotId:baseline?.id,outcome:payload.outcome,reason:payload.reason,evidence:payload.evidence,resultArrMinor:Number(payload.resultArrMinor),approvedBy:`person:${actor.id}`,approvedAt:now(),billingReconciliation:'pending-provider-sync'}
 return [...(baseline?[guard(db,'EXISTS(SELECT 1 FROM buoy_billing_current WHERE account_id=? AND snapshot_id=?)',accountId,baseline.id)]:[]),guard(db,'EXISTS(SELECT 1 FROM buoy_renewals WHERE id=? AND revision=?)',current.id,current.revision),stmt(db,'UPDATE buoy_renewals SET document=?,revision=? WHERE id=?',JSON.stringify(next),id(),current.id),stmt(db,'INSERT INTO buoy_renewal_history(id,record_id,field_key,old_value,new_value,actor,source,recorded_at) VALUES(?,?,?,?,?,?,?,?)',id(),current.id,'outcome',JSON.stringify(current.document),JSON.stringify(next),`person:${actor.id}`,payload.evidence,now())]
}
