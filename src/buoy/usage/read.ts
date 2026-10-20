import { MAPPED_JOIN, ATTRIBUTED } from './mappings'
import type { Actor } from '../core'
import { adminRead, credential, CREDENTIAL_COLUMNS, freshness, insist, SOURCE_COLUMNS, stmt, type Source } from './model'

export async function usageState(db:D1Database,actor:Actor){
 const result=await adminRead(db,actor,[
  stmt(db,`SELECT ${SOURCE_COLUMNS},(SELECT max(observed_at) FROM buoy_usage_events WHERE source_id=s.id) AS lastObservedAt,(SELECT count(*) FROM buoy_usage_events WHERE source_id=s.id) AS eventCount FROM buoy_usage_sources s ORDER BY created_at,id`),
  stmt(db,`SELECT ${CREDENTIAL_COLUMNS} FROM buoy_usage_credentials ORDER BY created_at,id`),
  stmt(db,`SELECT e.source_id AS sourceId,e.user_id AS userId,e.group_id AS groupId,count(*) AS eventCount,max(e.observed_at) AS lastObservedAt FROM buoy_usage_events e ${MAPPED_JOIN} WHERE NOT (${ATTRIBUTED}) GROUP BY e.source_id,e.user_id,e.group_id ORDER BY e.source_id,e.user_id,e.group_id LIMIT 201`),
  stmt(db,'SELECT source_id AS sourceId,user_id AS userId,group_id AS groupId,account_id AS accountId,person_id AS personId,reviewed_by AS reviewedBy,reviewed_at AS reviewedAt FROM buoy_usage_mappings ORDER BY reviewed_at DESC'),
  stmt(db,`SELECT m.account_id AS accountId,m.person_id AS personId,e.source_id AS sourceId,count(*) AS eventCount FROM buoy_usage_events e ${MAPPED_JOIN} WHERE ${ATTRIBUTED} GROUP BY m.account_id,m.person_id,e.source_id`)
 ])
 const sources=(result[0].results as unknown as (Source&{lastObservedAt:string|null;eventCount:number})[]).map(row=>({...row,freshness:freshness(row.lastObservedAt,row.staleDays)}))
 return {sources,credentials:(result[1].results as unknown as Parameters<typeof credential>[0][]).map(credential),review:result[2].results.slice(0,200),reviewLimited:result[2].results.length>200,
  mappings:result[3].results,attribution:result[4].results,receiver:'Stored observations use explicitly reviewed source identities. Unknown or conflicting claims await review. Provider delivery and identity are not verified.'}
}
type EventRow={id:string;sourceId:string;messageId:string;type:string;event:string|null;userId:string|null;groupId:string|null;observedAt:string;receivedAt:string;sourceReference:string;sourceSystem:Source['kind'];staleDays:number;payload:string}
export async function usageEvents(db:D1Database,actor:Actor,query:URLSearchParams){
 const allowed=['sourceId','userId','groupId','messageId','cursor','limit','accountId','personId']
 insist([...query.keys()].every(key=>allowed.includes(key)),'Unsupported event filter.')
 const clauses:string[]=[],params:unknown[]=[],limit=Number(query.get('limit')??50)
 insist(Number.isInteger(limit)&&limit>=1&&limit<=200,'Event page size must be 1–200.')
 for(const [parameter,column] of [['sourceId','source_id'],['userId','user_id'],['groupId','group_id'],['messageId','message_id']])if(query.has(parameter)){clauses.push(`e.${column}=?`);params.push(query.get(parameter))}
 for(const parameter of ['accountId','personId'])if(query.has(parameter)){clauses.push(`${ATTRIBUTED} AND m.${parameter==='accountId'?'account_id':'person_id'}=?`);params.push(query.get(parameter))}
 if(query.has('cursor')){
  let cursor:unknown
  try{cursor=JSON.parse(atob(query.get('cursor')!))}catch{insist(false,'Invalid event cursor.')}
  insist(Array.isArray(cursor)&&cursor.length===2&&cursor.every(x=>typeof x==='string'&&x.length<=100),'Invalid event cursor.')
  clauses.push('(e.received_at<? OR (e.received_at=? AND e.id<?))');params.push(cursor[0],cursor[0],cursor[1])
 }
 const result=await adminRead(db,actor,[stmt(db,`SELECT e.id,e.source_id AS sourceId,e.message_id AS messageId,e.type,e.event,e.user_id AS userId,e.group_id AS groupId,e.observed_at AS observedAt,e.received_at AS receivedAt,e.source_reference AS sourceReference,e.source_system AS sourceSystem,s.stale_days AS staleDays,e.payload,CASE WHEN ${ATTRIBUTED} THEN m.account_id ELSE NULL END AS accountId,CASE WHEN ${ATTRIBUTED} THEN m.person_id ELSE NULL END AS personId FROM buoy_usage_events e ${MAPPED_JOIN} JOIN buoy_usage_sources s ON s.id=e.source_id ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY e.received_at DESC,e.id DESC LIMIT ?`,...params,limit+1)])
 const rows=result[0].results as unknown as EventRow[],hasMore=rows.length>limit,events=rows.slice(0,limit).map(row=>({...row,status:(row as EventRow&{accountId:string|null}).accountId?'attributed':'review',freshness:freshness(row.observedAt,row.staleDays),payload:JSON.parse(row.payload)})),last=events.at(-1)
 return {events,nextCursor:hasMore&&last?btoa(JSON.stringify([last.receivedAt,last.id])):null}
}
