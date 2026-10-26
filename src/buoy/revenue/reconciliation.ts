import {accountAudit} from '../audit-records'
import {authority,date,guard,id,insist,now,object,requirePerson,stmt,text,type Actor} from '../core'
import type {ExactAmount} from '../billing/types'
import {calculateRevenue} from './model'
import {providerArrMatches,type ProviderVersion} from './provider'
import {parseRevenueImage,revenueImageSql} from './snapshot'
import type {RevenueAccount} from './types'

export interface RevenueResolution {
 id:string;accountId:string;accountRevision:string;contractVersionId:string;contractRevision:string;
 billingSnapshotId:string;resolvedBy:string;resolvedAt:string;reason:string
}
export interface RevenueReconciliation {
 accountId:string;revision:string;contractVersionId:string;contractRevision:string;billingSnapshotId:string;
 contract:{currency:string;arrMinor:number;reference:string};
 stripe:{amounts:{currency:string;arr:ExactAmount}[];reference:string;observedAt:string};
 status:'pending'|'resolved';resolution:RevenueResolution|null
}

export const REVENUE_RESOLUTIONS_SQL=`SELECT json_group_array(json_object('id',id,'accountId',account_id,'accountRevision',account_revision,
 'contractVersionId',contract_version_id,'contractRevision',contract_revision,'billingSnapshotId',billing_snapshot_id,
 'resolvedBy',resolved_by,'resolvedAt',resolved_at,'reason',reason)) FROM (SELECT * FROM buoy_revenue_resolutions ORDER BY resolved_at,id)`

// Supply only current observations whose exact customer binding is still reviewed.
export const RECONCILIATION_PROVIDERS_SQL=`SELECT json_group_array(json_object('id',s.id,'changeId',NULL,'accountId',s.account_id,
 'sourceReference',s.source_reference,'observedAt',s.observed_at,'receivedAt',s.received_at,'document',json(s.document)))
 FROM buoy_billing_current p JOIN buoy_billing_snapshots s ON s.id=p.snapshot_id AND s.account_id=p.account_id
 JOIN buoy_billing_bindings b ON b.id=s.binding_id AND b.account_id=s.account_id AND b.connection_id=s.connection_id AND b.customer_id=s.customer_id`

export function deriveRevenueReconciliation(account:RevenueAccount,providers:ProviderVersion[],resolutions:RevenueResolution[],on:string):RevenueReconciliation|null {
 const day=date(on,'Revenue measurement date')
 if(account.sourceKind!=='person-confirmed'||!account.contract||!account.versionId||!account.contractRevision)return null
 const sources=providers.filter(source=>source.accountId===account.accountId)
 // History alone cannot establish which reviewed observation is current.
 insist(sources.length<=1,'Provide one current reviewed Stripe observation per account.')
 const source=sources[0]
 if(!source||source.observedAt.slice(0,10)>day)return null
 const revenue=calculateRevenue(account.contract,day),arrMinor=revenue.arrMinor!
 const amounts=source.document.revenue.length?source.document.revenue.map(row=>({currency:row.currency,arr:row.arr})):[{currency:account.contract.currency,arr:{numeratorMinor:'0',denominator:'1',roundedMinor:0}}]
 const equal=providerArrMatches(source.document,account.contract.currency,arrMinor)
 if(equal)return null
 const resolution=resolutions.find(row=>row.accountId===account.accountId&&row.contractVersionId===account.versionId&&
  row.contractRevision===account.contractRevision&&row.billingSnapshotId===source.id)??null
 return {accountId:account.accountId,revision:account.revision,contractVersionId:account.versionId,contractRevision:account.contractRevision,
  billingSnapshotId:source.id,contract:{currency:account.contract.currency,arrMinor,reference:account.contract.source.reference},
  stripe:{amounts,reference:source.sourceReference,observedAt:source.observedAt},status:resolution?'resolved':'pending',resolution}
}

export function revenueReconciliationQueue(accounts:RevenueAccount[],providers:ProviderVersion[],resolutions:RevenueResolution[],on:string){
 return accounts.flatMap(account=>{const row=deriveRevenueReconciliation(account,providers,resolutions,on);return row?.status==='pending'?[row]:[]})
}

export async function resolveRevenueReconciliation(db:D1Database,actor:Actor,accountId:string,input:Record<string,unknown>){
 requirePerson(actor)
 const body=object(input)
 insist(Object.keys(body).every(key=>['revision','contractVersionId','contractRevision','billingSnapshotId','reason'].includes(key)),'Unsupported revenue resolution property.')
 const revision=text(body.revision,'Account revision',200),contractVersionId=text(body.contractVersionId,'Contract version',200),
  contractRevision=text(body.contractRevision,'Contract revision',200),billingSnapshotId=text(body.billingSnapshotId,'Stripe observation',200),
  reason=text(body.reason,'Resolution explanation',2000),stamp=now(),day=stamp.slice(0,10)
 insist(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(reason),'Resolution explanation cannot contain control characters.')
 const image=await db.batch<Record<string,unknown>>([
  db.prepare(revenueImageSql(day)),
  db.prepare('SELECT ('+RECONCILIATION_PROVIDERS_SQL+') AS snapshot'),
  db.prepare('SELECT ('+REVENUE_RESOLUTIONS_SQL+') AS snapshot')])
 const raw=(index:number)=>String(image[index].results[0]?.snapshot??'[]')
 const account=parseRevenueImage(raw(0),day).find(row=>row.accountId===accountId)
 insist(account,'Account not found.',404)
 insist(account.revision===revision,'Account changed. Reload before resolving revenue.',409)
 const mismatch=deriveRevenueReconciliation(account,JSON.parse(raw(1)) as ProviderVersion[],JSON.parse(raw(2)) as RevenueResolution[],day)
 insist(mismatch&&mismatch.status==='pending','Revenue mismatch changed or was already resolved. Reload before resolving.',409)
 insist(mismatch.contractVersionId===contractVersionId&&mismatch.contractRevision===contractRevision&&mismatch.billingSnapshotId===billingSnapshotId,
  'Revenue sources changed. Reload before resolving.',409)
 const resolution:RevenueResolution={id:id(),accountId,accountRevision:revision,contractVersionId,contractRevision,billingSnapshotId,
  resolvedBy:`person:${actor.id}`,resolvedAt:stamp,reason},nextRevision=id()
 await db.batch([authority(db,actor,true),
  guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)',accountId,revision),
  guard(db,`EXISTS(SELECT 1 FROM buoy_recurring_contract_current c JOIN buoy_recurring_contract_versions v ON v.id=c.version_id
   WHERE c.account_id=? AND v.account_id=c.account_id AND v.id=? AND v.revision=? AND v.source_kind='person-confirmed')`,accountId,contractVersionId,contractRevision),
  guard(db,`EXISTS(SELECT 1 FROM buoy_billing_current p JOIN buoy_billing_snapshots s ON s.id=p.snapshot_id AND s.account_id=p.account_id
   JOIN buoy_billing_bindings b ON b.id=s.binding_id AND b.account_id=s.account_id AND b.connection_id=s.connection_id AND b.customer_id=s.customer_id
   WHERE p.account_id=? AND s.id=?)`,accountId,billingSnapshotId),
  guard(db,`NOT EXISTS(SELECT 1 FROM buoy_revenue_resolutions WHERE account_id=? AND contract_version_id=? AND contract_revision=? AND billing_snapshot_id=?)`,
   accountId,contractVersionId,contractRevision,billingSnapshotId),
  stmt(db,`INSERT INTO buoy_revenue_resolutions(id,account_id,account_revision,contract_version_id,contract_revision,billing_snapshot_id,resolved_by,resolved_at,reason)
   VALUES(?,?,?,?,?,?,?,?,?)`,resolution.id,accountId,revision,contractVersionId,contractRevision,billingSnapshotId,resolution.resolvedBy,stamp,reason),
  stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',nextRevision,accountId),
  ...accountAudit(db,actor,accountId,'revenue.mismatch-resolved'),stmt(db,'DELETE FROM buoy_assertions')])
 return {accountId,revision:nextRevision,resolution}
}
