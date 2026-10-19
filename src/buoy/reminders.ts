import type { Bindings } from '../auth.server'
import { operatorMail } from '../mail.server.mjs'
import { stmt, id, now, usDay, type Actor } from './core'
import { HANDLER } from './tasks'
import { escape } from './ui/html'
import { localTime, taskTiming } from './settings'

// PLAY-002: the reminder run (an hourly Cron Trigger, wrangler.jsonc and deploy.json).
// Task days are calendar dates in the installation's time zone (UTC until one is set);
// a day's reminders are recorded by the first run at or after 08:00 there that day.
// Each task gets at most one of each kind, in-app and by email to the one person it
// goes to. Escalation goes to the owner's named manager, or the installation owner.
export const REMINDER_HOUR = 8
const DAY = 86400000
const shift = (value: string, days: number) => new Date(Date.parse(value) + days * DAY).toISOString().slice(0, 10)
type Due = {id: string; title: string; dueDate: string; accountId: string; accountName: string; ownerId: string; ownerName: string | null; handlerId: string; managerId: string | null}
export async function runReminders(env: Bindings, at = new Date()) {
 const db = env.DB, timing = await taskTiming(db), {date: on, hour} = localTime(timing.timeZone, at)
 if (hour < REMINDER_HOUR) return {on, recorded: 0}
 const {results} = await stmt(db, `SELECT t.id,t.title,t.due_date AS dueDate,t.account_id AS accountId,json_extract(a.document,'$.name') AS accountName,t.owner_id AS ownerId,
  (SELECT display_name FROM oa_operators WHERE id=t.owner_id) AS ownerName,${HANDLER} AS handlerId,
  COALESCE((SELECT m.id FROM buoy_people p JOIN oa_operators m ON m.id=p.manager_id AND m.status='active' WHERE p.person_id=t.owner_id),(SELECT id FROM oa_operators WHERE role='owner' AND status='active' ORDER BY created_at LIMIT 1)) AS managerId
  FROM buoy_tasks t JOIN buoy_accounts a ON a.id=t.account_id WHERE t.completed_at IS NULL AND t.owner_id IS NOT NULL ORDER BY t.due_date,t.id`, on, on).all<Due>()
 const sender = operatorMail(env), sent: string[] = []
 for (const task of results) {
  const [kind, personId] = task.dueDate === on ? ['due-today', task.handlerId]
   : task.dueDate > on && task.dueDate <= shift(on, timing.remindDaysBefore) ? ['due-soon', task.handlerId]
   : on >= shift(task.dueDate, timing.escalateAfterDays) ? ['escalated', task.managerId] : []
  if (!kind || !personId) continue
  const notificationId = id()
  const inserted = await stmt(db, "INSERT OR IGNORE INTO buoy_notifications(id,person_id,task_id,kind,on_date,created_at,email) VALUES(?,?,?,?,?,?,'pending')", notificationId, personId, task.id, kind, on, now()).run()
  if (inserted.meta.changes !== 1) continue
  await stmt(db, 'UPDATE buoy_notifications SET email=? WHERE id=?', await mail(env, sender, notificationId, kind, personId, task), notificationId).run()
  sent.push(notificationId)
 }
 return {on, recorded: sent.length}
}
async function mail(env: Bindings, sender: ReturnType<typeof operatorMail>, deliveryId: string, kind: string, personId: string, task: Due) {
 if (!sender || !env.MAIL_FROM) return 'no-provider'
 const recipient = await stmt(env.DB, "SELECT email FROM oa_operators WHERE id=? AND status='active'", personId).first<{email: string}>()
 if (!recipient) return 'no-recipient'
 const title = task.title.replace(/\s+/g, ' '), link = `${env.AUTH_ORIGIN}/app/accounts/${encodeURIComponent(task.accountId)}#tasks`
 const subject = kind === 'due-today' ? `Due today: ${title}` : kind === 'due-soon' ? `Due ${usDay(task.dueDate)}: ${title}` : `Escalated, overdue since ${usDay(task.dueDate)}: ${title}`
 const lead = kind === 'escalated' ? `${task.ownerName ?? 'A team member'}'s task for ${task.accountName} was due ${usDay(task.dueDate)} and is still open, so it is escalated to you as their manager.` : `Your task for ${task.accountName} is due ${usDay(task.dueDate)}.`
 const html = `<p>${escape(lead)}</p><p><strong>${escape(title)}</strong></p><p><a href="${escape(link)}">Open it in Buoy</a></p>`
 try {
  const result = await sender.send({deliveryId, from: env.MAIL_FROM, to: [recipient.email], subject: subject.slice(0, 900), text: `${lead}\n\n${title}\n\nOpen it in Buoy: ${link}\n`, html, headers: {'Auto-Submitted': 'auto-generated'}})
  return result.status === 'accepted' || result.status === 'development' || result.status === 'uncertain' ? result.status : 'failed'
 } catch { return 'failed' }
}
const LABELS: Record<string, string> = {pending: 'Email not yet attempted', accepted: 'Email accepted by the mail provider', failed: 'Email refused by the mail provider', uncertain: 'Email outcome unknown: the mail provider did not confirm acceptance', development: 'Email not sent: development mail on this computer', 'no-provider': 'Email not sent: no mail provider is set up', 'no-recipient': 'Email not sent: the person is no longer active'}
/** The signed-in person's own reminders and escalations, newest first. */
export async function notifications(db: D1Database, actor: Actor) {
 if (actor.kind !== 'person') return []
 const {results} = await stmt(db, "SELECT n.id,n.kind,n.on_date AS onDate,n.email,t.id AS taskId,t.title,t.due_date AS dueDate,t.account_id AS accountId,json_extract(a.document,'$.name') AS accountName FROM buoy_notifications n JOIN buoy_tasks t ON t.id=n.task_id JOIN buoy_accounts a ON a.id=t.account_id WHERE n.person_id=? ORDER BY n.created_at DESC,n.id LIMIT 50", actor.id).all<Record<string, string>>()
 return results.map(row => ({...row, emailLabel: LABELS[row.email]}))
}
