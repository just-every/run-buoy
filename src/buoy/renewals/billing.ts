import {guard,id,now,stmt} from '../core'
import {financials} from '../billing/model'
import type {BillingDocument} from '../billing/types'
import {noticeDate,type Account} from '../health'
import type {Renewal} from './index'

// One image includes both immutable observations and live source authority.
// No stale, disconnected or failed source creates or reconciles an opportunity.
const IMAGE=`SELECT json_group_array(json_object('accountId',a.id,'account',a.document,'ownerId',o.owner_id,'snapshotId',s.id,'reference',s.source_reference,'observedAt',s.observed_at,'document',s.document)) FROM buoy_billing_current p JOIN buoy_billing_snapshots s ON s.id=p.snapshot_id JOIN buoy_accounts a ON a.id=p.account_id JOIN buoy_connections c ON c.id=s.connection_id JOIN buoy_connection_credentials k ON k.connection_id=c.id JOIN buoy_billing_settings b ON b.connection_id=c.id LEFT JOIN buoy_account_owners o ON o.account_id=a.id WHERE c.disconnected_at IS NULL AND b.last_error IS NULL AND julianday(?) - julianday(substr(s.observed_at,1,10)) BETWEEN 0 AND b.stale_days`
type Source={accountId:string;account:string;ownerId:string|null;snapshotId:string;reference:string;observedAt:string;document:string}
export async function generateBillingRenewals(db:D1Database,on:string,settings:{revision:string;leadDays:number;stages:string[]}){
 const image=(await stmt(db,'SELECT ('+IMAGE+') AS snapshot',on).first<{snapshot:string}>())!.snapshot
 const sources=JSON.parse(image) as Source[],writes:D1PreparedStatement[]=[]
 const existing=(await db.prepare('SELECT id,account_id AS accountId,period_key AS periodKey,document,revision FROM buoy_renewals').all<{id:string;accountId:string;periodKey:string;document:string;revision:string}>()).results
 const write=(prior:typeof existing[number]|undefined,accountId:string,key:string,next:Record<string,unknown>,source:Source,field:string)=>{
  const recordId=prior?.id??id(),stamp=now()
  writes.push(guard(db,'(SELECT revision FROM buoy_renewals WHERE account_id=? AND period_key=?) IS ?',accountId,key,prior?.revision??null),stmt(db,'INSERT INTO buoy_renewals(id,account_id,period_key,document,revision,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,period_key) DO UPDATE SET document=excluded.document,revision=excluded.revision',recordId,accountId,key,JSON.stringify(next),id(),stamp),stmt(db,'INSERT INTO buoy_renewal_history(id,record_id,field_key,old_value,new_value,actor,source,recorded_at) VALUES(?,?,?,?,?,?,?,?)',id(),recordId,field,prior?.document??'null',JSON.stringify(next),'system:renewals',source.reference,stamp),stmt(db,"INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) VALUES(?,'system:renewals',?,?,?,?)",id(),field==='billing-reconciliation'?'renewal.billing-reconciled':prior?'renewal.source-refreshed':'renewal.created','renewal:'+recordId,'',stamp),stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),accountId))
 }
 for(const source of sources){
  const document=JSON.parse(source.document) as BillingDocument,account=JSON.parse(source.account) as Account
  // Approved source images never change. A later actual provider read is
  // retained separately, even when it disagrees with the human expectation.
  for(const prior of existing.filter(r=>r.accountId===source.accountId)){
   const renewal=JSON.parse(prior.document) as Renewal
   if(!renewal.outcome||renewal.sourceKind!=='stripe-test'||renewal.sourceCustomerId!==document.customerId||renewal.billingBaselineSnapshotId===source.snapshotId||renewal.billingActual?.snapshotId===source.snapshotId)continue
   const subscription=document.subscriptions.find(s=>s.id===renewal.sourceSubscriptionId)
   // Absence is not zero: an upstream omission is not a verified cancellation.
   if(!subscription)continue
   const actual=financials({...document,subscriptions:[subscription]},source.observedAt).revenue.find(r=>r.currency===renewal.currency)?.arr.roundedMinor??0
   const expected=renewal.resultArrMinor!,difference=actual-expected
   write(prior,source.accountId,prior.periodKey,{...renewal,billingReconciliation:difference===0?'matched':'mismatch',billingActual:{snapshotId:source.snapshotId,sourceReference:source.reference,observedAt:source.observedAt,arrMinor:actual,expectedArrMinor:expected,differenceMinor:difference}},source,'billing-reconciliation')
  }
  for(const subscription of document.subscriptions){
   if(!['active','past_due'].includes(subscription.status))continue
   const end=subscription.periodEnd.slice(0,10),start=subscription.periodStart.slice(0,10),opensOn=new Date(Date.parse(end)-settings.leadDays*86400000).toISOString().slice(0,10)
   const revenue=financials({...document,subscriptions:[subscription]},source.observedAt).revenue
   for(const amount of revenue){
    if(!subscription.lines.some(line=>line.currency===amount.currency))continue
    const key=JSON.stringify(['stripe-test',document.customerId,subscription.id,subscription.periodStart,subscription.periodEnd,amount.currency]),prior=existing.find(r=>r.accountId===source.accountId&&r.periodKey===key),previous=prior?JSON.parse(prior.document) as Renewal:null
    if(previous?.outcome||(!prior&&on<opensOn))continue
    const next={...previous,accountId:source.accountId,name:account.name+' subscription renewal',ownerId:previous?previous.ownerId:source.ownerId,renewalDate:end,noticeDeadline:account.renewalDate===end?noticeDate(account):null,expectedArrMinor:amount.arr.roundedMinor,currency:amount.currency,contractStart:start,sourceVersionId:source.snapshotId,sourceReference:source.reference,sourceKind:'stripe-test',sourceCustomerId:document.customerId,sourceSubscriptionId:subscription.id,sourcePeriodStart:subscription.periodStart,sourcePeriodEnd:subscription.periodEnd,stage:previous?.stage??settings.stages[0],forecast:previous?.forecast??'likely',riskReasons:previous?.riskReasons??(account.renewalDate===end?[]:['Confirmed notice terms do not match this subscription end date.']),outcome:null}
    if(previous&&JSON.stringify(next)===JSON.stringify(previous))continue
    write(prior,source.accountId,key,next,source,'source')
   }
  }
 }
 if(writes.length)await db.batch([guard(db,`(${IMAGE})=?`,on,image),guard(db,'EXISTS(SELECT 1 FROM buoy_renewal_settings WHERE revision=?)',settings.revision),...writes,stmt(db,'DELETE FROM buoy_assertions')])
}
