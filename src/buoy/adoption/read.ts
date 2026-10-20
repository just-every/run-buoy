import { authority, insist, stmt, type Actor } from '../core'
import { ATTRIBUTED, MAPPED_JOIN } from '../usage/mappings'
import { BASE, COUNTS, DEFINITIONS, FIRST_VALUE, SUBJECTS, selection } from './queries'
import type { AdoptionDefinition, AdoptionFraction, AdoptionMetrics, AdoptionPeriod, AdoptionPerson, AdoptionSeatEvidence, AdoptionSeatHistory, AdoptionSubject } from './types'

type Scope='summary'|'account'|'person'|'segment'
type SubjectRow={scope:Scope;id:string;name:string;kind:'contact'|'user'|null;accountIds:string;seats:number|null}
type CountRow={scope:Scope;id:string;period:'current'|'previous';dau:number;wau:number;mau:number;eventCount:number}
type DefinitionRow={scope:Scope;id:string;period:'current'|'previous';kind:'feature'|'module';key:string;name:string;people:number}
type FirstRow={scope:Scope;id:string;people:number;meanSeconds:number}
export interface AdoptionSource {id:string;name:string;kind:string;reference:string;eventCount:number;attributedEventCount:number;lastObservedAt:string|null}
const PROVENANCE=`${BASE}
 SELECT s.id,s.name,s.kind,s.reference,count(e.id) AS eventCount,max(e.observed_at) AS lastObservedAt,
  count(CASE WHEN ${ATTRIBUTED} AND e.user_id IS NOT NULL AND m.person_id IS NOT NULL THEN 1 END) AS attributedEventCount
 FROM buoy_usage_sources s CROSS JOIN filter f LEFT JOIN buoy_usage_events e ON e.source_id=s.id AND julianday(e.observed_at)>=f.until-60 AND julianday(e.observed_at)<f.until
 ${MAPPED_JOIN} GROUP BY s.id ORDER BY s.name,s.id`
const GAPS=`${BASE}
 SELECT count(CASE WHEN NOT (${ATTRIBUTED}) THEN 1 END) AS unattributedEvents,
  count(CASE WHEN e.user_id IS NULL THEN 1 END) AS groupOnlyEvents
 FROM buoy_usage_events e ${MAPPED_JOIN},filter f WHERE julianday(e.observed_at)>=f.until-60 AND julianday(e.observed_at)<f.until`

/** All event calculations happen in SQL, independently of the raw event page.
 * Definitions, seats and current membership are read in one authority batch. */
export async function adoptionState(db:D1Database,actor:Actor,query:URLSearchParams){
 insist(actor.kind==='person','Adoption reports are available to signed-in staff.',403)
 const selected=selection(query),sql=(value:string)=>stmt(db,value,...selected.params)
 const results=await db.batch([authority(db,actor),sql(SUBJECTS),sql(COUNTS),sql(DEFINITIONS),sql(FIRST_VALUE),
  stmt(db,'SELECT kind,key,name,events,updated_at AS updatedAt FROM buoy_adoption_definitions ORDER BY kind,key'),sql(PROVENANCE),sql(GAPS),
  sql(`${BASE} SELECT seats.account_id AS accountId,seats.seats,seats.source_system AS sourceSystem,seats.reference,seats.observed_at AS observedAt,seats.stale_days AS staleDays FROM buoy_adoption_seats seats JOIN selected_accounts a ON a.id=seats.account_id ORDER BY seats.account_id`),
  sql(`${BASE} SELECT h.id,h.account_id AS accountId,h.document,h.recorded_by AS recordedBy,h.recorded_at AS recordedAt FROM buoy_adoption_seat_history h JOIN selected_accounts a ON a.id=h.account_id ORDER BY h.recorded_at DESC,h.id DESC`),stmt(db,'DELETE FROM buoy_assertions')])
 const subjects=results[1].results as unknown as SubjectRow[],counts=results[2].results as unknown as CountRow[],definitionsUsed=results[3].results as unknown as DefinitionRow[],first=results[4].results as unknown as FirstRow[]
 const definitions=(results[5].results as unknown as (Omit<AdoptionDefinition,'events'>&{events:string})[]).map(row=>({...row,events:JSON.parse(row.events) as string[]}))
 const bySubject=<T extends {scope:Scope;id:string}>(rows:T[])=>{
  const map=new Map<string,T[]>()
  for(const row of rows){const key=JSON.stringify([row.scope,row.id]),list=map.get(key)??[];list.push(row);map.set(key,list)}
  return (subject:SubjectRow)=>map.get(JSON.stringify([subject.scope,subject.id]))??[]
 }
 const subjectCounts=bySubject(counts),subjectDefinitions=bySubject(definitionsUsed),subjectFirst=bySubject(first)
 const metrics=(subject:SubjectRow):AdoptionMetrics=>{
  const period=(which:'current'|'previous'):AdoptionPeriod=>{
   const count=subjectCounts(subject).find(row=>row.period===which)!,used=subjectDefinitions(subject).filter(row=>row.period===which)
   const fractions=(kind:'feature'|'module'):AdoptionFraction[]=>used.filter(row=>row.kind===kind).map(({key,name,people})=>({key,name,people,fraction:count.mau?people/count.mau:null}))
   return {dau:count.dau,wau:count.wau,mau:count.mau,eventCount:count.eventCount,depth:count.mau?count.eventCount/count.mau:null,
    breadth:definitions.length?used.filter(row=>row.people>0).length/definitions.length:null,
    utilization:subject.seats?count.mau/subject.seats:null,features:fractions('feature'),modules:fractions('module')}
  }
  const current=period('current'),previous=period('previous'),weeklyChange=previous.wau?(current.wau-previous.wau)/previous.wau:null,firstValue=subjectFirst(subject)[0]
  return {current,previous,weeklyChange,weeklyDrop:weeklyChange!==null&&weeklyChange<=-0.3,firstValue:{people:firstValue?.people??0,meanSeconds:firstValue?Math.round(firstValue.meanSeconds*1000)/1000:null}}
 }
 const subject=(row:SubjectRow):AdoptionSubject=>({id:row.id,name:row.name,accountIds:JSON.parse(row.accountIds) as string[],seats:row.seats,metrics:metrics(row)})
 const accounts=subjects.filter(row=>row.scope==='account').map(subject),people=subjects.filter(row=>row.scope==='person').map(row=>({...subject(row),kind:row.kind!} as AdoptionPerson)),segments=subjects.filter(row=>row.scope==='segment').map(subject)
 const gaps=results[7].results[0] as unknown as {unattributedEvents:number;groupOnlyEvents:number}
 const seatEvidence:AdoptionSeatEvidence[]=(results[8].results as unknown as Omit<AdoptionSeatEvidence,'freshness'>[]).map(row=>({...row,freshness:(Date.parse(selected.on)-Date.parse(row.observedAt))/86400000>row.staleDays?'stale':'current'}))
 const seatHistory:AdoptionSeatHistory[]=(results[9].results as unknown as {id:string;accountId:string;document:string;recordedBy:string;recordedAt:string}[]).map(({document,...row})=>({...JSON.parse(document),...row} as AdoptionSeatHistory))
 return {on:selected.on,filters:selected.filters,windows:selected.windows,definitions,
  summary:subject(subjects.find(row=>row.scope==='summary')!),accounts,people,segments,
  seats:accounts.map(({id:accountId,seats})=>({accountId,seats})),seatEvidence,seatHistory,sources:results[6].results as unknown as AdoptionSource[],
  coverage:{scope:'installation' as const,start:selected.windows.previous.month.start,end:selected.on,...gaps,missingSeatAccountIds:accounts.filter(row=>row.seats===null).map(row=>row.id),
   observationCompleteness:'unknown' as const,firstValueBaseline:'first observed identify, across currently attributed history' as const},
  interpretation:'Observed track/event activity only; no completeness is inferred. Current reviewed mappings, memberships, definitions and seats apply to both periods. Seat evidence is manually recorded, not billing verification; stale evidence remains in utilization and is labeled on the selected UTC date. First value uses the first observed identify and first later configured event, and is not a verified signup baseline. Person utilization is not meaningful and is null. Aggregate utilization is null if any selected account has missing seats, or total seats are zero.'}
}
export type AdoptionReport=Awaited<ReturnType<typeof adoptionState>>
