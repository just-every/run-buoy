import { Problem, stmt, id, now, requirePerson, type Actor } from './core'

// BOUNDARY-004: an agent request outside preparation is refused with its reason
// and recorded. Rows keep the actor, time, action and an opaque subject (an
// account id, command or route), never an account name, and have no account
// foreign key, so they outlive the subject's erasure (AUDIT-001 builds on this).
export async function refuse(db: D1Database, actor: Actor, subject: string, reason: string, status = 403): Promise<never> {
 if (actor.kind === 'agent') await stmt(db, "INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) VALUES(?,?,'agent.refused',?,?,?)", id(), `agent:${actor.id}:${actor.displayName}`, subject.slice(0, 200), reason, now()).run()
 throw new Problem(status, reason)
}
export async function audit(db: D1Database, actor: Actor) {
 requirePerson(actor)
 return {entries: (await stmt(db, 'SELECT id,actor,action,subject,detail,occurred_at AS occurredAt FROM buoy_audit ORDER BY occurred_at DESC,id').all()).results}
}
