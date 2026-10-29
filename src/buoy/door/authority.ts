import {guard, insist, type Actor} from '../core'
import type {AgentCommand} from '../agent-policy/policy'

/** Admission snapshot fenced in the same native transaction as the effect. */
export interface DoorActor {
 sponsorId:string; sponsorRole:string; sponsorVersion:number; agentId:string;
 clientId?:string; consent?:string; operationId:string; scopes:readonly string[]; label:string;
 envelope:string|null; document:string|null; localRevision:number; roleRevision:string;
}

export function doorAuthority(db:D1Database, actor:Actor, approval:boolean, command?:AgentCommand) {
 const admission=actor.door!
 insist(actor.kind==='agent' && !approval && command && admission.scopes.includes(command), 'Agents can only prepare within their native grant.',403)
 return guard(db, `EXISTS(SELECT 1 FROM oa_operators o,agent_door_state s,buoy_role_settings r,buoy_agent_settings p
 WHERE o.id=? AND o.status='active' AND o.role=? AND o.version=?
 AND o.role IN ('owner','admin','member') AND r.singleton=1 AND r.revision=?
 AND (o.role IN ('owner','admin') OR NOT EXISTS(SELECT 1 FROM buoy_role_assignments WHERE person_id=o.id))
 AND NOT EXISTS(SELECT 1 FROM buoy_portal_recipients WHERE operator_id=o.id OR email=o.email)
 AND p.singleton=1 AND p.disabled=0 AND s.id=1 AND s.local_paused=0
 AND s.envelope IS ? AND s.local_document IS ? AND s.local_revision=?
 AND NOT EXISTS(SELECT 1 FROM agent_door_agents WHERE id=? AND revoked=1)
 AND (? IS NULL OR EXISTS(SELECT 1 FROM buoy_agent_tokens t WHERE t.id=? AND t.owner_id=o.id AND t.owner_version=o.version AND t.revoked_at IS NULL AND t.expires_at>? AND EXISTS(SELECT 1 FROM json_each(t.scopes) WHERE value=?) AND (SELECT count(DISTINCT value) FROM json_each(t.data_classes) WHERE value IN ('account','billing','support','sentiment'))=4)))`,
 admission.sponsorId,admission.sponsorRole,admission.sponsorVersion,admission.roleRevision,
 admission.envelope,admission.document,admission.localRevision,admission.agentId,
 actor.tokenId??null,actor.tokenId??null,Date.now(),command)
}
