import type { Actor } from './core'

type AuditActor = Pick<Actor, 'kind' | 'id' | 'door'>
const identity=(actor:AuditActor)=>actor.door?`agent:${actor.door.agentId} for person:${actor.id}`:`${actor.kind}:${actor.id}`
// AUDIT-001: audit identity never includes a person's or agent's display name.
export function auditRecord(db: D1Database, actor: AuditActor, action: string, subject: string, detail = '') {
 return db.prepare('INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) VALUES(?,?,?,?,?,?)')
  .bind(crypto.randomUUID(), identity(actor), action, subject, detail, new Date().toISOString())
}

// Recorded only when the statement just before it in the same batch changed one row.
export function auditIfChanged(db: D1Database, actor: AuditActor, action: string, subject: string, detail = '') {
 return db.prepare('INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) SELECT ?,?,?,?,?,? WHERE changes()=1')
  .bind(crypto.randomUUID(), identity(actor), action, subject, detail, new Date().toISOString())
}

export function accountAudit(db: D1Database, actor: AuditActor, accountId: string, action: string) {
 return [
  db.prepare('INSERT OR IGNORE INTO buoy_audit_subjects(account_id,subject) SELECT id,lower(hex(randomblob(16))) FROM buoy_accounts WHERE id=?').bind(accountId),
  db.prepare("INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) SELECT ?,?,?,subject,'',? FROM buoy_audit_subjects WHERE account_id=?")
   .bind(crypto.randomUUID(), identity(actor), action, new Date().toISOString(), accountId),
 ]
}
