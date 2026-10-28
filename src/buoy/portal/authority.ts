import {guard,insist,stmt,type Actor} from '../core'

export const LIVE=`g.revoked_at IS NULL AND g.expires_at>? AND p.revision=g.plan_revision
 AND p.customer_owner_id=g.person_id AND c.kind='contact'
 AND EXISTS(SELECT 1 FROM buoy_customer_memberships m WHERE m.person_id=g.person_id AND m.account_id=g.account_id)
 AND o.status='active' AND o.role='member' AND o.version=g.operator_version AND o.email=r.email
 AND NOT EXISTS(SELECT 1 FROM buoy_role_assignments a WHERE a.person_id=o.id)
 AND w.status='active' AND w.role='owner' AND w.version=g.owner_version`
export const FROM=`buoy_portal_grants g JOIN buoy_success_plans p ON p.id=g.plan_id JOIN buoy_customer_people c ON c.id=g.person_id JOIN oa_operators o ON o.id=g.operator_id JOIN buoy_portal_recipients r ON r.operator_id=o.id JOIN oa_operators w ON w.id=g.owner_id`

export async function portalGrant(db:D1Database,actor:Actor,grantId:string){
 insist(actor.kind==='person'&&actor.role==='member','Customer access is required.',403)
 const sql=`SELECT g.* FROM ${FROM} WHERE g.id=? AND g.operator_id=? AND ${LIVE}`
 const row=await stmt(db,sql,grantId,actor.id,Date.now()).first<{id:string;account_id:string;plan_id:string;plan_revision:string;person_id:string;revision:string;task_ids:string}>()
 insist(row,'This shared plan is unavailable or access has stopped.',403)
 return {row,fence:()=>guard(db,`EXISTS(${sql})`,grantId,actor.id,Date.now())}
}
