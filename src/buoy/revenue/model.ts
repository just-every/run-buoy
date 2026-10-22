import {date,id,insist,object,text} from '../core'
import {isCurrency} from '../currencies'
import type {ConfirmedContract,RecurringLine,Revenue,RevenueSourceKind,RevenueValues} from './types'

const keys=(row:Record<string,unknown>,allowed:string[])=>insist(Object.keys(row).every(key=>allowed.includes(key)),'Unsupported recurring contract property.')
function integer(value:unknown,label:string,min=0){
 insist(typeof value==='number'&&Number.isSafeInteger(value)&&value>=min,`${label} must be a safe whole number of at least ${min}.`)
 return value
}
function shortText(value:unknown,label:string,max:number){
 const result=text(value,label,max)
 insist(!/[\u0000-\u001f]/.test(result),`${label} cannot contain control characters.`)
 return result
}
function line(value:unknown):RecurringLine {
 const row=object(value);keys(row,['id','product','quantity','amountMinor','frequency','entitlements'])
 insist(row.frequency==='monthly'||row.frequency==='annual','Recurring frequency must be monthly or annual.')
 insist(typeof row.entitlements==='string'&&row.entitlements.length<=2000,'Entitlements must be text of at most 2000 characters.')
 return {id:row.id===undefined?id():shortText(row.id,'Line ID',100),product:shortText(row.product,'Product',200),quantity:integer(row.quantity,'Quantity',1),amountMinor:integer(row.amountMinor,'Period total in minor units'),frequency:row.frequency,entitlements:row.entitlements}
}
export function annualTotals(contract:ConfirmedContract){
 let arr=0n,seats=0n
 for(const item of contract.lines){arr+=BigInt(item.amountMinor)*(item.frequency==='monthly'?12n:1n);seats+=BigInt(item.quantity)}
 insist(arr<=BigInt(Number.MAX_SAFE_INTEGER),'Annual recurring total exceeds safe integer minor units.')
 insist(seats<=BigInt(Number.MAX_SAFE_INTEGER),'Purchased quantity total exceeds a safe integer.')
 return {arrMinor:Number(arr),seats:Number(seats)}
}
export function confirmedContract(value:unknown,on=new Date().toISOString().slice(0,10)):ConfirmedContract {
 const row=object(value);keys(row,['currency','contractStart','contractEnd','lines','source'])
 const currency=shortText(row.currency,'Currency',3);insist(isCurrency(currency),'Currency must be an ISO 4217 code with minor units.')
 const contractStart=date(row.contractStart,'Contract start'),contractEnd=date(row.contractEnd,'Contract end')
 insist(contractStart<=contractEnd,'Contract end must be on or after contract start.')
 insist(Array.isArray(row.lines)&&row.lines.length<=100,'Recurring lines must be an explicit array of at most 100 lines; an empty array confirms zero recurring revenue.')
 const lines=row.lines.map(line);insist(new Set(lines.map(item=>item.id)).size===lines.length,'Recurring line IDs must be unique.')
 const source=object(row.source);keys(source,['reference','confirmedOn'])
 const confirmedOn=date(source.confirmedOn,'Confirmation date');insist(confirmedOn<=on,'Confirmation date cannot be in the future.')
 const contract={currency,contractStart,contractEnd,lines,source:{reference:shortText(source.reference,'Confirmation reference',1000),confirmedOn}}
 annualTotals(contract)
 return contract
}
export function calculateRevenue(contract:ConfirmedContract|null,on:string,sourceKind:RevenueSourceKind|null=contract?'person-confirmed':null):Revenue {
 const day=date(on,'Revenue measurement date')
 const status=!contract?'missing':day<contract.contractStart?'scheduled':day>contract.contractEnd?'expired':'active'
 const totals=contract?annualTotals(contract):null,arrMinor=totals?(status==='active'?totals.arrMinor:0):null
 // BigInt avoids losing the half-up boundary near MAX_SAFE_INTEGER.
 const mrrMinor=arrMinor===null?null:Number((BigInt(arrMinor)+6n)/12n)
 return {arrMinor,mrrMinor,currency:contract?.currency??null,mrrExact:arrMinor===null?null:{numeratorMinor:arrMinor,denominator:12},mrrRounding:'half-up to whole native minor unit',
  products:contract?[...new Set(contract.lines.map(item=>item.product))]:null,seats:totals?(status==='active'?totals.seats:0):null,
  contractStart:contract?.contractStart??null,contractEnd:contract?.contractEnd??null,sourceKind,reference:contract?.source.reference??null,confirmedOn:contract?.source.confirmedOn??null,status,
  freshness:!contract?'missing':Date.parse(day)-Date.parse(contract.source.confirmedOn)>30*86400000?'stale':'current',staleAfterDays:30,
  amountMeaning:'Line amountMinor is the total for its billing period, not a unit price'}
}
export function revenueValues(revenue:Revenue):RevenueValues {
 return {'revenue.usdArrMinor':revenue.reporting?.arrMinor??null,'revenue.usdMrrMinor':revenue.reporting?.mrrMinor??null,'revenue.reportingCurrency':'USD','revenue.rateTableRevision':revenue.reporting?.rate?.tableRevision??null,'revenue.usdPerUnit':revenue.reporting?.rate?.usdPerUnit??null,'revenue.arrMinor':revenue.arrMinor,'revenue.mrrMinor':revenue.mrrMinor,'revenue.currency':revenue.currency,
  'revenue.products':revenue.products?.join('\n')??null,'revenue.seats':revenue.seats,'revenue.contractStart':revenue.contractStart,'revenue.contractEnd':revenue.contractEnd,
  'revenue.sourceKind':revenue.sourceKind,'revenue.reference':revenue.reference,'revenue.confirmedOn':revenue.confirmedOn,'revenue.status':revenue.status}
}
export const REVENUE_FIELDS:Record<string,'text'|'number'>={
 'revenue.usdArrMinor':'number','revenue.usdMrrMinor':'number','revenue.reportingCurrency':'text','revenue.rateTableRevision':'text','revenue.usdPerUnit':'text',
 'revenue.arrMinor':'number','revenue.mrrMinor':'number','revenue.currency':'text','revenue.products':'text','revenue.seats':'number',
 'revenue.contractStart':'text','revenue.contractEnd':'text','revenue.sourceKind':'text','revenue.reference':'text','revenue.confirmedOn':'text','revenue.status':'text'
}
