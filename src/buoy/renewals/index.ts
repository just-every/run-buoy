import {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {jsonBody} from '../access'
import {accountAudit,auditRecord} from '../audit-records'
import {authority,date,guard,id,insist,now,object,requirePerson,stmt,text,type Actor} from '../core'
import {annualTotals} from '../revenue/model'
import type {ConfirmedContract} from '../revenue/types'
import {noticeDate,type Account} from '../health'
import {previewRenewalField,refreshRenewalFields,renewalFieldsState,saveRenewalField,saveRenewalValues} from './fields'

export interface Renewal {id:string;accountId:string;name:string;ownerId:string|null;renewalDate:string;noticeDeadline:string|null;expectedArrMinor:number;currency:string;stage:string;forecast:'commit'|'likely'|'at-risk';riskReasons:string[];contractStart:string;sourceVersionId:string;sourceReference:string;outcome:string|null;reason?:string;evidence?:string;resultArrMinor?:number;revision:string;createdAt:string}
export const SETTINGS_SQL='SELECT json_object(\'document\',document,\'revision\',revision) FROM buoy_renewal_settings WHERE singleton=1'
export const GENERATION_SQL=`SELECT json_group_array(json_object('id',a.id,'document',a.document,'revision',a.revision,'ownerId',o.owner_id,'versionId',v.id,'contract',v.document)) FROM(SELECT * FROM buoy_accounts ORDER BY id) a JOIN buoy_recurring_contract_current c ON c.account_id=a.id JOIN buoy_recurring_contract_versions v ON v.id=c.version_id LEFT JOIN buoy_account_owners o ON o.account_id=a.id`
export async function renewalSettings(db:D1Database){const row=await db.prepare('SELECT document,revision FROM buoy_renewal_settings WHERE singleton=1').first<{document:string;revision:string}>();insist(row,'Renewal configuration unavailable.',503);return {...JSON.parse(row.document) as {leadDays:number;stages:string[]},revision:row.revision}}
export async function saveRenewalSettings(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor);insist(Object.keys(input).every(k=>['revision','leadDays','stages'].includes(k)),'Unsupported renewal configuration property.');insist(Number.isInteger(input.leadDays)&&Number(input.leadDays)>=0&&Number(input.leadDays)<=730,'Renewal lead time must be 0–730 whole UTC days.');insist(Array.isArray(input.stages)&&input.stages.length>0&&input.stages.length<=20,'Configure 1–20 stages.');const stages=input.stages.map(v=>text(v,'Stage',100));insist(new Set(stages).size===stages.length,'Stages must be unique.');const current=await renewalSettings(db);insist(input.revision===current.revision,'Renewal configuration changed. Reload.',409)
 const used=(await db.prepare("SELECT DISTINCT json_extract(document,'$.stage') AS stage FROM buoy_renewals").all<{stage:string}>()).results;insist(used.every(row=>stages.includes(row.stage)),'A renewal still uses a removed stage. Move it first.',409)
 await db.batch([authority(db,actor,true),guard(db,'EXISTS(SELECT 1 FROM buoy_renewal_settings WHERE revision=?)',current.revision),guard(db,"NOT EXISTS(SELECT 1 FROM buoy_renewals WHERE json_extract(document,'$.stage') NOT IN(SELECT value FROM json_each(?)))",JSON.stringify(stages)),stmt(db,'UPDATE buoy_renewal_settings SET document=?,revision=? WHERE singleton=1',JSON.stringify({leadDays:input.leadDays,stages}),id()),auditRecord(db,actor,'renewal.settings-changed','renewal-settings'),stmt(db,'DELETE FROM buoy_assertions')]);return {status:'saved'}
}
/** Declared hourly Cron and successful source writes use the same idempotent door. */
export async function generateRenewals(db:D1Database,at=new Date()){
 const on=at.toISOString().slice(0,10),settings=await renewalSettings(db),source=await db.prepare('SELECT ('+GENERATION_SQL+') AS snapshot').first<{snapshot:string}>();insist(source,'Recurring source image unavailable.',503)
 const rows=JSON.parse(source.snapshot) as {id:string;document:string;revision:string;ownerId:string|null;versionId:string;contract:string}[]
 const existing=(await db.prepare('SELECT id,account_id AS accountId,period_key AS periodKey,document,revision FROM buoy_renewals').all<{id:string;accountId:string;periodKey:string;document:string;revision:string}>()).results
 const statements:D1PreparedStatement[]=[]
 for(const row of rows){
  const account=JSON.parse(row.document) as Account,contract=JSON.parse(row.contract) as ConfirmedContract,opensOn=new Date(Date.parse(contract.contractEnd)-settings.leadDays*86400000).toISOString().slice(0,10)
  const periodKey=JSON.stringify([contract.contractStart,contract.contractEnd]),prior=existing.find(r=>r.accountId===row.id&&r.periodKey===periodKey),previous=prior?JSON.parse(prior.document) as Omit<Renewal,'id'|'revision'|'createdAt'>:null
  if(!prior&&on<opensOn)continue
  const sourceData={name:account.name+' renewal',accountId:row.id,renewalDate:contract.contractEnd,noticeDeadline:account.renewalDate===contract.contractEnd?noticeDate(account):null,expectedArrMinor:annualTotals(contract).arrMinor,currency:contract.currency,contractStart:contract.contractStart,sourceVersionId:row.versionId,sourceReference:contract.source.reference}
  if(previous?.outcome)continue
  const riskReasons=sourceData.noticeDeadline===null?['Confirmed account notice terms do not match this contract end date.']:[]
  const next={...previous,...sourceData,ownerId:previous?previous.ownerId:row.ownerId,stage:previous?.stage??settings.stages[0],forecast:previous?.forecast??'likely',riskReasons:previous?.riskReasons??riskReasons,outcome:previous?.outcome??null}
  if(previous&&JSON.stringify(next)===JSON.stringify(previous))continue
  const recordId=prior?.id??id(),stamp=now()
  statements.push(stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),row.id),guard(db,'(SELECT revision FROM buoy_renewals WHERE account_id=? AND period_key=?) IS ?',row.id,periodKey,prior?.revision??null),stmt(db,'INSERT INTO buoy_renewals(id,account_id,period_key,document,revision,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,period_key) DO UPDATE SET document=excluded.document,revision=excluded.revision',recordId,row.id,periodKey,JSON.stringify(next),id(),stamp),stmt(db,"INSERT INTO buoy_renewal_history(id,record_id,field_key,old_value,new_value,actor,source,recorded_at) VALUES(?,?,?, ?,?,'system:renewals',?,?)",id(),recordId,'source',JSON.stringify(previous),JSON.stringify(next),contract.source.reference,stamp),stmt(db,"INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) VALUES(?,'system:renewals',?,?,?,?)",id(),prior?'renewal.source-refreshed':'renewal.created','renewal:'+recordId,'',stamp))
 }
 if(statements.length)await db.batch([guard(db,'EXISTS(SELECT 1 FROM buoy_renewal_settings WHERE revision=?)',settings.revision),guard(db,`(${GENERATION_SQL})=?`,source.snapshot),...statements,stmt(db,'DELETE FROM buoy_assertions')])
 await refreshRenewalFields(db,'system:renewals')
}
export async function renewalsState(db:D1Database,actor:Actor,query=new URLSearchParams()){
 insist(actor.kind==='person','Renewals require a staff session.',403)
 const quarter=query.get('quarter');insist(!quarter||/^\d{4}-Q[1-4]$/.test(quarter),'Choose a quarter such as 2027-Q1.')
 const records=(await db.prepare('SELECT id,document,revision,created_at AS createdAt FROM buoy_renewals ORDER BY json_extract(document,\'$.renewalDate\'),id').all<{id:string;document:string;revision:string;createdAt:string}>()).results.map(({document,...row})=>({...JSON.parse(document),...row})) as Renewal[]
 const all=records.map(r=>({...r,quarter:r.renewalDate.slice(0,4)+'-Q'+Math.ceil(Number(r.renewalDate.slice(5,7))/3)}))
 return {settings:await renewalSettings(db),quarters:[...new Set(all.map(r=>r.quarter))].sort(),records:all.filter(r=>!quarter||r.quarter===quarter),fields:await renewalFieldsState(db),interpretation:'Expected ARR is confirmed contract annualized native-currency minor units. Renewal outcomes do not change billing. Billing reconciliation after a provider sync remains unproved. Dates and quarters use UTC. A changed contract period creates its own opportunity; source revisions within the same period refresh one opportunity. Earlier periods remain as history.'}
}
export async function saveRenewal(db:D1Database,actor:Actor,recordId:string,input:Record<string,unknown>){
 requirePerson(actor);insist(Object.keys(input).every(k=>['revision','stage','forecast','ownerId','riskReasons'].includes(k)),'Unsupported renewal update property.');const row=await stmt(db,'SELECT document,revision FROM buoy_renewals WHERE id=?',recordId).first<{document:string;revision:string}>();insist(row,'Renewal not found.',404);insist(row.revision===input.revision,'Renewal changed. Reload before saving.',409)
 const prior=JSON.parse(row.document) as Renewal,settings=await renewalSettings(db);insist(!prior.outcome,'An outcome has already been approved for this renewal.',409);insist(settings.stages.includes(String(input.stage)),'Choose a configured renewal stage.');insist(['commit','likely','at-risk'].includes(String(input.forecast)),'Choose commit, likely or at-risk.');insist(input.ownerId===null||typeof input.ownerId==='string','Choose a renewal owner or null.');insist(Array.isArray(input.riskReasons)&&input.riskReasons.length<=20,'List at most 20 risk reasons.');const reasons=input.riskReasons.map(v=>text(v,'Risk reason',1000));const next={...prior,ownerId:input.ownerId,stage:input.stage,forecast:input.forecast,riskReasons:reasons}
 await db.batch([authority(db,actor,true),guard(db,'EXISTS(SELECT 1 FROM buoy_renewals WHERE id=? AND revision=?)',recordId,row.revision),guard(db,'EXISTS(SELECT 1 FROM buoy_renewal_settings WHERE revision=?)',settings.revision),...(input.ownerId?[guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",input.ownerId)]:[]),stmt(db,'UPDATE buoy_renewals SET document=?,revision=? WHERE id=?',JSON.stringify(next),id(),recordId),stmt(db,'INSERT INTO buoy_renewal_history(id,record_id,field_key,old_value,new_value,actor,source,recorded_at) VALUES(?,?,?,?,?,?,?,?)',id(),recordId,'pipeline',JSON.stringify(prior),JSON.stringify(next),`person:${actor.id}`,'Human pipeline review',now()),stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),prior.accountId),...accountAudit(db,actor,prior.accountId,'renewal.pipeline-changed'),stmt(db,'DELETE FROM buoy_assertions')]);return {id:recordId}
}
export const renewalsApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
renewalsApi.get('/api/buoy/renewals',async c=>c.json(await renewalsState(c.env.DB,c.get('actor'),new URL(c.req.url).searchParams)))
renewalsApi.put('/api/buoy/renewals/settings',async c=>c.json(await saveRenewalSettings(c.env.DB,c.get('actor'),await jsonBody(c.req.raw))))
renewalsApi.put('/api/buoy/renewals/:id',async c=>c.json(await saveRenewal(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
renewalsApi.post('/api/buoy/renewal-fields/preview',async c=>c.json(await previewRenewalField(c.env.DB,c.get('actor'),await jsonBody(c.req.raw))))
renewalsApi.post('/api/buoy/renewal-fields',async c=>c.json(await saveRenewalField(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
renewalsApi.put('/api/buoy/renewals/:id/fields',async c=>c.json(await saveRenewalValues(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
