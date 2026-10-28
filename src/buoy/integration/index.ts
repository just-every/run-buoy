import {Hono,type Context} from 'hono'
import {runtimeBindings,type Bindings} from '../../auth.server'
import {actorFor,digest,jsonBody} from '../access'
import {account} from '../accounts'
import {auditIfChanged} from '../audit-records'
import {guard,id,insist,now,Problem,requirePerson,stmt,text,type Actor} from '../core'
import {notErasedSql,parseAccount} from '../imports'
import {canonicalJson} from '../../modules/import-kit/src/d1/index.ts'
import {refreshAccountConsumers} from '../account-consumers'
import {openapi} from './openapi'

type Token={id:string;token_hash:string;owner_id:string;owner_version:number;scopes:string;account_ids:string;account_scope:'explicit'|'all';requests_per_minute:number;expires_at:number}
type Receipt={request_hash:string;account_id:string;revision:string;status:number}
const prefix='/api/buoy/v1'
const authoritySql="EXISTS(SELECT 1 FROM buoy_integration_tokens t JOIN oa_operators o ON o.id=t.owner_id WHERE t.id=? AND t.token_hash=? AND t.revoked_at IS NULL AND t.expires_at>? AND o.status='active' AND o.role='owner' AND o.version=t.owner_version AND t.scopes=? AND t.account_ids=? AND t.account_scope=?)"
const fence=(db:D1Database,t:Token)=>guard(db,authoritySql,t.id,t.token_hash,Date.now(),t.scopes,t.account_ids,t.account_scope)
const ownerActor=(t:Token):Actor=>({id:t.owner_id,kind:'person',role:'owner',displayName:'Integration owner'})
const scope=(t:Token,value:string)=>insist((JSON.parse(t.scopes) as string[]).includes(value),'Token does not permit this operation.',403)
const accountScope=(t:Token,value:string)=>insist(t.account_scope==='all'||(JSON.parse(t.account_ids) as string[]).includes(value),'Account is outside the token scope.',403)
async function owner(request:Request,env:Bindings){const actor=await actorFor(request,env);requirePerson(actor,true);return actor}
function integer(value:unknown,min:number,max:number,label:string){insist(typeof value==='number'&&Number.isInteger(value)&&value>=min&&value<=max,`${label} must be a whole number from ${min} to ${max}.`);return value}

export const integrationApi=new Hono<{Bindings:Bindings;Variables:{token:Token}}>()
integrationApi.use(prefix+'/*',async(c,next)=>{c.header('cache-control','no-store');c.header('x-content-type-options','nosniff');c.header('referrer-policy','no-referrer');await next()})
integrationApi.onError((error,c)=>{
 if(error instanceof Problem)return c.json({error:error.message},error.status as 400)
 if(/constraint|SQLITE_CONSTRAINT/i.test(error.message))return c.json({error:'Record, replay key or authority changed. Review before retrying.'},409)
 console.error('Integration request failed',error.name)
 return c.json({error:'Integration request could not be completed.'},500)
})
integrationApi.get(prefix+'/openapi.json',c=>c.json(openapi))
integrationApi.post(prefix+'/tokens',async c=>{
 const env=runtimeBindings(c.env),actor=await owner(c.req.raw,env),body=await jsonBody(c.req.raw)
 insist(Object.keys(body).every(k=>['label','scopes','accountIds','accountScope','requestsPerMinute','expiresDays'].includes(k)),'Unsupported token setting.')
 insist(Array.isArray(body.scopes)&&body.scopes.length>0&&body.scopes.every(s=>['accounts.read','accounts.write'].includes(s)),'Choose explicit account scopes.')
 const accountScope=body.accountScope??'explicit'
 insist(accountScope==='explicit'||accountScope==='all','Choose explicit account IDs or all accounts.')
 if(accountScope==='all')insist(body.accountIds===undefined||(Array.isArray(body.accountIds)&&body.accountIds.length===0),'An all-accounts grant must not include explicit IDs.')
 else insist(Array.isArray(body.accountIds)&&body.accountIds.length>0&&body.accountIds.length<=50&&body.accountIds.every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v)),'Choose between 1 and 50 explicit account IDs.')
 const label=body.label===undefined?'Integration credential':text(body.label,'Credential label',100)
 const scopes=JSON.stringify([...new Set(body.scopes)].sort()),accountIds=JSON.stringify(accountScope==='all'?[]:[...new Set(body.accountIds as string[])].sort())
 const limit=integer(body.requestsPerMinute,1,600,'Request limit'),days=integer(body.expiresDays,1,365,'Expiry days')
 const tokenId=id(),secret=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join(''),expiresAt=Date.now()+days*86400000
 await env.DB.batch([
  guard(env.DB,"(SELECT count(*) FROM buoy_integration_tokens WHERE revoked_at IS NULL AND expires_at>?)<50",Date.now()),
  stmt(env.DB,"INSERT INTO buoy_integration_tokens(id,token_hash,owner_id,owner_version,scopes,account_ids,account_scope,label,created_at,requests_per_minute,expires_at) SELECT ?,?,id,version,?,?,?,?,?,?,? FROM oa_operators WHERE id=? AND status='active' AND role='owner'",tokenId,await digest(secret),scopes,accountIds,accountScope,label,now(),limit,expiresAt,actor.id),
  auditIfChanged(env.DB,actor,'integration.credential-issued','integration:'+tokenId),stmt(env.DB,'DELETE FROM buoy_assertions')
 ])
 // Verify issuance rather than returning a credential if owner authority changed.
 insist(await stmt(env.DB,'SELECT 1 FROM buoy_integration_tokens WHERE id=?',tokenId).first(),'Owner authority changed.',403)
 return c.json({id:tokenId,label,token:secret,scopes:JSON.parse(scopes),accountIds:JSON.parse(accountIds),accountScope,requestsPerMinute:limit,expiresAt},201)
})
integrationApi.get(prefix+'/tokens',async c=>{
 const env=runtimeBindings(c.env);await owner(c.req.raw,env)
 const rows=await stmt(env.DB,`SELECT t.id,t.label,t.scopes,t.account_ids,t.account_scope,t.requests_per_minute,t.expires_at,t.created_at,t.last_used_at,t.revoked_at,t.revoked_reason,t.owner_id,o.display_name,
 CASE WHEN t.revoked_at IS NOT NULL THEN COALESCE(t.revoked_reason,'revocation')
 WHEN o.id IS NULL OR o.status<>'active' OR o.role<>'owner' OR o.version<>t.owner_version THEN 'issuer_change'
 WHEN t.expires_at<=? THEN 'expiry' ELSE NULL END AS stopped_reason
 FROM buoy_integration_tokens t LEFT JOIN oa_operators o ON o.id=t.owner_id ORDER BY t.created_at DESC,t.id`,Date.now()).all<{id:string;label:string;scopes:string;account_ids:string;account_scope:string;requests_per_minute:number;expires_at:number;created_at:string|null;last_used_at:string|null;revoked_at:number|null;owner_id:string;display_name:string|null;stopped_reason:string|null}>()
 return c.json({items:rows.results.map(t=>({id:t.id,label:t.label,scopes:JSON.parse(t.scopes),accountIds:JSON.parse(t.account_ids),accountScope:t.account_scope,requestsPerMinute:t.requests_per_minute,expiresAt:t.expires_at,createdAt:t.created_at,lastUsedAt:t.last_used_at,issuer:{id:t.owner_id,displayName:t.display_name},stoppedReason:t.stopped_reason,expiringSoon:t.stopped_reason===null&&t.expires_at<=Date.now()+14*86400000}))})
})
integrationApi.delete(prefix+'/tokens/:id',async c=>{
 const env=runtimeBindings(c.env),actor=await owner(c.req.raw,env),tokenId=c.req.param('id')
 await env.DB.batch([guard(env.DB,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')",actor.id),stmt(env.DB,"UPDATE buoy_integration_tokens SET revoked_at=?,revoked_reason='revocation' WHERE id=? AND revoked_at IS NULL",Date.now(),tokenId),auditIfChanged(env.DB,actor,'integration.credential-revoked','integration:'+tokenId),stmt(env.DB,'DELETE FROM buoy_assertions')])
 return c.json({status:'revoked'})
})
// No cookie fallback and no browser CORS. Integration secrets stay on a server.
integrationApi.use(prefix+'/*',async(c,next)=>{
 const env=runtimeBindings(c.env),request=c.req.raw,url=new URL(request.url)
 insist(url.origin===env.AUTH_ORIGIN&&(!request.headers.has('host')||request.headers.get('host')===url.host),'Invalid request host.',403)
 insist(!request.headers.has('origin')&&!['sec-fetch-site','sec-fetch-dest','sec-fetch-user'].some(k=>request.headers.has(k)),'Server integrations only.',403)
 const authorization=request.headers.get('authorization')??''
 insist(/^Bearer [a-f0-9]{64}$/.test(authorization),'A scoped integration token is required.',401)
 const token=await stmt(env.DB,"SELECT t.* FROM buoy_integration_tokens t JOIN oa_operators o ON o.id=t.owner_id WHERE t.token_hash=? AND t.revoked_at IS NULL AND t.expires_at>? AND o.status='active' AND o.role='owner' AND o.version=t.owner_version",await digest(authorization.slice(7)),Date.now()).first<Token>()
 insist(token,'Integration token is expired or revoked.',401)
 const minute=Math.floor(Date.now()/60000),retryAfter=Math.max(1,Math.ceil(((minute+1)*60000-Date.now())/1000))
 const results=await env.DB.batch([
  fence(env.DB,token),
  stmt(env.DB,'INSERT INTO buoy_integration_minutes(token_id,minute,requests) VALUES(?,?,1) ON CONFLICT(token_id,minute) DO UPDATE SET requests=requests+1 RETURNING requests',token.id,minute),
  stmt(env.DB,'UPDATE buoy_integration_tokens SET last_used_at=? WHERE id=?',now(),token.id),
  stmt(env.DB,'DELETE FROM buoy_integration_minutes WHERE token_id=? AND minute<?',token.id,minute-1),stmt(env.DB,'DELETE FROM buoy_assertions')
 ])
 c.header('RateLimit-Limit',String(token.requests_per_minute));c.header('RateLimit-Reset',String(retryAfter))
 if(Number((results[1].results[0] as {requests:number}).requests)>token.requests_per_minute){c.header('Retry-After',String(retryAfter));throw new Problem(429,'Token request limit reached. Retry after the indicated seconds.')}
 c.set('token',token);await next()
})
integrationApi.get(prefix+'/accounts',async c=>{
 const t=c.get('token'),env=runtimeBindings(c.env);scope(t,'accounts.read')
 const raw=c.req.query('limit')??'50',after=c.req.query('after')??''
 insist(/^\d+$/.test(raw),'Invalid page limit.');const limit=integer(Number(raw),1,100,'Page limit')
 insist(after===''||/^[A-Za-z0-9_-]{1,64}$/.test(after),'Invalid page cursor.')
 const rows=await stmt(env.DB,`SELECT document,revision FROM buoy_accounts WHERE (?='all' OR id IN(SELECT value FROM json_each(?))) AND id>? ORDER BY id LIMIT ?`,t.account_scope,t.account_ids,after,limit+1).all<{document:string;revision:string}>()
 return c.json({items:rows.results.slice(0,limit).map(r=>({...JSON.parse(r.document),revision:r.revision})),next:rows.results.length>limit?JSON.parse(rows.results[limit-1].document).id:null})
})
integrationApi.get(prefix+'/accounts/:id',async c=>{const t=c.get('token');scope(t,'accounts.read');accountScope(t,c.req.param('id')!);return c.json(await account(runtimeBindings(c.env).DB,c.req.param('id')!))})

async function write(db:D1Database,t:Token,request:Request,accountId?:string){
 scope(t,'accounts.write')
 const rawKey=request.headers.get('idempotency-key')??''
 insist(/^[A-Za-z0-9._-]{1,128}$/.test(rawKey),'Send an Idempotency-Key of 1 to 128 letters, numbers, dots, underscores or hyphens.')
 const body=await jsonBody(request)
 let value:ReturnType<typeof parseAccount>
 try{const {revision:_revision,...input}=body;value=parseAccount({...input,id:accountId??body.id})}catch(error){throw new Problem(400,(error as Error).message)}
 if(accountId)insist(!body.id||body.id===accountId,'Body ID must match the account path.')
 accountScope(t,value.id)
 const key=await digest(rawKey),fingerprint=await digest(canonicalJson({method:request.method,path:new URL(request.url).pathname,body}))
 const receipt=()=>stmt(db,'SELECT request_hash,account_id,revision,status FROM buoy_integration_receipts WHERE token_id=? AND key_hash=?',t.id,key).first<Receipt>()
 const replay=await receipt()
 if(replay){insist(replay.request_hash===fingerprint,'Idempotency key was already used for a different request.',409);return replay}
 const revision=id(),status=accountId?200:201,statements:D1PreparedStatement[]=[]
 if(accountId){
  insist(typeof body.revision==='string','An update requires the current revision.')
  const prior=await account(db,accountId);insist(prior.revision===body.revision,'Account changed. Reload before saving.',409)
  if(prior.migrationHealth)value.migrationHealth=prior.migrationHealth
  if(prior.migrationJourneys)value.migrationJourneys=prior.migrationJourneys
  statements.push(guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)',accountId,body.revision),stmt(db,'UPDATE buoy_accounts SET document=?,revision=? WHERE id=?',canonicalJson(value),revision,accountId))
 }else{
  const erased=notErasedSql(value.id)
  statements.push(guard(db,erased.sql,...erased.params??[]),guard(db,'(SELECT count(*) FROM buoy_accounts)<500'),stmt(db,'INSERT INTO buoy_accounts(id,document,revision,created_at) VALUES(?,?,?,?)',value.id,canonicalJson(value),revision,now()))
 }
 try{
  await db.batch([fence(db,t),
   stmt(db,'INSERT INTO buoy_integration_receipts(token_id,key_hash,request_hash,account_id,revision,status) VALUES(?,?,?,?,?,?)',t.id,key,fingerprint,value.id,revision,status),
   ...statements,
   stmt(db,'INSERT OR IGNORE INTO buoy_audit_subjects(account_id,subject) VALUES(?,lower(hex(randomblob(16))))',value.id),
   stmt(db,"INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) SELECT ?,?,?,subject,'',? FROM buoy_audit_subjects WHERE account_id=?",id(),'integration:'+t.id,accountId?'account.updated':'account.created',now(),value.id),
   stmt(db,'DELETE FROM buoy_assertions')])
 }catch(error){
  // A concurrent identical request may have won the atomic receipt reservation.
  const won=await receipt();if(won){insist(won.request_hash===fingerprint,'Idempotency key was already used for a different request.',409);return won}throw error
 }
 return {request_hash:fingerprint,account_id:value.id,revision,status}
}
async function respond(c:Context<{Bindings:Bindings;Variables:{token:Token}}>,accountId?:string){
 const env=runtimeBindings(c.env),t=c.get('token'),result=await write(env.DB,t,c.req.raw,accountId)
 // Consumers use the existing owner-approved native path. Replays repair an
 // interrupted refresh without repeating the account write or its audit entry.
 // Concurrent receipts can reach a consumer with an older source snapshot.
 // Recompute only failed transaction fences; the committed receipt, account
 // effect and mail reservations remain idempotent. Provider failures never retry.
 for(let attempt=0;;attempt++){
  try{await refreshAccountConsumers(env,ownerActor(t));break}
  catch(error){if(attempt>=4||!(error instanceof Error)||!/constraint|SQLITE_CONSTRAINT/i.test(error.message))throw error;await env.DB.batch([fence(env.DB,t),stmt(env.DB,'DELETE FROM buoy_assertions')])}
 }
 return c.json({id:result.account_id,revision:result.revision},result.status as 200)
}
integrationApi.post(prefix+'/accounts',c=>respond(c))
integrationApi.put(prefix+'/accounts/:id',c=>respond(c,c.req.param('id')))
