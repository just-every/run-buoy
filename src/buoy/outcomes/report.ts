import { insist, now } from '../core'
import { snapshot, definitions } from '../segments/snapshot'
import type { Definition, ReportRow, Subject } from './types'
export async function outcomeState(db:D1Database) {
 const reports=(await db.prepare('SELECT * FROM buoy_outcomes ORDER BY started_at,id').all<ReportRow>()).results
 const subjects=(await db.prepare('SELECT o.*,json_extract(a.document,\'$.name\') AS name FROM buoy_outcome_accounts o JOIN buoy_accounts a ON a.id=o.account_id ORDER BY a.id').all<Subject&{name:string}>()).results
 const summarize=(cohort:Subject['cohort'],report:ReportRow)=>subjects.filter(s=>s.report_id===report.id&&s.cohort===cohort).map(s=>({accountId:s.account_id,name:s.name,taskId:s.task_id,reachedAt:s.reached_at,evidence:s.evidence,elapsedHours:s.reached_at?(Date.parse(s.reached_at)-Date.parse(report.started_at))/3600000:null,status:s.reached_at?'reached':(report.closed_at||now()>report.deadline)?'missed':'observing'}))
 const mean=(items:ReturnType<typeof summarize>,startedAt:string)=>{const reached=items.filter(s=>s.reachedAt);return reached.length?reached.reduce((sum,s)=>sum+(Date.parse(s.reachedAt!)-Date.parse(startedAt))/3600000,0)/reached.length:null}
 return {segments:definitions((await snapshot(db)).value).map(s=>({id:s.id,name:s.name})),reports:reports.map(row=>{
  const enrolled=summarize('enrolled',row),comparison=summarize('comparison',row),rate=(items:typeof enrolled)=>items.length?items.filter(s=>s.reachedAt).length/items.length:0
  return {...JSON.parse(row.document) as Definition,id:row.id,startedAt:row.started_at,deadline:row.deadline,enrolled,comparison,rate:rate(enrolled),comparisonRate:rate(comparison),meanHours:mean(enrolled,row.started_at),comparisonMeanHours:mean(comparison,row.started_at)}
 })}
}
export async function outcomeReport(db:D1Database,reportId:string){const report=(await outcomeState(db)).reports.find(r=>r.id===reportId);insist(report,'Outcome report not found.',404);return report}
export function outcomeCsv(report:Awaited<ReturnType<typeof outcomeReport>>){
 const cell=(value:unknown)=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"'
 return [['Cohort','Account id','Account','Status','First observed UTC','Elapsed hours','Evidence'],...(['enrolled','comparison'] as const).flatMap(kind=>report[kind].map(a=>[kind,a.accountId,a.name,a.status,a.reachedAt,a.reachedAt?(Date.parse(a.reachedAt)-Date.parse(report.startedAt))/3600000:null,a.evidence]))].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
}
