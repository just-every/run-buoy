// Install only on the buyer's server; authenticate against its real product session.
import {UsageError} from './usage.mjs'
const limit=256000
const reply=(status,error)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}})
const validId=value=>typeof value==='string'&&value.trim().length>0&&value.length<=200
export function createUsageRelay({client,authenticate}) {
 if(typeof window!=='undefined'||typeof document!=='undefined')throw new TypeError('Usage relays run only on the product server.')
 if(typeof client?.batch!=='function'||typeof authenticate!=='function')throw new TypeError('A server usage client and product authenticate callback are required.')
 return async request=>{
  if(request.method!=='POST')return reply(405,'Use POST.')
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return reply(403,'Same-origin product requests are required.')
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply(415,'JSON is required.')
  let identity
  try{identity=await authenticate(request)}catch{return reply(503,'Product authentication is unavailable.')}
  if(identity===null)return reply(401,'Sign in to the product.')
  if(!identity||!validId(identity.userId)||(identity.groupId!==undefined&&!validId(identity.groupId)))return reply(503,'Product authentication is unavailable.')
  let input
  try{
   if(Number(request.headers.get('content-length'))>limit)return reply(413,'Usage request exceeds 256000 bytes.')
   const reader=request.body?.getReader();if(!reader)return reply(400,'A JSON body is required.')
   const chunks=[];let size=0
   for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return reply(413,'Usage request exceeds 256000 bytes.')}chunks.push(value)}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
   input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
  }catch{return reply(400,'Invalid JSON body.')}
  if(!input||typeof input!=='object'||Array.isArray(input))return reply(400,'A usage object is required.')
  const messages=Object.hasOwn(input,'batch')?input.batch:[input]
  if(!Array.isArray(messages)||messages.length<1||messages.length>500||messages.some(m=>!m||typeof m!=='object'||Array.isArray(m)||!['track','identify','group','event'].includes(m.type)))return reply(400,'Supply 1–500 valid usage messages.')
  const trusted=messages.map(message=>{
   const {anonymousId,userId,groupId,context,...rest}=message
   const cleanContext=context&&typeof context==='object'&&!Array.isArray(context)?{...context}:{}
   delete cleanContext.anonymousId;delete cleanContext.userId;delete cleanContext.groupId
   cleanContext.userId=identity.userId
   if(identity.groupId!==undefined)cleanContext.groupId=identity.groupId
   return {...rest,userId:identity.userId,...(identity.groupId===undefined?{}:{groupId:identity.groupId}),context:cleanContext}
  })
  try{
   const receipt=await client.batch(trusted),safe={}
   for(const key of ['received','accepted','duplicates','review']){if(!Number.isSafeInteger(receipt?.[key])||receipt[key]<0)return reply(503,'Usage intake returned an invalid receipt.');safe[key]=receipt[key]}
   return Response.json(safe,{status:202,headers:{'Cache-Control':'no-store'}})
  }catch(error){
   if(error instanceof UsageError&&error.status>=400&&error.status<=599)return reply(error.status,'Usage intake refused the request.')
   return reply(503,'Usage intake is unavailable.')
  }
 }
}
