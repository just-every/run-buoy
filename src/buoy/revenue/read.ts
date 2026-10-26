import {date,insist,stmt,type Actor} from '../core'
import {providerAmounts,PROVIDER_HISTORY_SQL,type ProviderVersion} from './provider'
import {monthlyRevenueHistory} from './monthly'
import {deriveRevenueReconciliation,RECONCILIATION_PROVIDERS_SQL,REVENUE_RESOLUTIONS_SQL,type RevenueResolution} from './reconciliation'
import type {RateTable} from './fx'
import {stripeFreshness,type StripeEvidence} from '../billing-evidence'
import {parseRevenueImage,revenueImageSql} from './snapshot'
import type {ContractVersion} from './types'

export async function revenueReader(db:D1Database,actor:Actor){
 insist(actor.kind==='person'&&['owner','admin','member'].includes(actor.role),'Only signed-in staff can read recurring contracts.',403)
 const person=await stmt(db,"SELECT id FROM oa_operators WHERE id=? AND status='active' AND role IN ('owner','admin','member')",actor.id).first()
 insist(person,'Only active staff can read recurring contracts.',403)
}
export async function revenueState(db:D1Database,actor:Actor,on=new Date().toISOString().slice(0,10)){
 await revenueReader(db,actor)
 const day=date(on,'Revenue measurement date')
 const [image,history,providerHistory,currentProviders,resolutionHistory]=await db.batch<Record<string,unknown>>([
  db.prepare(revenueImageSql(day)),
  db.prepare('SELECT id,account_id AS accountId,revision,source_kind AS sourceKind,document,recorded_by AS recordedBy,recorded_at AS recordedAt FROM buoy_recurring_contract_versions ORDER BY recorded_at DESC,id DESC'),
  db.prepare('SELECT ('+PROVIDER_HISTORY_SQL+') AS history'),
  db.prepare('SELECT ('+RECONCILIATION_PROVIDERS_SQL+') AS history'),
  db.prepare('SELECT ('+REVENUE_RESOLUTIONS_SQL+') AS history')
 ])
 const raw=(image.results[0] as {snapshot:string}).snapshot
 const versions=history.results.map(row=>{const {document,...rest}=row;return {...rest,contract:JSON.parse(String(document))} as ContractVersion})
 const parsed=JSON.parse(raw),table:RateTable=parsed.rateDocument?{...JSON.parse(parsed.rateDocument),revision:parsed.rateVersionId}:{name:'Corporate budget rates',mode:'corporate',rates:[],revision:null}
 const providers=(parsed.billing??[] as StripeEvidence[]).map((s:StripeEvidence)=>({accountId:s.accountId,snapshotId:s.snapshotId,reference:s.reference,observedAt:s.observedAt,freshness:stripeFreshness(s,day),amounts:s.document?providerAmounts(s.document,table,day).map(({currency,arr,mrr,reporting})=>({currency,arr,mrr,reporting})):[]}))
 const accounts=parseRevenueImage(raw,day),retained=JSON.parse(String(providerHistory.results[0]?.history??'[]')) as ProviderVersion[]
 const monthly=actor.kind==='person'&&['owner','admin'].includes(actor.role)?accounts.flatMap(account=>{const identity={accountId:account.accountId,name:account.name},primary=monthlyRevenueHistory(identity,retained,versions,table,day);return account.contract&&retained.some(v=>v.accountId===account.accountId)?[primary,monthlyRevenueHistory(identity,retained,[],table,day)]:[primary]}):[]
 const reconciliation=actor.kind==='person'&&['owner','admin'].includes(actor.role)?accounts.flatMap(account=>{const row=deriveRevenueReconciliation(account,JSON.parse(String(currentProviders.results[0]?.history??'[]')),JSON.parse(String(resolutionHistory.results[0]?.history??'[]')) as RevenueResolution[],day);return row?[row]:[]}):[]
 return {on:day,providers,accounts,versions,monthly,reconciliation,
  interpretation:'Contracted recurring revenue in native minor units. USD reporting uses the explicitly named rate table; missing rates remain unavailable. Reviewed Stripe sources supply revenue when no person-confirmed contract exists. Both sources remain separate when a contract exists.'}
}
