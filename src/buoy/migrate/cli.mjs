#!/usr/bin/env node
// Prepare a lossless migration bundle for the existing reviewed Imports screen.
import {csvRows} from './csv.ts'
import {acquireTotango} from './totango-api.ts'
import {referenceRecords,referenceKinds} from './references.ts'
import {assertNoCredentials} from '../../modules/import-kit/src/provenance/credentials.ts'
import {readFile,writeFile} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {createInterface} from 'node:readline/promises'
const flags = new Map()
for(let i=2;i<process.argv.length;i+=2) {
 const name=process.argv[i], value=process.argv[i+1]
 if(!['--source','--input','--output','--columns','--date-order','--api-query','--region','--references'].includes(name)||!value||flags.has(name))throw new Error('Use --source, --input, --output, optional --columns JSON, --date-order and --references manifest.')
 flags.set(name,value)
}
const source=flags.get('--source'), input=flags.get('--input'), output=flags.get('--output'), dateOrder=flags.get('--date-order')??'iso'
if(!['csv','vitally','velaris','totango','churnzero'].includes(source)||(!input&&!flags.has('--api-query'))||(input&&flags.has('--api-query'))||!output||!['iso','day-first','month-first'].includes(dateOrder))throw new Error('Choose csv, totango, churnzero, vitally or velaris, input and output files, and an explicit date order.')
let references
if(flags.has('--references')){
 if(source!=='totango')throw new Error('--references requires --source totango.')
 const manifestPath=resolve(flags.get('--references')),manifest=JSON.parse(await readFile(manifestPath,'utf8'))
 if(!Array.isArray(manifest)||!manifest.length||manifest.length>10)throw new Error('The reference manifest must list 1 to 10 files.')
 references=[]
 for(const entry of manifest){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(key=>!['name','kind','path'].includes(key))||typeof entry.path!=='string'||!referenceKinds.includes(entry.kind))throw new Error('Each reference needs name, kind and path.')
  const bytes=await readFile(resolve(dirname(manifestPath),entry.path))
  if(bytes.length>2_000_000)throw new Error('Reference file exceeds the migration source bound.')
  references.push({name:entry.name,kind:entry.kind,text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),sha256:createHash('sha256').update(bytes).digest('hex')})
 }
 // Validate all references before writing any bundle. The server uses this same parser.
 for(const record of referenceRecords(references))assertNoCredentials(record.payload)
}
if(flags.has('--api-query')){
 if(source!=='totango'||!flags.has('--columns'))throw new Error('Totango API acquisition requires explicit --columns and --source totango.')
 const query=JSON.parse(await readFile(flags.get('--api-query'),'utf8'))
 const api=await acquireTotango(query,flags.get('--region')??'us',process.env.BUOY_TOTANGO_APP_TOKEN??'')
 const bundle={format:'buoy-migration-v1',source,dateOrder,columns:JSON.parse(flags.get('--columns')),api,...(references?{references}:{})}
 const encoded=JSON.stringify(bundle)
 if(Buffer.byteLength(encoded)>2_000_000)throw new Error('Prepared API bundle exceeds 2 MB; narrow the source segment.')
 await writeFile(output,encoded,{mode:0o600,flag:'wx'})
 console.log('Totango account API bundle prepared. No native records changed. Upload in Imports and review its exact fingerprint before applying.')
 process.exit(0)
}
if(flags.has('--region'))throw new Error('--region applies only to Totango API acquisition.')
const bytes=await readFile(input)
if(bytes.length>2_000_000)throw new Error('Source exceeds the 2 MB migration bundle bound.')
const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)
const csvSource=source==='csv'||source==='totango'||source==='churnzero'
const header=csvSource?csvRows(text)[0]:null
if(!csvSource)JSON.parse(text.replace(/^\uFEFF/,''))
let columns=flags.has('--columns')?JSON.parse(flags.get('--columns')):undefined
if(csvSource&&!columns) {
 if(!process.stdin.isTTY)throw new Error('Pass --columns JSON when no interactive terminal is available.')
 const terminal=createInterface({input:process.stdin,output:process.stdout}); columns={}
 try {
  console.log('Available source headers: '+JSON.stringify(header))
  console.log('Enter exact source header names. Required fields cannot be left blank; optional invoice and support fields may be skipped.')
  for(const field of ['id','name','renewalDate','noticeDays','renewalEvidence','invoiceTotal','invoiceCurrency','invoiceObservedAt','invoiceDueDate','supportObservedAt','supportReference','openTickets','urgentTickets']) {
   const answer=(await terminal.question(`${field}: `)).trim()
   if(answer)columns[field]=answer
   else if(['id','name','renewalDate','noticeDays','renewalEvidence'].includes(field))throw new Error(`A source header is required for ${field}.`)
  }
 } finally {terminal.close()}
}
const bundle={format:'buoy-migration-v1',source,dateOrder,...(references?{references}:{}),...(columns?{columns}:{}),...(csvSource?{csv:text,originalSha256:createHash('sha256').update(bytes).digest('hex')}:{exportText:text,originalSha256:createHash('sha256').update(bytes).digest('hex')})}
const encoded=JSON.stringify(bundle)
if(Buffer.byteLength(encoded)>2_000_000)throw new Error('Prepared bundle exceeds 2 MB; split the source into smaller reviewed bundles.')
await writeFile(output,encoded,{mode:0o600,flag:'wx'})
console.log('Bundle prepared. Upload this JSON file in Imports, inspect every rejection and unmapped field, then explicitly approve its fingerprint. No native data has changed.')
