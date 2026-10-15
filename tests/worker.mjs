import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:net'
import { randomBytes } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function startWorker(options = {}) {
 const root = options.root ?? process.cwd()
 const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
 const port = socket.address().port; await new Promise(resolve => socket.close(resolve))
 const origin = `http://127.0.0.1:${port}`, directory = options.directory ?? await mkdtemp(join(tmpdir(), 'buoy-http-'))
 const secret = () => randomBytes(32).toString('base64url')
 const vars = {AUTH_LOCAL: 'true', AUTH_ORIGIN: origin, OWNER_EMAIL: 'owner@example.test', SESSION_SECRET: secret(), SETUP_TOKEN: secret(), MAIL_PROVIDER: 'development', MAIL_FROM: 'auth@localhost.test', RER_DEV_KEY: secret()}
 await mkdir(directory, {recursive:true})
 await writeFile(join(directory, 'local.env'), Object.entries(vars).map(([k,v]) => `${k}=${v}`).join('\n'), {mode: 0o600})
 const base = ['node_modules/wrangler/bin/wrangler.js'], config = ['--config','dist/server/wrangler.json']
 execFileSync(process.execPath, [...base,'d1','migrations','apply','DB','--local','--persist-to',directory,...config], {cwd:root,stdio:'pipe',env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}})
 const child = spawn(process.execPath,[...base,'dev',...config,'--inspector-port','0','--local','--persist-to',directory,'--ip','127.0.0.1','--port',String(port),'--env-file',join(directory,'local.env')], {cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_INCLUDE_PROCESS_ENV:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'true'}})
 let output = ''; for (const stream of [child.stdout,child.stderr]) stream.on('data', b => {output += b})
 const request = (path, {method='GET',body,cookie,token,headers={}}={}) => fetch(origin+path,{method,redirect:'manual',headers:{origin,...(body === undefined?{}:{'content-type':'application/json'}),...(cookie?{cookie}:{}),...(token?{authorization:`Bearer ${token}`} : {}),...headers},...(body === undefined?{}:{body:JSON.stringify(body)})})
 async function close() { child.kill('SIGTERM'); await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit',resolve)); if (!options.keep) await rm(directory,{recursive:true,force:true}) }
 try {
  let ready=false
  for(let i=0;i<240;i++) {try{if((await request('/health')).ok){ready=true;break}}catch{} if(child.exitCode!==null)break; await new Promise(r=>setTimeout(r,250))}
  assert.ok(ready,'Worker became healthy')
  const boot=await request('/auth/bootstrap',{method:'POST',body:{token:vars.SETUP_TOKEN,displayName:'Harbour CS owner'}})
  assert.equal(boot.status,303)
  const cookie=boot.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  assert.ok(cookie)
  await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{origin,cookie,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
  async function signIn(email) {
   assert.equal((await request('/auth/magic-link',{method:'POST',body:{email}})).status,202)
   const listing=await(await request('/__dev/outbox',{headers:{'x-rer-dev-key':vars.RER_DEV_KEY}})).text()
   const paths=[...listing.matchAll(/href="(\/__dev\/outbox\?message=[^"]+)"/g)].map(x=>x[1].replaceAll('&amp;','&'))
   for(const path of paths){
    const detail=await(await request(path,{headers:{'x-rer-dev-key':vars.RER_DEV_KEY}})).text()
    if(!detail.includes(email))continue
    const match=detail.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/); if(!match)continue
    const link=new URL(match[1].replaceAll('&amp;','&'),origin)
    const response=await request('/auth/confirm',{method:'POST',body:{token:link.searchParams.get('token')}})
    if(response.status===303)return response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
   }
   throw Error('No usable sign-in message')
  }
  return {origin,directory,request,cookie,signIn,close}
 } catch(error) {await close(); throw error}
}
