import {providerRetention,type RetentionRow,type SourceException} from './provider-retention'
import {PROVIDER_HISTORY_SQL,type ProviderVersion} from './provider'
import {authority,date,guard,insist} from '../core'
import type {Actor} from '../core'
import {SNAPSHOT,evaluated,definitions,type Image} from '../segments/snapshot'
import {includes} from '../segments/rules'
import {calculateRevenue} from './model'
import {revenueImageSql,parseRevenueImage,type RevenueImage} from './snapshot'
import {convertMinor,selectedRate,type RateTable} from './fx'
import type {ContractVersion} from './types'

const safe=(n:number)=>{insist(Number.isSafeInteger(n),'Report total exceeds safe integer minor units.');return n}
export function reportingWindow(query:URLSearchParams){
 insist([...query.keys()].every(k=>['period','end','segmentId','ownerId','tier','plan','cohort'].includes(k))&&[...query.keys()].every(k=>query.getAll(k).length===1),'Unsupported or repeated retention filter.')
 const period=query.get('period')??'quarter';insist(['month','quarter','ttm'].includes(period),'Choose month, quarter or ttm.')
 const today=new Date(),defaultEnd=new Date(Date.UTC(today.getUTCFullYear(),Math.floor(today.getUTCMonth()/3)*3,0)).toISOString().slice(0,10)
 const end=date(query.get('end')??defaultEnd,'Period end'),endDate=new Date(end)
 insist(end<=today.toISOString().slice(0,10),'Retention reports need an observed period, not a future projection.')
 insist(new Date(Date.parse(end)+86400000).getUTCDate()===1,'Period end must be the last UTC date of a month.')
 if(period==='quarter')insist((endDate.getUTCMonth()+1)%3===0,'Quarter reports end in March, June, September or December.')
 const start=new Date(Date.UTC(endDate.getUTCFullYear(),endDate.getUTCMonth()-(period==='ttm'?11:period==='quarter'?2:0),1)).toISOString().slice(0,10)
 return {period,start,end,basisOn:new Date(Date.parse(start)-86400000).toISOString().slice(0,10)}
}
function selected(versions:ContractVersion[],on:string){
 return versions.filter(v=>v.contract.source.confirmedOn<=on).sort((a,b)=>b.contract.source.confirmedOn.localeCompare(a.contract.source.confirmedOn)||b.recordedAt.localeCompare(a.recordedAt)||b.id.localeCompare(a.id))[0]??null
}
const HISTORY_SQL=`SELECT json_group_array(json_object('id',id,'accountId',account_id,'revision',revision,'sourceKind',source_kind,'document',document,'recordedBy',recorded_by,'recordedAt',recorded_at)) FROM(SELECT * FROM buoy_recurring_contract_versions ORDER BY recorded_at DESC,id DESC)`
export async function retentionReport(db:D1Database,actor:Actor,query:URLSearchParams,accountAllowlist?:readonly string[],readFences:D1PreparedStatement[]=[]){
 insist(actor.kind==='person'&&['owner','admin','member'].includes(actor.role),'Retention reports require a staff session.',403)
 const window=reportingWindow(query)
 // All report sources, rate versions and filter membership come from one read transaction.
 const result=(await db.batch<Record<string,unknown>>([...readFences,authority(db,actor),db.prepare(revenueImageSql(window.end)),db.prepare('SELECT id,account_id AS accountId,revision,source_kind AS sourceKind,document,recorded_by AS recordedBy,recorded_at AS recordedAt FROM buoy_recurring_contract_versions ORDER BY recorded_at DESC,id DESC'),db.prepare(SNAPSHOT),db.prepare('SELECT ('+PROVIDER_HISTORY_SQL+') AS snapshot'),db.prepare('DELETE FROM buoy_assertions')])).slice(readFences.length)
 const raw=String(result[1].results[0].snapshot),revenueImage=JSON.parse(raw) as Exclude<RevenueImage,unknown[]>,rates:RateTable=revenueImage.rateDocument?{...JSON.parse(revenueImage.rateDocument),revision:revenueImage.rateVersionId}:{name:'Corporate budget rates',mode:'corporate',rates:[],revision:null}
 const allowed=accountAllowlist===undefined?null:new Set(accountAllowlist)
 // Scope the source rows before parsing report money, selecting versions,
 // matching requested filters or collecting exceptions. A hidden record never
 // contributes a report total.
 const scopedRevenue=allowed?{...revenueImage,accounts:revenueImage.accounts.filter(row=>allowed.has(row.accountId))}:revenueImage
 const history=result[2].results as unknown as {id:string;accountId:string;revision:string;sourceKind:string;document:string;recordedBy:string;recordedAt:string}[],historyRaw=JSON.stringify(history.map(row=>({id:row.id,accountId:row.accountId,revision:row.revision,sourceKind:row.sourceKind,document:row.document,recordedBy:row.recordedBy,recordedAt:row.recordedAt})))
 const data={accounts:parseRevenueImage(JSON.stringify(scopedRevenue),window.end),versions:history.filter(row=>!allowed||allowed.has(row.accountId)).map(({document,...row})=>({...row,contract:JSON.parse(document)}) as unknown as ContractVersion)}
 // Native formulas need their complete graph (including terminal descendants).
 // Keep that context internal, then scope its account rows before any requested
 // segment/owner/tier filter is matched or any exception/detail is assembled.
 const sourceRaw=String(result[3].results[0].snapshot),image=JSON.parse(sourceRaw) as Image
 const current=evaluated(image,new Date().toISOString().slice(0,10)).filter(row=>!allowed||allowed.has(row.account.id)),segmentId=query.get('segmentId'),segment=segmentId?definitions(image).find(s=>s.id===segmentId):null

 insist(!segmentId||segment,'Report segment not found.',404)
 const accounts=data.accounts.filter(a=>{const row=current.find(r=>r.account.id===a.accountId)!;return (!segment||includes(segment,a.accountId,row.values,row.people))&&(!query.has('ownerId')||row.values.ownerId===query.get('ownerId'))&&(!query.has('tier')||row.tier===query.get('tier'))})
 const providerRaw=String(result[4].results[0].snapshot),providerHistory=(JSON.parse(providerRaw) as ProviderVersion[]).filter(v=>!allowed||allowed.has(v.accountId))
 const exceptions:SourceException[]=[],blockedCurrencies=new Set<string>()
 const rows:RetentionRow[]=accounts.flatMap((account):RetentionRow[]=>{
  const versions=data.versions.filter(v=>v.accountId===account.accountId),start=selected(versions,window.basisOn),end=selected(versions,window.end)
  if(!versions.length&&revenueImage.billing?.some(v=>v.accountId===account.accountId)){const live=revenueImage.billing?.find(b=>b.accountId===account.accountId);if(live&&(live.disconnectedAt||!live.credentialPresent||live.lastError))exceptions.push({accountId:account.accountId,name:account.name,reason:'Stripe source requires reconnection or its latest read failed. Historical amounts are retained evidence with reduced confidence.'});const provider=providerRetention({accountId:account.accountId,name:account.name},providerHistory,window,rates);exceptions.push(...provider.exceptions);return provider.rows.filter(r=>(!query.has('cohort')||r.cohort===query.get('cohort'))&&(!query.has('plan')||r.products.includes(query.get('plan')!)))}
  if(!end){if(versions.length||current.find(a=>a.account.id===account.accountId)?.account.billing)exceptions.push({accountId:account.accountId,name:account.name,reason:'No confirmed recurring source at the period end; invoice snapshots cannot supply ARR.'});return []}
  const cohort=versions.map(v=>v.contract.contractStart).sort()[0]?.slice(0,7)
  if(query.has('cohort')&&cohort!==query.get('cohort'))return []
  if(query.has('plan')&&![...(start?.contract.lines??[]),...end.contract.lines].some(l=>l.product===query.get('plan')))return []
  if(start&&start.contract.currency!==end.contract.currency){blockedCurrencies.add(start.contract.currency);blockedCurrencies.add(end.contract.currency);exceptions.push({accountId:account.accountId,name:account.name,reason:'Native currency changed inside the period; review the source history. No cross-currency adjustment is inferred.'});return []}
  const currency=end.contract.currency,startMinor=start?calculateRevenue(start.contract,window.basisOn,start.sourceKind).arrMinor!:0,endMinor=calculateRevenue(end.contract,window.end,end.sourceKind).arrMinor!,inCohort=startMinor>0
  const earlier=versions.some(v=>v.contract.source.confirmedOn<window.start&&calculateRevenue(v.contract,v.contract.source.confirmedOn,v.sourceKind).arrMinor!>0)
  const movement=inCohort?(endMinor===0?'churn':endMinor>startMinor?'expansion':endMinor<startMinor?'contraction':'unchanged'):endMinor>0?(earlier?'reactivation':'new'):'zero'
  const startRate=selectedRate(rates,currency,window.basisOn),endRate=selectedRate(rates,currency,window.end),usdStart=convertMinor(startMinor,currency,startRate),usdEndConstant=convertMinor(endMinor,currency,startRate),usdEnd=convertMinor(endMinor,currency,endRate)
  if(!startRate||!endRate)exceptions.push({accountId:account.accountId,name:account.name,reason:'Missing '+currency+' USD rate at '+(!startRate?window.basisOn:window.end)+'. Native figures remain available; USD totals are unavailable.'})
  return [{accountId:account.accountId,name:account.name,currency,cohort,products:[...new Set(end.contract.lines.map(l=>l.product))],inCohort,movement,startMinor,endMinor,usdStartMinor:usdStart,usdEndConstantMinor:usdEndConstant,usdEndMinor:usdEnd,fxMinor:usdEnd===null||usdEndConstant===null?null:safe(usdEnd-usdEndConstant),startRate,endRate,startSource:start,endSource:end,startReference:start?.contract.source.reference??'No starting confirmation',endReference:end.contract.source.reference,sourceLinks:[],href:'/app/accounts/'+encodeURIComponent(account.accountId)+'#contract-history'}]
 })
 function totals(currency:string,usd=false){
  const selected=usd?rows:rows.filter(r=>r.currency===currency),cohort=selected.filter(r=>r.inCohort)
  const available=usd?blockedCurrencies.size===0&&selected.every(r=>r.usdStartMinor!==null&&r.usdEndConstantMinor!==null&&r.usdEndMinor!==null):!blockedCurrencies.has(currency)
  const amount=(r:typeof rows[number],end=false)=>usd?(end?r.usdEndConstantMinor!:r.usdStartMinor!):(end?r.endMinor:r.startMinor)
  const sum=(values:number[])=>values.reduce((s,v)=>safe(s+v),0)
  const startMinor=available?sum(cohort.map(r=>amount(r))):null,endCohortMinor=available?sum(cohort.map(r=>amount(r,true))):null
  const grossMinor=available?sum(cohort.map(r=>Math.min(amount(r),amount(r,true)))):null
  return {currency,available,startMinor,endCohortMinor,grossMinor,expansionMinor:available?sum(cohort.map(r=>Math.max(0,amount(r,true)-amount(r)))):null,contractionMinor:available?sum(cohort.filter(r=>r.endMinor>0).map(r=>Math.max(0,amount(r)-amount(r,true)))):null,churnMinor:available?sum(cohort.filter(r=>r.endMinor===0).map(r=>amount(r))):null,newMinor:available?sum(selected.filter(r=>r.movement==='new').map(r=>amount(r,true))):null,reactivationMinor:available?sum(selected.filter(r=>r.movement==='reactivation').map(r=>amount(r,true))):null,endPortfolioMinor:available?sum(selected.map(r=>usd?r.usdEndMinor!:r.endMinor)):null,fxMinor:usd&&available?sum(selected.map(r=>r.fxMinor!)):usd?null:0,nrr:startMinor?{numeratorMinor:endCohortMinor!,denominatorMinor:startMinor}:null,grr:startMinor?{numeratorMinor:grossMinor!,denominatorMinor:startMinor}:null,logoRetention:{retained:(usd?blockedCurrencies.size===0:!blockedCurrencies.has(currency))?new Set(cohort.filter(r=>r.endMinor>0).map(r=>r.accountId)).size:null,starting:(usd?blockedCurrencies.size===0:!blockedCurrencies.has(currency))?new Set(cohort.map(r=>r.accountId)).size:null}}
 }
 const report={window,filters:Object.fromEntries(query),count:new Set(rows.map(r=>r.accountId)).size,cohortCount:new Set(rows.filter(r=>r.inCohort).map(r=>r.accountId)).size,rateTable:{name:rates.name,revision:rates.revision},native:[...new Set([...rows.map(r=>r.currency),...blockedCurrencies])].sort().map(c=>totals(c)),usd:totals('USD',true),rows,exceptions,
  reconciliation:rows.some(r=>'sourceReference' in r.endSource)?'retained-stripe-reads-and-invoice-exceptions':'unavailable-person-confirmed-sources-only',interpretation:'Person-confirmed terms take precedence when present; otherwise exact reviewed Stripe bindings supply retained provider reads. Native sources remain separate. Stripe history uses actual read instants, never reconstructed backdating. Starting ARR cohort is positive ARR on the UTC day before the period. End ARR uses the last confirmation dated on or before each boundary; same-day ties use recording time then version ID. Terms count through their inclusive end. New and reactivated logos are shown separately and excluded from retention numerators. USD movements use the starting-boundary rate for both amounts; ending-rate difference is FX only. Missing sources and rates and currency changes are exceptions, never adjustments. Segment, CSM and tier filters use current membership and assignment; plan matches either boundary and cohort is earliest confirmed contract start month. Stripe invoice exceptions do not alter ARR; actual retained invoices and subscription reads remain linked. Other billing sources inherit the same acceptance before shipping.'}
 if(accountAllowlist!==undefined)await db.batch([...readFences,guard(db,`(${revenueImageSql(window.end)})=?`,raw),guard(db,`(${HISTORY_SQL})=?`,historyRaw),guard(db,`(${PROVIDER_HISTORY_SQL})=?`,providerRaw),guard(db,`(${SNAPSHOT})=?`,sourceRaw),db.prepare('DELETE FROM buoy_assertions')])
 if(accountAllowlist!==undefined||actor.role==='member')for(const row of report.rows){if('sourceReference' in row.endSource){row.href='/app/accounts/'+encodeURIComponent(row.accountId);row.sourceLinks=row.sourceLinks.map(l=>({...l,href:row.href}))}}
 return report
}
