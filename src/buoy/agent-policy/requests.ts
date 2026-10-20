import { auditRecord } from '../audit-records'
import { refuse } from '../audit'
import { id, now, stmt, insist, type Actor } from '../core'
import type { AgentRequest, RequestCommand } from './policy'
const ledger = (db: D1Database, actor: Actor, request: AgentRequest, status: 'attempt' | 'succeeded' | 'refused', reason: string) =>
 stmt(db, 'INSERT INTO buoy_agent_ledger(id,request_id,token_id,command,status,reason,spent_minor,occurred_at) VALUES(?,?,?,?,?,?,0,?)', status === 'attempt' ? request.id : id(), request.id, actor.tokenId, request.command, status, reason, now())
export async function beginRequest(db: D1Database, actor: Actor, request: Request) {
 const command: RequestCommand = new URL(request.url).pathname !== '/api/buoy/commands' ? 'other.route' : request.method === 'GET' ? 'commands.read' : 'commands.request'
 const entry: AgentRequest = {id: id(), command}, minute = Math.floor(Date.now() / 60000)
 const results = await db.batch<Record<string, unknown>>([
  stmt(db, 'INSERT INTO buoy_agent_minutes(token_id,minute,requests) VALUES(?,?,1) ON CONFLICT(token_id,minute) DO UPDATE SET requests=requests+1 RETURNING requests', actor.tokenId, minute),
  ledger(db, actor, entry, 'attempt', 'Authenticated request received.'),
  auditRecord(db, actor, 'agent.requested', `agent:${actor.id}`, `${['GET','POST'].includes(request.method) ? request.method : 'Other method'} ${command === 'other.route' ? 'other route' : 'commands'} request received; outcome not recorded.`),
  db.prepare('SELECT disabled FROM buoy_agent_settings WHERE singleton=1'),
  // Keep only the active minute and its predecessor; the durable ledger holds history.
  stmt(db, 'DELETE FROM buoy_agent_minutes WHERE token_id=? AND minute<?', actor.tokenId, minute - 1)])
 actor.agentRequest = entry
 return {requests: Number(results[0].results[0].requests), disabled: !!results[3].results[0].disabled, retryAfter: Math.max(1, Math.ceil(((minute + 1) * 60000 - Date.now()) / 1000))}
}
export async function checkRequest(db: D1Database, actor: Actor, result: Awaited<ReturnType<typeof beginRequest>>, request: Request) {
 insist(!result.disabled, 'Agent access is disabled by the owner.', 403)
 insist(result.requests <= actor.agentPolicy!.requestsPerMinute, 'Agent request limit reached. Try the next UTC minute.', 429)
 if (actor.agentRequest!.command === 'other.route') await refuseRequest(db, actor, `${request.method} ${new URL(request.url).pathname}`, 'Agents can only use the preparation commands.')
}
export async function refuseRequest(db: D1Database, actor: Actor, subject: string, reason: string, status = 403): Promise<never> {
 if (actor.agentRequest) actor.agentRequest.refusalAudited = true
 return refuse(db, actor, subject, reason, status)
}
export async function finishRequest(db: D1Database, actor: Actor, status: number) {
 const request = actor.agentRequest!, succeeded = status < 400
 const reason = succeeded ? 'Command completed.' : status === 429 ? 'Request rate exceeded.' : status === 403 ? 'Authority or policy refused.' : status >= 500 ? 'Operation failed.' : 'Request refused.'
 await db.batch<Record<string, unknown>>([stmt(db, "UPDATE buoy_agent_ledger SET command=? WHERE id=? AND status='attempt'", request.command, request.id),
  ledger(db, actor, request, succeeded ? 'succeeded' : 'refused', reason),
  ...(request.refusalAudited ? [] : [auditRecord(db, actor, succeeded ? 'agent.succeeded' : 'agent.refused', `agent:${actor.id}`, `${request.command}: ${reason}`)])])
}
