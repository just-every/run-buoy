import {sha256} from '../../modules/import-kit/src/provenance/identity.ts'
import {parseJson} from '../../modules/import-kit/src/readers/json.ts'
import {assertNoCredentials,reflectedCredentialMatcher} from '../../modules/import-kit/src/provenance/credentials.ts'
import type {Json} from '../../modules/import-kit/src/types.ts'

type Row=Record<string,Json>
const object=(value:unknown):Row=>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected a ChurnZero source object.')
 return value as Row
}
const keys=(row:Row,allowed:string[])=>{if(Object.keys(row).some(key=>!allowed.includes(key)))throw Error('Unsupported ChurnZero acquisition property.')}
export interface ChurnzeroQuery {tenant:string;select:string[];filter?:string;pageSize:number}
export interface ChurnzeroApi {query:ChurnzeroQuery;retrievedAt:string;pages:{offset:number;text:string;sha256:string}[]}
export function churnzeroQuery(value:unknown):ChurnzeroQuery{
 const row=object(value);keys(row,['tenant','select','filter','pageSize'])
 if(typeof row.tenant!=='string')throw Error('Supply the ChurnZero tenant origin.')
 let origin:URL
 try{origin=new URL(row.tenant)}catch{throw Error('Choose a valid ChurnZero tenant HTTPS origin.')}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.port||origin.pathname!=='/'||origin.search||origin.hash||! /^[a-z0-9][a-z0-9-]*\.(?:us1app|eu1app)\.churnzero\.net$/.test(origin.hostname))throw Error('Choose a ChurnZero US or EU tenant HTTPS origin without a path or credentials.')
 if(!Array.isArray(row.select)||row.select.length<1||row.select.length>100||row.select.some(field=>typeof field!=='string'||! /^[A-Za-z][A-Za-z0-9_]*(?:\/[A-Za-z][A-Za-z0-9_]*)?$/.test(field)))throw Error('Select 1 to 100 explicit ChurnZero account fields.')
 const select=row.select as string[]
 if(new Set(select).size!==select.length||!select.includes('ExternalId')||!select.includes('Name'))throw Error('Select unique fields including ExternalId and Name.')
 if(row.filter!==undefined&&(typeof row.filter!=='string'||row.filter.length>4000||/[\u0000-\u001f]/.test(row.filter)))throw Error('The optional source filter must be bounded OData text.')
 const pageSize=row.pageSize??100
 if(typeof pageSize!=='number'||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw Error('Choose a page size from 1 to 100.')
 const query={tenant:origin.origin,select,...(row.filter!==undefined?{filter:row.filter as string}:{}),pageSize}
 assertNoCredentials(query as unknown as Json)
 return query
}
function pageContent(text:string){
 const row=object(parseJson(text.replace(/^\uFEFF/,''),{artifact:'ChurnZero account response',pointer:''}))
 assertNoCredentials(row)
 if(!Number.isSafeInteger(row['@odata.count'])||Number(row['@odata.count'])<1||Number(row['@odata.count'])>500||!Array.isArray(row.value))throw Error('ChurnZero must report 1 to 500 accounts and an OData value array; narrow the source filter.')
 return {row,total:Number(row['@odata.count']),accounts:row.value.map(object)}
}
// Pagination is constructed from the reviewed query. Provider links are never
// fetched, so a response cannot redirect a private Basic credential elsewhere.
function endpoint(query:ChurnzeroQuery,offset:number){
 const url=new URL('/public/v1/Account',query.tenant)
 url.search=new URLSearchParams({'$select':query.select.join(','),'$count':'true','$top':String(query.pageSize),'$skip':String(offset),'$orderby':'Id asc',...(query.filter?{'$filter':query.filter}:{})}).toString()
 return url
}
export async function acquireChurnzero(value:unknown,username:string,apiKey:string):Promise<ChurnzeroApi>{
 const query=churnzeroQuery(value)
 if(!username||!apiKey||username.includes(':')||/[\u0000-\u001f]/.test(username+apiKey))throw Error('Set BUOY_CHURNZERO_USERNAME and BUOY_CHURNZERO_API_KEY privately before acquisition.')
 const encoded=Buffer.from(username+':'+apiKey,'utf8').toString('base64')
 const reflects=reflectedCredentialMatcher([username,apiKey,encoded]),pages:ChurnzeroApi['pages']=[]
 if(reflects(JSON.stringify(query)))throw Error('The query contains a private credential; no request or bundle written.')
 let offset=0,total:number|undefined,size=0
 do{
  const response=await fetch(endpoint(query,offset),{method:'GET',redirect:'error',headers:{authorization:'Basic '+encoded,accept:'application/json'},signal:AbortSignal.timeout(30000)})
  if(!response.ok)throw Error('ChurnZero account read refused (HTTP '+response.status+'). No bundle written.')
  const reader=response.body?.getReader(),chunks:Uint8Array[]=[]
  if(!reader)throw Error('ChurnZero returned an empty response body.')
  try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>2_000_000)throw Error('ChurnZero response exceeds the source bound.');chunks.push(next.value)}}finally{await reader.cancel()}
  const bytes=new Uint8Array(chunks.reduce((sum,chunk)=>sum+chunk.length,0));let at=0
  for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)
  if(reflects(text))throw Error('ChurnZero reflected a private credential; no bundle written.')
  const page=pageContent(text)
  if(reflects(JSON.stringify(page.row)))throw Error('ChurnZero reflected a private credential; no bundle written.')
  if(total!==undefined&&page.total!==total)throw Error('ChurnZero account total changed during acquisition; prepare a fresh source snapshot.')
  total=page.total
  if(!page.accounts.length||page.accounts.length>query.pageSize||offset+page.accounts.length>total||offset+page.accounts.length<total&&page.accounts.length!==query.pageSize)throw Error('ChurnZero account pagination is incomplete.')
  pages.push({offset,text,sha256:sha256(text)});offset+=page.accounts.length
  if(offset<total)await new Promise(resolve=>setTimeout(resolve,650))
 }while(offset<total)
 const api={query,retrievedAt:new Date().toISOString(),pages}
 churnzeroApiRows(api)
 return api
}
export function churnzeroApiRows(value:unknown){
 const api=object(value);keys(api,['query','retrievedAt','pages'])
 const query=churnzeroQuery(api.query)
 if(typeof api.retrievedAt!=='string'||!Number.isFinite(Date.parse(api.retrievedAt))||!Array.isArray(api.pages)||!api.pages.length||api.pages.length>500)throw Error('Invalid ChurnZero acquisition metadata.')
 const rows:Record<string,unknown>[]=[],pointers:string[]=[],identities=new Set<string>()
 let total:number|undefined
 for(const [index,value]of api.pages.entries()){
  const page=object(value);keys(page,['offset','text','sha256'])
  if(page.offset!==rows.length||typeof page.text!=='string'||sha256(page.text)!==page.sha256)throw Error('ChurnZero page offset or original response digest is invalid.')
  const content=pageContent(page.text)
  if(total!==undefined&&content.total!==total)throw Error('ChurnZero response totals disagree.')
  total=content.total
  if(!content.accounts.length||content.accounts.length>query.pageSize||rows.length+content.accounts.length>total||index<api.pages.length-1&&content.accounts.length!==query.pageSize)throw Error('ChurnZero account pagination is incomplete.')
  for(const [position,row]of content.accounts.entries()){
   if(typeof row.ExternalId!=='string'||!row.ExternalId.trim()||typeof row.Name!=='string'||!row.Name.trim()||identities.has(row.ExternalId))throw Error('ChurnZero accounts need unique external identities and names; no source record may be discarded.')
   identities.add(row.ExternalId)
   const custom=row.Cf===undefined?{}:object(row.Cf)
   rows.push({...row,...Object.fromEntries(Object.entries(custom).map(([key,value])=>['Cf/'+key,value]))})
   pointers.push('/api/pages/'+index+'/value/'+position)
  }
 }
 if(rows.length!==total)throw Error('ChurnZero pages do not reconcile with the reported account total.')
 return {rows,pointers}
}
