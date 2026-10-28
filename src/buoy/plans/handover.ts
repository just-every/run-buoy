import {stmt} from '../core'

export interface DraftHandover {
 id:string; accountId:string; revision:string; staffOwnerId:string|null; customerOwnerId:string|null; document:string
}
// Retained customer activity and even withdrawn grants keep a plan outside draft handover.
export const HANDOVER_DRAFTS = `SELECT json_group_array(json_object('id',id,'accountId',account_id,'revision',revision,'staffOwnerId',staff_owner_id,'customerOwnerId',customer_owner_id,'document',document))
 FROM (SELECT p.* FROM buoy_success_plans p
 WHERE NOT EXISTS(SELECT 1 FROM buoy_portal_grants g WHERE g.plan_id=p.id)
 AND NOT EXISTS(SELECT 1 FROM buoy_plan_confirmations c WHERE c.plan_id=p.id)
 AND NOT EXISTS(SELECT 1 FROM buoy_portal_events e WHERE e.plan_id=p.id) ORDER BY p.id)`

/** Called inside the assignment's snapshot-fenced batch, before replacing account owners. */
export function handoverDrafts(db:D1Database,moves:{toId:string;drafts:{id:string;revision:string}[]}[],stamp:string){
 const drafts=JSON.stringify(moves.flatMap(m=>m.drafts.map(p=>({...p,toId:m.toId}))))
 return stmt(db,`UPDATE buoy_success_plans SET
 staff_owner_id=(SELECT json_extract(value,'$.toId') FROM json_each(?) WHERE json_extract(value,'$.id')=buoy_success_plans.id),
 revision=lower(hex(randomblob(16))),updated_at=?
 WHERE EXISTS(SELECT 1 FROM json_each(?) WHERE json_extract(value,'$.id')=buoy_success_plans.id AND json_extract(value,'$.revision')=buoy_success_plans.revision)`,drafts,stamp,drafts)
}
