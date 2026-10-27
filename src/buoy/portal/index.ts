import {Hono} from 'hono'
import {actorFor,jsonBody} from '../access'
import {operatorAuth,type Bindings} from '../../auth.server'
import {accountAudit,auditRecord} from '../audit-records'
import {authority,guard,id,insist,now,Problem,requirePerson,stmt,text,type Actor} from '../core'
import {PLAN_SQL,planProjection,type PlanRow} from '../plans/model'
import {inputImage} from '../scorecards/inputs'
import {recalculateScorecards} from '../scorecards'

// Every read and atomic write uses the same live authority predicate.
const LIVE=`g.revoked_at IS NULL AND g.expires_at>? AND p.revision=g.plan_revision
 AND p.customer_owner_id=g.person_id AND c.kind='contact'
 AND EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.person_id=g.person_id AND m.account_id=g.account_id)
 AND o.status='active' AND o.role='member' AND o.version=g.operator_version AND o.email=r.email
 AND NOT EXISTS(SELECT 1 FROM buoy_role_assignments a WHERE a.person_id=o.id)
 AND w.status='active' AND w.role='owner' AND w.version=g.owner_version`
const FROM=`buoy_portal_grants g JOIN buoy_success_plans p ON p.id=g.plan_id JOIN buoy_customer_people c ON c.id=g.person_id JOIN oa_operators o ON o.id=g.operator_id JOIN buoy_portal_recipients r ON r.operator_id=o.id JOIN oa_operators w ON w.id=g.owner_id`
async function grant(db:D1Database,actor:Actor,grantId:string){
 insist(actor.kind==='person'&&actor.role==='member','Customer access is required.',403)
 const sql=`SELECT g.* FROM ${FROM} WHERE g.id=? AND g.operator_id=? AND ${LIVE}`
 const row=await stmt(db,sql,grantId,actor.id,Date.now()).first<{id:string;account_id:string;plan_id:string;plan_revision:string;person_id:string;revision:string;task_ids:string}>()
 insist(row,'This shared plan is unavailable or access has stopped.',403)
 return {row,fence:()=>guard(db,`EXISTS(${sql})`,grantId,actor.id,Date.now())}
}
export async function portalState(db:D1Database,actor:Actor,grantId:string){
 const {row,fence}=await grant(db,actor,grantId)
 const snapshot=JSON.parse((await db.prepare(PLAN_SQL).first<{snapshot:string}>())!.snapshot) as PlanRow[],plan=snapshot.find(p=>p.id===row.plan_id)!
 const image=await inputImage(db,new Date()),values=image.accounts.find(a=>a.accountId===row.account_id)!.inputs.values,projected=planProjection(plan,values)
 const tasks=(await stmt(db,'SELECT id,title,completed_at AS completedAt FROM buoy_tasks WHERE account_id=? AND id IN (SELECT value FROM json_each(?)) ORDER BY id',row.account_id,row.task_ids).all<{id:string;title:string;completedAt:string|null}>()).results
 const comments=(await stmt(db,"SELECT id,body,recorded_at AS recordedAt FROM buoy_portal_events WHERE plan_id=? AND kind='comment' ORDER BY recorded_at,id",row.plan_id).all<{id:string;body:string;recordedAt:string}>()).results
 await db.batch([fence(),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:row.id,revision:row.revision,accountId:row.account_id,planId:row.plan_id,planRevision:row.plan_revision,name:projected.name,objectives:projected.objectives.map(o=>({id:o.id,title:o.title,kind:o.kind,dueOn:o.dueOn,status:o.status})),milestones:(projected.milestones??[]).map(m=>({id:m.id,title:m.title,objectiveId:m.objectiveId})),tasks,comments}
}
export async function sharingState(db:D1Database,actor:Actor,accountId:string){
 requirePerson(actor,true)
 return {grants:(await stmt(db,`SELECT g.id,g.plan_id AS planId,g.person_id AS personId,o.email,g.revision,g.expires_at AS expiresAt,CASE WHEN g.revoked_at IS NOT NULL THEN 'Revoked' WHEN g.expires_at<=? THEN 'Expired' WHEN p.revision!=g.plan_revision THEN 'Plan changed' WHEN NOT (${LIVE}) THEN 'Authority changed' ELSE 'Active' END AS status FROM ${FROM} WHERE g.account_id=? ORDER BY g.created_at,g.id`,Date.now(),Date.now(),accountId).all<{id:string;planId:string;personId:string;email:string;revision:string;expiresAt:number;status:string}>()).results}
}
export async function sharePlan(db:D1Database,actor:Actor,accountId:string,input:Record<string,unknown>){
 requirePerson(actor,true)
 const planId=text(input.planId,'Plan',100),revision=text(input.planRevision,'Plan revision',100),email=text(input.email,'Confirmed recipient email',254).toLowerCase(),days=Number(input.days)
 insist(Number.isInteger(days)&&days>=1&&days<=365,'Choose 1 to 365 days.')
 const plan=await stmt(db,'SELECT customer_owner_id,document FROM buoy_success_plans WHERE id=? AND account_id=? AND revision=?',planId,accountId,revision).first<{customer_owner_id:string;document:string}>();insist(plan,'Plan changed. Reload before sharing.',409)
 const recipient=await stmt(db,"SELECT id,version,email FROM oa_operators WHERE email=? AND role='member' AND status='active' AND last_signin_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM buoy_role_assignments WHERE person_id=oa_operators.id)",email).first<{id:string;version:number;email:string}>();insist(recipient,'Choose a confirmed non-staff recipient invited through Access.',409)
 const personId=plan.customer_owner_id;insist(personId,'Choose the customer owner before sharing.',409)
 const taskIds=input.taskIds??[];insist(Array.isArray(taskIds)&&taskIds.length<=50&&taskIds.every(v=>typeof v==='string'),'Choose customer tasks explicitly.')
 const linked=JSON.parse(plan.document).taskIds??[];insist(new Set(taskIds).size===taskIds.length&&taskIds.every(v=>linked.includes(v)),'Only tasks linked to this reviewed plan can be shared.')
 const grantId=id(),stamp=now()
 await db.batch([authority(db,actor,true),guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')",actor.id),
 guard(db,'EXISTS(SELECT 1 FROM buoy_success_plans WHERE id=? AND account_id=? AND revision=? AND customer_owner_id=?)',planId,accountId,revision,personId),
 guard(db,"EXISTS(SELECT 1 FROM buoy_customer_people p JOIN buoy_customer_memberships m ON m.person_id=p.id WHERE p.id=? AND p.kind='contact' AND m.account_id=?)",personId,accountId),
 guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=? AND version=? AND role='member' AND status='active' AND last_signin_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM buoy_role_assignments WHERE person_id=?))",recipient.id,email,recipient.version,recipient.id),
 ...taskIds.map(t=>guard(db,'EXISTS(SELECT 1 FROM buoy_tasks WHERE id=? AND account_id=?)',t,accountId)),
 stmt(db,'INSERT INTO buoy_portal_recipients(operator_id,email) VALUES(?,?) ON CONFLICT(operator_id) DO UPDATE SET email=excluded.email',recipient.id,email),
 stmt(db,'UPDATE buoy_portal_grants SET revoked_at=? WHERE plan_id=? AND operator_id=? AND revoked_at IS NULL',stamp,planId,recipient.id),
 stmt(db,"INSERT INTO buoy_portal_grants(id,account_id,plan_id,plan_revision,person_id,operator_id,operator_version,owner_id,owner_version,revision,task_ids,expires_at,created_at) SELECT ?,?,?,?,?,?,?,id,version,?,?,?,? FROM oa_operators WHERE id=? AND role='owner' AND status='active'",grantId,accountId,planId,revision,personId,recipient.id,recipient.version,id(),JSON.stringify(taskIds),Date.now()+days*86400000,stamp,actor.id),
 ...accountAudit(db,actor,accountId,'portal.shared'),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:grantId,path:'/portal/'+grantId}
}
export const portalApi=new Hono<{Bindings:Bindings;Variables:{actor:Actor}}>()
portalApi.post('/api/buoy/portal-invitations',async c=>{
 const actor=await actorFor(c.req.raw,c.env);requirePerson(actor,true)
 const input=await jsonBody(c.req.raw),email=text(input.email,'Customer email',254).toLowerCase(),displayName=text(input.displayName,'Customer name',100)
 insist(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email),'Enter a valid customer email.')
 insist(!await stmt(c.env.DB,'SELECT 1 FROM oa_operators WHERE email=?',email).first(),'This email already has access. Confirm its identity before sharing a plan.',409)
 // Reserve customer-only separation before the native invitation can be consumed.
 await c.env.DB.batch([authority(c.env.DB,actor,true),guard(c.env.DB,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')",actor.id),stmt(c.env.DB,'INSERT INTO buoy_portal_recipients(operator_id,email) VALUES(?,?)','pending:'+email,email),auditRecord(c.env.DB,actor,'portal.invitation-requested','portal-invitation:'+id()),stmt(c.env.DB,'DELETE FROM buoy_assertions')])
 await operatorAuth(c.env).invite(c.req.raw,{email,displayName,role:'member',returnTo:'/portal'})
 return c.json({invited:true},202)
})
portalApi.use('/api/buoy/portal/*' ,async(c,next)=>{c.header('cache-control','no-store');c.header('referrer-policy','no-referrer');c.header('x-content-type-options','nosniff');c.set('actor',await actorFor(c.req.raw,c.env));await next()})
portalApi.get('/api/buoy/portal/home',async c=>{const actor=c.get('actor');insist(actor.kind==='person'&&actor.role==='member','Customer access is required.',403);return c.json({plans:(await stmt(c.env.DB,`SELECT g.id,json_extract(p.document,'$.name') AS name FROM ${FROM} WHERE g.operator_id=? AND ${LIVE} ORDER BY g.id`,actor.id,Date.now()).all<{id:string;name:string}>()).results})})
portalApi.get('/api/buoy/portal/:id',async c=>c.json(await portalState(c.env.DB,c.get('actor'),c.req.param('id'))))
portalApi.post('/api/buoy/portal/:id/action',async c=>{
 const actor=c.get('actor'),db=c.env.DB,{row,fence}=await grant(db,actor,c.req.param('id')),input=await jsonBody(c.req.raw)
 insist(input.revision===row.revision,'Access changed. Reload before continuing.',409)
 const stamp=now(),eventId=id(),statements:D1PreparedStatement[]=[fence()]
 let kind:string,body:string
 if(input.action==='confirm'){
  const objectiveId=text(input.objectiveId,'Objective',100),plan=await stmt(db,'SELECT document FROM buoy_success_plans WHERE id=?',row.plan_id).first<{document:string}>()
  insist(JSON.parse(plan!.document).objectives.some((o:{id:string;kind:string})=>o.id===objectiveId&&o.kind==='customer-statement'),'Only a customer statement can be confirmed.')
  body=text(input.statement,'Your confirmation statement',2000);kind='confirmation'
  statements.push(stmt(db,'INSERT INTO buoy_plan_confirmations(plan_id,plan_revision,objective_id,person_id,operator_id,statement,recorded_at) VALUES(?,?,?,?,?,?,?)',row.plan_id,row.plan_revision,objectiveId,row.person_id,actor.id,body,stamp))
 }else if(input.action==='complete-task'){
  const taskId=text(input.taskId,'Customer task',100);insist(JSON.parse(row.task_ids).includes(taskId),'This task is not shared with you.',403)
  kind='task-completed';body=text(input.evidence,'Completion evidence',2000)
  statements.push(guard(db,'EXISTS(SELECT 1 FROM buoy_tasks WHERE id=? AND account_id=? AND completed_at IS NULL)',taskId,row.account_id),stmt(db,'UPDATE buoy_tasks SET completed_at=?,outcome=?,evidence=? WHERE id=?',stamp,'Completed by customer','Customer receipt '+eventId,taskId))
 }else {insist(input.action==='comment','Choose an available customer action.');kind='comment';body=text(input.comment,'Comment',2000)}
 statements.push(stmt(db,'INSERT INTO buoy_portal_events(id,account_id,plan_id,person_id,operator_id,kind,body,recorded_at) VALUES(?,?,?,?,?,?,?,?)',eventId,row.account_id,row.plan_id,row.person_id,actor.id,kind,body,stamp),...accountAudit(db,actor,row.account_id,'portal.'+kind),stmt(db,'DELETE FROM buoy_assertions'))
 await db.batch(statements);await recalculateScorecards(db)
 return c.json({id:eventId},201)
})
portalApi.onError((error,c)=>c.json({error:error instanceof Problem?error.message:/constraint/i.test(error.message)?'This record changed or was already confirmed. Reload before continuing.':'Customer action unavailable.'},(error instanceof Problem?error.status:/constraint/i.test(error.message)?409:500) as 400))
