// Real buyer-product HTTP edge. Fixture identity exists only in this test server.
import {createServer} from 'node:http'
import {Readable} from 'node:stream'
import {readFile} from 'node:fs/promises'
import {randomBytes} from 'node:crypto'
import {createUsageRelay} from '../sdk/relay.mjs'
export async function startUsageRelay(client,{userId=' Buyer/User A ',groupId=' Buyer/Group A '}={}) {
 const session=randomBytes(32).toString('hex'),asset=await readFile(new URL('../public/buoy-usage.js',import.meta.url))
 const relay=createUsageRelay({client,authenticate:async request=>request.headers.get('cookie')?.split(';').some(part=>part.trim()===`product_session=${session}`)?{userId,groupId}:null})
 let origin
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,origin)
   if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});res.end('<!doctype html><html lang="en"><title>Buyer product</title><body><main><h1>Product usage relay fixture</h1></main></body></html>');return}
   if(req.method==='GET'&&url.pathname==='/buoy-usage.js'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});res.end(asset);return}
   if(url.pathname!=='/usage-relay'){res.writeHead(404);res.end();return}
   const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})})
   const response=await relay(request)
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))
  }catch{res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:'Product relay unavailable.'}))}
 })
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
 origin=`http://127.0.0.1:${server.address().port}`
 return {origin,userId,groupId,cookie:{name:'product_session',value:session,url:origin},close:()=>new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeIdleConnections()})}
}
