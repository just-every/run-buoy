import {planOutcomeImage,observedPlanEvidence} from '../plans/outcomes'
import { authority, stmt, type Actor } from '../core'
import { evaluated } from '../segments'
import { snapshot, fence } from '../segments/snapshot'
import type { Definition, ReportRow, Subject, Decision } from './types'
/** First observed evidence is durable; finishing a task never implies recovery. */
export async function observeOutcomes(db:D1Database,actor:Actor,at=new Date()) {
 const reports=(await db.prepare('SELECT * FROM buoy_outcomes ORDER BY started_at,id').all<ReportRow>()).results
 if(!reports.length)return
 const image=await snapshot(db),accounts=evaluated(image.value,at.toISOString().slice(0,10)),subjects=(await db.prepare('SELECT * FROM buoy_outcome_accounts WHERE reached_at IS NULL').all<Subject>()).results
 const decisions=(await db.prepare('SELECT id,account_id,outcome,recorded_at,reason,evidence FROM buoy_decisions ORDER BY recorded_at,id').all<Decision>()).results
 const plans=reports.some(r=>JSON.parse(r.document).kind==='plan-objective')?await planOutcomeImage(db,at):null
 const statements:D1PreparedStatement[]=[]
 for(const row of reports){
  const definition=JSON.parse(row.document) as Definition
  if(row.closed_at||at.toISOString()<row.started_at)continue
  if(at.toISOString()>row.deadline){statements.push(stmt(db,'UPDATE buoy_outcomes SET closed_at=? WHERE id=? AND closed_at IS NULL',at.toISOString(),row.id));continue}
  for(const subject of subjects.filter(s=>s.report_id===row.id)){
   const a=accounts.find(a=>a.account.id===subject.account_id);if(!a)continue
   const decision=decisions.find(d=>d.account_id===subject.account_id&&d.outcome==='renewed'&&d.recorded_at>=row.started_at&&d.recorded_at<=at.toISOString())
   const evidence=definition.kind==='plan-objective'?observedPlanEvidence(plans!,subject,definition):definition.kind==='healthy'?(a.values['health.status']==='healthy'?`Healthy evidence at account revision ${a.account.revision}: ${a.values['health.reasons']}`:null):decision?`Approved renewed decision ${decision.id} at ${decision.recorded_at}: ${decision.reason}; ${decision.evidence}`:null
   if(evidence)statements.push(stmt(db,'UPDATE buoy_outcome_accounts SET reached_at=?,evidence=? WHERE report_id=? AND account_id=? AND reached_at IS NULL AND EXISTS(SELECT 1 FROM buoy_outcomes WHERE id=report_id AND closed_at IS NULL)',at.toISOString(),evidence,row.id,a.account.id))
  }
 }
 if(statements.length)await db.batch([authority(db,actor),fence(db,image),...(plans?plans.fences():[]),...statements,stmt(db,'DELETE FROM buoy_assertions')])
}
