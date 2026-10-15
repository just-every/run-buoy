// Adapted from Nectar receivables.ts BALANCE_SQL at c76a60ccffa39cc1a207b52c152bda16d6d7b1df.
// Only payments allocated to this invoice reduce the evidence balance.
export interface Account {
 id: string; name: string; renewalDate: string; noticeDays: number; renewalEvidence: string;
 billing: null | {observedAt: string; reference: string; currency: string; totalMinor: number; creditsMinor: number; allocatedMinor: number; dueDate: string};
 support: null | {observedAt: string; reference: string; openTickets: number; urgentTickets: number};
}
export function health(account: Account, today = new Date().toISOString().slice(0, 10)) {
 const reasons: string[] = [], gaps: string[] = []
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
 return { status: reasons.length ? 'at-risk' : gaps.length ? 'unknown' : 'healthy', reasons: [...reasons, ...gaps, ...(!reasons.length && !gaps.length ? ['Current billing and support snapshots show no defined risk signal.'] : [])] }
}
// Adapted from Locket's confirmed-term deadline path. Calendar dates use UTC
// arithmetic, never browser-local parsing; no billing period implies renewal.
export function noticeDate(account: Account) {
 return new Date(Date.parse(account.renewalDate) - account.noticeDays * 86400000).toISOString().slice(0, 10)
}
