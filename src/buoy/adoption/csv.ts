import type { AdoptionReport } from './read'
import type { AdoptionSubject } from './types'

export function adoptionCsv(report:AdoptionReport){
 const cell=(value:unknown)=>{
  const raw=String(value??''),safe=typeof value==='number'?raw:raw.replace(/^[=+@\-\t\r]/,"'$&")
  return '"'+safe.replaceAll('"','""')+'"'
 }
 const rows:unknown[][]=[['On','Scope','ID','Name','Account IDs','Seats','Period','DAU','WAU','MAU','Events (30d)','Depth','Breadth','Utilization','Definition kind','Definition key','Definition name','Adopting people (30d)','Adoption fraction','Weekly change','Weekly drop','First value people','Mean first value seconds','Seat evidence','Seat history','Coverage','Interpretation']]
 const append=(scope:string,subject:AdoptionSubject)=>{
  for(const period of ['current','previous'] as const){
   const metric=subject.metrics[period],definitions=[...metric.features.map(d=>({...d,kind:'feature'})),...metric.modules.map(d=>({...d,kind:'module'}))]
   const prefix=[report.on,scope,subject.id,subject.name,subject.accountIds.join('; '),subject.seats,period,metric.dau,metric.wau,metric.mau,metric.eventCount,metric.depth,metric.breadth,metric.utilization]
   const suffix=[subject.metrics.weeklyChange,subject.metrics.weeklyDrop,subject.metrics.firstValue.people,subject.metrics.firstValue.meanSeconds,JSON.stringify(report.seatEvidence.filter(row=>subject.accountIds.includes(row.accountId))),JSON.stringify(report.seatHistory.filter(row=>subject.accountIds.includes(row.accountId))),JSON.stringify(report.coverage),report.interpretation]
   rows.push([...prefix,'','','','','',...suffix])
   for(const d of definitions)rows.push([...prefix,d.kind,d.key,d.name,d.people,d.fraction,...suffix])
  }
 }
 append('summary',report.summary)
 for(const [scope,subjects] of [['account',report.accounts],['person',report.people],['segment',report.segments]] as const)for(const subject of subjects)append(scope,subject)
 return rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
}
