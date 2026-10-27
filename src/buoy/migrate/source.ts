import {churnzeroHealth,healthFields} from './churnzero-health'
import { csvRows } from './csv'
import {totangoApiRows} from './totango-api'
import {referenceRecords} from './references'
import { sha256 } from '../../modules/import-kit/src/d1/index.ts'
import type { Json, ParsedRecord, ImportMapping } from '../../modules/import-kit/src/d1/index.ts'
import { parseAccount } from '../imports/validation'
import { KIND } from '../imports/source'
import { minorUnitDigits } from '../currencies'
export const migrationSources = ['vitally', 'velaris', 'csv', 'totango', 'churnzero'] as const
export type MigrationSource = typeof migrationSources[number]
export const migrationNamespace = (source: MigrationSource) => `buoy-migrate-${source}-v1`
export const migrationSource = (value: string | null): MigrationSource | undefined => migrationSources.find(source => source === value)
export const migrationTarget = (source: MigrationSource, id: string) => 'migration_' + sha256(JSON.stringify([source, id])).slice(0, 40)
const fields = ['id','name','renewalDate','noticeDays','renewalEvidence','invoiceTotal','invoiceCurrency','invoiceObservedAt','invoiceDueDate','supportObservedAt','supportReference','openTickets','urgentTickets'] as const
function object(value: unknown): Record<string, unknown> {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.')
 return value as Record<string, unknown>
}
function realDate(value: unknown, order: unknown): string {
 if (typeof value !== 'string') throw new Error('Date must be text.')
 const text = value.trim(), match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
 let result = text
 if (match && ['day-first','month-first'].includes(String(order))) {
  const [day,month] = order === 'day-first' ? [match[1],match[2]] : [match[2],match[1]]
  result = `${match[3]}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`
 }
 if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0,10) !== result) throw new Error('Date must be a real calendar date in the selected date order.')
 return result
}
function money(value: unknown, currency: string): number {
 const digits = minorUnitDigits(currency)
 if (digits === undefined) throw new Error('Currency must be an ISO 4217 code with minor units.')
 if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value.trim())) throw new Error('Invoice amount must be nonnegative decimal text without separators or symbols.')
 const [whole, fraction = ''] = value.trim().split('.')
 if (fraction.length > digits) throw new Error('Invoice amount has too many decimal places for its currency.')
 const amount = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits,'0') || '0')
 if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invoice amount exceeds exact integer minor units.')
 return Number(amount)
}
function rejection(id: string, reason: string, pointer: string): ParsedRecord {
 return {kind:'migration-rejected',sourceId:id,payload:{reason},pointer}
}
export function parseMigration(value: Json, source: MigrationSource): ParsedRecord[] {
 try {
  const bundle = object(value)
  if (Object.keys(bundle).some(key=>!['format','source','dateOrder','columns','csv','originalSha256','data','exportText','api','references'].includes(key))) throw new Error('Unsupported migration bundle field.')
  if (bundle.format !== 'buoy-migration-v1' || bundle.source !== source) throw new Error('Choose a matching versioned migration bundle.')
  if (!['iso','day-first','month-first'].includes(String(bundle.dateOrder))) throw new Error('Choose iso, day-first or month-first date order.')
  if(bundle.references!==undefined&&source!=='totango')throw new Error('Reference files are supported only for Totango account bundles.')
  const references=referenceRecords(bundle.references)
  let rows: Record<string,unknown>[], columns: Record<string,unknown>, pointers: string[]
  let exportData: Record<string,unknown> | undefined
  if(bundle.api!==undefined){
   if(source!=='totango'||bundle.csv!==undefined||bundle.data!==undefined||bundle.exportText!==undefined||bundle.originalSha256!==undefined)throw new Error('Totango API bundles cannot contain a second export representation.')
   const parsed=totangoApiRows(bundle.api);rows=parsed.rows;pointers=parsed.pointers;columns=object(bundle.columns)
   for(const [key,column]of Object.entries(columns))if(!fields.includes(key as typeof fields[number])||typeof column!=='string'||!column.trim())throw new Error('Invalid Totango API field mapping.')
   const selected=Object.values(columns);if(new Set(selected).size!==selected.length)throw new Error('Each Totango source field maps to only one destination field.')
  }else if (source === 'csv' || source === 'totango' || source === 'churnzero') {
   if (bundle.data !== undefined || bundle.exportText !== undefined) throw new Error('CSV bundles cannot contain a second export representation.')
   if (typeof bundle.csv !== 'string' || sha256(bundle.csv) !== bundle.originalSha256) throw new Error('Original CSV digest does not match its embedded UTF-8 text.')
   const [header,...data] = csvRows(bundle.csv); columns = object(bundle.columns)
   for (const [key,column] of Object.entries(columns)) {
    const factorColumns=source==='churnzero'&&key==='churnScoreFactors'&&column&&typeof column==='object'&&!Array.isArray(column)
    const selected=factorColumns?Object.values(column):[column]
    if((!(fields as readonly string[]).includes(key)&&!(source==='churnzero'&&(healthFields as readonly string[]).includes(key)))||!selected.length||selected.some(value=>typeof value!=='string'||!header.includes(value)))throw new Error('Column mapping names an unsupported field or missing header.')
   }
   const selected = Object.values(columns).flatMap(value=>value&&typeof value==='object'?Object.values(value):[value])
   if (new Set(selected).size !== selected.length) throw new Error('Each selected column maps to only one destination field.')
   rows = data.map(row => row.length === header.length ? Object.fromEntries(header.map((key,i)=>[key,row[i]])) : {__invalidRow:true})
   pointers = data.map((_,i)=>['','csv','rows',i+2].join('/'))
  } else {
   if (bundle.csv !== undefined) throw new Error('Incumbent bundles cannot contain CSV data.')
   if (bundle.exportText !== undefined && (typeof bundle.exportText !== 'string' || sha256(bundle.exportText) !== bundle.originalSha256 || bundle.data !== undefined)) throw new Error('Original export digest is invalid or the bundle has two export representations.')
   const data = object(bundle.exportText === undefined ? bundle.data : JSON.parse(String(bundle.exportText).replace(/^\uFEFF/,'')))
   exportData = data
   if (!Array.isArray(data.accounts) || !data.accounts.length || data.accounts.length > 2000) throw new Error('Export must contain 1 to 2000 accounts.')
   columns = bundle.columns === undefined ? Object.fromEntries(fields.map(field=>[field,field])) : object(bundle.columns)
   for (const [key,column] of Object.entries(columns)) if (!fields.includes(key as typeof fields[number]) || typeof column !== 'string' || !column.trim()) throw new Error('Invalid export column mapping.')
   rows = data.accounts as Record<string,unknown>[]; pointers = rows.map((_,i)=>['','data','accounts',i].join('/'))
  }
  for (const field of ['id','name','renewalDate','noticeDays','renewalEvidence']) if (!columns[field]) throw new Error(`Map the required ${field} column.`)
  const ids = rows.map(row => { try { return String(object(row)[String(columns.id)] ?? '').trim() } catch { return '' } })
  const counts = new Map<string,number>(); ids.forEach(id=>counts.set(id,(counts.get(id)??0)+1))
  const records = rows.map((raw,i): ParsedRecord => {
   const id = ids[i], pointer = pointers[i]
   try {
    const row = object(raw), rawId = row[String(columns.id)]
    if (row.__invalidRow) throw new Error('CSV row has a different number of columns from its header.')
    if (typeof rawId !== 'string' && !(typeof rawId === 'number' && Number.isSafeInteger(rawId))) throw new Error('Source ID must be text or an exact integer.')
    if (!id || id.length > 200 || /[\u0000-\u001f]/.test(id)) throw new Error('Source ID must be nonempty text of at most 200 characters.')
    if (counts.get(id)!==1) throw new Error('Duplicate source ID; every occurrence is rejected.')
    const get = (field: string) => row[String(columns[field])] ?? ''
    const notice = String(get('noticeDays')).trim()
    if (!/^\d+$/.test(notice)) throw new Error('Notice days must be a nonnegative whole number.')
    const invoiceFields = ['invoiceTotal','invoiceCurrency','invoiceObservedAt','invoiceDueDate']
    const hasInvoice = invoiceFields.some(field => String(get(field)).trim() !== '')
    const currency = String(get('invoiceCurrency')).trim().toUpperCase()
    const supportFields = ['supportObservedAt','supportReference','openTickets','urgentTickets']
    const hasSupport = supportFields.some(field => String(get(field)).trim() !== '')
    const ticketCount = (field: string) => {const value=String(get(field)).trim();if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('Ticket counts must be exact nonnegative whole numbers.');return Number(value)}
    const support = hasSupport ? {observedAt:realDate(get('supportObservedAt'),bundle.dateOrder),reference:get('supportReference'),openTickets:ticketCount('openTickets'),urgentTickets:ticketCount('urgentTickets')} : null
    const account = parseAccount({id:migrationTarget(source,id),name:get('name'),renewalDate:realDate(get('renewalDate'),bundle.dateOrder),noticeDays:Number(notice),renewalEvidence:get('renewalEvidence'),support,
     billing:hasInvoice ? {observedAt:realDate(get('invoiceObservedAt'),bundle.dateOrder),reference:`${source} account ${id}`,currency,totalMinor:money(get('invoiceTotal'),currency),creditsMinor:0,allocatedMinor:0,dueDate:realDate(get('invoiceDueDate'),bundle.dateOrder)} : null})
    const migrationHealth=source==='churnzero'?churnzeroHealth(row,columns,id):undefined
    const nativeAccount={...account,...(migrationHealth?{migrationHealth}:{})}
    const used = new Set(Object.values(columns).flatMap(value=>value&&typeof value==='object'?Object.values(value):[value]).map(String)), unmapped = Object.keys(row).filter(key=>!used.has(key))
    return {kind:KIND,sourceId:id,payload:{account:nativeAccount as unknown as Json,unmapped},pointer}
   } catch (error) { return rejection(`row-${i+1}`,error instanceof Error ? error.message : 'Invalid migration row.',pointer) }
  })
  if (source !== 'csv' && source !== 'totango' && source !== 'churnzero') {
   for (const [kind,items] of Object.entries(exportData!)) if (kind !== 'accounts') {
    const count = Array.isArray(items) ? items.length : 1
    records.push({kind:'migration-unmapped',sourceId:`collection-${kind}`,payload:{collection:kind,count,reason:'This record kind is not mapped. No native records or automation are created.'},pointer:['','data',kind.replaceAll('~','~0').replaceAll('/','~1')].join('/')})
   }
  }
  return [...records,...references]
 } catch (error) { return [rejection('bundle',error instanceof Error ? error.message : 'Invalid migration bundle.','')] }
}
export const migrationMapping: ImportMapping = {version:'migration-v1',map(record) {
 const payload = object(record.payload)
 if (record.kind === 'migration-rejected') return {effects:[],rejection:String(payload.reason)}
 if (record.kind === 'migration-reference') return {effects:[],unmapped:(payload.fields as string[]).map(field=>({field:String(payload.name)+'#'+field,reason:String(payload.kind)+': source element retained without native mapping; no playbook or automation is created. A genuine definition schema and supported mapping remain required.'}))}
 if (record.kind === 'migration-unmapped') return {effects:[],unmapped:[{field:String(payload.collection),reason:`${payload.count} source records: ${payload.reason}`}]}
 if (record.kind !== KIND) return {effects:[],rejection:'Unsupported migration record.'}
 return {effects:[{targetKind:KIND,targetId:String(object(payload.account).id),value:payload.account as Json}],
  unmapped:(payload.unmapped as string[]).map(field=>({field,reason:'Source field retained in import custody; no native field mapping.'}))}
}}
