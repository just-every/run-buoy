import { authority, commit, guard, id, insist, now, stmt, text, type Actor } from './core'
import { notifications } from './reminders'
import { accountHealth } from './sentiment'
import type { Account } from './health'

export const NOTICE_TYPES = ['mention', 'assignment', 'signal', 'approval'] as const
export type NoticeType = typeof NOTICE_TYPES[number]
export type Preferences = {frequency: 'off' | 'daily' | 'weekly'; modes: Record<NoticeType, 'immediate' | 'digest' | 'none'>; bookCursor: number}
export const personal = (actor: Actor) => insist(actor.kind === 'person', 'Notifications belong to the signed-in person.', 403)
export async function preferences(db: D1Database, personId: string): Promise<Preferences> {
 const row = await stmt(db, 'SELECT frequency,modes,book_cursor AS bookCursor FROM buoy_notification_preferences WHERE person_id=?', personId).first<{frequency: Preferences['frequency']; modes: string; bookCursor: number}>()
 return row ? {...row, modes: JSON.parse(row.modes)} : {frequency: 'off', modes: {mention: 'immediate', assignment: 'immediate', signal: 'immediate', approval: 'immediate'}, bookCursor: 0}
}
export async function setPreferences(db: D1Database, actor: Actor, input: Record<string, unknown>) {
 personal(actor)
 insist(['off','daily','weekly'].includes(String(input.frequency)), 'Choose off, daily or weekly digest.')
 const modes = input.modes as Preferences['modes']
 insist(modes && typeof modes === 'object' && !Array.isArray(modes) && Object.keys(modes).length === NOTICE_TYPES.length && NOTICE_TYPES.every(type => ['immediate','digest','none'].includes(modes[type])), 'Choose immediate, digest-only or no email for each notification type.')
 insist(Object.keys(input).every(key => ['frequency','modes'].includes(key)), 'Only your digest frequency and notification modes can be changed.')
 await db.batch([authority(db, actor), stmt(db, `INSERT INTO buoy_notification_preferences(person_id,frequency,modes,book_cursor) VALUES(?,?,?,(SELECT COALESCE(max(rowid),0) FROM buoy_audit)) ON CONFLICT(person_id) DO UPDATE SET frequency=excluded.frequency,modes=excluded.modes`, actor.id, input.frequency, JSON.stringify(modes)), stmt(db, 'DELETE FROM buoy_assertions')])
 return preferences(db, actor.id)
}
export async function inbox(db: D1Database, actor: Actor) {
 personal(actor)
 const {results} = await stmt(db, `SELECT n.id,n.type,n.title,n.body,n.created_at AS createdAt,n.read_at AS readAt,n.email,n.account_id AS accountId,json_extract(a.document,'$.name') AS accountName FROM buoy_inbox n JOIN buoy_accounts a ON a.id=n.account_id WHERE n.person_id=? ORDER BY n.created_at DESC,n.id`, actor.id).all()
 return {items: results, reminders: await notifications(db, actor), preferences: await preferences(db, actor.id), digests: (await stmt(db, 'SELECT id,period,frequency,email FROM buoy_digests WHERE person_id=? ORDER BY created_at DESC', actor.id).all()).results}
}
export async function markRead(db: D1Database, actor: Actor, noticeId: string) {
 personal(actor)
 const changed = await stmt(db, "UPDATE buoy_inbox SET read_at=COALESCE(read_at,?) WHERE id=? AND person_id=? AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')", now(), noticeId, actor.id, actor.id).run()
 insist(changed.meta.changes === 1, 'Notification not found.', 404)
 return {id: noticeId, read: true}
}
export async function mention(db: D1Database, actor: Actor, accountId: string, input: Record<string, unknown>) {
 personal(actor)
 const personId = text(input.personId, 'Person to mention', 100), note = text(input.note, 'Mention note', 1000), noticeId = id()
 await commit(db, actor, accountId, 'account.mentioned', [guard(db, "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')", personId), guard(db, 'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=?)', accountId),
  stmt(db, "INSERT INTO buoy_inbox(id,person_id,account_id,type,source,title,body,created_at) VALUES(?,?,?,'mention',?,?,?,?)", noticeId, personId, accountId, `mention:${noticeId}`, `${actor.displayName} mentioned you`, note, now())])
 return {id: noticeId}
}
/** Current health alerts, one per changed risk state and recipient. SIGNAL-001
 * must use this inbox before adding configurable signals. No source is invented. */
export async function recordHealthAlerts(db: D1Database) {
 const rows = (await db.prepare("SELECT a.id,a.document,o.owner_id AS ownerId FROM buoy_accounts a JOIN buoy_account_owners o ON o.account_id=a.id JOIN oa_operators p ON p.id=o.owner_id AND p.status='active' ORDER BY a.id").all<{id: string; document: string; ownerId: string}>()).results
 for (const row of rows) {
  const h = await accountHealth(db, JSON.parse(row.document) as Account), fingerprint = JSON.stringify([row.ownerId, h.status, h.reasons])
  const previous = await stmt(db, 'SELECT fingerprint FROM buoy_alert_state WHERE account_id=?', row.id).first<{fingerprint: string}>()
  if (previous?.fingerprint === fingerprint) continue
  const at = now(), key = id()
  await db.batch([
   stmt(db, `INSERT INTO buoy_inbox(id,person_id,account_id,type,source,title,body,created_at) SELECT ?,?,?,'signal',?,'Account at risk',?,? WHERE ?='at-risk' AND NOT EXISTS(SELECT 1 FROM buoy_alert_state WHERE account_id=? AND fingerprint=?)`, key, row.ownerId, row.id, `health:${key}`, h.reasons.join(' '), at, h.status, row.id, fingerprint),
   stmt(db, 'INSERT INTO buoy_alert_state(account_id,fingerprint) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET fingerprint=excluded.fingerprint', row.id, fingerprint)])
 }
}
