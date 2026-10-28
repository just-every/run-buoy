import {accountAudit} from '../audit-records'
import {authority,guard,id,insist,now,requirePerson,stmt,text,type Actor} from '../core'

export async function onboardingProjects(db:D1Database,accountId:string){
 return (await stmt(db,`SELECT p.id,p.plan_id AS planId,p.name,p.revision,p.created_at AS createdAt,
 count(t.id) AS total,sum(CASE WHEN t.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed,
 sum(CASE WHEN t.completed_at IS NULL AND t.due_date<? THEN 1 ELSE 0 END) AS overdue
 FROM buoy_onboarding_projects p LEFT JOIN buoy_tasks t ON t.onboarding_project_id=p.id
 WHERE p.account_id=? GROUP BY p.id ORDER BY p.created_at,p.id`,now().slice(0,10),accountId).all<{id:string;planId:string;name:string;revision:string;createdAt:string;total:number;completed:number;overdue:number}>()).results
}
export async function startOnboardingProject(db:D1Database,actor:Actor,accountId:string,input:Record<string,unknown>){
 requirePerson(actor,true)
 insist(Object.keys(input).every(key=>['planId','planRevision','name','taskIds'].includes(key)),'Unsupported onboarding project property.')
 const planId=text(input.planId,'Reviewed plan',100),planRevision=text(input.planRevision,'Plan revision',100),name=text(input.name,'Project name',200)
 const plan=await stmt(db,'SELECT customer_owner_id AS personId,document FROM buoy_success_plans WHERE id=? AND account_id=? AND revision=?',planId,accountId,planRevision).first<{personId:string;document:string}>()
 insist(plan?.personId,'Choose a current customer owner and reviewed plan.',409)
 const taskIds=input.taskIds;insist(Array.isArray(taskIds)&&taskIds.length>0&&taskIds.length<=50&&taskIds.every(value=>typeof value==='string')&&new Set(taskIds).size===taskIds.length,'Choose the approved customer tasks for this project.')
 const linked=JSON.parse(plan.document).taskIds??[];insist(taskIds.every(taskId=>linked.includes(taskId)),'Use approved tasks linked to this reviewed plan.')
 const projectId=id(),stamp=now()
 await db.batch([authority(db,actor,true),guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')",actor.id),
  guard(db,'EXISTS(SELECT 1 FROM buoy_success_plans WHERE id=? AND account_id=? AND revision=? AND customer_owner_id=?)',planId,accountId,planRevision,plan.personId),
  guard(db,"EXISTS(SELECT 1 FROM buoy_customer_people c JOIN buoy_customer_memberships m ON m.person_id=c.id WHERE c.id=? AND c.kind='contact' AND m.account_id=?)",plan.personId,accountId),
  ...taskIds.map(taskId=>guard(db,'EXISTS(SELECT 1 FROM buoy_tasks WHERE id=? AND account_id=? AND onboarding_project_id IS NULL AND completed_at IS NULL)',taskId,accountId)),
  stmt(db,'INSERT INTO buoy_onboarding_projects(id,account_id,plan_id,name,revision,created_at) VALUES(?,?,?,?,?,?)',projectId,accountId,planId,name,id(),stamp),
  ...taskIds.map(taskId=>stmt(db,"UPDATE buoy_tasks SET onboarding_project_id=?,customer_person_id=?,type='onboarding' WHERE id=?",projectId,plan.personId,taskId)),
  stmt(db,'UPDATE buoy_portal_grants SET revoked_at=? WHERE plan_id=? AND revoked_at IS NULL',stamp,planId),
  ...accountAudit(db,actor,accountId,'onboarding.project-started'),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:projectId}
}
