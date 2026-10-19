import { usDay } from './core'
import { majorAmount } from './currencies'
import { DEFAULT_STALENESS, type Staleness } from './settings'
// Adapted from Nectar receivables.ts BALANCE_SQL at c76a60ccffa39cc1a207b52c152bda16d6d7b1df.
// Only payments allocated to this invoice reduce the evidence balance.
export const HEALTH_INTERPRETATION = 'Health describes recorded evidence; it is not a churn prediction or proof of causation.'
export interface Account {
 id: string; name: string; renewalDate: string; noticeDays: number; renewalEvidence: string;
 billing: null | {observedAt: string; reference: string; currency: string; totalMinor: number; creditsMinor: number; allocatedMinor: number; dueDate: string};
 support: null | {observedAt: string; reference: string; openTickets: number; urgentTickets: number};
}
export interface Sentiment { rating: 'red' | 'amber' | 'green'; reason: string; recordedBy: string; recordedAt: string; expiresOn: string }
// HEALTH-002: red sentiment is a risk reason; amber and green are shown as the
// person's judgment without moving the band. An expired rating is a missing
// optional measure: it is named but, unlike billing and support, never makes health Unknown.
function judgment(sentiment: Sentiment | null, today: string) {
 if (!sentiment) return null
 const by = sentiment.recordedBy.split(':').slice(2).join(':') || 'A team member', expired = today > sentiment.expiresOn
 const rating = sentiment.rating[0].toUpperCase() + sentiment.rating.slice(1)
 return {...sentiment, by, expired, line: expired
  ? `CSM sentiment from ${by} expired after ${usDay(sentiment.expiresOn)}; the sentiment measure is missing until someone records a new rating.`
  : `${rating} CSM sentiment — ${by}’s judgment, not source data, counting through ${usDay(sentiment.expiresOn)}: ${sentiment.reason}`}
}
// DATA-001: evidence is stale when its observation date is more than the source
// kind's threshold in whole UTC days before today. Every observation is a manual snapshot today.
export function health(account: Account, today = new Date().toISOString().slice(0, 10), sentiment: Sentiment | null = null, limits: Staleness = DEFAULT_STALENESS) {
 const reasons: string[] = [], gaps: string[] = [], judged = judgment(sentiment, today)
 const stale = (observed: string, days: number) => Date.parse(today) - Date.parse(observed) > days * 86400000
 const evidence = (['billing', 'support'] as const).map(kind => {
  const observation = account[kind], staleAfterDays = kind === 'billing' ? limits.billingDays : limits.supportDays
  return {kind, sourceSystem: observation ? 'manual' : null, staleAfterDays, missing: !observation, stale: !!observation && stale(observation.observedAt, staleAfterDays)}
 })
 if (!account.billing) gaps.push('Billing evidence is missing.')
 else {
  if (evidence[0].stale) gaps.push(`Billing evidence is older than ${limits.billingDays} days.`)
  const balance = account.billing.totalMinor - account.billing.creditsMinor - account.billing.allocatedMinor
  if (balance > 0 && account.billing.dueDate < today) reasons.push(`${account.billing.currency} ${majorAmount(balance, account.billing.currency)} overdue in ${account.billing.reference}.`)
 }
 if (!account.support) gaps.push('Support evidence is missing.')
 else {
  if (evidence[1].stale) gaps.push(`Support evidence is older than ${limits.supportDays} days.`)
  if (account.support.urgentTickets > 0) reasons.push(`${account.support.urgentTickets} urgent open support ticket(s) in ${account.support.reference}.`)
 }
 const evidenceRisk = reasons.length > 0
 if (judged && !judged.expired && judged.rating === 'red') reasons.push(judged.line)
 const notes = judged && (judged.expired || judged.rating !== 'red') ? [judged.line] : []
 return { interpretation: HEALTH_INTERPRETATION, evaluatedOn: today, status: reasons.length ? 'at-risk' : gaps.length ? 'unknown' : 'healthy', reasons: [...reasons, ...gaps, ...(!evidenceRisk && !gaps.length ? ['Current billing and support snapshots show no defined risk signal.'] : []), ...notes],
  evidence, sentiment: judged && {rating: judged.rating, reason: judged.reason, by: judged.by, recordedAt: judged.recordedAt, expiresOn: judged.expiresOn, expired: judged.expired} }
}
// Adapted from Locket's confirmed-term deadline path. Calendar dates use UTC
// arithmetic, never browser-local parsing; no billing period implies renewal.
export function noticeDate(account: Account) {
 return new Date(Date.parse(account.renewalDate) - account.noticeDays * 86400000).toISOString().slice(0, 10)
}
// The runway's health along a lane: today's band, then each day before renewal on
// which today's evidence turns stale or a judgment expires. It projects forward
// exactly as healthOn does and never looks back or invents history.
const DAY = 86400000
const shift = (value: string, days: number) => new Date(Date.parse(value.slice(0, 10)) + days * DAY).toISOString().slice(0, 10)
export function outlook(account: Account, today: string, sentiment: Sentiment | null = null, limits: Staleness = DEFAULT_STALENESS) {
 const turns = [account.billing && shift(account.billing.observedAt, limits.billingDays + 1), account.support && shift(account.support.observedAt, limits.supportDays + 1), sentiment && shift(sentiment.expiresOn, 1)]
 const days = [today, ...turns.filter((day): day is string => !!day && day > today && day < account.renewalDate)].sort()
 const segments: {from: string; status: string}[] = []
 for (const day of days) {
  const status = health(account, day, sentiment, limits).status
  if (segments.at(-1)?.status !== status) segments.push({from: day, status})
 }
 return segments
}
