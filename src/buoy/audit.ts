import { Problem, stmt, id, now, requirePerson, insist, date, type Actor } from './core'

// BOUNDARY-004: an agent request outside preparation is refused with its reason
// and recorded. Rows keep the actor, time, action and an opaque subject (an
// account id, command or route), never an account name, and have no account
// foreign key, so they outlive the subject's erasure (AUDIT-001 builds on this).
export async function refuse(db: D1Database, actor: Actor, subject: string, reason: string, status = 403): Promise<never> {
 if (actor.kind === 'agent') await stmt(db, "INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) VALUES(?,?,'agent.refused',?,?,?)", id(), `agent:${actor.id}:${actor.displayName}`, subject.slice(0, 200), reason, now()).run()
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
