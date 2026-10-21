import {date,insist} from '../core'
import {calculateRevenue,revenueValues} from './model'
import type {ConfirmedContract,RevenueAccount,RevenueSourceKind} from './types'

// The raw ordered SQL image is also a transaction fence. Include every account
// revision and current contract, so consumers cannot publish from stale inputs.
export function revenueImageSql(on?:string){
 if(on!==undefined)date(on,'Revenue measurement date')
 return `SELECT json_group_array(json_object('accountId',accountId,'name',name,'revision',revision,'versionId',versionId,
  'contractRevision',contractRevision,'sourceKind',sourceKind,'contract',json(contract),'recordedBy',recordedBy,'recordedAt',recordedAt)) AS snapshot FROM (
  SELECT a.id AS accountId,json_extract(a.document,'$.name') AS name,a.revision,v.id AS versionId,v.revision AS contractRevision,
   v.source_kind AS sourceKind,v.document AS contract,v.recorded_by AS recordedBy,v.recorded_at AS recordedAt
  FROM buoy_accounts a LEFT JOIN buoy_recurring_contract_current c ON c.account_id=a.id
  LEFT JOIN buoy_recurring_contract_versions v ON v.id=c.version_id AND v.account_id=a.id ORDER BY a.id)`
}
export interface RevenueImageRow {
 accountId:string;name:string;revision:string;versionId:string|null;contractRevision:string|null;
 sourceKind:RevenueSourceKind|null;contract:ConfirmedContract|null;recordedBy:string|null;recordedAt:string|null
}
export function parseRevenueImage(raw:string,on:string){
 return (JSON.parse(raw) as RevenueImageRow[]).map(row=>({...row,revenue:calculateRevenue(row.contract,on,row.sourceKind)})) as RevenueAccount[]
}
export async function revenueInputs(db:D1Database,on=new Date().toISOString().slice(0,10)){
 const day=date(on,'Revenue measurement date'),sql=revenueImageSql(day),row=await db.prepare(sql).first<{snapshot:string}>()
 insist(row,'Recurring revenue inputs unavailable.',503)
 const value=JSON.parse(row.snapshot) as RevenueImageRow[],accounts=parseRevenueImage(row.snapshot,day)
 return {on:day,sql,raw:row.snapshot,value,accounts,values:new Map(accounts.map(account=>[account.accountId,revenueValues(account.revenue)]))}
}
