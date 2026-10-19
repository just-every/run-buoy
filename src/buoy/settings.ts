import { insist, stmt, now, requirePerson, type Actor } from './core'

// DATA-001: each source kind has its own staleness threshold. Every observation
// today is a manual snapshot (typed in or moved in from a file); connected
// sources add their own kind and threshold before they ship (CONNECT-001).
export interface Staleness { billingDays: number; supportDays: number }
export const DEFAULT_STALENESS: Staleness = {billingDays: 30, supportDays: 30}
export async function staleness(db: D1Database): Promise<Staleness> {
 const row = await stmt(db, "SELECT value FROM buoy_settings WHERE key='staleness'").first<{value: string}>()
 return row ? {...DEFAULT_STALENESS, ...JSON.parse(row.value)} : DEFAULT_STALENESS
}
export async function setStaleness(db: D1Database, actor: Actor, input: Record<string, unknown>) {
 requirePerson(actor)
 const value: Staleness = {billingDays: 0, supportDays: 0}
 for (const key of ['billingDays', 'supportDays'] as const) {
  const days = input[key]
  insist(typeof days === 'number' && Number.isInteger(days) && days >= 1 && days <= 365, `${key === 'billingDays' ? 'Billing' : 'Support'} snapshots go stale after 1 to 365 whole days.`)
  value[key] = days
 }
 insist(Object.keys(input).every(key => key in value), 'Only billingDays and supportDays can be set.')
 const result = await stmt(db, "INSERT INTO buoy_settings(key,value,updated_by,updated_at) SELECT 'staleness',?,?,? WHERE EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role IN ('owner','admin')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at", JSON.stringify(value), `person:${actor.id}:${actor.displayName}`, now(), actor.id).run()
 insist(result.meta.changes === 1, 'Owner or admin authority changed.', 403)
 return {staleness: await staleness(db)}
}

// PLAY-002: reminders go out a set number of whole days before the due date and on
// it; an open task escalates once the set number of days after its due date has begun.
// Task days are calendar dates in the installation's time zone (UTC until one is set).
export interface TaskTiming { remindDaysBefore: number; escalateAfterDays: number; timeZone: string | null }
export const DEFAULT_TASK_TIMING: TaskTiming = {remindDaysBefore: 1, escalateAfterDays: 1, timeZone: null}
export async function taskTiming(db: D1Database): Promise<TaskTiming> {
 const row = await stmt(db, "SELECT value FROM buoy_settings WHERE key='tasks'").first<{value: string}>()
 return row ? {...DEFAULT_TASK_TIMING, ...JSON.parse(row.value)} : DEFAULT_TASK_TIMING
}
const parts = (timeZone: string | null, at: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: timeZone ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'}).formatToParts(at).map(part => [part.type, part.value]))
/** The calendar date and hour at an instant in the installation's time zone. */
export function localTime(timeZone: string | null, at = new Date()) {
 const p = parts(timeZone, at)
 return {date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour)}
}
export async function setTaskTiming(db: D1Database, actor: Actor, input: Record<string, unknown>) {
 requirePerson(actor)
 const value: TaskTiming = {remindDaysBefore: 0, escalateAfterDays: 0, timeZone: null}
 for (const key of ['remindDaysBefore', 'escalateAfterDays'] as const) {
  const days = input[key]
  insist(typeof days === 'number' && Number.isInteger(days) && days >= 1 && days <= 30, `${key === 'remindDaysBefore' ? 'Reminders' : 'Escalation'} take 1 to 30 whole days.`)
  value[key] = days
 }
 if (input.timeZone !== undefined && input.timeZone !== null && input.timeZone !== '') {
  insist(typeof input.timeZone === 'string' && input.timeZone.length <= 64, 'Time zone must be an IANA name such as America/Chicago.')
  try { value.timeZone = new Intl.DateTimeFormat('en-US', {timeZone: input.timeZone}).resolvedOptions().timeZone } catch { insist(false, 'Time zone must be an IANA name such as America/Chicago.') }
 }
 insist(Object.keys(input).every(key => key in value), 'Only remindDaysBefore, escalateAfterDays and timeZone can be set.')
 const result = await stmt(db, "INSERT INTO buoy_settings(key,value,updated_by,updated_at) SELECT 'tasks',?,?,? WHERE EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role IN ('owner','admin')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at", JSON.stringify(value), `person:${actor.id}:${actor.displayName}`, now(), actor.id).run()
 insist(result.meta.changes === 1, 'Owner or admin authority changed.', 403)
 return {tasks: await taskTiming(db)}
}
