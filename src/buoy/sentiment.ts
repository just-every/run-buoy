import { insist, text, stmt, commit, id, now, type Actor } from './core'
import { account } from './accounts'
import { health, type Account, type Sentiment } from './health'

// HEALTH-002: a CSM's rating is a person's judgment with a reason and an end.
// It counts through expires_on (a UTC calendar date) and is missing from the next day.
const DAY = 86400000
export const today = () => new Date().toISOString().slice(0, 10)
const LATEST = 'SELECT s.account_id AS accountId,s.rating,s.reason,s.recorded_by AS recordedBy,s.recorded_at AS recordedAt,s.expires_on AS expiresOn FROM buoy_sentiments s WHERE NOT EXISTS(SELECT 1 FROM buoy_sentiments n WHERE n.account_id=s.account_id AND (n.recorded_at>s.recorded_at OR (n.recorded_at=s.recorded_at AND n.id>s.id)))'
export async function latestSentiments(db: D1Database) {
 const rows = (await db.prepare(LATEST).all<Sentiment & {accountId: string}>()).results
 return new Map(rows.map(({accountId, ...sentiment}) => [accountId, sentiment as Sentiment]))
}
export async function latestSentiment(db: D1Database, accountId: string) {
 return await stmt(db, `${LATEST} AND s.account_id=?`, accountId).first<Sentiment>() ?? null
}
export async function accountHealth(db: D1Database, current: Account, on = today()) {
 return health(current, on, await latestSentiment(db, current.id))
}
export async function recordSentiment(db: D1Database, actor: Actor, accountId: string, input: Record<string, unknown>) {
 insist(actor.kind === 'person', 'Sentiment is a person’s judgment. Agents cannot record it.', 403)
 const current = await account(db, accountId)
 insist(['red', 'amber', 'green'].includes(String(input.rating)), 'Choose a red, amber or green sentiment.')
 const reason = text(input.reason, 'Sentiment reason'), days = input.days === undefined ? 30 : input.days
 insist(Number.isInteger(days) && Number(days) >= 1 && Number(days) <= 90, 'Sentiment lasts 1 to 90 whole days.')
 const at = now(), expiresOn = new Date(Date.parse(at.slice(0, 10)) + Number(days) * DAY).toISOString().slice(0, 10)
 const sentiment: Sentiment = {rating: input.rating as Sentiment['rating'], reason, recordedBy: `person:${actor.id}:${actor.displayName}`, recordedAt: at, expiresOn}
 await commit(db, actor, current.id, 'sentiment.recorded', [
  stmt(db, 'INSERT INTO buoy_sentiments(id,account_id,rating,reason,recorded_by,recorded_at,expires_on) VALUES(?,?,?,?,?,?,?)', id(), current.id, sentiment.rating, reason, sentiment.recordedBy, at, expiresOn)])
 return {accountId: current.id, sentiment, health: health(current, today(), sentiment)}
}
// Health on a later date projects today's evidence and judgments forward: what
// will be stale or expired by then. It never changes data and never looks back.
export async function healthOn(db: D1Database, accountId: string, on: string) {
 const current = await account(db, accountId), from = today()
 insist(on >= from && Date.parse(on) - Date.parse(from) <= 366 * DAY, 'Read health from today up to 366 days ahead.')
 return {accountId: current.id, on, health: await accountHealth(db, current, on)}
}
