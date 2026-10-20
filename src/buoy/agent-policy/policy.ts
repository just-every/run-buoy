import { insist } from '../core'
export const COMMANDS = ['renewals.list', 'playbook.prepare', 'renewal.prepare'] as const
export const DATA_CLASSES = ['account', 'billing', 'support', 'sentiment'] as const
export const COST_LABEL = 'No paid or external action'
export type AgentCommand = typeof COMMANDS[number]
export type DataClass = typeof DATA_CLASSES[number]
export interface AgentPolicy {scopes: AgentCommand[]; dataClasses: DataClass[]; requestsPerMinute: number; budgetMinor: number}
export type RequestCommand = AgentCommand | 'commands.read' | 'commands.request' | 'other.route'
export interface AgentRequest {id: string; command: RequestCommand; refusalAudited?: boolean}
export interface PolicyRow {scopes: string; data_classes: string; requests_per_minute: number; budget_minor: number}
export const policyFromRow = (row: PolicyRow): AgentPolicy => ({scopes: JSON.parse(row.scopes), dataClasses: JSON.parse(row.data_classes), requestsPerMinute: row.requests_per_minute, budgetMinor: row.budget_minor})
export const describedPolicy = (policy: AgentPolicy) => ({...policy, currency: 'USD' as const, spentMinor: 0, costLabel: COST_LABEL})
function selection<T extends string>(value: unknown, allowed: readonly T[], label: string): T[] {
 if (value === undefined) return [...allowed]
 insist(Array.isArray(value) && value.length > 0 && value.length <= allowed.length && value.every(item => allowed.includes(item)) && new Set(value).size === value.length, `Choose a nonempty unique list of ${label}: ${allowed.join(', ')}.`)
 return value as T[]
}
function integer(value: unknown, fallback: number, min: number, max: number, label: string): number {
 const result = value === undefined ? fallback : value
 insist(typeof result === 'number' && Number.isSafeInteger(result) && result >= min && result <= max, `${label} must be a whole number from ${min} to ${max}.`)
 return result
}
export function mintPolicy(input: Record<string, unknown>) {
 insist(Object.keys(input).every(key => ['label','scopes','dataClasses','expiresDays','requestsPerMinute','budgetMinor'].includes(key)), 'Unknown agent policy field.')
 return {scopes: selection(input.scopes, COMMANDS, 'commands'), dataClasses: selection(input.dataClasses, DATA_CLASSES, 'data classes'),
  expiresDays: integer(input.expiresDays, 7, 1, 365, 'Expiry days'), requestsPerMinute: integer(input.requestsPerMinute, 60, 1, 10000, 'Requests per minute'), budgetMinor: integer(input.budgetMinor, 0, 0, Number.MAX_SAFE_INTEGER, 'USD budget in cents')}
}
export function requireCommand(policy: AgentPolicy, command: AgentCommand) {
 insist(policy.scopes.includes(command), 'This command is outside the agent grant.', 403)
 if (command !== 'renewals.list') insist(DATA_CLASSES.every(kind => policy.dataClasses.includes(kind)), 'Preparation requires account, billing, support and sentiment data access.', 403)
}
export function projectAccounts<T extends {id: string; revision: unknown; health: {sentiment: unknown}}>(accounts: T[], policy: AgentPolicy) {
 if (DATA_CLASSES.every(kind => policy.dataClasses.includes(kind))) return accounts
 return accounts.map(account => {
  const row = account as T & Record<string, unknown>, result: Record<string, unknown> = {id: row.id, revision: row.revision}
  if (policy.dataClasses.includes('account')) for (const key of ['name','renewalDate','noticeDays','renewalEvidence','noticeDate','ownerId']) result[key] = row[key]
  for (const key of ['billing','support'] as const) if (policy.dataClasses.includes(key)) result[key] = row[key]
  if (policy.dataClasses.includes('sentiment')) result.sentiment = row.health.sentiment
  return result
 })
}
