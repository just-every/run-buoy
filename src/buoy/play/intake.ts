import {Hono} from 'hono'
import {runtimeBindings,type Bindings} from '../../auth.server'
import {jsonBody} from '../access'
import {auditIfChanged,auditRecord} from '../audit-records'
import {authority,guard,id,insist,now,requirePerson,stmt,text,type Actor} from '../core'
import {enroll,advance} from './engine'
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')
export async function issueIntake(db:D1Database,actor:Actor,bookId:string,input:Record<string,unknown>){
 requirePerson(actor,true)
 insist(Object.keys(input).length===1&&Array.isArray(input.accountIds)&&input.accountIds.length>=1&&input.accountIds.length<=500,'Choose an explicit list of 1–500 accounts.')
 const accountIds=(input.accountIds as unknown[]).map(value=>text(value,'Allowed account',100));insist(new Set(accountIds).size===accountIds.length,'Allowed accounts must be unique.')
 const book=await stmt(db,"SELECT revision FROM buoy_playbooks WHERE id=? AND enabled=1 AND json_extract(document,'$.trigger.kind')='webhook'",bookId).first<{revision:string}>();insist(book,'Enable a webhook-triggered playbook before issuing intake authority.',409)
 const credentialId=id(),secret=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''),at=now()
 await db.batch([authority(db,actor,true),guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')",actor.id),guard(db,'(SELECT count(*) FROM buoy_accounts WHERE id IN(SELECT value FROM json_each(?)))=?',JSON.stringify(accountIds),accountIds.length),guard(db,"EXISTS(SELECT 1 FROM buoy_playbooks WHERE id=? AND revision=? AND enabled=1 AND json_extract(document,'$.trigger.kind')='webhook')",bookId,book.revision),stmt(db,'INSERT INTO buoy_playbook_credentials(id,playbook_id,version_id,digest,account_ids,created_by,created_at) VALUES(?,?,?,?,?,?,?)',credentialId,bookId,book.revision,await digest(secret),JSON.stringify(accountIds),actor.id,at),auditRecord(db,actor,'playbook.intake-issued',credentialId),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:credentialId,secret,playbookId:bookId,versionId:book.revision,accountIds,createdAt:at,warning:'Shown once. Server-only enrollment authority; no read or approval grant. A new publish requires reissue.'}
}
export async function revokeIntake(db:D1Database,actor:Actor,bookId:string,credentialId:string){
 requirePerson(actor,true)
 await db.batch([authority(db,actor,true),guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')",actor.id),stmt(db,'UPDATE buoy_playbook_credentials SET revoked_at=? WHERE id=? AND playbook_id=? AND revoked_at IS NULL',now(),credentialId,bookId),auditIfChanged(db,actor,'playbook.intake-revoked',credentialId),stmt(db,'DELETE FROM buoy_assertions')])
 return {revoked:true}
}
export async function intakeState(db:D1Database,actor:Actor,bookId:string){
 requirePerson(actor,true)
 return {credentials:(await stmt(db,'SELECT id,version_id AS versionId,account_ids AS accountIds,created_at AS createdAt,revoked_at AS revokedAt,last_used_at AS lastUsedAt FROM buoy_playbook_credentials WHERE playbook_id=? ORDER BY created_at,id',bookId).all<{id:string;versionId:string;accountIds:string;createdAt:string;revokedAt:string|null;lastUsedAt:string|null}>()).results.map(r=>({...r,accountIds:JSON.parse(r.accountIds)}))}
}
export const playIngest=new Hono<{Bindings:Bindings}>()
playIngest.post('/api/buoy/playbooks/intake/:id',async(c,next)=>{
 c.header('cache-control','no-store');c.header('x-content-type-options','nosniff');c.header('referrer-policy','no-referrer')
 const env=runtimeBindings(c.env),authorization=c.req.header('authorization'),match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization??''),hash=match?await digest(match[1]):'',bookId=c.req.param('id'),db=env.DB
 const predicate="k.digest=? AND k.playbook_id=? AND k.revoked_at IS NULL AND p.enabled=1 AND p.revision=k.version_id AND json_extract(p.document,'$.trigger.kind')='webhook' AND o.role='owner' AND o.status='active'"
 const key=match?await stmt(db,`SELECT k.id,k.account_ids FROM buoy_playbook_credentials k JOIN buoy_playbooks p ON p.id=k.playbook_id JOIN oa_operators o ON o.id=k.created_by WHERE ${predicate}`,hash,bookId).first<{id:string;account_ids:string}>():null
 // Only a recognized, current source grant takes this early path. Agent and
 // other bearer credentials keep the parent's normal attempt/refusal ledger.
 if(authorization&&!key){await next();return c.res}
 const url=new URL(c.req.url)
 insist(url.origin===env.AUTH_ORIGIN&&(!c.req.raw.headers.has('host')||c.req.header('host')===url.host),'Invalid request host.',403)
 insist(!c.req.raw.headers.has('origin')&&!['sec-fetch-site','sec-fetch-dest','sec-fetch-user'].some(name=>c.req.raw.headers.has(name)),'Server intake only. Relay authenticated product events through your server.',403)
 insist(key,'Intake credential required.',401)
 const minute=Math.floor(Date.now()/60000),at=now()
 const receipt=await db.batch([guard(db,`EXISTS(SELECT 1 FROM buoy_playbook_credentials k JOIN buoy_playbooks p ON p.id=k.playbook_id JOIN oa_operators o ON o.id=k.created_by WHERE ${predicate})`,hash,bookId),stmt(db,'INSERT INTO buoy_playbook_intake_limits(credential_id,minute,requests) VALUES(?,?,1) ON CONFLICT(credential_id,minute) DO UPDATE SET requests=requests+1 RETURNING requests',key.id,minute),stmt(db,'UPDATE buoy_playbook_credentials SET last_used_at=? WHERE id=?',at,key.id),stmt(db,'DELETE FROM buoy_assertions')])
 const reserved=Number((receipt[1].results[0] as {requests:number}).requests)
 c.header('RateLimit-Limit','60');c.header('RateLimit-Remaining',String(Math.max(0,60-reserved)));c.header('RateLimit-Reset',String((minute+1)*60))
 if(reserved>60){c.header('Retry-After',String(60-new Date().getUTCSeconds()));return c.json({error:'Intake limit is 60 requests per credential per minute.'},429)}
 const body=await jsonBody(c.req.raw);insist(Object.keys(body).every(k=>['accountId','operationKey'].includes(k)),'Intake accepts only accountId and operationKey.')
 const accountId=text(body.accountId,'Account',100);insist((JSON.parse(key.account_ids) as string[]).includes(accountId),'Account is outside this credential grant.',403)
 const fence=guard(db,`EXISTS(SELECT 1 FROM buoy_playbook_credentials k JOIN buoy_playbooks p ON p.id=k.playbook_id JOIN oa_operators o ON o.id=k.created_by WHERE ${predicate} AND EXISTS(SELECT 1 FROM json_each(k.account_ids) WHERE value=?))`,hash,bookId,accountId)
 const run=await enroll(db,undefined,bookId,{accountId,operationKey:'webhook:'+text(body.operationKey,'Source operation key',80)},new Date(),[fence])
 await advance(db,run.id)
 await stmt(db,'DELETE FROM buoy_playbook_intake_limits WHERE minute<?',minute-1440).run()
 return c.json({id:run.id,replayed:run.replayed,accepted:true,authority:'Enrollment only; no read or approval grant'},202)
})
