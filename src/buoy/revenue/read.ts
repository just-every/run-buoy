import {date,insist,stmt,type Actor} from '../core'
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
 const [image,history]=await db.batch<Record<string,unknown>>([
  db.prepare(revenueImageSql(day)),
  db.prepare('SELECT id,account_id AS accountId,revision,source_kind AS sourceKind,document,recorded_by AS recordedBy,recorded_at AS recordedAt FROM buoy_recurring_contract_versions ORDER BY recorded_at DESC,id DESC')
 ])
 const raw=(image.results[0] as {snapshot:string}).snapshot
 const versions=history.results.map(row=>{const {document,...rest}=row;return {...rest,contract:JSON.parse(String(document))} as ContractVersion})
 return {on:day,accounts:parseRevenueImage(raw,day),versions,
  interpretation:'Contracted recurring revenue in native minor units. No invoice revenue, currency conversion, or cross-currency total is inferred.'}
}
