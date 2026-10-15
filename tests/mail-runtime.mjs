// The emitted application, with a fake only at the paid mail-provider edge.
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { realpath, readFile, readdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

export async function mailWorker({ root = process.cwd() } = {}) {
 const require = createRequire(await realpath(join(root, 'node_modules/wrangler/package.json')))
 const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
 const { unstable_splitSqlQuery: splitSql } = require('wrangler')
 const config = JSON.parse(await readFile(join(root, 'dist/server/wrangler.json'), 'utf8'))
 const socket=createServer(); await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve)); const port=socket.address().port; await new Promise(resolve=>socket.close(resolve))
 const origin = `https://127.0.0.1:${port}`, directory = await mkdtemp(join(tmpdir(), 'buoy-mail-'))
 const secret = () => randomBytes(32).toString('base64url'), mails = []
 const vars = { AUTH_LOCAL: 'false', AUTH_ORIGIN: origin, OWNER_EMAIL: 'owner@example.test', SESSION_SECRET: secret(), SETUP_TOKEN: secret(), MAIL_PROVIDER: 'resend', MAIL_FROM: 'auth@example.test', MAIL_API_KEY: 'test-only-provider-key' }
 const mf = new Miniflare({ ...convertV4MiniflareOptions({
  host:'127.0.0.1', port, https:true,
  modulesRoot: join(root, 'dist/server'),
  modules: [config.main, ...(await readdir(join(root, 'dist/server/assets'))).filter(file => file.endsWith('.js')).map(file => `assets/${file}`)].map(file => ({type:'ESModule',path:join(root,'dist/server',file)})),
  compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
  assets: {directory:join(root,'dist/client'),routerConfig:{has_user_worker:true}},
  d1Databases: {DB:'foundation'}, bindings:vars,
  outboundService: async request => {
   assert.equal(request.url, 'https://api.resend.com/emails')
   mails.push(await request.json())
   return Response.json({id:`provider-receipt-${mails.length}`})
  },
 }), resourcePersistencePath:join(directory,'state') })
 try {
  await mf.ready
  const db=await mf.getD1Database('DB')
  for(const file of (await readdir(join(root,'migrations/core'))).filter(file=>file.endsWith('.sql')).sort()) {
   for(const sql of splitSql(await readFile(join(root,'migrations/core',file),'utf8'))) await db.prepare(sql).run()
  }
  const request=(path,{method='GET',body,cookie,token,headers={}}={})=>mf.dispatchFetch(origin+path,{method,redirect:'manual',headers:{origin,...(body===undefined?{}:{'content-type':'application/json'}),...(cookie?{cookie}:{}),...(token?{authorization:`Bearer ${token}`} : {}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const boot=await request('/auth/bootstrap',{method:'POST',body:{token:vars.SETUP_TOKEN,displayName:'Harbour CS owner'}})
  assert.equal(boot.status,303,await boot.clone().text())
  const cookie=boot.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  await mf.dispatchFetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{origin,cookie,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
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
  return {origin,directory,request,cookie,signIn,mails,async close(){await mf.dispose();await rm(directory,{recursive:true,force:true})}}
 }catch(error){await mf.dispose();await rm(directory,{recursive:true,force:true});throw error}
}
