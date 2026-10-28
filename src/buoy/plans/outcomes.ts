import {auditRecord} from '../audit-records'
import {authority,guard,id,insist,now,requirePerson,stmt,text,type Actor} from '../core'
import {snapshot,fence,definitions} from '../segments/snapshot'
import {inputImage} from '../scorecards/inputs'
import {PLAN_SQL,planProjection,type PlanRow,type Objective} from './model'
import type {Definition,Subject} from '../outcomes/types'
export async function planOutcomeImage(db:D1Database,at:Date){
 const raw=(await db.prepare(PLAN_SQL).first<{snapshot:string}>())!.snapshot,rows=JSON.parse(raw) as PlanRow[],inputs=await inputImage(db,at)
 return {raw,rows,inputs,plans:rows.map(r=>planProjection(r,inputs.accounts.find(a=>a.accountId===r.accountId)?.inputs.values??{})),fences:()=>[guard(db,`(${PLAN_SQL})=?`,raw),...inputs.fences.map(f=>guard(db,`(${f.sql})=?`,f.raw))]}
}
const criterion=(o:Objective)=>JSON.stringify({id:o.id,title:o.title,dueOn:o.dueOn,kind:o.kind,field:o.field,target:o.target,direction:o.direction})
export async function startPlanOutcome(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor)
 insist(Object.keys(input).every(k=>['name','segmentId','kind','windowDays','planIds','objectiveId','operationKey'].includes(k)),'Unsupported plan outcome property.')
 insist(input.kind==='plan-objective','Choose a plan objective outcome.')
 const operationKey=text(input.operationKey,'Operation key',200),prior=await stmt(db,'SELECT id,document FROM buoy_outcomes WHERE operation_key=?',operationKey).first<{id:string;document:string}>()
 const operationInput=JSON.stringify({name:input.name,segmentId:input.segmentId,kind:input.kind,windowDays:input.windowDays,planIds:input.planIds,objectiveId:input.objectiveId})
 if(prior){const definition=JSON.parse(prior.document);insist(definition.kind==='plan-objective'&&definition.operationInput===operationInput,'Operation key belongs to a different reviewed outcome.',409);return {id:prior.id}}
 insist(Array.isArray(input.planIds)&&input.planIds.length>0&&input.planIds.length<=500,'Choose 1 to 500 plans.')
 const planIds=input.planIds.map(v=>text(v,'Plan',100));insist(new Set(planIds).size===planIds.length,'Plan ids must be unique.')
 const at=new Date(),image=await planOutcomeImage(db,at),segments=await snapshot(db),segmentId=text(input.segmentId,'Segment',100),segment=definitions(segments.value).find(s=>s.id===segmentId);insist(segment,'Choose an existing segment.')
 const objectiveId=text(input.objectiveId,'Objective',100),selected=planIds.map(pid=>{const p=image.plans.find(p=>p.id===pid);insist(p,'Choose an existing plan.');return p})
 insist(new Set(selected.map(p=>p.accountId)).size===selected.length,'Choose one plan per enrolled account.')
 const first=selected[0].objectives.find(o=>o.id===objectiveId);insist(first,'Choose an objective in the selected plan.')
 const unsatisfied=(o:ReturnType<typeof planProjection>['objectives'][number])=>o.status==='in-progress'||o.status==='awaiting-customer-confirmation'
 const matches=(p:typeof selected[number])=>p.objectives.find(o=>criterion(o)===criterion(first))
 insist(selected.every(p=>matches(p)&&unsatisfied(matches(p)!)),'Choose matching objectives with an unsatisfied baseline.')
 const members=new Set(segments.value.entries.filter(e=>e.segmentId===segmentId&&!e.exitedAt).map(e=>e.accountId));insist(selected.every(p=>members.has(p.accountId)),'Every enrolled account must belong to the segment.')
 const enrolled=new Set(selected.map(p=>p.id)),subjects=[...selected]
 for(const aid of [...members].sort())if(!subjects.some(p=>p.accountId===aid)){
  const matching=image.plans.filter(p=>p.accountId===aid&&matches(p));insist(matching.every(p=>matches(p)!.status!=='unavailable'),'Comparison metric evidence is unavailable. Review sources before starting.');const candidates=matching.filter(p=>unsatisfied(matches(p)!));insist(candidates.length<=1,'Comparison account has several matching plans. Select an unambiguous cohort.');if(candidates[0])subjects.push(candidates[0])
 }
 insist(Number.isInteger(input.windowDays)&&Number(input.windowDays)>=1&&Number(input.windowDays)<=365,'Observation window is 1 to 365 whole UTC days.')
 const reportId=id(),startedAt=at.toISOString(),deadline=new Date(at.getTime()+Number(input.windowDays)*86400000).toISOString(),definition:Definition={name:text(input.name,'Report name',100),segmentId,segmentName:segment.name,kind:'plan-objective',windowDays:Number(input.windowDays),objectiveId,operationInput}
 await db.batch([authority(db,actor,true),fence(db,segments),...image.fences(),stmt(db,'INSERT INTO buoy_outcomes(id,document,started_at,deadline,created_by,operation_key) VALUES(?,?,?,?,?,?)',reportId,JSON.stringify(definition),startedAt,deadline,actor.id,operationKey),...subjects.map(p=>stmt(db,'INSERT INTO buoy_outcome_accounts(report_id,account_id,cohort,baseline_revision,plan_id,plan_revision,plan_objective,plan_customer_id) SELECT ?,?,?,revision,?,?,?,? FROM buoy_accounts WHERE id=?',reportId,p.accountId,enrolled.has(p.id)?'enrolled':'comparison',p.id,p.revision,criterion(matches(p)!),p.customerOwnerId,p.accountId)),auditRecord(db,actor,'plan.outcome-started','outcome:'+reportId),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:reportId}
}
export function observedPlanEvidence(image:Awaited<ReturnType<typeof planOutcomeImage>>,subject:Subject,definition:Definition){
 const p=image.plans.find(p=>p.id===subject.plan_id&&p.customerOwnerId===subject.plan_customer_id),o=p?.objectives.find(o=>o.id===definition.objectiveId)
 return o?.status==='achieved'&&criterion(o)===subject.plan_objective?`Plan objective ${o.id} achieved at reviewed plan revision ${p!.revision}`:null
}
