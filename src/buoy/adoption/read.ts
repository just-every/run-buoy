import { metricReader, type SubjectRow, type CountRow, type DefinitionRow, type FirstRow } from './metrics'
import { authority, insist, stmt, type Actor } from '../core'
import { ATTRIBUTED, MAPPED_JOIN } from '../usage/mappings'
import { BASE, COUNTS, DEFINITIONS, FIRST_VALUE, SUBJECTS, selection } from './queries'
import type { AdoptionPersonLicense, AdoptionPersonLicenseHistory, AdoptionDefinition, AdoptionPerson, AdoptionSeatEvidence, AdoptionSeatHistory, AdoptionSubject } from './types'

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
  sql(`${BASE} SELECT h.id,h.account_id AS accountId,h.document,h.recorded_by AS recordedBy,h.recorded_at AS recordedAt FROM buoy_adoption_seat_history h JOIN selected_accounts a ON a.id=h.account_id ORDER BY h.recorded_at DESC,h.id DESC`),sql(`${BASE} SELECT l.account_id AS accountId,l.person_id AS personId,l.licensed,l.source_system AS sourceSystem,l.reference,l.observed_at AS observedAt,l.stale_days AS staleDays FROM buoy_adoption_person_licenses l JOIN selected_accounts a ON a.id=l.account_id,filter f WHERE f.personId IS NULL OR l.person_id=f.personId ORDER BY l.account_id,l.person_id`),
  sql(`${BASE} SELECT h.id,h.account_id AS accountId,h.person_id AS personId,h.document,h.recorded_by AS recordedBy,h.recorded_at AS recordedAt FROM buoy_adoption_person_license_history h JOIN selected_accounts a ON a.id=h.account_id,filter f WHERE f.personId IS NULL OR h.person_id=f.personId ORDER BY h.recorded_at DESC,h.id DESC`),stmt(db,'DELETE FROM buoy_assertions')])
 const subjects=results[1].results as unknown as SubjectRow[],counts=results[2].results as unknown as CountRow[],definitionsUsed=results[3].results as unknown as DefinitionRow[],first=results[4].results as unknown as FirstRow[]
 const definitions=(results[5].results as unknown as (Omit<AdoptionDefinition,'events'>&{events:string})[]).map(row=>({...row,events:JSON.parse(row.events) as string[]}))
 const metrics=metricReader(counts,definitionsUsed,first,definitions)
 const subject=(row:SubjectRow):AdoptionSubject=>({id:row.id,name:row.name,accountIds:JSON.parse(row.accountIds) as string[],seats:row.seats,metrics:metrics(row)})
 const accounts=subjects.filter(row=>row.scope==='account').map(subject),people=subjects.filter(row=>row.scope==='person').map(row=>({...subject(row),kind:row.kind!} as AdoptionPerson)),segments=subjects.filter(row=>row.scope==='segment').map(subject)
 const gaps=results[7].results[0] as unknown as {unattributedEvents:number;groupOnlyEvents:number}
 const seatEvidence:AdoptionSeatEvidence[]=(results[8].results as unknown as Omit<AdoptionSeatEvidence,'freshness'>[]).map(row=>({...row,freshness:(Date.parse(selected.on)-Date.parse(row.observedAt))/86400000>row.staleDays?'stale':'current'}))
 const seatHistory:AdoptionSeatHistory[]=(results[9].results as unknown as {id:string;accountId:string;document:string;recordedBy:string;recordedAt:string}[]).map(({document,...row})=>({...JSON.parse(document),...row} as AdoptionSeatHistory))
 const personLicenses:AdoptionPersonLicense[]=(results[10].results as unknown as (Omit<AdoptionPersonLicense,'licensed'|'freshness'>&{licensed:number})[]).map(row=>({...row,licensed:row.licensed===1,freshness:(Date.parse(selected.on)-Date.parse(row.observedAt))/86400000>row.staleDays?'stale':'current'}))
 const personLicenseHistory:AdoptionPersonLicenseHistory[]=(results[11].results as unknown as {id:string;accountId:string;personId:string;document:string;recordedBy:string;recordedAt:string}[]).map(({document,...row})=>{const change=JSON.parse(document);return {...change.newValue,...change,...row}})
 return {on:selected.on,filters:selected.filters,windows:selected.windows,definitions,
  summary:subject(subjects.find(row=>row.scope==='summary')!),accounts,people,segments,
  personLicenses,personLicenseHistory,seats:accounts.map(({id:accountId,seats})=>({accountId,seats})),seatEvidence,seatHistory,sources:results[6].results as unknown as AdoptionSource[],
  coverage:{scope:'installation' as const,start:selected.windows.previous.month.start,end:selected.on,...gaps,missingSeatAccountIds:accounts.filter(row=>row.seats===null).map(row=>row.id),
   observationCompleteness:'unknown' as const,firstValueBaseline:'first observed identify, across currently attributed history' as const},
  interpretation:'Observed track/event activity only; no completeness is inferred. Current reviewed mappings, memberships, definitions and seats apply to both periods. Seat evidence is manually recorded, not billing verification; stale evidence remains in utilization and is labeled on the selected UTC date. First value uses the first observed identify and first later configured event, and is not a verified signup baseline. Person utilization is monthly activity (0 or 1) divided by one explicitly licensed seat across selected memberships. All selected memberships need recorded license evidence; at least one must be licensed. Missing evidence or no licensed seat gives null. Account purchased seats remain independent of individual assignments. Aggregate utilization is null if any selected account has missing seats, or total seats are zero.'}
}
export type AdoptionReport=Awaited<ReturnType<typeof adoptionState>>
