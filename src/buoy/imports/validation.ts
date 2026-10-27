import { isCurrency } from '../currencies'
/** Input is a bounded, documented JSON snapshot, never an executable connector. */
export interface BillingSnapshot {
  observedAt: string; reference: string; currency: string; totalMinor: number
  creditsMinor: number; allocatedMinor: number; dueDate: string
}
export interface SupportSnapshot {
  observedAt: string; reference: string; openTickets: number; urgentTickets: number
}
export interface ImportedAccount {
  migrationHealth?:import('../migrate/churnzero-health').MigrationHealth;
  id: string; name: string; renewalDate: string; noticeDays: number; renewalEvidence: string
  billing: BillingSnapshot | null; support: SupportSnapshot | null
}
function object(value: unknown, at: string, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${at} must be an object.`)
  const row = value as Record<string, unknown>
  const extra = Object.keys(row).find(key => !keys.includes(key))
  if (extra) throw new Error(`${at}.${extra} is not supported.`)
  return row
}
function text(value: unknown, at: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`${at} must be nonempty text of at most ${max} characters.`)
  return value.trim()
}
function date(value: unknown, at: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error(`${at} must be a real date in YYYY-MM-DD format.`)
  return value
}
function integer(value: unknown, at: string, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${at} must be a nonnegative whole number at most ${max}.`)
  return value
}
export function parseAccount(value: unknown, at = 'account'): ImportedAccount {
  const row = object(value, at, ['id', 'name', 'renewalDate', 'noticeDays', 'renewalEvidence', 'billing', 'support'])
  const id = text(row.id, `${at}.id`, 64)
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`${at}.id must contain only letters, numbers, underscores and hyphens.`)
  let billing: BillingSnapshot | null = null, support: SupportSnapshot | null = null
  if (row.billing !== null) {
    const b = object(row.billing, `${at}.billing`, ['observedAt', 'reference', 'currency', 'totalMinor', 'creditsMinor', 'allocatedMinor', 'dueDate'])
    const currency = text(b.currency, `${at}.billing.currency`, 3)
    if (!isCurrency(currency)) throw new Error(`${at}.billing.currency must be an ISO 4217 currency code with minor units, such as USD.`)
    billing = { observedAt: date(b.observedAt, `${at}.billing.observedAt`), reference: text(b.reference, `${at}.billing.reference`), currency,
      totalMinor: integer(b.totalMinor, `${at}.billing.totalMinor`), creditsMinor: integer(b.creditsMinor, `${at}.billing.creditsMinor`), allocatedMinor: integer(b.allocatedMinor, `${at}.billing.allocatedMinor`), dueDate: date(b.dueDate, `${at}.billing.dueDate`) }
    if (billing.creditsMinor > billing.totalMinor - billing.allocatedMinor) throw new Error(`${at}.billing credits and allocations cannot exceed the invoice total.`)
    if (billing.observedAt > new Date().toISOString().slice(0, 10)) throw new Error(`${at}.billing observation cannot be in the future.`)
  }
  if (row.support !== null) {
    const s = object(row.support, `${at}.support`, ['observedAt', 'reference', 'openTickets', 'urgentTickets'])
    support = { observedAt: date(s.observedAt, `${at}.support.observedAt`), reference: text(s.reference, `${at}.support.reference`), openTickets: integer(s.openTickets, `${at}.support.openTickets`), urgentTickets: integer(s.urgentTickets, `${at}.support.urgentTickets`) }
    if (support.observedAt > new Date().toISOString().slice(0, 10)) throw new Error(`${at}.support observation cannot be in the future.`)
    if (support.urgentTickets > support.openTickets) throw new Error(`${at}.support.urgentTickets cannot exceed openTickets.`)
  }
  return { id, name: text(row.name, `${at}.name`, 200), renewalDate: date(row.renewalDate, `${at}.renewalDate`), noticeDays: integer(row.noticeDays, `${at}.noticeDays`, 3650), renewalEvidence: text(row.renewalEvidence, `${at}.renewalEvidence`), billing, support }
}
export function parseAccounts(body: unknown): ImportedAccount[] {
  const row = object(body, 'upload', ['accounts'])
  if (!Array.isArray(row.accounts) || row.accounts.length < 1 || row.accounts.length > 50) throw new Error('Upload must contain between 1 and 50 accounts.')
  const accounts = row.accounts.map((account, index) => parseAccount(account, `accounts[${index}]`))
  const seen = new Set<string>()
  for (const account of accounts) {
    if (seen.has(account.id)) throw new Error(`Duplicate account id: ${account.id}.`)
    seen.add(account.id)
  }
  return accounts
}
