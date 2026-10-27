#!/usr/bin/env node
// Prepare a lossless migration bundle for the existing reviewed Imports screen.
import {csvRows} from './csv.ts'
import {acquireTotango} from './totango-api.ts'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createInterface} from 'node:readline/promises'
const flags = new Map()
for(let i=2;i<process.argv.length;i+=2) {
 const name=process.argv[i], value=process.argv[i+1]
 if(!['--source','--input','--output','--columns','--date-order','--api-query','--region'].includes(name)||!value||flags.has(name))throw new Error('Use --source, --input, --output, optional --columns JSON and --date-order.')
 flags.set(name,value)
}
const source=flags.get('--source'), input=flags.get('--input'), output=flags.get('--output'), dateOrder=flags.get('--date-order')??'iso'
if(!['csv','vitally','velaris','totango','churnzero'].includes(source)||(!input&&!flags.has('--api-query'))||(input&&flags.has('--api-query'))||!output||!['iso','day-first','month-first'].includes(dateOrder))throw new Error('Choose csv, totango, churnzero, vitally or velaris, input and output files, and an explicit date order.')
if(flags.has('--api-query')){
 if(source!=='totango'||!flags.has('--columns'))throw new Error('Totango API acquisition requires explicit --columns and --source totango.')
 const query=JSON.parse(await readFile(flags.get('--api-query'),'utf8'))
 const api=await acquireTotango(query,flags.get('--region')??'us',process.env.BUOY_TOTANGO_APP_TOKEN??'')
 const bundle={format:'buoy-migration-v1',source,dateOrder,columns:JSON.parse(flags.get('--columns')),api}
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
  for(const field of ['id','name','renewalDate','noticeDays','renewalEvidence','invoiceTotal','invoiceCurrency','invoiceObservedAt','invoiceDueDate','supportObservedAt','supportReference','openTickets','urgentTickets',...(source==='churnzero'?['churnScore','churnScoreFactors']:[])]) {
   const answer=(await terminal.question(`${field}: `)).trim()
   if(answer)columns[field]=answer
   else if(['id','name','renewalDate','noticeDays','renewalEvidence'].includes(field))throw new Error(`A source header is required for ${field}.`)
  }
 } finally {terminal.close()}
}
const bundle={format:'buoy-migration-v1',source,dateOrder,...(columns?{columns}:{}),...(csvSource?{csv:text,originalSha256:createHash('sha256').update(bytes).digest('hex')}:{exportText:text,originalSha256:createHash('sha256').update(bytes).digest('hex')})}
const encoded=JSON.stringify(bundle)
if(Buffer.byteLength(encoded)>2_000_000)throw new Error('Prepared bundle exceeds 2 MB; split the source into smaller reviewed bundles.')
await writeFile(output,encoded,{mode:0o600,flag:'wx'})
console.log('Bundle prepared. Upload this JSON file in Imports, inspect every rejection and unmapped field, then explicitly approve its fingerprint. No native data has changed.')
