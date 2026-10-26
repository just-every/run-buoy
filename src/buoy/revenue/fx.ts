import {auditRecord} from '../audit-records'
import {authority,date,guard,id,insist,now,object,requirePerson,stmt,text,type Actor} from '../core'
import {minorUnitDigits} from '../currencies'
import type {Revenue} from './types'

export interface Rate {currency:string;from:string;to:string;usdPerUnit:string;source:string}
export interface RateTable {name:string;mode:'corporate'|'daily';rates:Rate[];revision:string|null}
const keys=(o:Record<string,unknown>,allowed:string[])=>insist(Object.keys(o).every(k=>allowed.includes(k)),'Unsupported rate-table property.')
const EMPTY:RateTable={name:'Corporate budget rates',mode:'corporate',rates:[],revision:null}
function decimal(value:unknown){
 insist(typeof value==='string'&&/^(0|[1-9]\d{0,8})(\.\d{1,12})?$/.test(value),'USD per native major unit must be positive decimal text with at most 12 fractional places.')
 const [whole,fraction='']=value.split('.'),numerator=BigInt(whole+fraction),denominator=10n**BigInt(fraction.length)
 insist(numerator>0n,'A conversion rate must be greater than zero.')
 return {numerator,denominator}
}
export function rateTable(input:unknown):Omit<RateTable,'revision'>{
 const row=object(input);keys(row,['name','mode','rates']);insist(row.mode==='corporate'||row.mode==='daily','Choose corporate or daily rates.')
 insist(Array.isArray(row.rates)&&row.rates.length<=2000,'Use at most 2000 explicit rate periods.')
 const rates=row.rates.map(value=>{
  const r=object(value);keys(r,['currency','from','to','usdPerUnit','source'])
  insist(typeof r.currency==='string'&&minorUnitDigits(r.currency)!==undefined&&r.currency!=='USD','Choose an ISO 4217 native currency other than USD; USD is always exactly 1.')
  const from=date(r.from,'Rate effective from'),to=date(r.to,'Rate effective through');insist(from<=to,'Rate period ends before it starts.')
  if(row.mode==='corporate')insist(Date.parse(to)-Date.parse(from)>=364*86400000&&Date.parse(to)-Date.parse(from)<=365*86400000,'A fixed corporate fiscal-year period must cover 365 or 366 inclusive days.')
  else insist(from===to&&['European Central Bank reference rates','Open Exchange Rates'].includes(String(r.source)),'Daily rates need one UTC date and the named ECB or Open Exchange Rates source.')
  decimal(r.usdPerUnit)
  return {currency:r.currency,from,to,usdPerUnit:r.usdPerUnit as string,source:text(r.source,'Rate author/source reference',1000)}
 }).sort((a,b)=>a.currency.localeCompare(b.currency)||a.from.localeCompare(b.from))
 for(let i=1;i<rates.length;i++)insist(rates[i].currency!==rates[i-1].currency||rates[i].from>rates[i-1].to,'Effective rate periods for a currency must not overlap, including their endpoints.')
 return {name:text(row.name,'Rate table name',100),mode:row.mode,rates}
}
export function selectedRate(table:RateTable,currency:string,on:string){
 if(currency==='USD')return {currency:'USD',from:on,to:on,usdPerUnit:'1',source:'USD identity rate',tableName:table.name,tableRevision:table.revision}
 const rate=table.rates.find(r=>r.currency===currency&&r.from<=on&&r.to>=on)
 return rate?{...rate,tableName:table.name,tableRevision:table.revision}:null
}
/** Exact integer arithmetic; source amount is never rewritten. Signed half-up is away from zero. */
export function convertMinor(amount:number,currency:string,rate:ReturnType<typeof selectedRate>,divisor=1n){
 if(!rate)return null
 insist(Number.isSafeInteger(amount),'Native minor-unit amount exceeds a safe integer.')
 return convertExactMinor({numeratorMinor:String(amount),denominator:String(divisor)},currency,rate)
}
export function convertExactMinor(amount:{numeratorMinor:string;denominator:string},currency:string,rate:ReturnType<typeof selectedRate>){
 if(!rate)return null
 const digits=minorUnitDigits(currency);insist(digits!==undefined,'Native currency has no supported minor unit.')
 insist(/^-?\d+$/.test(amount.numeratorMinor)&&/^[1-9]\d*$/.test(amount.denominator),'Invalid exact source amount.')
 const {numerator,denominator}=decimal(rate.usdPerUnit),value=BigInt(amount.numeratorMinor)*numerator*100n,denom=denominator*10n**BigInt(digits)*BigInt(amount.denominator),absolute=value<0n?-value:value
 const rounded=(absolute*2n+denom)/(2n*denom),signed=value<0n?-rounded:rounded
 insist(signed<=BigInt(Number.MAX_SAFE_INTEGER)&&signed>=BigInt(Number.MIN_SAFE_INTEGER),'Converted USD cents exceed a safe integer.')
 return Number(signed)
}
export function reportingRevenue(revenue:Revenue,table:RateTable,on:string){
 const rate=revenue.currency?selectedRate(table,revenue.currency,on):null
 return {currency:'USD' as const,arrMinor:revenue.arrMinor===null||!revenue.currency?null:convertMinor(revenue.arrMinor,revenue.currency,rate),mrrMinor:revenue.arrMinor===null||!revenue.currency?null:convertMinor(revenue.arrMinor,revenue.currency,rate,12n),rate,rounding:'half-up to USD cents; MRR converts exact ARR/12' as const}
}
export async function fxState(db:D1Database){
 const current=await db.prepare('SELECT v.id,v.document FROM buoy_fx_current c JOIN buoy_fx_versions v ON v.id=c.version_id WHERE c.singleton=1').first<{id:string;document:string}>()
 const history=(await db.prepare('SELECT id,document,published_by AS publishedBy,published_at AS publishedAt FROM buoy_fx_versions ORDER BY published_at DESC,id DESC').all<{id:string;document:string;publishedBy:string;publishedAt:string}>()).results.map(({document,...r})=>({...r,table:JSON.parse(document) as Omit<RateTable,'revision'>}))
 return {table:current?{...JSON.parse(current.document),revision:current.id} as RateTable:EMPTY,history,interpretation:'Rates convert one native major unit to USD. Effective UTC dates include both endpoints. Corporate rates are fixed for the stated fiscal-year period; daily rates are manually recorded from the named source, not automatically fetched or provider-verified. Missing rates stay unavailable. Edits restate reporting, preserve native records and retained rate versions, and invalidate pending account approvals.'}
}
export async function publishRates(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor);keys(input,['revision','table']);const next=rateTable(input.table),current=(await fxState(db)).table
 insist(input.revision===current.revision,'Rate table changed. Reload before publishing.',409)
 const version=id(),at=now()
 await db.batch([authority(db,actor,true),guard(db,'(SELECT version_id FROM buoy_fx_current WHERE singleton=1) IS ?',current.revision),stmt(db,'INSERT INTO buoy_fx_versions(id,document,published_by,published_at) VALUES(?,?,?,?)',version,JSON.stringify(next),'person:'+actor.id,at),stmt(db,'INSERT INTO buoy_fx_current(singleton,version_id) VALUES(1,?) ON CONFLICT(singleton) DO UPDATE SET version_id=excluded.version_id',version),stmt(db,'UPDATE buoy_accounts SET revision=lower(hex(randomblob(16)))'),auditRecord(db,actor,'revenue.rates-published','rate-table:'+version),stmt(db,'DELETE FROM buoy_assertions')])
 return {revision:version,table:next,publishedBy:'person:'+actor.id,publishedAt:at}
}
