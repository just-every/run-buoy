import type { Account } from '../buoy/health'

// Tidewell Software's renewal runway: the manual move-in fixture's account,
// billing and support shape for the eleven accounts renewing Oct 2026 to Mar 2027.
// Renewal dates are the homepage's and the picked app's own records (Cascade
// Freight renews Thu Dec 31, 2026 with its contract notice on Mon Nov 30), and
// every notice term lands on a weekday. Each annual invoice is the account's
// contract value. Observations are weekdays before the demo's start, so evidence is
// as fresh as the story; Cascade Freight carries the one at-risk signal.
type Row = [slug: string, name: string, renewal: string, noticeDays: number, total: number, billingSeen: number | null, supportSeen: number | null, open: number, urgent: number]
const book: Row[] = [
  ['tri-county', 'Tri-County Movers', '2026-10-30', 60, 22_500, -6, -2, 1, 0],
  ['halvorsen', 'Halvorsen Dairy', '2026-11-16', 45, 41_200, -18, -3, 2, 0],
  ['pinecrest', 'Pinecrest Lumber Supply', '2026-11-30', 45, 88_500, -9, -1, 0, 0],
  ['ozark-valley', 'Ozark Valley Feed', '2026-12-01', 60, 37_800, -22, -4, 1, 0],
  ['kestrel', 'Kestrel Cold Chain', '2026-12-15', 60, 212_000, -5, -38, 3, 0],
  ['cascade', 'Cascade Freight', '2026-12-31', 31, 148_000, -7, -1, 4, 3],
  ['bluegate', 'Bluegate Imports', '2026-12-31', 30, 64_000, -11, -2, 0, 0],
  ['ridgeline', 'Ridgeline Haulers', '2027-01-15', 60, 96_000, -41, -2, 2, 0],
  ['juniper', 'Juniper Labs', '2027-02-01', 60, 180_000, -3, -1, 1, 0],
  ['bayside', 'Bayside Produce', '2027-02-26', 60, 61_500, -14, -5, 1, 0],
  ['cold-spring', 'Cold Spring Logistics', '2027-03-31', 90, 86_000, -8, null, 0, 0],
]

export function demoDates(now: Date) {
  return (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

export function demoAccounts(now: Date): Account[] {
  const day = demoDates(now)
  // Snapshots are taken on weekdays: a weekend observation moves back to the Friday before.
  const seen = (days: number): string => [0, 6].includes(new Date(day(days)).getUTCDay()) ? seen(days - 1) : day(days)
  return book.map(([slug, name, renewalDate, noticeDays, total, billingSeen, supportSeen, openTickets, urgentTickets], i) => ({
    id: `demo-${slug}`, name, renewalDate, noticeDays,
    renewalEvidence: `Signed ${name} annual order TW-${slug.toUpperCase()}-26, section 4`,
    billing: billingSeen === null ? null : { observedAt: seen(billingSeen), reference: `Stripe invoice TW-26-${4100 + i * 7}`,
      currency: 'USD', totalMinor: total * 100, creditsMinor: 0, allocatedMinor: total * 100, dueDate: seen(billingSeen - 14) },
    support: supportSeen === null ? null : { observedAt: seen(supportSeen), reference: `Zendesk view: ${name} open tickets`, openTickets, urgentTickets },
  }))
}
