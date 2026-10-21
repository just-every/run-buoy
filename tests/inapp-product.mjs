// Test-only buyer product: real HTTP, opaque server sessions and the shipped relay/snippet.
import {createServer} from 'node:http'
import {Readable} from 'node:stream'
import {readFile} from 'node:fs/promises'
import {randomBytes} from 'node:crypto'
import {createInappRelay} from '../sdk/relay.mjs'
export async function startInappProduct(client,identity){
 const sessions=new Map(),asset=await readFile(new URL('../public/buoy-inapp.js',import.meta.url))
 const relay=createInappRelay({client,authenticate:async request=>{const key=request.headers.get('cookie')?.split(';').map(p=>p.trim()).find(p=>p.startsWith('product_session='))?.slice(16);return sessions.get(key)??null}})
 let origin
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,origin)
   if(req.method==='GET'&&url.pathname==='/buoy-inapp.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(asset);return}
   if(req.method==='GET'&&url.pathname==='/'){
    res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'})
    res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Northstar customer workspace</title></head><body><main><h1>Northstar customer workspace</h1><p>Welcome to your reporting workspace.</p><button id="refresh">Read product messages</button><div id="messages"></div></main><script type="module">import {createBuoyInapp} from "/buoy-inapp.js";const messages=createBuoyInapp({relay:"/inapp-relay",container:document.querySelector("#messages")});document.querySelector("#refresh").addEventListener("click",()=>messages.refresh());</script></body></html>');return
   }
   if(url.pathname!=='/inapp-relay'){res.writeHead(404);res.end();return}
   const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})})
   const response=await relay(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))
  }catch{res.writeHead(503);res.end('Buyer relay unavailable.')}
 })
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
 origin='http://127.0.0.1:'+server.address().port
 const cookie=trusted=>{const key=randomBytes(32).toString('hex');sessions.set(key,trusted);return{name:'product_session',value:key,url:origin}}
 return {origin,cookie:cookie(identity),session:cookie,close:()=>new Promise((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeIdleConnections()})}
}
