import {configurationSignals} from './ai/configuration-signals'
import {roleNotification} from './roles'
import {recordAdoptionAlerts} from './adoption/consumers-alerts'
import type { Bindings } from '../auth.server'
import { operatorMail } from '../mail.server.mjs'
import { id, now, stmt } from './core'
import { localTime, taskTiming } from './settings'
import { preferences, recordHealthAlerts, type NoticeType } from './notify'
import { escape } from './ui/html'

export const emailLabel = (status: string) => ({'scope-refused':'Email not sent: outside current record scope',dismissed:'Email cancelled: alert dismissed', pending:'Email waiting', reserved:'Email outcome unconfirmed; will not resend automatically', accepted:'Email accepted by the mail provider', failed:'Email refused by the mail provider', uncertain:'Email outcome unconfirmed; will not resend automatically', development:'Email not sent: development mailer', 'no-provider':'Email not sent: no mail provider', 'no-recipient':'Email not sent: person inactive', digest:'Email included in digest', none:'Email disabled', queued:'Email waiting for digest'}[status] ?? status)
async function send(env: Bindings, deliveryId: string, personId: string, subject: string, content: string, accountId?:string) {
 const recipient = await stmt(env.DB, "SELECT email FROM oa_operators WHERE id=? AND status='active'", personId).first<{email:string}>()
 if (!recipient) return 'no-recipient'
 if(accountId){const projection=await roleNotification(env.DB,personId,accountId,subject,content,env.AUTH_ORIGIN);if(!projection.allowed)return 'scope-refused';subject=projection.subject;content=projection.content}
 const sender = operatorMail(env)
 if (!sender || !env.MAIL_FROM) return 'no-provider'
 try {
  const result = await sender.send({deliveryId, from:env.MAIL_FROM, to:[recipient.email], subject, text:content, html:`<p>${escape(content).replaceAll('\n','<br>')}</p>`, headers:{'Auto-Submitted':'auto-generated'}})
  return ['accepted','uncertain','development'].includes(result.status) ? result.status : ['rejected','rate_limited'].includes(result.status) ? 'failed' : 'uncertain'
 } catch { return 'uncertain' }
}
/** Reserve before the paid edge. A crash/unconfirmed response is never retried. */
export async function flushNotifications(env: Bindings) {
 const rows = (await env.DB.prepare("SELECT n.id,n.person_id AS personId,n.type,n.title,n.body,n.account_id AS accountId,json_extract(a.document,'$.name') AS accountName FROM buoy_inbox n JOIN buoy_accounts a ON a.id=n.account_id WHERE n.email='pending' ORDER BY n.created_at,n.id").all<{id:string;personId:string;type:NoticeType;title:string;body:string;accountId:string;accountName:string}>()).results
 for (const row of rows) {
  const mode = (await preferences(env.DB, row.personId)).modes[row.type]
  const claimed = await stmt(env.DB, "UPDATE buoy_inbox SET email=? WHERE id=? AND email='pending'", mode === 'immediate' ? 'reserved' : mode === 'digest' ? 'queued' : 'none', row.id).run()
  if (claimed.meta.changes !== 1 || mode !== 'immediate') continue
  const status = await send(env, row.id, row.personId, `Buoy: ${row.title}`, `${row.title}\n${row.accountName}\n${row.body}\n${env.AUTH_ORIGIN}/app/accounts/${encodeURIComponent(row.accountId)}\n`,row.accountId)
  await stmt(env.DB, 'UPDATE buoy_inbox SET email=? WHERE id=?', status, row.id).run()
 }
}
export async function runDigests(env: Bindings, at = new Date()) {
 const db = env.DB, {date, hour} = localTime((await taskTiming(db)).timeZone, at)
 if (hour < 8) return
 const monday = new Date(date+'T00:00:00Z').getUTCDay() === 1
 const people = (await db.prepare("SELECT p.person_id AS personId FROM buoy_notification_preferences p JOIN oa_operators o ON o.id=p.person_id AND o.status='active' WHERE p.frequency<>'off' AND (o.role IN ('owner','admin') OR NOT EXISTS(SELECT 1 FROM buoy_role_assignments a WHERE a.person_id=o.id))").all<{personId:string}>()).results
 for (const {personId} of people) {
  const p = await preferences(db, personId)
  if (p.frequency === 'off' || (p.frequency === 'weekly' && !monday)) continue
  const digestId = id(), cursor = (await db.prepare('SELECT COALESCE(max(rowid),0) AS n FROM buoy_audit').first<{n:number}>())!.n
  const items = (await stmt(db, "SELECT n.id,n.type,n.title,n.body,n.account_id AS accountId,json_extract(a.document,'$.name') AS accountName FROM buoy_inbox n JOIN buoy_accounts a ON a.id=n.account_id WHERE n.person_id=? AND n.digest_id IS NULL AND n.email IN ('queued','pending') ORDER BY n.created_at,n.id", personId).all<{id:string;type:NoticeType;title:string;body:string;accountId:string;accountName:string}>()).results.filter(row => p.modes[row.type] === 'digest')
  const changes = (await stmt(db, `SELECT json_extract(a.document,'$.name') AS name,a.id,count(*) AS count FROM buoy_audit e JOIN buoy_audit_subjects s ON s.subject=e.subject JOIN buoy_accounts a ON a.id=s.account_id JOIN buoy_account_owners o ON o.account_id=a.id WHERE o.owner_id=? AND e.rowid>? AND e.rowid<=? GROUP BY a.id ORDER BY a.id`, personId, p.bookCursor, cursor).all<{id:string;name:string;count:number}>()).results
  // The period reservation, item claims and cursor move are one transaction.
  const reservation = stmt(db, "INSERT OR IGNORE INTO buoy_digests(id,person_id,period,frequency,created_at,email) SELECT ?,?,?,?,?,'reserved' WHERE EXISTS(SELECT 1 FROM buoy_notification_preferences WHERE person_id=? AND frequency=? AND modes=?)", digestId, personId, date, p.frequency, now(), personId, p.frequency, JSON.stringify(p.modes))
  const claimed = await db.batch([reservation, ...items.map(item => stmt(db, "UPDATE buoy_inbox SET digest_id=?,email='digest' WHERE id=? AND digest_id IS NULL AND email IN ('queued','pending') AND EXISTS(SELECT 1 FROM buoy_digests WHERE id=?)", digestId, item.id, digestId)), stmt(db, 'UPDATE buoy_notification_preferences SET book_cursor=? WHERE person_id=? AND EXISTS(SELECT 1 FROM buoy_digests WHERE id=?)', cursor, personId, digestId)])
  if (claimed[0].meta.changes !== 1) continue
  const text = [`Your ${p.frequency} Buoy digest`, ...items.filter((_,index)=>claimed[index+1].meta.changes===1).map(item => `${item.type}: ${item.title} — ${item.accountName}\n${item.body}\n${env.AUTH_ORIGIN}/app/accounts/${encodeURIComponent(item.accountId)}`), ...changes.map(row => `${row.name}: ${row.count} recorded book change(s). ${env.AUTH_ORIGIN}/app/accounts/${encodeURIComponent(row.id)}`), `${env.AUTH_ORIGIN}/app/notifications`].join('\n\n')
  await stmt(db, 'UPDATE buoy_digests SET email=? WHERE id=?', await send(env, digestId, personId, `Buoy ${p.frequency} digest`, text), digestId).run()
 }
}
export async function runNotifications(env: Bindings, at = new Date()) {
 await recordAdoptionAlerts(env.DB)
 await configurationSignals(env.DB)
 await recordHealthAlerts(env.DB)
 await flushNotifications(env)
 await runDigests(env, at)
}
