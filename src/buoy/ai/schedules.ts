import {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {jsonBody} from '../access'
import {authority,guard,id,insist,now,requirePerson,stmt,text,type Actor} from '../core'
import {auditRecord} from '../audit-records'
import {account} from '../accounts'
import {question,settings} from './index'

interface Schedule {id:string;name:string;account_id:string;question:string;hour_utc:number;owner_id:string;owner_version:number;policy_revision:string;policy_document:string;revision:string;revoked_at:string|null;last_slot:string|null}
const active=(db:D1Database,row:Schedule)=>guard(db,`EXISTS(SELECT 1 FROM buoy_ai_schedules s JOIN oa_operators o ON o.id=s.owner_id WHERE s.id=? AND s.revision=? AND s.revoked_at IS NULL AND o.status='active' AND o.role='owner' AND o.version=s.owner_version)`,row.id,row.revision)
async function list(db:D1Database,actor:Actor){requirePerson(actor,true);return {schedules:(await db.prepare('SELECT * FROM buoy_ai_schedules ORDER BY name,id').all<Schedule>()).results.map(row=>({...row,feature:'questions',policy:JSON.parse(row.policy_document)}))}}
async function authorize(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor,true)
 insist(input.authorize===true&&input.feature==='questions','Explicitly authorize the named questions schedule.',403)
 const config=await settings(db);insist(config.enabled&&input.policyRevision===config.revision,'Review the current enabled model, data classes and cost policy.',409)
 const name=text(input.name,'Schedule name',100),prompt=text(input.question,'Question',500),accountId=text(input.accountId,'Account',100),hour=Number(input.hourUtc)
 insist(Number.isInteger(hour)&&hour>=0&&hour<=23,'Choose a whole UTC hour from 0 to 23.')
 await account(db,accountId)
 const owner=await stmt(db,"SELECT version FROM oa_operators WHERE id=? AND role='owner' AND status='active'",actor.id).first<{version:number}>();insist(owner,'Current owner required.',403)
 const key=id()
 await db.batch([authority(db,actor,true),guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active' AND version=?)",actor.id,owner.version),guard(db,'(SELECT revision FROM buoy_ai_settings WHERE singleton=1)=?',config.revision),stmt(db,'INSERT INTO buoy_ai_schedules(id,name,account_id,question,hour_utc,owner_id,owner_version,policy_revision,policy_document,revision) VALUES(?,?,?,?,?,?,?,?,?,?)',key,name,accountId,prompt,hour,actor.id,owner.version,config.revision,JSON.stringify(config),id()),auditRecord(db,actor,'ai.schedule-authorized','ai:'+key),stmt(db,'DELETE FROM buoy_assertions')])
 return list(db,actor)
}
async function revoke(db:D1Database,actor:Actor,key:string,input:Record<string,unknown>){
 requirePerson(actor,true)
 const row=await stmt(db,'SELECT * FROM buoy_ai_schedules WHERE id=?',key).first<Schedule>();insist(row,'Schedule unavailable.',404)
 insist(input.revision===row.revision,'Schedule changed. Reload.',409)
 await db.batch([authority(db,actor,true),guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')",actor.id),guard(db,'EXISTS(SELECT 1 FROM buoy_ai_schedules WHERE id=? AND revision=?)',key,row.revision),stmt(db,'UPDATE buoy_ai_schedules SET revoked_at=?,revision=? WHERE id=?',now(),id(),key),auditRecord(db,actor,'ai.schedule-revoked','ai:'+key),stmt(db,'DELETE FROM buoy_assertions')])
 return list(db,actor)
}
// Each UTC daily slot is reserved before the provider effect. Uncertain calls
// are never retried automatically. A changed policy requires fresh consent.
export async function runScheduledAi(env:Bindings,at:Date){
 const rows=(await stmt(env.DB,'SELECT * FROM buoy_ai_schedules WHERE revoked_at IS NULL AND hour_utc=? ORDER BY id',at.getUTCHours()).all<Schedule>()).results
 for(const row of rows){
 const slot=at.toISOString().slice(0,10),owner=await stmt(env.DB,"SELECT display_name FROM oa_operators WHERE id=? AND role='owner' AND status='active' AND version=?",row.owner_id,row.owner_version).first<{display_name:string}>()
 if(!owner||row.last_slot===slot)continue
 const actor:Actor={id:row.owner_id,role:'owner',kind:'person',displayName:owner.display_name}
 try{
  const config=await settings(env.DB);if(!config.enabled||config.revision!==row.policy_revision)continue
  const result=await question(env,actor,{accountId:row.account_id,question:row.question},[active(env.DB,row),guard(env.DB,'EXISTS(SELECT 1 FROM buoy_ai_schedules WHERE id=? AND (last_slot IS NULL OR last_slot<>?))',row.id,slot),stmt(env.DB,'UPDATE buoy_ai_schedules SET last_slot=? WHERE id=?',slot,row.id)])
  await auditRecord(env.DB,actor,'ai.schedule-completed','ai:'+row.id,'Request receipt '+result.requestId+'. Output not retained.').run()
 }catch{await auditRecord(env.DB,actor,'ai.schedule-refused','ai:'+row.id,'No automatic retry; inspect the request ledger before authorizing further work.').run()}
 }
}
export const scheduleApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
scheduleApi.get('/api/buoy/ai/schedules',async c=>c.json(await list(c.env.DB,c.get('actor'))))
scheduleApi.post('/api/buoy/ai/schedules',async c=>c.json(await authorize(c.env.DB,c.get('actor'),await jsonBody(c.req.raw)),201))
scheduleApi.delete('/api/buoy/ai/schedules/:id',async c=>c.json(await revoke(c.env.DB,c.get('actor'),c.req.param('id'),await jsonBody(c.req.raw))))
