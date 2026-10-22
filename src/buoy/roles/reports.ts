import {guard,id,insist,stmt,type Actor} from '../core'
import {auditRecord} from '../audit-records'
import {retentionReport,reportingWindow} from '../revenue/retention'
import {commercialFor,readableIds,roleAccess,roleFence,scopeFence,scopeImage,type RoleAccess} from './access'

export interface RetentionFilterOptions {
 owners:{id:string;name:string}[];segments:{id:string;name:string}[];
 plans:string[];cohorts:string[];tiers:string[]
}
export type ScopedRetentionReport=Awaited<ReturnType<typeof retentionReport>>&{filterOptions?:RetentionFilterOptions}
/** Native reporting semantics stay unchanged; an unselected optional control
 * simply does not add a filter to an assigned-profile report or CSV. */
export function normalizedRetentionQuery(query:URLSearchParams){
 insist([...query.keys()].every(key=>query.getAll(key).length===1),'Unsupported or repeated retention filter.')
 const normalized=new URLSearchParams(query)
 for(const key of ['period','end','segmentId','ownerId','tier','plan','cohort'])if(normalized.has(key)&&normalized.get(key)!.trim()==='')normalized.delete(key)
 return normalized
}
/** Report permission never grants archive or complete-data export authority. */
async function reportContext(db:D1Database,actor:Actor,query:URLSearchParams,provided?:RoleAccess){
 const access=provided??await roleAccess(db,actor)
 insist(!access.stale&&(access.restricted||(actor.kind==='person'&&['owner','admin'].includes(actor.role))),'A current assigned profile or native owner/admin is required for report export.',403)
 insist(['data-reports','team','own-reports','reports'].includes(access.permissions.export),'Your profile cannot export financial reports.',403)
 // Validate all existing filters before using their values. No account, staff,
 // segment or plan catalog is returned by this report door.
 const normalized=normalizedRetentionQuery(query);reportingWindow(normalized)
 const image=await scopeImage(db),readable=new Set(readableIds(image.value,actor,access))
 const accounts=image.value.accounts.filter(account=>readable.has(account.id)&&(
  access.permissions.export==='own-reports'?account.ownerId===actor.id:
  access.permissions.export==='team'?image.value.people.some(person=>person.id===account.ownerId&&person.status==='active'&&person.managerId===actor.id):true))
 insist(commercialFor(access,actor,actor.id)==='full'&&accounts.every(account=>commercialFor(access,actor,account.ownerId)==='full'),'This report requires full commercial-field access for every selected account.',403)
 const allowed=accounts.map(account=>account.id),segmentId=normalized.get('segmentId')
 insist(!segmentId||image.value.segments.some(member=>member.segmentId===segmentId&&allowed.includes(member.accountId)),'Report segment is unavailable in your current scope.',404)
 return {access,image,allowed,query:normalized}
}
interface FilterCatalog {
 owners:{id:string;name:string;status:string;role:string;version:number}[];
 segments:{id:string;name:string;revision:string}[];
 classifications:{accountId:string;tier:string|null}[]
}
// Each catalog is a projection of the permitted export-set, never a global
// operator/segment directory. Names and their native revisions are fenced too.
const CATALOG_SQL=`SELECT json_object(
 'owners',json((SELECT json_group_array(json_object('id',id,'name',display_name,'status',status,'role',role,'version',version)) FROM(
  SELECT o.id,o.display_name,o.status,o.role,o.version FROM oa_operators o WHERE EXISTS(
   SELECT 1 FROM buoy_account_owners a WHERE a.owner_id=o.id AND a.account_id IN(SELECT value FROM json_each(?))) ORDER BY o.display_name,o.id))),
 'segments',json((SELECT json_group_array(json_object('id',id,'name',name,'revision',revision)) FROM(
  SELECT s.id,json_extract(s.document,'$.name') AS name,s.revision FROM buoy_segments s WHERE EXISTS(
   SELECT 1 FROM buoy_segment_entries e WHERE e.segment_id=s.id AND e.exited_at IS NULL AND e.account_id IN(SELECT value FROM json_each(?))) ORDER BY name,s.id))),
 'classifications',json((SELECT json_group_array(json_object('accountId',account_id,'tier',tier)) FROM(
  SELECT account_id,tier FROM buoy_classifications WHERE account_id IN(SELECT value FROM json_each(?)) ORDER BY account_id))))`
async function filterCatalog(db:D1Database,allowed:string[]){
 const ids=JSON.stringify(allowed),row=await stmt(db,CATALOG_SQL+' AS snapshot',ids,ids,ids).first<{snapshot:string}>()
 insist(row,'Report filter choices are unavailable.',503)
 return {ids,raw:row.snapshot,value:JSON.parse(row.snapshot) as FilterCatalog}
}
function catalogFence(db:D1Database,catalog:{ids:string;raw:string}){return guard(db,`(${CATALOG_SQL})=?`,catalog.ids,catalog.ids,catalog.ids,catalog.raw)}
export async function scopedRetentionReport(db:D1Database,actor:Actor,query:URLSearchParams,provided?:RoleAccess):Promise<ScopedRetentionReport>{
 const context=await reportContext(db,actor,query,provided),{access,image,allowed}=context,catalog=await filterCatalog(db,allowed)
 const report=await retentionReport(db,actor,context.query,allowed,[roleFence(db,actor,access),scopeFence(db,image),catalogFence(db,catalog)])
 const unique=(values:string[])=>[...new Set(values)].sort((a,b)=>a.localeCompare(b))
 const filterOptions:RetentionFilterOptions={owners:catalog.value.owners.map(({id,name})=>({id,name})),segments:catalog.value.segments.map(({id,name})=>({id,name})),plans:unique(report.rows.flatMap(row=>row.products)),cohorts:unique(report.rows.flatMap(row=>row.cohort?[row.cohort]:[])),tiers:unique(catalog.value.classifications.flatMap(row=>row.tier?[row.tier]:[]))}
 await db.batch([roleFence(db,actor,access),scopeFence(db,image),catalogFence(db,catalog),stmt(db,'DELETE FROM buoy_assertions')])
 return {...report,filterOptions}
}
const csvCell=(value:unknown)=>{const text=String(value??'');return '"'+(/^[=+\-@\t\r]/.test(text)?"'":'')+text.replaceAll('"','""')+'"'}
export function scopedRetentionCsv(report:ScopedRetentionReport){
 const header=['account_id','account_name','currency','movement','starting_arr_minor','ending_arr_minor','usd_starting_arr_minor','usd_ending_constant_arr_minor','usd_ending_arr_minor','in_starting_cohort','start_source_id','end_source_id','exception','period_start','period_end','interpretation']
 const rows:unknown[][]=report.rows.map(row=>[row.accountId,row.name,row.currency,row.movement,row.startMinor,row.endMinor,row.usdStartMinor,row.usdEndConstantMinor,row.usdEndMinor,row.inCohort,row.startSource?.id??'',row.endSource.id,'',report.window.start,report.window.end,report.interpretation])
 rows.push(...report.exceptions.map(exception=>[exception.accountId,exception.name,'','','','','','','','','','',exception.reason,report.window.start,report.window.end,report.interpretation]))
 return [header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'
}
export async function scopedRetentionExport(db:D1Database,actor:Actor,query:URLSearchParams):Promise<string>{
 const context=await reportContext(db,actor,query),{access,image,allowed}=context
 const report=await retentionReport(db,actor,context.query,allowed,[roleFence(db,actor,access),scopeFence(db,image)]),csv=scopedRetentionCsv(report)
 // The CSV is returned only after the original authority/scope still holds and
 // one opaque export receipt commits. Report read fences contain no audit writes.
 await db.batch([roleFence(db,actor,access),scopeFence(db,image),auditRecord(db,actor,'data.exported','report:'+id()),stmt(db,'DELETE FROM buoy_assertions')])
 return csv
}
