import { auditRecord } from '../audit-records'
import { authority, id, insist, now, requirePerson, stmt, text, type Actor } from '../core'
import { evaluated } from '../segments'
import { snapshot, fence, definitions } from '../segments/snapshot'

import type { Definition, Decision } from './types'

export async function startOutcome(db:D1Database,actor:Actor,input:Record<string,unknown>) {
 requirePerson(actor)
 insist(Object.keys(input).every(k=>['name','segmentId','kind','windowDays','taskIds','operationKey'].includes(k)),'Unsupported outcome field.')
 const operationKey=text(input.operationKey,'Operation key',200),prior=await stmt(db,'SELECT id FROM buoy_outcomes WHERE operation_key=?',operationKey).first<{id:string}>()
 if(prior)return {id:prior.id}
 const image=await snapshot(db),segmentId=text(input.segmentId,'Segment',100),segment=definitions(image.value).find(s=>s.id===segmentId)
 insist(segment,'Choose an existing segment.')
 const name=text(input.name,'Report name',100),kind=input.kind
 insist(kind==='healthy'||kind==='renewed','Choose healthy evidence or an approved renewed decision.')
 insist(Number.isInteger(input.windowDays)&&Number(input.windowDays)>=1&&Number(input.windowDays)<=365,'Observation window is 1 to 365 whole UTC days.')
 insist(Array.isArray(input.taskIds)&&input.taskIds.length>0&&input.taskIds.length<=500,'Choose 1 to 500 approved tasks.')
 const taskIds=input.taskIds.map(v=>text(v,'Task id',100));insist(new Set(taskIds).size===taskIds.length,'Task ids must be unique.')
 const tasks=(await db.prepare('SELECT t.id,t.account_id,p.status FROM buoy_tasks t JOIN buoy_proposals p ON p.id=t.proposal_id ORDER BY t.id').all<{id:string;account_id:string;status:string}>()).results
 const selected=taskIds.map(tid=>{const task=tasks.find(t=>t.id===tid&&t.status==='approved');insist(task,'Only existing approved playbook tasks can be tracked.');return task})
 insist(new Set(selected.map(t=>t.account_id)).size===selected.length,'Choose one approved task per enrolled account.')
 const accounts=evaluated(image.value,new Date().toISOString().slice(0,10))
 const members=new Set(image.value.entries.filter(e=>e.segmentId===segmentId&&!e.exitedAt).map(e=>e.accountId))
 insist(selected.every(t=>members.has(t.account_id)),'Every enrolled account must currently belong to the chosen segment.')
 const decisions=(await db.prepare('SELECT id,account_id,outcome,recorded_at,reason,evidence FROM buoy_decisions ORDER BY recorded_at DESC,id DESC').all<Decision>()).results
 const satisfied=(aid:string)=>kind==='healthy'?accounts.find(a=>a.account.id===aid)?.values['health.status']==='healthy':decisions.find(d=>d.account_id===aid)?.outcome==='renewed'
 insist(selected.every(t=>!satisfied(t.account_id)),'The intended outcome is already satisfied for an enrolled account. Choose an unsatisfied baseline.')
 const definition:Definition={name,segmentId,segmentName:segment.name,kind,windowDays:Number(input.windowDays)},reportId=id(),startedAt=now(),deadline=new Date(Date.parse(startedAt)+definition.windowDays*86400000).toISOString()
 const enrolled=new Map(selected.map(t=>[t.account_id,t.id]))
 // Freeze both source revisions and the cohort membership in the same fenced batch.
 const subjects=accounts.filter(a=>members.has(a.account.id)&&(enrolled.has(a.account.id)||!satisfied(a.account.id)))
 await db.batch([authority(db,actor,true),fence(db,image),
  stmt(db,'INSERT INTO buoy_outcomes(id,document,started_at,deadline,created_by,operation_key) VALUES(?,?,?,?,?,?)',reportId,JSON.stringify(definition),startedAt,deadline,actor.id,operationKey),
  ...subjects.map(a=>stmt(db,'INSERT INTO buoy_outcome_accounts(report_id,account_id,task_id,cohort,baseline_revision) VALUES(?,?,?,?,?)',reportId,a.account.id,enrolled.get(a.account.id)??null,enrolled.has(a.account.id)?'enrolled':'comparison',a.account.revision)),
  auditRecord(db,actor,'playbook.outcome-started',`outcome:${reportId}`),stmt(db,'DELETE FROM buoy_assertions')])
 return {id:reportId}
}
