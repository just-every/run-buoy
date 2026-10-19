// Adapted from Nectar receivables.ts BALANCE_SQL at c76a60ccffa39cc1a207b52c152bda16d6d7b1df.
// Only payments allocated to this invoice reduce the evidence balance.
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
  ? `CSM sentiment from ${by} expired after ${sentiment.expiresOn}; the sentiment measure is missing until someone records a new rating.`
  : `${rating} CSM sentiment — ${by}’s judgment, not source data, counting through ${sentiment.expiresOn}: ${sentiment.reason}`}
}
export function health(account: Account, today = new Date().toISOString().slice(0, 10), sentiment: Sentiment | null = null) {
 const reasons: string[] = [], gaps: string[] = [], judged = judgment(sentiment, today)
 const stale = (observed: string) => Date.parse(today) - Date.parse(observed) > 30 * 86400000
 if (!account.billing) gaps.push('Billing evidence is missing.')
 else {
  if (stale(account.billing.observedAt)) gaps.push('Billing evidence is older than 30 days.')
  const balance = account.billing.totalMinor - account.billing.creditsMinor - account.billing.allocatedMinor
  if (balance > 0 && account.billing.dueDate < today) reasons.push(`${account.billing.currency} ${(balance / 100).toFixed(2)} overdue in ${account.billing.reference}.`)
 }
 if (!account.support) gaps.push('Support evidence is missing.')
 else {
  if (stale(account.support.observedAt)) gaps.push('Support evidence is older than 30 days.')
  if (account.support.urgentTickets > 0) reasons.push(`${account.support.urgentTickets} urgent open support ticket(s) in ${account.support.reference}.`)
 }
 const evidenceRisk = reasons.length > 0
 if (judged && !judged.expired && judged.rating === 'red') reasons.push(judged.line)
 const notes = judged && (judged.expired || judged.rating !== 'red') ? [judged.line] : []
 return { status: reasons.length ? 'at-risk' : gaps.length ? 'unknown' : 'healthy', reasons: [...reasons, ...gaps, ...(!evidenceRisk && !gaps.length ? ['Current billing and support snapshots show no defined risk signal.'] : []), ...notes],
  sentiment: judged && {rating: judged.rating, reason: judged.reason, by: judged.by, recordedAt: judged.recordedAt, expiresOn: judged.expiresOn, expired: judged.expired} }
}
// Adapted from Locket's confirmed-term deadline path. Calendar dates use UTC
// arithmetic, never browser-local parsing; no billing period implies renewal.
export function noticeDate(account: Account) {
 return new Date(Date.parse(account.renewalDate) - account.noticeDays * 86400000).toISOString().slice(0, 10)
}
