// The emitted application, with a fake only at the paid mail-provider edge.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { realpath, readFile, readdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import {execFileSync} from 'node:child_process'

export async function mailWorker({ root = process.cwd(), bindings = () => ({}), completeSetup = true, secure = true, providerFetch, clock, persistenceDirectory, keepPersistence = false, trace } = {}) {
 const require = createRequire(await realpath(join(root, 'node_modules/wrangler/package.json')))
 const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
 const { unstable_splitSqlQuery: splitSql } = require('wrangler')
 const config = JSON.parse(await readFile(join(root, 'dist/server/wrangler.json'), 'utf8'))
 const directory = persistenceDirectory??await mkdtemp(join(tmpdir(), 'buoy-mail-'))
 const dbConfig=config.d1_databases.find(row=>row.binding==='DB')
 assert.ok(dbConfig,'Built Worker declares its real DB binding')
 const databaseId=dbConfig.preview_database_id??dbConfig.database_id??dbConfig.binding
 // Wrangler --persist-to takes the unversioned root; Miniflare and the rer
 // archive proxy take its v3 directory. Use the actual declared database ID.
 if(persistenceDirectory)execFileSync(process.execPath,[join(root,'node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','DB','--local','--persist-to',directory,'--config',join(root,'dist/server/wrangler.json')],{cwd:root,stdio:'pipe',maxBuffer:16*1024*1024,env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}})
 const secret = () => randomBytes(32).toString('base64url'), mails = [], outbound = []
 const vars = { AUTH_LOCAL: secure ? 'false' : 'true', OWNER_EMAIL: 'owner@example.test', SESSION_SECRET: secret(), SETUP_TOKEN: secret(), MAIL_PROVIDER: 'resend', MAIL_FROM: 'auth@example.test', MAIL_API_KEY: 'test-only-provider-key' }
 let runtimeBindings
 const responses=new Set()
 let mailStatus = 200
 const clockValue=()=>Number(typeof clock==='function'?clock():clock)
 // Resolve origin-dependent bindings after workerd owns its ephemeral port.
 // A private service supplies them before the first application handler runs,
 // without restarting workerd and releasing that port again.
 const wrapper = `import worker from './${config.main}';
 let bindings;
 async function environment(env) {
  bindings ??= env.__BUOY_TEST_BINDINGS.fetch('http://bindings.test').then(response => response.json());
  return {...env, ...await bindings};
 }
 ${clock===undefined?'':`const NativeDate=Date; let instant=${clockValue()}; globalThis.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[instant]));} static now(){return instant}};`}
 export default {
  ...worker,
  async fetch(request, env, ctx) {
   ${clock===undefined?'':"const value=request.headers.get('x-buoy-test-time');if(value)instant=Number(value);"}
   return worker.fetch(request, await environment(env), ctx);
  },
  async scheduled(controller, env, ctx) {
   return worker.scheduled(controller, await environment(env), ctx);
  }
 };`
 const mf = new Miniflare({ ...convertV4MiniflareOptions({
  host:'127.0.0.1', port:0, https:secure, unsafeTriggerHandlers:!!persistenceDirectory,
  modulesRoot: join(root, 'dist/server'),
  modules: [{type:'ESModule',path:join(root,'dist/server/test-runtime.mjs'),contents:wrapper},...[config.main, ...(await readdir(join(root, 'dist/server/assets'))).filter(file => file.endsWith('.js')).map(file => `assets/${file}`)].map(file => ({type:'ESModule',path:join(root,'dist/server',file)}))],
  compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
  assets: {directory:join(root,'dist/client'),routerConfig:{has_user_worker:true}},
  d1Databases: {DB:databaseId}, bindings:vars,
  serviceBindings: {__BUOY_TEST_BINDINGS: () => {
   assert.ok(runtimeBindings, 'Runtime bindings are resolved before application requests')
   return Response.json(runtimeBindings)
  }},
  outboundService: async request => {
   outbound.push(request.url)
   if(providerFetch&&['portal-idp.example.test','api.sendgrid.com','api.stripe.com','api.anthropic.com','api.openai.com'].includes(new URL(request.url).hostname))return providerFetch(request)
   assert.equal(request.url, 'https://api.resend.com/emails')
   mails.push(await request.json())
   return Response.json(mailStatus === 200 ? {id:`provider-receipt-${mails.length}`} : {error:'test provider failure'}, {status:mailStatus})
  },
 }), resourcePersistencePath:join(directory,persistenceDirectory?'v3':'state') })
 try {
  trace?.('waiting for the native Worker listener')
  const origin = (await mf.ready).origin
  trace?.('native Worker listener ready')
  runtimeBindings = {AUTH_ORIGIN:origin, ...bindings(origin)}
  Object.assign(vars, runtimeBindings)
  // Persistent fixtures applied migrations through Wrangler above; they do not
  // need another Node D1 proxy before the Worker's own binding is opened.
  const db=persistenceDirectory?null:await mf.getD1Database('DB')
  trace?.('native database binding ready')
  for(const file of (persistenceDirectory?[]:await readdir(join(root,'migrations/core'))).filter(file=>file.endsWith('.sql')).sort()) {
   for(const sql of splitSql(await readFile(join(root,'migrations/core',file),'utf8'))) await db.prepare(sql).run()
  }
  trace?.('native schema applied')
  const request=async(path,{method='GET',body,cookie,token,headers={}}={})=>{const response=await mf.dispatchFetch(origin+path,{method,redirect:'manual',headers:{origin,...(clock===undefined?{}:{'x-buoy-test-time':String(clockValue())}),...(body===undefined?{}:{'content-type':'application/json'}),...(cookie?{cookie}:{}),...(token?{authorization:`Bearer ${token}`} : {}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});responses.add(response);return response}
  const boot=await request('/auth/bootstrap',{method:'POST',body:{token:vars.SETUP_TOKEN,displayName:'Harbour CS owner'}})
  assert.equal(boot.status,303,await boot.clone().text())
  trace?.('native owner bootstrapped')
  const cookie=boot.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  if (completeSetup) await mf.dispatchFetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{origin,cookie,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
  trace?.('native setup completed')
  async function signIn(email) {
   assert.equal((await request('/auth/magic-link',{method:'POST',body:{email}})).status,202)
   const message=mails.findLast(mail=>mail.to.includes(email))
   assert.ok(message,'provider receives the sign-in message')
   const link=new URL(message.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'))
   assert.equal(link.origin,origin)
   assert.equal((await request(link.pathname+link.search)).status,200)
   const response=await request('/auth/confirm',{method:'POST',body:{token:link.searchParams.get('token')}})
   assert.equal(response.status,303)
   return response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  }
  // The Cron Trigger door, as Cloudflare calls it.
  const scheduled=async(cron='0 * * * *',scheduledTime=Date.now())=>{
   if(!persistenceDirectory)return (await mf.getWorker()).scheduled({cron,scheduledTime})
   // The supported local Cron endpoint reaches the exported scheduled handler
   // inside workerd, without a Node RPC proxy against a restored D1 database.
   const response=await mf.dispatchFetch(origin+'/cdn-cgi/local/scheduled?'+new URLSearchParams({cron,time:String(scheduledTime),format:'json'}))
   const body=await response.text();assert.equal(response.status,200,body)
   assert.equal(JSON.parse(body).outcome,'ok')
  }
  return {origin,directory,request,dispatch:async request=>mf.dispatchFetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),redirect:'manual',...(['GET','HEAD'].includes(request.method)?{}:{body:await request.arrayBuffer()})}),cookie,signIn,scheduled,mails,outbound,setMailStatus(status){mailStatus=status},async close(){for(const response of responses)if(response.body&&!response.body.locked)await response.body.cancel();responses.clear();await mf.dispose();if(!keepPersistence)await rm(directory,{recursive:true,force:true})}}
 }catch(error){await mf.dispose();if(!keepPersistence)await rm(directory,{recursive:true,force:true});throw error}
}
