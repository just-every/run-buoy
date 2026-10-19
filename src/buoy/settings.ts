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
