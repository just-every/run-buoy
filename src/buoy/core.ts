import { accountAudit } from './audit-records'
import type { AgentPolicy, AgentRequest, AgentCommand } from './agent-policy/policy'
export class Problem extends Error {
 constructor(public status: number, message: string) { super(message) }
}
export function insist(condition: unknown, message: string, status = 400): asserts condition {
 if (!condition) throw new Problem(status, message)
}
export const now = () => new Date().toISOString()
/** "Wed Nov 18, 2026": the US date Buoy writes in its own text. Calendar dates are UTC dates. */
export const usDay = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)).replace(/,(?= \w{3} )/, '')
export const id = () => crypto.randomUUID()
export function text(value: unknown, label: string, max = 1000): string {
 insist(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label} is required (up to ${max} characters).`)
 return value.trim()
}
export function date(value: unknown, label: string): string {
 const result = text(value, label, 10)
 insist(/^\d{4}-\d{2}-\d{2}$/.test(result) && Number.isFinite(Date.parse(result)) && new Date(result).toISOString().slice(0, 10) === result, `${label} must be a valid calendar date.`)
 return result
}
export function object(value: unknown): Record<string, unknown> {
 insist(!!value && typeof value === 'object' && !Array.isArray(value), 'A JSON object is required.')
 return value as Record<string, unknown>
}
export const stmt = (db: D1Database, sql: string, ...params: unknown[]) => db.prepare(sql).bind(...params)
export const guard = (db: D1Database, sql: string, ...params: unknown[]) => stmt(db, `INSERT INTO buoy_assertions(ok) VALUES(CASE WHEN (${sql}) THEN 1 ELSE 0 END)`, ...params)
export interface Actor { id: string; role: string; displayName: string; kind: 'person' | 'agent'; tokenId?: string; agentPolicy?: AgentPolicy; agentRequest?: AgentRequest }
export function requirePerson(actor: Actor, owner = false) {
 insist(actor.kind === 'person' && (owner ? actor.role === 'owner' : ['owner', 'admin'].includes(actor.role)), owner ? 'Only the owner can do this.' : 'An owner or admin must approve this action.', 403)
}
export function authority(db: D1Database, actor: Actor, approval = false, command?: AgentCommand) {
 if (actor.kind === 'agent') {
  insist(!approval, 'Agents cannot approve changes.', 403)
  return guard(db, "EXISTS(SELECT 1 FROM buoy_agent_tokens t JOIN oa_operators o ON o.id=t.owner_id WHERE t.id=? AND t.revoked_at IS NULL AND t.expires_at>? AND o.status='active' AND o.role='owner' AND o.version=t.owner_version AND (SELECT disabled FROM buoy_agent_settings WHERE singleton=1)=0 AND (? IS NULL OR (EXISTS(SELECT 1 FROM json_each(t.scopes) WHERE value=?) AND (SELECT count(DISTINCT value) FROM json_each(t.data_classes) WHERE value IN ('account','billing','support','sentiment'))=4)))", actor.tokenId, Date.now(), command ?? null, command ?? null)
 }
 return guard(db, `EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role IN (${approval ? "'owner','admin'" : "'owner','admin','member'"}))`, actor.id)
}
export async function commit(db: D1Database, actor: Actor, accountId: string, action: string, statements: D1PreparedStatement[], approval = false) {
 const command = action === 'playbook.prepared' ? 'playbook.prepare' : action === 'renewal.prepared' ? 'renewal.prepare' : undefined
 if (actor.kind === 'agent') insist(command && !approval, 'Agents can only prepare proposals.', 403)
 await db.batch([authority(db, actor, approval, command), ...statements,
  ...accountAudit(db, actor, accountId, action),
  stmt(db, 'DELETE FROM buoy_assertions')])
}
