import {guard,insist,stmt} from '../core'
import {restoreHoldSnapshot} from './snapshot'

type Row=Record<string,unknown>
// Fixed schema-owned names only. Every selected row is fenced before a write.
const stores=[
 ['hold','buoy_privacy_holds','person_id=?'],
 ['heldVersions','buoy_privacy_hold_versions','person_id=?'],
 ['person','buoy_customer_people','id=?'],['subject','buoy_customer_subjects','person_id=?'],
 ['memberships','buoy_customer_memberships','person_id=?'],['manualFields','buoy_customer_values','person_id=?'],
 ['calculatedFields','buoy_customer_results','person_id=?'],['fieldHistory','buoy_customer_history','person_id=?'],
 ['businessReviewHolds','buoy_review_hold_dependencies','person_id=?'],
 ['businessReviews','buoy_reviews','id IN(SELECT review_id FROM buoy_review_people WHERE person_id=?)'],
 ['reviewMeetings','buoy_review_meetings','review_id IN(SELECT review_id FROM buoy_review_people WHERE person_id=?)'],
 ['surveyResponses','buoy_survey_responses','person_id=?'],
 ['portalEvents','buoy_portal_events','person_id=?'],
 ['portalFiles','buoy_portal_files','person_id=?'],
 ['planOutcomeSubjects','buoy_outcome_accounts','plan_customer_id=?'],
 ['planConfirmations','buoy_plan_confirmations','person_id=?'],
 ['successPlans','buoy_success_plans','customer_owner_id=?'],
 ['usageEvents','buoy_usage_events',`EXISTS(SELECT 1 FROM buoy_usage_mappings m WHERE m.person_id=? AND m.source_id=t.source_id AND m.user_id=t.user_id)`],
 ['trustProposals','buoy_trust_proposals',"? IN(json_extract(evidence,'$.evidence.claim.personId'),json_extract(evidence,'$.evidence.preview.person.id'),json_extract(evidence,'$.evidence.preview.previous.person_id'))"],
 ['usageMappings','buoy_usage_mappings','person_id=?'],['inappDeliveries','buoy_inapp_deliveries','person_id=?'],
 ['inappReceipts','buoy_inapp_receipts',`event_id IN(SELECT e.id FROM buoy_usage_events e JOIN buoy_usage_mappings m ON m.source_id=e.source_id AND m.user_id=e.user_id WHERE m.person_id=?)`],
 ['communications','buoy_communications','person_id=?'],
 ['communicationScores','buoy_communication_scores','account_id IN(SELECT account_id FROM buoy_communications WHERE person_id=?)'],
 ['licenses','buoy_adoption_person_licenses','person_id=?'],['licenseHistory','buoy_adoption_person_license_history','person_id=?'],
 ['declaredHolders','buoy_customer_holders','person_id=?'],
 ['stakeholderRoles','buoy_stakeholder_roles','person_id=?'],
 ['stakeholderHistory','buoy_hierarchy_history','id IN(SELECT history_id FROM buoy_hierarchy_history_people WHERE person_id=?)'],
 ['savedViews','buoy_workspace_views','id IN(SELECT view_id FROM buoy_workspace_view_people WHERE person_id=?)'],
 ['usageSources','buoy_usage_sources','id IN(SELECT source_id FROM buoy_usage_mappings WHERE person_id=?)']
] as const

export async function privacyImage(db:D1Database,personId:string){
 const selections=[...stores,['snapshotChunks','buoy_privacy_hold_chunks','person_id=?'] as const]
 const columns=await db.batch(selections.map(([,table])=>db.prepare(`PRAGMA table_info(${table})`)))
 const queries=selections.map(([,table,filter],i)=>{
  const names=columns[i].results.map(c=>String((c as {name:string}).name))
  const row=`json_object(${names.map(n=>`'${n}',t."${n}"`).join(',')})`
  const from=`FROM ${table} t WHERE ${filter}`
  return {sql:`SELECT ${row} AS document ${from} ORDER BY ${names.map(n=>`t."${n}"`).join(',')}`,from}
 })
 // D1 sees individual rows, never an aggregate of file bytes and held copies.
 const results=await db.batch(queries.map(q=>stmt(db,q.sql,personId)))
 const records=results.map(result=>result.results.map(r=>String((r as {document:string}).document)))
 const fences=()=>queries.flatMap((q,i)=>[
  guard(db,`(SELECT count(*) ${q.from})=?`,personId,records[i].length),
  ...records[i].map((raw,index)=>guard(db,`(${q.sql} LIMIT 1 OFFSET ?)=?`,personId,index,raw))
 ])
 const data=Object.fromEntries(stores.map(([key],i)=>[key,records[i].map(raw=>JSON.parse(raw) as Row)]))
 const chunks=records[stores.length].map(raw=>JSON.parse(raw) as Row)
 for(const hold of data.hold)hold.snapshot=restoreHoldSnapshot(String(hold.snapshot),chunks)
 const person=data.person[0] as {id:string;name:string;revision:string;kind:string}|undefined
 insist(person,'Customer person not found.',404)
 const declared=data.declaredHolders[0]?.document
 const holders=[...(declared?JSON.parse(String(declared)):[]) as {system:string;reference:string}[],...data.usageSources.map(s=>({system:String(s.name),reference:`Reviewed ${s.kind} source`}))]
 return {person,data,holders,subject:String(data.subject[0].subject),raw:JSON.stringify(data),fences}
}
