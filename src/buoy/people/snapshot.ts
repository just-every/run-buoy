import { insist } from '../core'
import type { Definition } from '../fields/model'

export interface PersonRow {
 id:string;kind:'contact'|'user';name:string;revision:string;createdAt:string;
 accountIds:string[];manual:Record<string,unknown>;previous:Record<string,unknown>
}
export interface AccountRow {id:string;name:string;revision:string}
export interface PeopleImage {definitions:Definition[];records:PersonRow[];accounts:AccountRow[]}
// One deterministic image fences every definition, record, membership, manual
// input, previous result and account used by a preview or successful mutation.
export const PEOPLE_SNAPSHOT=`SELECT json_object(
 'definitions',json((SELECT json_group_array(json(document)) FROM (SELECT document FROM buoy_customer_fields ORDER BY key))),
 'records',json((SELECT json_group_array(json_object('id',p.id,'kind',p.kind,'name',p.name,'revision',p.revision,'createdAt',p.created_at,
  'accountIds',json((SELECT json_group_array(account_id) FROM (SELECT account_id FROM buoy_customer_memberships WHERE person_id=p.id ORDER BY account_id))),
  'manual',json(COALESCE(v.document,'{}')),'previous',json(COALESCE(r.document,'{}'))))
  FROM (SELECT * FROM buoy_customer_people ORDER BY id) p LEFT JOIN buoy_customer_values v ON v.person_id=p.id LEFT JOIN buoy_customer_results r ON r.person_id=p.id)),
 'accounts',json((SELECT json_group_array(json_object('id',id,'name',json_extract(document,'$.name'),'revision',revision)) FROM (SELECT * FROM buoy_accounts ORDER BY id)))
 ) AS snapshot`
export async function peopleImage(db:D1Database){
 const row=await db.prepare(PEOPLE_SNAPSHOT).first<{snapshot:string}>()
 insist(row,'Customer people unavailable.',503)
 return {raw:row.snapshot,value:JSON.parse(row.snapshot) as PeopleImage}
}
