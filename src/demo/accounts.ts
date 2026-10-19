import type { Account } from '../buoy/health'

// The manual move-in fixture's account/billing/support shape, expanded into a
// lived-in portfolio. All observations are current; risk is recorded evidence.
const companies = [
  ['harbor', 'Harbor Studio', 'USD', 14], ['cedar', 'Cedar Health', 'USD', 21],
  ['northstar', 'Northstar Logistics', 'USD', 28], ['orchard', 'Orchard Workshop', 'USD', 35],
  ['mariner', 'Mariner Analytics', 'USD', 42], ['willow', 'Willow Learning', 'USD', 49],
  ['summit', 'Summit Engineering', 'USD', 56], ['atlas', 'Atlas Coffee', 'USD', 63],
  ['juniper', 'Juniper Design', 'USD', 70], ['coastal', 'Coastal Foods', 'USD', 77],
  ['birch', 'Birch Financial', 'USD', 84], ['fieldwork', 'Fieldwork Research', 'USD', 91],
  ['tandem', 'Tandem Mobility', 'USD', 98], ['paperplane', 'Paperplane Media', 'USD', 105],
  ['redwood', 'Redwood Construction', 'USD', 112], ['lighthouse', 'Lighthouse Events', 'USD', 119],
  ['meadow', 'Meadow Veterinary', 'USD', 126], ['foundry', 'Foundry Software', 'USD', 133],
  ['evergreen', 'Evergreen Energy', 'USD', 140], ['bridgewater', 'Bridgewater Legal', 'USD', 147],
  ['acorn', 'Acorn Childcare', 'USD', 154], ['kinfolk', 'Kinfolk Retail', 'USD', 161],
  ['clearwater', 'Clearwater Marine', 'USD', 168], ['copper', 'Copper Architecture', 'USD', 175],
] as const

export function demoDates(now: Date) {
  return (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

export function demoAccounts(now: Date): Account[] {
  const day = demoDates(now)
  return companies.map(([slug, name, currency, renewal], i) => {
    const totalMinor = 240000 + i * 35000, overdue = i % 6 === 0
    return {
      id: `demo-${slug}`, name, renewalDate: day(renewal), noticeDays: i % 2 ? 30 : 14,
      renewalEvidence: `Signed ${name} annual order ${slug.toUpperCase()}-26, section 4`,
      billing: { observedAt: day(-1), reference: `Invoice ${slug.toUpperCase()}-${1040 + i}`,
        currency, totalMinor, creditsMinor: 0, allocatedMinor: overdue ? Math.floor(totalMinor / 2) : totalMinor,
        dueDate: day(overdue ? -7 : 14) },
      support: { observedAt: day(-1), reference: `${name} support review, ${day(-1)}`,
        openTickets: i % 4, urgentTickets: i % 3 === 0 ? 1 : 0 },
    }
  }).map(account => ({ ...account, support: account.support && {
    ...account.support, openTickets: Math.max(account.support.openTickets, account.support.urgentTickets),
  } }))
}
