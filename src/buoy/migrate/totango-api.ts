import {sha256} from '../../modules/import-kit/src/provenance/identity.ts'

type ObjectValue=Record<string,unknown>
const object=(value:unknown):ObjectValue=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected a Totango object.');return value as ObjectValue}
const keys=(value:ObjectValue,allowed:string[])=>{if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error('Unsupported Totango API bundle field.')}
export interface TotangoPage {offset:number;text:string;sha256:string}
export interface TotangoApi {region:'us'|'eu';query:ObjectValue;retrievedAt:string;pages:TotangoPage[]}
export function accountQuery(value:unknown){
 const query=object(value);keys(query,['terms','fields','count','sort_by','sort_order','scope'])
 if(!Array.isArray(query.terms)||!Array.isArray(query.fields)||query.fields.length<1||query.fields.length>100)throw Error('Supply the explicit Totango account segment terms and fields.')
 const count=query.count??1000
 if(!Number.isInteger(count)||Number(count)<1||Number(count)>1000)throw Error('Totango page count must be a whole number from 1 to 1000.')
 const labels=query.fields.map(value=>{const field=object(value);if(typeof field.field_display_name!=='string'||!field.field_display_name.trim())throw Error('Every Totango selected field needs its exact field_display_name.');return field.field_display_name})
 if(new Set(labels).size!==labels.length||labels.some(label=>['name','display_name'].includes(label)))throw Error('Totango field labels must be unique and cannot replace account identity.')
 return {query:{...query,count},labels,count:Number(count)}
}
function pageContent(text:string){
 const document=object(JSON.parse(text.replace(/^\uFEFF/,''))),response=object(document.response),stats=object(response.stats),accounts=object(response.accounts)
 if(!Number.isSafeInteger(stats.total_hits)||Number(stats.total_hits)<1||Number(stats.total_hits)>2000||!Array.isArray(accounts.hits))throw Error('Totango account response must report 1 to 2000 total hits and an accounts hit array.')
 return {total:Number(stats.total_hits),hits:accounts.hits}
}
// Fixed regional read endpoints. Authentication never enters the retained bundle.
export async function acquireTotango(value:unknown,region:string,credential:string):Promise<TotangoApi>{
 if(!['us','eu'].includes(region))throw Error('Choose the Totango us or eu region.')
 if(!credential)throw Error('Set BUOY_TOTANGO_APP_TOKEN privately before API acquisition.')
 const {query,count}=accountQuery(value),pages:TotangoPage[]=[]
 const endpoint=(region==='eu'?'https://api-eu1.totango.com':'https://api.totango.com')+'/api/v1/search/accounts'
 let offset=0,total:number|undefined
 do{
  const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'app-token':credential,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({query:JSON.stringify({...query,offset})}),signal:AbortSignal.timeout(30000)})
  if(!response.ok)throw Error('Totango account read refused (HTTP '+response.status+'). No bundle written.')
  const bytes=await response.arrayBuffer()
  if(bytes.byteLength>2_000_000)throw Error('Totango response exceeds the migration source bound.')
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)
  const page=pageContent(text)
  if(total!==undefined&&total!==page.total)throw Error('Totango total changed during acquisition; prepare a fresh reviewed snapshot.')
  total=page.total
  if(page.hits.length<1||page.hits.length>count||offset+page.hits.length>total)throw Error('Totango pagination is incomplete or inconsistent.')
  pages.push({offset,text,sha256:sha256(text)});offset+=page.hits.length
  if(offset<total&&page.hits.length!==count)throw Error('Totango returned a short page before the reported total.')
  if(offset<total)await new Promise(resolve=>setTimeout(resolve,650))
 }while(offset<total)
 return {region:region as 'us'|'eu',query,retrievedAt:new Date().toISOString(),pages}
}
export function totangoApiRows(value:unknown){
 const api=object(value);keys(api,['region','query','retrievedAt','pages'])
 if(!['us','eu'].includes(String(api.region))||typeof api.retrievedAt!=='string'||!Number.isFinite(Date.parse(api.retrievedAt))||!Array.isArray(api.pages)||!api.pages.length||api.pages.length>2000)throw Error('Invalid Totango API source metadata.')
 const {labels,count}=accountQuery(api.query),rows:ObjectValue[]=[],pointers:string[]=[]
 let total:number|undefined
 for(const [index,value]of api.pages.entries()){
  const page=object(value);keys(page,['offset','text','sha256'])
  if(page.offset!==rows.length||typeof page.text!=='string'||sha256(page.text)!==page.sha256)throw Error('Totango page offset or original response digest is invalid.')
  const content=pageContent(page.text)
  if(total!==undefined&&total!==content.total)throw Error('Totango response totals disagree.')
  total=content.total
  if(content.hits.length<1||content.hits.length>count||rows.length+content.hits.length>total||index<api.pages.length-1&&content.hits.length!==count)throw Error('Totango pagination is incomplete or inconsistent.')
  for(const [position,value]of content.hits.entries()){
   const hit=object(value)
   if(typeof hit.name!=='string'||typeof hit.display_name!=='string'||!Array.isArray(hit.selected_fields)||hit.selected_fields.length!==labels.length)throw Error('Totango account identity or selected field positions are invalid.')
   // Extra hit properties stay retained and appear as unmapped fields.
   const {selected_fields,...rest}=hit
   rows.push({...rest,...Object.fromEntries(labels.map((label,i)=>[label,selected_fields[i]]))})
   pointers.push('/api/pages/'+index+'/response/accounts/hits/'+position)
  }
 }
 if(rows.length!==total)throw Error('Totango pages do not reconcile with the reported account total.')
 return {rows,pointers}
}
