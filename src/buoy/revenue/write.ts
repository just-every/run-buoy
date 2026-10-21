import {accountAudit} from '../audit-records'
import {authority,guard,id,insist,now,object,requirePerson,stmt,text,type Actor} from '../core'
import {confirmedContract,calculateRevenue} from './model'
import type {RevenueSourceKind} from './types'

export async function saveContract(db:D1Database,actor:Actor,accountId:string,input:Record<string,unknown>){
 requirePerson(actor)
 const body=object(input);insist(Object.keys(body).every(key=>['revision','contract'].includes(key)),'Unsupported recurring contract save property.')
 const revision=text(body.revision,'Account revision',200),contract=confirmedContract(body.contract),stamp=now()
 const prior=await stmt(db,`SELECT a.revision,c.version_id AS versionId,v.source_kind AS sourceKind
  FROM buoy_accounts a LEFT JOIN buoy_recurring_contract_current c ON c.account_id=a.id
  LEFT JOIN buoy_recurring_contract_versions v ON v.id=c.version_id WHERE a.id=?`,accountId).first<{revision:string;versionId:string|null;sourceKind:RevenueSourceKind|null}>()
 insist(prior,'Account not found.',404)
 insist(prior.revision===revision,'Account changed. Reload before saving recurring terms.',409)
 const source=await stmt(db,"SELECT id FROM buoy_recurring_contract_versions WHERE account_id=? AND source_kind<>'person-confirmed' LIMIT 1",accountId).first()
 insist(!source,'Provider revenue records exist. A source authority policy is required before entering manual recurring terms.',409)
 const versionId=id(),contractRevision=id(),nextRevision=id(),recordedBy=`person:${actor.id}`
 await db.batch([authority(db,actor,true),
  guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)',accountId,revision),
  guard(db,'(SELECT version_id FROM buoy_recurring_contract_current WHERE account_id=?) IS ?',accountId,prior.versionId),
  // Future provider ingestion must retain its source kind here; absent a real
  // IDENTITY-001 policy, manual terms must never overwrite provider records.
  guard(db,"NOT EXISTS(SELECT 1 FROM buoy_recurring_contract_versions WHERE account_id=? AND source_kind<>'person-confirmed')",accountId),
  stmt(db,'INSERT INTO buoy_recurring_contract_versions(id,account_id,revision,source_kind,document,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?)',versionId,accountId,contractRevision,'person-confirmed',JSON.stringify(contract),recordedBy,stamp),
  stmt(db,'INSERT INTO buoy_recurring_contract_current(account_id,version_id) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET version_id=excluded.version_id',accountId,versionId),
  // Pending approvals and other editors must observe the new source revision.
  stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',nextRevision,accountId),
  ...accountAudit(db,actor,accountId,'revenue.contract-confirmed'),stmt(db,'DELETE FROM buoy_assertions')])
 return {accountId,revision:nextRevision,versionId,contractRevision,contract,sourceKind:'person-confirmed' as const,recordedBy,recordedAt:stamp,revenue:calculateRevenue(contract,stamp.slice(0,10))}
}
