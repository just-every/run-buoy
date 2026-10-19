import type { Account } from '../buoy/health'

// Tidewell Software's renewal runway: the manual move-in fixture's account,
// billing and support shape for the eleven accounts renewing over the next six
// months. Each annual invoice is the account's contract value. Dates are days
// from the demo's start; Cascade Freight carries the one at-risk signal.
type Row = [slug: string, name: string, renewal: number, noticeDays: number, total: number, billingSeen: number | null, supportSeen: number | null, open: number, urgent: number]
const book: Row[] = [
  ['tri-county', 'Tri-County Movers', 24, 60, 22_500, -6, -2, 1, 0],
  ['halvorsen', 'Halvorsen Dairy', 41, 30, 41_200, -18, -3, 2, 0],
  ['pinecrest', 'Pinecrest Lumber Supply', 55, 30, 88_500, -9, -1, 0, 0],
  ['ozark-valley', 'Ozark Valley Feed', 56, 30, 37_800, -22, -4, 1, 0],
  ['kestrel', 'Kestrel Cold Chain', 70, 45, 212_000, -5, -38, 3, 0],
  ['cascade', 'Cascade Freight', 86, 31, 148_000, -7, -1, 4, 3],
  ['bluegate', 'Bluegate Imports', 86, 30, 64_000, -11, -2, 0, 0],
  ['ridgeline', 'Ridgeline Haulers', 101, 60, 96_000, -41, -2, 2, 0],
  ['juniper', 'Juniper Labs', 118, 60, 180_000, -3, -1, 1, 0],
  ['bayside', 'Bayside Produce', 143, 60, 61_500, -14, -5, 1, 0],
  ['cold-spring', 'Cold Spring Logistics', 176, 90, 86_000, -8, null, 0, 0],
]

export function demoDates(now: Date) {
  return (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

export function demoAccounts(now: Date): Account[] {
  const day = demoDates(now)
  return book.map(([slug, name, renewal, noticeDays, total, billingSeen, supportSeen, openTickets, urgentTickets], i) => ({
    id: `demo-${slug}`, name, renewalDate: day(renewal), noticeDays,
    renewalEvidence: `Signed ${name} annual order TW-${slug.toUpperCase()}-26, section 4`,
    billing: billingSeen === null ? null : { observedAt: day(billingSeen), reference: `Stripe invoice TW-26-${4100 + i * 7}`,
      currency: 'USD', totalMinor: total * 100, creditsMinor: 0, allocatedMinor: total * 100, dueDate: day(billingSeen - 14) },
    support: supportSeen === null ? null : { observedAt: day(supportSeen), reference: `Zendesk view: ${name} open tickets`, openTickets, urgentTickets },
  }))
}
