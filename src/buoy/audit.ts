import { auditRecord } from './audit-records'
import { Problem, stmt, requirePerson, insist, date, type Actor } from './core'

// BOUNDARY-004: an agent request outside preparation is refused with its reason
// and recorded. Refusals retain command or route context, with no account
// foreign key. Account erasure replaces matching context with its opaque alias
// and a generic refusal reason; actor display names are never retained.
export async function refuse(db: D1Database, actor: Actor, subject: string, reason: string, status = 403): Promise<never> {
 if (actor.kind === 'agent') await auditRecord(db, actor, 'agent.refused', subject.slice(0, 200), reason).run()
 throw new Problem(status, reason)
}
// AUDIT-001: literal substring filters; date bounds include whole UTC days.
export async function audit(db: D1Database, actor: Actor, query = new URLSearchParams()) {
 requirePerson(actor)
 const predicates: string[] = [], params: unknown[] = []
 for (const field of ['actor', 'action', 'subject']) {
  const value = query.get(field)?.trim() ?? ''
  insist(value.length <= 200, `${field} filter is limited to 200 characters.`)
  if (value) { predicates.push(`instr(lower(${field}),lower(?))>0`); params.push(value) }
 }
 const since = query.get('since'), until = query.get('until')
 if (since) { predicates.push('occurred_at>=?'); params.push(date(since, 'From date') + 'T00:00:00.000Z') }
 if (until) { predicates.push('substr(occurred_at,1,10)<=?'); params.push(date(until, 'Through date')) }
 insist(!since || !until || since <= until, 'From date must be on or before through date.')
 const offset = Number(query.get('offset') ?? 0)
 insist(Number.isSafeInteger(offset) && offset >= 0, 'Offset must be a nonnegative whole number.')
 const where = predicates.length ? ' WHERE ' + predicates.join(' AND ') : ''
 const entries = (await stmt(db, 'SELECT id,actor,action,subject,detail,occurred_at AS occurredAt FROM buoy_audit' + where + ' ORDER BY occurred_at DESC,id LIMIT 51 OFFSET ?', ...params, offset).all()).results
 return {entries: entries.slice(0, 50), nextOffset: entries.length > 50 ? offset + 50 : null}
}
