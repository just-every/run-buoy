import {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {jsonBody} from '../access'
import {state} from '../accounts'
import {auditRecord} from '../audit-records'
import {guard,id,insist,now,object,stmt,text,type Actor} from '../core'
import {DEFAULT_ROLES,projectState,readableIds,roleAccess,roleFence,scopeFence,scopeImage} from '../roles'
import {snapshot,evaluated} from '../segments/snapshot'
import {segmentFields} from '../segments'
import {SAFE_FIELDS,calculateReport,reportCsv,reportInput,requiredFields,type Catalog,type ReportSpec,type ReportRow} from './model'
import {dashboardPresets,presetReport} from './presets'
export interface SavedReport {id:string;revision:string;spec:ReportSpec}
export interface Dashboard {id:string;revision:string;name:string;sharedRoles:string[];reportIds:string[]}
export const reportInterpretation='Current account evidence, not a historical reconstruction or guaranteed prediction. Saved definitions grant no record or commercial authority. Filters and current segment membership apply before grouping, formulas, charts and CSV. Native money is grouped separately by currency; missing inputs make the group value unavailable. Calculated columns show their formula and inputs. Owners, administrators and explicitly assigned authors create definitions within their current account and field permissions.'
async function context(db:D1Database,actor:Actor){
 const access=await roleAccess(db,actor),scope=await scopeImage(db)
 insist(!access.stale,'Your role assignment changed. Ask an administrator to assign it again.',403)
 const roles=[...DEFAULT_ROLES.map(r=>r.id),...(await db.prepare('SELECT id FROM buoy_role_definitions ORDER BY id').all<{id:string}>()).results.map(r=>r.id),'member']
 const manage=!access.restricted&&['owner','admin'].includes(actor.role),roleId=access.roleId
 const author=manage||access.restricted&&access.permissions.reports==='author'&&access.permissions.read!=='none'&&access.permissions.export!=='none'
 return {access,scope,roles,manage,author,roleId}
}
const mayEdit=(ctx:Awaited<ReturnType<typeof context>>,actor:Actor,creator:string)=>ctx.manage||ctx.author&&creator===actor.id
const mayRead=(ctx:Awaited<ReturnType<typeof context>>,actor:Actor,creator:string,roles:string[])=>mayEdit(ctx,actor,creator)||roles.includes(ctx.roleId)
export async function reportSource(db:D1Database,actor:Actor){
 const ctx=await context(db,actor),source=await snapshot(db),on=now().slice(0,10),raw=await state(db,actor),visible=new Set(readableIds(ctx.scope.value,actor,ctx.access)),people=raw.people as unknown as {id:string;displayName:string}[]
 let catalog:Catalog,rows:ReportRow[]
 if(ctx.access.restricted){
  const projected=await projectState(db,actor,raw,ctx.access)
  insist(ctx.access.permissions.export!=='none','Your profile cannot access reports.',403)
  const exact=projected.accounts.every(a=>a.commercialAccess==='full')&&ctx.access.commercial==='full'&&ctx.access.roleCommercial==='full'&&['full','own'].includes(ctx.access.permissions.commercialRead)
  catalog=Object.fromEntries(Object.entries(SAFE_FIELDS).filter(([key])=>exact||!key.startsWith('revenue.'))) as Catalog
  rows=projected.accounts.map(a=>({id:a.id,currency:a.commercial?.currency??null,ownerName:people.find(p=>p.id===a.ownerId)?.displayName??null,values:{id:a.id,name:a.name,ownerId:a.ownerId,renewalDate:a.renewalDate,'health.status':a.health.status,'revenue.arrMinor':a.commercial?.arrMinor??null,'revenue.currency':a.commercial?.currency??null}}))
 }else{
  catalog=Object.fromEntries(Object.entries(segmentFields(source.value)).filter(([key])=>!key.startsWith('people.')&&!key.startsWith('records.renewal.'))) as Catalog
  rows=evaluated(source.value,on).filter(r=>visible.has(r.account.id)).map(r=>({id:r.account.id,values:r.values,currency:typeof r.values['revenue.currency']==='string'?r.values['revenue.currency']:null,ownerName:people.find(p=>p.id===r.values.ownerId)?.displayName??null}))
 }
 const segments=source.value.segments.flatMap(s=>{const ids=source.value.entries.filter(e=>e.segmentId===s.id&&!e.exitedAt&&visible.has(e.accountId)).map(e=>e.accountId);return ctx.manage||ids.length?[{id:s.id,name:JSON.parse(s.document).name as string,accountIds:ids}]:[]})
 return {ctx,source,catalog,rows,segments}
}
export async function savedReports(db:D1Database,actor:Actor){
 const source=await reportSource(db,actor),{ctx}=source
 const shares=(await db.prepare('SELECT report_id,role_id FROM buoy_report_shares ORDER BY report_id,role_id').all<{report_id:string;role_id:string}>()).results
 const dashboardShares=(await db.prepare('SELECT dashboard_id,role_id FROM buoy_dashboard_shares ORDER BY dashboard_id,role_id').all<{dashboard_id:string;role_id:string}>()).results
 const reports=(await db.prepare('SELECT id,revision,document,created_by FROM buoy_reports ORDER BY created_at,id').all<{id:string;revision:string;document:string;created_by:string}>()).results.map(({document,created_by,...r})=>({...r,canEdit:mayEdit(ctx,actor,created_by),readable:mayRead(ctx,actor,created_by,shares.filter(s=>s.report_id===r.id).map(s=>s.role_id)),spec:{...JSON.parse(document) as ReportSpec,sharedRoles:shares.filter(s=>s.report_id===r.id).map(s=>s.role_id)}})).filter(r=>r.readable&&requiredFields(r.spec).every(f=>Object.hasOwn(source.catalog,f)))
 const links=(await db.prepare('SELECT dashboard_id,report_id FROM buoy_dashboard_reports ORDER BY position,report_id').all<{dashboard_id:string;report_id:string}>()).results
 const dashboards=(await db.prepare('SELECT id,revision,document,created_by FROM buoy_dashboards ORDER BY created_at,id').all<{id:string;revision:string;document:string;created_by:string}>()).results.map(({document,created_by,...r})=>({...r,readable:mayRead(ctx,actor,created_by,dashboardShares.filter(s=>s.dashboard_id===r.id).map(s=>s.role_id)),...JSON.parse(document) as {name:string;sharedRoles:string[]},sharedRoles:dashboardShares.filter(s=>s.dashboard_id===r.id).map(s=>s.role_id),reportIds:links.filter(l=>l.dashboard_id===r.id).map(l=>l.report_id).filter(id=>reports.some(r=>r.id===id))})).filter(d=>d.readable)
 await db.batch([roleFence(db,actor,ctx.access),scopeFence(db,ctx.scope),guard(db,`(${source.source.sql})=?`,source.source.raw),stmt(db,'DELETE FROM buoy_assertions')])
 return {reports,dashboards,catalog:source.catalog,roles:ctx.author?ctx.roles:[],presets:ctx.author?dashboardPresets:[],segments:source.segments.map(({accountIds:_,...s})=>s),canManage:ctx.author,interpretation:reportInterpretation}
}
export async function runReport(db:D1Database,actor:Actor,key:string){
 const src=await reportSource(db,actor),row=await stmt(db,'SELECT revision,document,created_by FROM buoy_reports WHERE id=?',key).first<{revision:string;document:string;created_by:string}>();insist(row,'Report unavailable.',404)
 const spec={...JSON.parse(row.document) as ReportSpec,sharedRoles:(await stmt(db,'SELECT role_id FROM buoy_report_shares WHERE report_id=? ORDER BY role_id',key).all<{role_id:string}>()).results.map(s=>s.role_id)}
 insist(mayRead(src.ctx,actor,row.created_by,spec.sharedRoles),'Report is not shared with your current role.',403)
 insist(requiredFields(spec).every(k=>Object.hasOwn(src.catalog,k)),'This report uses fields unavailable to your profile.',403)
 const segment=src.segments.find(s=>s.id===spec.segmentId);insist(!spec.segmentId||segment,'Selected segment is unavailable.',403)
 const result=calculateReport(spec,src.rows.filter(r=>!segment||segment.accountIds.includes(r.id)))
 await db.batch([roleFence(db,actor,src.ctx.access),scopeFence(db,src.ctx.scope),guard(db,'EXISTS(SELECT 1 FROM buoy_reports WHERE id=? AND revision=?)',key,row.revision),guard(db,`(${src.source.sql})=?`,src.source.raw),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:key,revision:row.revision,canEdit:mayEdit(src.ctx,actor,row.created_by),spec,result,interpretation:reportInterpretation}
}
export async function saveReport(db:D1Database,actor:Actor,input:Record<string,unknown>,effects?:(key:string)=>D1PreparedStatement[]){
 insist(Object.keys(input).every(k=>['id','revision','spec'].includes(k)),'Unsupported report request.')
 const source=await reportSource(db,actor);insist(source.ctx.author,'Explicit report author permission is required.',403)
 const spec=reportInput(input.spec,source.catalog,source.ctx.roles),key=input.id===undefined?id():text(input.id,'Report ID',100),prior=await stmt(db,'SELECT revision,created_by FROM buoy_reports WHERE id=?',key).first<{revision:string;created_by:string}>()
 insist(!prior||mayEdit(source.ctx,actor,prior.created_by),'Only the author or an administrator can edit this report.',403)
 insist(!spec.segmentId||source.segments.some(s=>s.id===spec.segmentId),'Choose an existing segment.')
 insist(input.id===undefined?!prior&&input.revision===undefined:prior&&prior.revision===input.revision,'Report changed. Reload before saving.',409)
 const refs=source.rows.filter(r=>spec.rules.conditions.some(c=>['id','name'].includes(c.field)&&c.value===r.values[c.field])).map(r=>r.id)
 await db.batch([roleFence(db,actor,source.ctx.access),scopeFence(db,source.ctx.scope),guard(db,'(SELECT revision FROM buoy_reports WHERE id=?) IS ?',key,prior?.revision??null),guard(db,`(${source.source.sql})=?`,source.source.raw),stmt(db,'INSERT INTO buoy_reports VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document,revision=excluded.revision',key,JSON.stringify({...spec,sharedRoles:[]}),id(),actor.id,now()),stmt(db,'DELETE FROM buoy_report_shares WHERE report_id=?',key),...spec.sharedRoles.map(role=>stmt(db,'INSERT INTO buoy_report_shares VALUES(?,?)',key,role)),stmt(db,'DELETE FROM buoy_report_accounts WHERE report_id=?',key),...refs.map(a=>stmt(db,'INSERT INTO buoy_report_accounts VALUES(?,?)',key,a)),...(effects?effects(key):[]),auditRecord(db,actor,'report.saved','report:'+key),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:key}
}
export async function saveDashboard(db:D1Database,actor:Actor,input:Record<string,unknown>){
 if(Object.hasOwn(input,'presetId'))return savePresetDashboard(db,actor,input)
 insist(Object.keys(input).every(k=>['id','revision','name','sharedRoles','reportIds'].includes(k)),'Unsupported dashboard property.')
 const ctx=await context(db,actor);insist(ctx.author,'Explicit dashboard author permission is required.',403)
 const name=text(input.name,'Dashboard name',100),key=input.id===undefined?id():text(input.id,'Dashboard ID',100)
 insist(Array.isArray(input.sharedRoles)&&input.sharedRoles.length<=50&&input.sharedRoles.every(r=>ctx.roles.includes(String(r))),'Choose current viewer roles.')
 insist(Array.isArray(input.reportIds)&&input.reportIds.length>0&&input.reportIds.length<=20&&input.reportIds.every(r=>typeof r==='string')&&new Set(input.reportIds).size===input.reportIds.length,'Choose 1–20 unique saved reports.')
 const all=(await savedReports(db,actor)).reports;insist(input.reportIds.every(k=>all.some(r=>r.id===k)),'A selected report is unavailable.',409)
 const prior=await stmt(db,'SELECT revision,created_by FROM buoy_dashboards WHERE id=?',key).first<{revision:string;created_by:string}>();insist(!prior||mayEdit(ctx,actor,prior.created_by),'Only the author or an administrator can edit this dashboard.',403);insist(input.id===undefined?!prior&&input.revision===undefined:prior&&prior.revision===input.revision,'Dashboard changed. Reload.',409)
 await db.batch([roleFence(db,actor,ctx.access),guard(db,'(SELECT revision FROM buoy_dashboards WHERE id=?) IS ?',key,prior?.revision??null),stmt(db,'INSERT INTO buoy_dashboards VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document,revision=excluded.revision',key,JSON.stringify({name,sharedRoles:[]}),id(),actor.id,now()),stmt(db,'DELETE FROM buoy_dashboard_shares WHERE dashboard_id=?',key),...[...new Set(input.sharedRoles.map(String))].map(role=>stmt(db,'INSERT INTO buoy_dashboard_shares VALUES(?,?)',key,role)),stmt(db,'DELETE FROM buoy_dashboard_reports WHERE dashboard_id=?',key),...input.reportIds.map((r,i)=>stmt(db,'INSERT INTO buoy_dashboard_reports VALUES(?,?,?)',key,r,i)),auditRecord(db,actor,'dashboard.saved','dashboard:'+key),stmt(db,'DELETE FROM buoy_assertions')]);return {id:key}
}
async function savePresetDashboard(db:D1Database,actor:Actor,input:Record<string,unknown>){
 insist(Object.keys(input).every(k=>['presetId','segmentId'].includes(k)),'Starter dashboards accept only a starter and current segment. Shares and schedules require separate actions.')
 const ctx=await context(db,actor);insist(ctx.author,'Explicit report author permission is required to create starter dashboards.',403)
 const spec=presetReport(input.presetId,input.segmentId),key=id()
 // The report and its private dashboard are one fenced transaction. There is
 // no stored result, new authority or delivery configuration to restore.
 const report=await saveReport(db,actor,{spec},reportId=>[
  stmt(db,'INSERT INTO buoy_dashboards VALUES(?,?,?,?,?)',key,JSON.stringify({name:spec.name,sharedRoles:[]}),id(),actor.id,now()),
  stmt(db,'INSERT INTO buoy_dashboard_reports VALUES(?,?,?)',key,reportId,0),
  auditRecord(db,actor,'dashboard.saved','dashboard:'+key),
 ])
 return {id:key,reportId:report.id}
}
export const reportsApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
reportsApi.get('/api/buoy/reports',async c=>c.json(await savedReports(c.env.DB,c.get('actor'))))
reportsApi.get('/api/buoy/reports/:id',async c=>c.json(await runReport(c.env.DB,c.get('actor'),c.req.param('id'))))
reportsApi.get('/api/buoy/reports/:id/export.csv',async c=>{const r=await runReport(c.env.DB,c.get('actor'),c.req.param('id'));return c.body(reportCsv(r.spec,r.result),200,{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename=buoy-report.csv'})})
reportsApi.post('/api/buoy/reports',async c=>c.json(await saveReport(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
reportsApi.post('/api/buoy/dashboards',async c=>c.json(await saveDashboard(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))

reportsApi.get('/api/buoy/reports/:id/delivery-preview.txt',async c=>{const r=await runReport(c.env.DB,c.get('actor'),c.req.param('id'));return c.body(r.spec.name+'\n'+reportCsv(r.spec,r.result)+'\n'+r.interpretation,200,{'content-type':'text/plain; charset=utf-8','content-disposition':'attachment; filename=buoy-report-preview.txt'})})
