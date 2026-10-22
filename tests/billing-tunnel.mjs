// Test transport only. No Stripe credential, body, signature or tunnel log is
// printed. A remote mode is selected explicitly; a failure never changes modes.
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'

const route='/stripe-billing/webhook',maximumBody=256000,relayMarker='buoy-billing-relay-v1'
const quote=value=>"'"+String(value).replaceAll("'","'\"'\"'")+"'"
function childEnvironment(){
 // An allowlist also avoids SendEnv configurations forwarding a held key.
 const env={}
 for(const key of ['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL','SSH_AUTH_SOCK'])if(process.env[key]!==undefined)env[key]=process.env[key]
 return env
}
const sshOptions=['-T','-o','BatchMode=yes','-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2']
const safeCode=value=>typeof value==='string'&&/^[A-Z0-9_]{1,80}$/.test(value.toUpperCase())?value.toUpperCase():'UNKNOWN'
function failure(code,diagnostics){
 const error=new Error(code+' '+JSON.stringify({mode:diagnostics.mode,phase:diagnostics.phase,statuses:[...diagnostics.statuses].sort(),connectionCategories:[...diagnostics.categories].sort()}))
 error.name='BillingTunnelError';error.code=code
 return error
}
function classify(log,diagnostics){
 const patterns={
  quick_tunnel_request:/failed to request quick tunnel|failed to create.*quick tunnel|unable to request quick tunnel|error.*api\.trycloudflare\.com/i,
  timeout:/timeout|timed out|deadline exceeded/i,
  edge_connection:/failed to (?:serve|connect|dial)|unable to establish|connection refused|no route to host|network is unreachable/i,
  edge_port_7844:/7844/,
  dns:/\bDNS\b|lookup .*trycloudflare|failed to resolve/i,
  ssh_authentication:/permission denied|authentication failed|host key verification failed/i,
  ssh_forwarding:/forwarding failed|cannot listen to port|administratively prohibited/i,
  connected:/registered tunnel connection|connection .*registered/i,
  origin_unreachable:/error proxying request|unable to reach the origin service/i,
 }
 for(const [category,pattern]of Object.entries(patterns))if(pattern.test(log))diagnostics.categories.add(category)
 for(const match of log.matchAll(/(?:status(?: code)?|response code)[=: ]+([1-5]\d{2})\b/gi))diagnostics.statuses.add('tunnel_http_'+match[1])
}
async function stopChild(child){
 if(!child||child.exitCode!==null||child.signalCode!==null)return
 const exited=new Promise(resolve=>child.once('close',resolve))
 child.kill('SIGTERM')
 await Promise.race([exited,delay(3000)])
 if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await Promise.race([exited,delay(1000)])}
}
async function controlSsh(host,command,diagnostics){
 const child=spawn('ssh',[...sshOptions,'--',host,command],{env:childEnvironment(),stdio:['ignore','pipe','pipe']})
 let stdout='',stderr='',spawnError
 child.on('error',error=>{spawnError=safeCode(error.code)})
 child.stdout.on('data',chunk=>{stdout=(stdout+chunk.toString()).slice(-16000)})
 child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-16000)})
 let timer
 const result=await Promise.race([
  new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal}))),
  new Promise(resolve=>{timer=setTimeout(()=>resolve({timeout:true}),20000)}),
 ])
 clearTimeout(timer)
 if(result.timeout)await stopChild(child)
 classify(stderr,diagnostics)
 if(spawnError)diagnostics.statuses.add('ssh_spawn_'+spawnError)
 if(result.timeout)diagnostics.statuses.add('ssh_control_timeout')
 else diagnostics.statuses.add('ssh_control_exit_'+String(result.code??result.signal??'unknown'))
 return {stdout,ok:!result.timeout&&!spawnError&&result.code===0}
}
async function remotePort(host,marker,diagnostics){
 const script="import socket; s=socket.socket(socket.AF_INET,socket.SOCK_STREAM); s.bind(('127.0.0.1',0)); print('"+marker+"='+str(s.getsockname()[1]),flush=True); s.close()"
 const result=await controlSsh(host,'python3 -c '+quote(script),diagnostics)
 const match=result.stdout.match(new RegExp('(?:^|\\n)'+marker+'=(\\d+)(?:\\r?\\n|$)'))
 const port=Number(match?.[1])
 if(!result.ok||!Number.isInteger(port)||port<1||port>65535)throw failure('BILLING_TUNNEL_REMOTE_PORT',diagnostics)
 return port
}
async function stopRemote(host,pid,binary,args,marker,diagnostics){
 if(!Number.isSafeInteger(pid)||pid<2)return
 // The marker identified our exec PID. Before either signal, independently
 // prove that exact PID still runs our executable and unique loopback URL.
 const script=`import json,os,shutil,signal,subprocess,sys,time
p=json.loads(sys.argv[1]); pid=p['pid']; tail=' '+' '.join(p['args'])
def owned():
 r=subprocess.run(['ps','-ww','-p',str(pid),'-o','command='],capture_output=True,text=True)
 line=r.stdout.strip()
 if not line:return None
 if not line.endswith(tail):return False
 executable=line[:-len(tail)].strip()
 expected=shutil.which(p['binary']) or p['binary']
 return os.path.realpath(executable)==os.path.realpath(expected)
state=owned()
if state is None:print(p['marker']+'=gone');sys.exit(0)
if state is not True:print(p['marker']+'=unproven');sys.exit(2)
try:os.kill(pid,signal.SIGTERM)
except ProcessLookupError:print(p['marker']+'=gone');sys.exit(0)
for _ in range(20):
 time.sleep(0.1)
 state=owned()
 if state is None:print(p['marker']+'=stopped');sys.exit(0)
 if state is not True:print(p['marker']+'=changed');sys.exit(2)
if owned() is True:
 try:os.kill(pid,signal.SIGKILL)
 except ProcessLookupError:pass
 print(p['marker']+'=killed');sys.exit(0)
print(p['marker']+'=changed');sys.exit(2)`
 const result=await controlSsh(host,'python3 -c '+quote(script)+' '+quote(JSON.stringify({pid,binary,args,marker})),diagnostics)
 const match=result.stdout.match(new RegExp('(?:^|\\n)'+marker+'=(gone|stopped|killed)(?:\\r?\\n|$)'))
 if(!result.ok||!match){diagnostics.statuses.add('remote_cleanup_unproven');throw failure('BILLING_TUNNEL_REMOTE_CLEANUP',diagnostics)}
 diagnostics.statuses.add('remote_cleanup_'+match[1])
}
function bodyBytes(request){
 return new Promise(resolve=>{
  const chunks=[];let size=0,done=false
  const finish=value=>{if(!done){done=true;resolve(value)}}
  request.on('data',chunk=>{size+=chunk.length;if(size>maximumBody){chunks.length=0;finish(null)}else if(!done)chunks.push(chunk)})
  request.once('end',()=>finish(Buffer.concat(chunks)))
  request.once('error',()=>finish(undefined));request.once('aborted',()=>finish(undefined))
 })
}
async function localRelay(handler){
 let port
 const server=createServer({maxHeaderSize:32768,requestTimeout:30000,headersTimeout:10000},async(request,response)=>{
  const reject=status=>{response.writeHead(status,{'x-buoy-billing-relay':relayMarker,'cache-control':'no-store','connection':'close'});response.end();request.resume()}
  if(request.method!=='POST'||request.url!==route){reject(404);return}
  const declared=request.headers['content-length']
  if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>maximumBody)){reject(413);return}
  try{
   const bytes=await bodyBytes(request)
   if(bytes===null){reject(413);return}
   if(bytes===undefined){reject(400);return}
   const headers=new Headers()
   for(const [name,value]of Object.entries(request.headers))if(Array.isArray(value)){for(const entry of value)headers.append(name,entry)}else if(value!==undefined)headers.set(name,value)
   const result=await handler(new Request('http://127.0.0.1:'+port+route,{method:'POST',headers,body:bytes}))
   // Miniflare can return a standards-compatible Response from another realm.
   if(!result||!Number.isInteger(result.status)||result.status<200||result.status>599||!result.headers||typeof result.arrayBuffer!=='function'){reject(503);return}
   response.writeHead(result.status,Object.fromEntries(result.headers));response.end(Buffer.from(await result.arrayBuffer()))
  }catch{if(!response.headersSent)reject(503);else response.end()}
 })
 server.on('clientError',(_,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'))
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
 port=server.address().port
 return {port,async close(){const closed=new Promise(resolve=>server.close(resolve));server.closeIdleConnections();const forced=setTimeout(()=>server.closeAllConnections(),3000);await closed;clearTimeout(forced)}}
}
function quickOrigin(log){
 const candidates=log.matchAll(/https:\/\/([a-z0-9][a-z0-9-]*\.trycloudflare\.com)\b/g)
 for(const match of candidates)if(match[1]!=='api.trycloudflare.com')return 'https://'+match[1]
}

/** Returns the full POST webhook URL. close() owns only this relay/tunnel. */
export async function startBillingTunnel(handler){
 const host=process.env.BUOY_TUNNEL_SSH_HOST,binary=host?(process.env.BUOY_TUNNEL_REMOTE_BIN??'cloudflared'):(process.env.CLOUDFLARED_BIN??'cloudflared')
 const diagnostics={mode:host?'ssh':'local',phase:'configuration',statuses:new Set(),categories:new Set()}
 if(typeof handler!=='function'||!binary||binary.length>1024||/[\x00-\x1f\x7f]/.test(binary)||(host&&!/^[A-Za-z0-9][A-Za-z0-9_.@:-]{0,255}$/.test(host)))throw failure('BILLING_TUNNEL_CONFIGURATION',diagnostics)
 const nonce=randomBytes(12).toString('hex'),pidMarker='BUOY_TUNNEL_PID_'+nonce,portMarker='BUOY_TUNNEL_PORT_'+nonce,cleanupMarker='BUOY_TUNNEL_STOP_'+nonce
 let relay,child,remotePid,args=[],origin,stdout='',stderr='',spawnError,closing
 const close=()=>closing??=(async()=>{
  let cleanupError
  try{if(host&&remotePid)await stopRemote(host,remotePid,binary,args,cleanupMarker,diagnostics)}catch(error){cleanupError=error}
  await stopChild(child);await relay?.close()
  if(cleanupError)throw cleanupError
 })()
 try{
  diagnostics.phase='relay';relay=await localRelay(handler)
  diagnostics.phase=host?'remote_port':'launch'
  const tunnelPort=host?await remotePort(host,portMarker,diagnostics):relay.port
  args=['tunnel','--url','http://127.0.0.1:'+tunnelPort,'--no-autoupdate','--protocol','http2','--edge-ip-version','4']
  if(host){
   const command="printf '%s=%s\\n' "+quote(pidMarker)+' "$$"; exec '+[binary,...args].map(quote).join(' ')
   child=spawn('ssh',[...sshOptions,'-o','ExitOnForwardFailure=yes','-R',`127.0.0.1:${tunnelPort}:127.0.0.1:${relay.port}`,'--',host,command],{env:childEnvironment(),stdio:['ignore','pipe','pipe']})
  }else child=spawn(binary,args,{env:childEnvironment(),stdio:['ignore','pipe','pipe']})
  child.on('error',error=>{spawnError=safeCode(error.code);diagnostics.statuses.add('tunnel_spawn_'+spawnError)})
  child.on('close',(code,signal)=>diagnostics.statuses.add('tunnel_exit_'+String(code??signal??'unknown')))
  const capture=(chunk,isError)=>{
   if(isError)stderr=(stderr+chunk.toString()).slice(-64000);else stdout=(stdout+chunk.toString()).slice(-64000)
   const log=stdout+'\n'+stderr;classify(log,diagnostics);origin??=quickOrigin(log)
   if(host&&!remotePid){const match=stdout.match(new RegExp('(?:^|\\n)'+pidMarker+'=(\\d+)(?:\\r?\\n|$)'));if(match){const value=Number(match[1]);if(Number.isSafeInteger(value)&&value>1)remotePid=value}}
  }
  child.stdout.on('data',chunk=>capture(chunk,false));child.stderr.on('data',chunk=>capture(chunk,true))
  const deadline=Date.now()+120000
  const alive=()=>{if(spawnError||child.exitCode!==null||child.signalCode!==null)throw failure('BILLING_TUNNEL_PROCESS_EXIT',diagnostics)}
  diagnostics.phase='quick_tunnel_hostname'
  while(!origin||host&&!remotePid){alive();if(Date.now()>=deadline)throw failure('BILLING_TUNNEL_HOSTNAME_TIMEOUT',diagnostics);await delay(100)}
  diagnostics.phase='public_relay_readiness'
  let ready=false
  while(Date.now()<deadline){
   alive()
   try{
    const response=await fetch(origin+'/',{redirect:'manual',signal:AbortSignal.timeout(Math.min(5000,Math.max(1,deadline-Date.now())))})
    diagnostics.statuses.add('public_http_'+response.status)
    ready=response.status===404&&response.headers.get('x-buoy-billing-relay')===relayMarker
    await response.body?.cancel()
    if(ready)break
   }catch(error){diagnostics.statuses.add('public_fetch_'+safeCode(error.cause?.code??error.code??error.name))}
   await delay(500)
  }
  if(!ready)throw failure('BILLING_TUNNEL_PUBLIC_READINESS_TIMEOUT',diagnostics)
  diagnostics.phase='ready'
  return {url:origin+route,close}
 }catch(error){
  let cleanupFailed=false
  try{await close()}catch{cleanupFailed=true;diagnostics.statuses.add('cleanup_failed')}
  throw failure(cleanupFailed?'BILLING_TUNNEL_CLEANUP_FAILED':error?.name==='BillingTunnelError'?error.code:'BILLING_TUNNEL_START_FAILED',diagnostics)
 }
}
