import {accountAudit} from '../audit-records'
import {date,id,insist,now,stmt,text,type Actor} from '../core'
import type {PlanDocument} from '../plans/model'
import type {portalGrant} from './authority'

// Customer edits never widen the selected projection or retain publication authority.
export async function updateSharedPlan(db:D1Database,actor:Actor,access:Awaited<ReturnType<typeof portalGrant>>,input:Record<string,unknown>){
 const {row,fence}=access
 insist(input.revision===row.revision,'Access changed. Reload before continuing.',409)
 const stored=await stmt(db,'SELECT document FROM buoy_success_plans WHERE id=? AND revision=?',row.plan_id,row.plan_revision).first<{document:string}>()
 insist(stored,'Plan changed. Ask the account owner to review access.',409)
 const prior=JSON.parse(stored.document) as PlanDocument
 const allowed=['action','revision','name',...prior.objectives.flatMap(o=>['title:'+o.id,'due:'+o.id]),...(prior.milestones??[]).map(m=>'milestone:'+m.id)]
 insist(Object.keys(input).every(key=>allowed.includes(key)),'Only shared plan names, objective details and milestone titles can be edited.')
 const document:PlanDocument={...prior,name:input.name===undefined?prior.name:text(input.name,'Plan name',200),
  objectives:prior.objectives.map(o=>({...o,title:input['title:'+o.id]===undefined?o.title:text(input['title:'+o.id],'Business objective',500),dueOn:input['due:'+o.id]===undefined?o.dueOn:date(input['due:'+o.id],'Objective due date')})),
  milestones:(prior.milestones??[]).map(m=>({...m,title:input['milestone:'+m.id]===undefined?m.title:text(input['milestone:'+m.id],'Milestone title',500)}))}
 insist(JSON.stringify(document)!==stored.document,'Change a plan detail before submitting.')
 const revision=id(),stamp=now(),eventId=id(),encoded=JSON.stringify(document)
 await db.batch([fence(),
  stmt(db,'UPDATE buoy_success_plans SET document=?,revision=?,updated_at=? WHERE id=? AND revision=?',encoded,revision,stamp,row.plan_id,row.plan_revision),
  stmt(db,'INSERT INTO buoy_success_plan_history(id,plan_id,account_id,revision,document,actor_id,recorded_at) VALUES(?,?,?,?,?,?,?)',eventId,row.plan_id,row.account_id,revision,encoded,actor.id,stamp),
  stmt(db,'UPDATE buoy_portal_grants SET revoked_at=? WHERE plan_id=? AND revoked_at IS NULL',stamp,row.plan_id),
  stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),row.account_id),
  stmt(db,"INSERT INTO buoy_portal_events(id,account_id,plan_id,person_id,operator_id,kind,body,recorded_at) VALUES(?,?,?,?,?,'plan-updated',?,?)",eventId,row.account_id,row.plan_id,row.person_id,actor.id,'Customer updated the agreed plan. Owner review is required before sharing again.',stamp),
  ...accountAudit(db,actor,row.account_id,'portal.plan-updated'),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:row.plan_id,revision,reviewRequired:true}
}
