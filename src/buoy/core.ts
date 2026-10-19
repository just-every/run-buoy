import { accountAudit } from './audit-records'
export class Problem extends Error {
 constructor(public status: number, message: string) { super(message) }
}
export function insist(condition: unknown, message: string, status = 400): asserts condition {
 if (!condition) throw new Problem(status, message)
}
export const now = () => new Date().toISOString()
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
export interface Actor { id: string; role: string; displayName: string; kind: 'person' | 'agent'; tokenId?: string }
export function requirePerson(actor: Actor, owner = false) {
 insist(actor.kind === 'person' && (owner ? actor.role === 'owner' : ['owner', 'admin'].includes(actor.role)), owner ? 'Only the owner can do this.' : 'An owner or admin must approve this action.', 403)
}
export function authority(db: D1Database, actor: Actor, approval = false) {
 if (actor.kind === 'agent') return guard(db, "EXISTS(SELECT 1 FROM buoy_agent_tokens t JOIN oa_operators o ON o.id=t.owner_id WHERE t.id=? AND t.revoked_at IS NULL AND t.expires_at>? AND o.status='active' AND o.role='owner' AND o.version=t.owner_version)", actor.tokenId, Date.now())
 return guard(db, `EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role IN (${approval ? "'owner','admin'" : "'owner','admin','member'"}))`, actor.id)
}
export async function commit(db: D1Database, actor: Actor, accountId: string, action: string, statements: D1PreparedStatement[], approval = false) {
 await db.batch([authority(db, actor, approval), ...statements,
  ...accountAudit(db, actor, accountId, action),
  stmt(db, 'DELETE FROM buoy_assertions')])
}
