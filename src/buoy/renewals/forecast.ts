import {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {jsonBody} from '../access'
import {accountAudit,auditRecord} from '../audit-records'
import {date,guard,id,insist,now,requirePerson,stmt,text,type Actor} from '../core'
import {commercialFor,readableIds,roleAccess,roleFence,scopeFence,scopeImage} from '../roles/access'
import {convertMinor,selectedRate,type RateTable} from '../revenue/fx'
import type {Renewal} from './index'
import type {Team} from '../team-plan'

// Current inputs, rate versions and source authority are fenced together. A
// retained weekly item owns its own rate and evidence, never a mutable total.
const IMAGE=`SELECT json_object(
 'renewals',json((SELECT json_group_array(json_object('id',r.id,'revision',r.revision,'document',json(r.document))) FROM(SELECT * FROM buoy_renewals ORDER BY id) r)),
 'rateDocument',(SELECT v.document FROM buoy_fx_current c JOIN buoy_fx_versions v ON v.id=c.version_id WHERE c.singleton=1),
 'rateVersionId',(SELECT version_id FROM buoy_fx_current WHERE singleton=1),
 'teams',(SELECT document FROM buoy_team_settings WHERE singleton=1),
 'people',json((SELECT json_group_array(json_object('id',id,'name',display_name)) FROM(SELECT * FROM oa_operators WHERE status='active' ORDER BY id))),
 'segments',json((SELECT json_group_array(json_object('id',s.id,'name',json_extract(s.document,'$.name'),'accountId',e.account_id)) FROM buoy_segments s LEFT JOIN buoy_segment_entries e ON e.segment_id=s.id AND e.exited_at IS NULL)),
 'providers',json((SELECT json_group_array(json_object('accountId',p.account_id,'observedAt',s.observed_at,'disconnected',c.disconnected_at,'credential',k.connection_id,'error',b.last_error,'staleDays',b.stale_days)) FROM buoy_billing_current p JOIN buoy_billing_snapshots s ON s.id=p.snapshot_id JOIN buoy_connections c ON c.id=s.connection_id JOIN buoy_billing_settings b ON b.connection_id=c.id LEFT JOIN buoy_connection_credentials k ON k.connection_id=c.id)))`
interface Image {renewals:{id:string;revision:string;document:Renewal&{forecastOverride?:Override}}[];rateDocument:string|null;rateVersionId:string|null;teams:string;people:{id:string;name:string}[];segments:{id:string;name:string;accountId:string|null}[];providers:{accountId:string;observedAt:string;disconnected:string|null;credential:string|null;error:string|null;staleDays:number}[]}
interface Override {from:string;to:string;reason:string;actor:string;at:string}
export interface ForecastRecord {id:string;revision:string;accountId:string;name:string;ownerId:string|null;teamIds:string[];segmentIds:string[];renewalDate:string;stage:string;category:string;currency:string;nativeArrMinor:number;usdArrMinor:number|null;forecastUsdMinor:number|null;actualUsdMinor:number|null;actualNativeMinor:number|null;actualSource:string|null;rate:ReturnType<typeof selectedRate>;sourceReference:string;sourceVersionId:string;outcome:string|null;override:Override|null;gaps:string[];canOverride?:boolean}
async function image(db:D1Database){const raw=(await db.prepare(IMAGE+' AS snapshot').first<{snapshot:string}>())!.snapshot;return {raw,value:JSON.parse(raw) as Image}}
function rates(v:Image):RateTable{return v.rateDocument?{...JSON.parse(v.rateDocument),revision:v.rateVersionId}:{name:'Corporate budget rates',mode:'corporate',rates:[],revision:null}}
function records(value:Image,on:string):ForecastRecord[]{
 const table=rates(value),teams=(JSON.parse(value.teams) as {teams:Team[]}).teams
 return value.renewals.map(row=>{
  const r=row.document,rate=selectedRate(table,r.currency,r.renewalDate),gaps:string[]=[],provider=value.providers.find(p=>p.accountId===r.accountId)
  if(!rate)gaps.push('No '+r.currency+' reporting rate for '+r.renewalDate)
  if(r.sourceKind==='stripe-test'){
   if(!provider||provider.disconnected||!provider.credential)gaps.push('Stripe source reconnect required')
   else if(provider.error)gaps.push('Stripe source failed; expected ARR is retained evidence')
   else if(Date.parse(on)-Date.parse(provider.observedAt.slice(0,10))>provider.staleDays*86400000)gaps.push('Stripe source stale; expected ARR is retained evidence')
  }
  const usd=convertMinor(r.expectedArrMinor,r.currency,rate),actualNative=r.outcome&&r.outcome!=='deferred'?(r.sourceKind==='stripe-test'?r.billingActual?.arrMinor??null:r.resultArrMinor??null):null
  if(r.outcome&&r.outcome!=='deferred'&&actualNative===null)gaps.push('Approved outcome has no later provider actual')
  if(r.outcome==='deferred')gaps.push('Deferred outcome has no closed actual')
  const actual=actualNative===null?null:convertMinor(actualNative,r.currency,rate)
  return {id:row.id,revision:row.revision,accountId:r.accountId,name:r.name,ownerId:r.ownerId,teamIds:teams.filter(t=>r.ownerId&&t.personIds.includes(r.ownerId)).map(t=>t.id),segmentIds:[...new Set(value.segments.filter(s=>s.accountId===r.accountId).map(s=>s.id))],renewalDate:r.renewalDate,stage:r.stage,category:r.forecast,currency:r.currency,nativeArrMinor:r.expectedArrMinor,usdArrMinor:usd,forecastUsdMinor:r.outcome&&r.outcome!=='deferred'?actual:gaps.length?null:usd,actualUsdMinor:actual,actualNativeMinor:actualNative,actualSource:actualNative===null?null:r.sourceKind==='stripe-test'?r.billingActual!.sourceReference:'Human-approved outcome '+r.evidence,rate,sourceReference:r.sourceReference,sourceVersionId:r.sourceVersionId,outcome:r.outcome,override:r.forecastOverride??null,gaps}
 })
}
const week=(on:string)=>{const d=new Date(on+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)}
export async function snapshotForecast(db:D1Database,at=new Date(),actor?:Actor){
 if(actor)requirePerson(actor)
 const on=at.toISOString().slice(0,10),start=week(on),prior=await stmt(db,'SELECT id FROM buoy_forecast_snapshots WHERE week_start=?',start).first<{id:string}>()
 if(prior)return {id:prior.id,created:false}
 const current=await image(db),items=records(current.value,on),snapshotId=id(),stamp=now()
 await db.batch([...(actor?[roleFence(db,actor,await roleAccess(db,actor))]:[]),guard(db,`(${IMAGE})=?`,current.raw),stmt(db,'INSERT INTO buoy_forecast_snapshots(id,week_start,captured_at,evaluation_day) VALUES(?,?,?,?)',snapshotId,start,stamp,on),...items.map(r=>stmt(db,'INSERT INTO buoy_forecast_snapshot_items(snapshot_id,renewal_id,account_id,document) VALUES(?,?,?,?)',snapshotId,r.id,r.accountId,JSON.stringify(r))),...(actor?[auditRecord(db,actor,'renewal.forecast-snapshot','forecast:'+snapshotId)]:[stmt(db,"INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) VALUES(?,'system:renewals','renewal.forecast-snapshot',?,'',?)",id(),'forecast:'+snapshotId,stamp)]),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:snapshotId,created:true}
}
function window(query:URLSearchParams){
 const period=query.get('period')??'quarter';insist(['month','quarter'].includes(period),'Choose month or quarter.')
 const on=date(query.get('on')??now().slice(0,10),'Evaluation day'),start=date(query.get('start')??on.slice(0,4)+'-'+String((period==='quarter'?Math.floor((Number(on.slice(5,7))-1)/3)*3:Number(on.slice(5,7))-1)+1).padStart(2,'0')+'-01','Period start')
 insist(start.endsWith('-01')&&(period==='month'||[1,4,7,10].includes(Number(start.slice(5,7)))),'Start on the first UTC day of the selected month or quarter.')
 const end=new Date(Date.UTC(Number(start.slice(0,4)),Number(start.slice(5,7))+(period==='quarter'?2:0),0)).toISOString().slice(0,10)
 return {period,start,end,on,closed:end<on}
}
const sum=(values:(number|null)[])=>values.some(v=>v===null)?null:values.reduce<number>((s,v)=>s+v!,0)
function totals(rows:ForecastRecord[]){return {count:rows.length,expectedUsdMinor:sum(rows.map(r=>r.forecastUsdMinor)),commitUsdMinor:sum(rows.filter(r=>r.outcome&&r.outcome!=='deferred'||r.category==='commit').map(r=>r.forecastUsdMinor)),atRiskUsdMinor:sum(rows.filter(r=>!r.outcome&&r.category==='at-risk').map(r=>r.forecastUsdMinor)),bestUsdMinor:sum(rows.map(r=>r.forecastUsdMinor)),worstUsdMinor:sum(rows.filter(r=>r.outcome&&r.outcome!=='deferred'||r.category==='commit').map(r=>r.forecastUsdMinor)),actualUsdMinor:sum(rows.map(r=>r.actualUsdMinor)),actualCount:rows.filter(r=>r.actualUsdMinor!==null).length}}
async function access(db:D1Database,actor:Actor){const role=await roleAccess(db,actor),scope=await scopeImage(db),visible=readableIds(scope.value,actor,role).filter(accountId=>commercialFor(role,actor,scope.value.accounts.find(a=>a.id===accountId)!.ownerId)==='full');return {role,scope,visible}}
function mayOverride(actor:Actor,a:Awaited<ReturnType<typeof access>>,record:ForecastRecord){return a.visible.includes(record.accountId)&&(!a.role.restricted?['owner','admin'].includes(actor.role):!a.role.stale&&a.role.permissions.commercialEdit==='team'&&a.role.permissions.renewals==='team'&&a.scope.value.people.some(p=>p.id===record.ownerId&&p.status==='active'&&p.managerId===actor.id))}
export async function forecastState(db:D1Database,actor:Actor,query=new URLSearchParams()){
 const a=await access(db,actor),current=await image(db),w=window(query),all=records(current.value,w.on).filter(r=>a.visible.includes(r.accountId)),teams=(JSON.parse(current.value.teams) as {teams:Team[]}).teams
 const scopedPeople=current.value.people.filter(p=>all.some(r=>r.ownerId===p.id)),scopedTeams=teams.filter(t=>all.some(r=>r.teamIds.includes(t.id))).map(({id,name})=>({id,name})),scopedSegments=[...new Map(current.value.segments.filter(s=>s.accountId&&a.visible.includes(s.accountId)).map(s=>[s.id,{id:s.id,name:s.name}])).values()]
 const owner=query.get('ownerId'),team=query.get('teamId'),segment=query.get('segmentId')
 for(const [selected,list]of [[owner,scopedPeople],[team,scopedTeams],[segment,scopedSegments]] as const)insist(!selected||list.some(v=>v.id===selected),'A selected filter is unavailable in your current scope.',403)
 const cohort=new Set(all.filter(r=>(!owner||r.ownerId===owner)&&(!team||r.teamIds.includes(team))&&(!segment||r.segmentIds.includes(segment))).map(r=>r.accountId))
 const filtered=all.filter(r=>cohort.has(r.accountId)&&r.renewalDate>=w.start&&r.renewalDate<=w.end).map(r=>({...r,canOverride:!r.outcome&&mayOverride(actor,a,r)}))
 const snapshots=(await db.prepare('SELECT id,week_start AS weekStart,captured_at AS capturedAt,evaluation_day AS evaluationDay FROM buoy_forecast_snapshots ORDER BY evaluation_day DESC,captured_at DESC,id DESC').all<{id:string;weekStart:string;capturedAt:string;evaluationDay:string}>()).results
 const selected=query.get('snapshotId')?snapshots.find(s=>s.id===query.get('snapshotId')):snapshots.find(s=>!w.closed||s.evaluationDay<=w.end)
 insist(!query.get('snapshotId')||selected,'Snapshot unavailable.',404);insist(!selected||!w.closed||selected.evaluationDay<=w.end,'A closed period needs a snapshot captured before it ended.')
 const baseline=selected?(await stmt(db,'SELECT document FROM buoy_forecast_snapshot_items WHERE snapshot_id=? ORDER BY renewal_id',selected.id).all<{document:string}>()).results.map(r=>JSON.parse(r.document) as ForecastRecord).filter(r=>cohort.has(r.accountId)&&r.renewalDate>=w.start&&r.renewalDate<=w.end):[]
 const summary=totals(filtered),previous=selected?totals(baseline):null,movements=filtered.map(r=>{const before=baseline.find(b=>b.id===r.id);return {renewalId:r.id,previousStage:before?.stage??null,currentStage:r.stage,previousCategory:before?.category??null,currentCategory:r.category,previousOutcome:before?.outcome??null,currentOutcome:r.outcome,deltaUsdMinor:before&&before.forecastUsdMinor!==null&&r.forecastUsdMinor!==null?r.forecastUsdMinor-before.forecastUsdMinor:null}})
 const grouping=(key:'ownerId'|'teamIds'|'segmentIds')=>[...new Set(filtered.flatMap(r=>key==='ownerId'?[r.ownerId??'unassigned']:r[key]))].sort().map(keyValue=>({id:keyValue,...totals(filtered.filter(r=>key==='ownerId'?(r.ownerId??'unassigned')===keyValue:r[key].includes(keyValue)))}))
 const gaps=[...new Set(filtered.flatMap(r=>r.gaps.map(g=>r.name+': '+g)))]
 if(!selected)gaps.push('No retained weekly snapshot is available for this period')
 if(w.closed&&summary.actualCount<summary.count)gaps.push('Closed period actual coverage is incomplete: '+summary.actualCount+' of '+summary.count)
 const accuracy=w.closed&&filtered.length>0&&previous&&previous.expectedUsdMinor!==null&&summary.actualUsdMinor!==null&&baseline.length===filtered.length&&filtered.every(r=>baseline.some(b=>b.id===r.id))?{forecastUsdMinor:previous.expectedUsdMinor,actualUsdMinor:summary.actualUsdMinor,errorUsdMinor:summary.actualUsdMinor-previous.expectedUsdMinor,absoluteErrorUsdMinor:Math.abs(summary.actualUsdMinor-previous.expectedUsdMinor)}:null
 await db.batch([roleFence(db,actor,a.role),scopeFence(db,a.scope),guard(db,`(${IMAGE})=?`,current.raw),stmt(db,'DELETE FROM buoy_assertions')])
 return {window:w,records:filtered,baseline,summary,previous,snapshot:selected??null,snapshots:snapshots.filter(s=>!w.closed||s.evaluationDay<=w.end),movements,groups:{csms:grouping('ownerId'),teams:grouping('teamIds'),segments:grouping('segmentIds')},filters:{people:scopedPeople,teams:scopedTeams,segments:scopedSegments},accuracy,gaps,canSnapshot:!a.role.restricted&&['owner','admin'].includes(actor.role),interpretation:'Judgments over current retained sources, not guaranteed predictions or proof of causation. UTC month/quarter; expected and best case use open expected ARR plus known closed actuals, worst case uses commit plus known closed actuals. No probability weighting. Closed native actuals are human-approved outcomes; Stripe actuals require a later provider observation. Deferred, unclosed, stale or missing inputs remain explicit. USD converts each native amount at its renewal-date rate with half-up cents; each weekly snapshot retains its original rate and inputs. Accuracy compares the retained forecast with all closed actuals only for the same complete cohort. Current filters and access apply to both; current data is not historical reconstruction.'}
}
export async function overrideForecast(db:D1Database,actor:Actor,renewalId:string,input:Record<string,unknown>){
 const a=await access(db,actor),current=await image(db),record=records(current.value,now().slice(0,10)).find(r=>r.id===renewalId)
 insist(record&&mayOverride(actor,a,record),'This renewal is outside your forecast override authority.',403)
 insist(Object.keys(input).every(k=>['revision','category','reason'].includes(k)),'Unsupported override property.')
 const reason=text(input.reason,'Override reason',1000);insist(['commit','likely','at-risk'].includes(String(input.category)),'Choose commit, likely or at-risk.')
 const source=current.value.renewals.find(r=>r.id===renewalId)!
 insist(source.revision===input.revision&&!source.document.outcome,'Renewal changed or closed. Reload before overriding.',409)
 const override={from:source.document.forecast,to:String(input.category),reason,actor:'person:'+actor.id,at:now()},next={...source.document,forecast:input.category,forecastOverride:override}
 await db.batch([roleFence(db,actor,a.role),scopeFence(db,a.scope),guard(db,`(${IMAGE})=?`,current.raw),stmt(db,'UPDATE buoy_renewals SET document=?,revision=? WHERE id=?',JSON.stringify(next),id(),renewalId),stmt(db,'INSERT INTO buoy_renewal_history(id,record_id,field_key,old_value,new_value,actor,source,recorded_at) VALUES(?,?,?,?,?,?,?,?)',id(),renewalId,'forecast-override',JSON.stringify(source.document),JSON.stringify(next),'person:'+actor.id,'Reasoned forecast override',override.at),stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),record.accountId),...accountAudit(db,actor,record.accountId,'renewal.forecast-overridden'),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:renewalId,override}
}
export const forecastApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
forecastApi.get('/api/buoy/renewals/forecast',async c=>c.json(await forecastState(c.env.DB,c.get('actor'),new URL(c.req.url).searchParams)))
forecastApi.post('/api/buoy/renewals/forecast/snapshots',async c=>{await jsonBody(c.req.raw);return c.json(await snapshotForecast(c.env.DB,new Date(),c.get('actor')),201)})
forecastApi.post('/api/buoy/renewals/:id/forecast-override',async c=>c.json(await overrideForecast(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
