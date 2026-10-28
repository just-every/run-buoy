import { insist, object, text } from './core'
import type {DraftHandover} from './plans/handover'

export interface Team { id: string; name: string; pod: string; personIds: string[] }
export interface TeamSettings {
 teams: Team[]; capacities: {personId: string; capacity: number}[];
 rules: {id: string; name: string; teamId: string; territory?: string; segmentId?:string}[]
}
export interface AssignmentInput { mode: 'rules' | 'handover' | 'rebalance'; fromId?: string; toId?: string; note?: string }
export interface Snapshot {
 settings: string; segments?:{id:string;name:string;accountId:string}[];
 accounts: {id: string; document: string; revision: string; ownerId: string | null; assignedAt: string | null}[];
 territories: {accountId: string; territory: string}[];
 people: {id: string; role: string; status: string; version: number}[];
 tasks: {id: string; accountId: string; ownerId: string | null; completedAt: string | null}[];
 drafts: DraftHandover[]
}
export interface Move { accountId: string; fromId: string | null; toId: string; openTasks: number; drafts:{id:string;name:string;revision:string}[] }
export const keys = (value: Record<string, unknown>, allowed: string[]) => insist(Object.keys(value).every(key => allowed.includes(key)), 'Unsupported team field.')
const list = (value: unknown, label: string, max = 500): unknown[] => {
 insist(Array.isArray(value) && value.length <= max, `${label} must be an array of at most ${max} entries.`)
 return value
}
const unique = (values: string[], label: string) => insist(new Set(values).size === values.length, `${label} must be unique.`)
const identifier = (value: unknown, label: string) => text(value, label, 100)
export function settingsInput(input: Record<string, unknown>, snapshot: Snapshot) {
 keys(input, ['teams', 'capacities', 'rules', 'territories'])
 const active = new Set(snapshot.people.filter(p => p.status === 'active').map(p => p.id))
 const requireActive = (value: unknown) => { const id = identifier(value, 'Person'); insist(active.has(id), 'Choose an active person.'); return id }
 const teams = list(input.teams, 'Teams').map(value => {
  const row = object(value); keys(row, ['id', 'name', 'pod', 'personIds'])
  const personIds = list(row.personIds, 'Team members').map(requireActive); unique(personIds, 'Team members')
  insist(typeof row.pod === 'string' && row.pod.length <= 100, 'Pod must be text of at most 100 characters.')
  return {id: identifier(row.id, 'Team id'), name: text(row.name, 'Team name', 100), pod: row.pod.trim(), personIds}
 })
 unique(teams.map(t => t.id), 'Team ids')
 const capacities = list(input.capacities, 'Capacities').map(value => {
  const row = object(value); keys(row, ['personId', 'capacity'])
  insist(typeof row.capacity === 'number' && Number.isInteger(row.capacity) && row.capacity >= 0 && row.capacity <= 500, 'Capacity must be a whole account count from 0 to 500.')
  return {personId: requireActive(row.personId), capacity: row.capacity}
 })
 unique(capacities.map(c => c.personId), 'Capacity people')
 const rules = list(input.rules, 'Rules').map(value => {
  const row = object(value); keys(row, ['id', 'name', 'teamId', 'territory', 'segmentId'])
  if(row.segmentId!==undefined)insist(typeof row.segmentId==='string'&&snapshot.segments?.some(s=>s.id===row.segmentId),'Choose an existing segment with members.')
  const teamId = identifier(row.teamId, 'Rule team'); insist(teams.some(t => t.id === teamId), 'Choose a configured team for every rule.')
  return {id: identifier(row.id, 'Rule id'), name: text(row.name, 'Rule name', 100), teamId, ...(row.segmentId===undefined?{}:{segmentId:String(row.segmentId)}), ...(row.territory === undefined ? {} : {territory: text(row.territory, 'Territory', 100)})}
 })
 unique(rules.map(r => r.id), 'Rule ids')
 const territories = input.territories === undefined ? snapshot.territories : list(input.territories, 'Territories').map(value => {
  const row = object(value); keys(row, ['accountId', 'territory'])
  const accountId = identifier(row.accountId, 'Account'); insist(snapshot.accounts.some(a => a.id === accountId), 'Territory account not found.')
  return {accountId, territory: text(row.territory, 'Territory', 100)}
 })
 unique(territories.map(t => t.accountId), 'Territory accounts')
 return {settings: {teams, capacities, rules} satisfies TeamSettings, territories}
}
export function assignmentInput(input: Record<string, unknown>): AssignmentInput {
 keys(input, ['mode', 'fromId', 'toId', 'note', 'fingerprint'])
 insist(input.mode === 'rules' || input.mode === 'handover' || input.mode === 'rebalance', 'Choose rules or handover assignment.')
 if (input.mode !== 'handover') {
  insist(input.fromId === undefined && input.toId === undefined && input.note === undefined, 'Rule assignment does not take handover fields.')
  return {mode: input.mode}
 }
 const fromId = identifier(input.fromId, 'Outgoing owner'), toId = identifier(input.toId, 'New owner')
 insist(fromId !== toId, 'Choose a different new owner.')
 return {mode: 'handover', fromId, toId, note: text(input.note, 'Handover note', 2000)}
}
export function plan(snapshot: Snapshot, input: AssignmentInput) {
 const settings = JSON.parse(snapshot.settings) as TeamSettings, counts = new Map<string, number>()
 for (const a of snapshot.accounts) if (a.ownerId) counts.set(a.ownerId, (counts.get(a.ownerId) ?? 0) + 1)
 const capacity = new Map(settings.capacities.map(c => [c.personId, c.capacity]))
 const active = new Set(snapshot.people.filter(p => p.status === 'active').map(p => p.id))
 const territory = new Map(snapshot.territories.map(t => [t.accountId, t.territory]))
 const moves: Move[] = [], diagnostics: {accountId: string; reason: string}[] = []
 for (const account of snapshot.accounts) {
  if (input.mode === 'rules' ? !!account.ownerId : input.mode === 'handover' ? account.ownerId !== input.fromId : !account.ownerId || !capacity.has(account.ownerId) || (counts.get(account.ownerId) ?? 0) <= capacity.get(account.ownerId)!) continue
  let candidates: string[]
  if (input.mode === 'handover') candidates = [input.toId!]
  else {
   const rule = settings.rules.find(r => (r.territory === undefined || r.territory === territory.get(account.id)) && (!r.segmentId || snapshot.segments?.some(s=>s.id===r.segmentId&&s.accountId===account.id)))
   candidates = rule ? settings.teams.find(t => t.id === rule.teamId)!.personIds : []
  }
  candidates = candidates.filter(id => active.has(id) && (counts.get(id) ?? 0) < (capacity.get(id) ?? 0))
  candidates.sort((a, b) => ((counts.get(a) ?? 0) / capacity.get(a)!) - ((counts.get(b) ?? 0) / capacity.get(b)!) || (a < b ? -1 : a > b ? 1 : 0))
  const toId = candidates[0]
  if (!toId) { diagnostics.push({accountId: account.id, reason: 'No eligible active CSM with remaining configured capacity in the first matching rule or handover target.'}); continue }
  counts.set(toId, (counts.get(toId) ?? 0) + 1)
  if (account.ownerId) counts.set(account.ownerId, (counts.get(account.ownerId) ?? 0) - 1)
  const drafts=snapshot.drafts.filter(p=>account.ownerId!==null&&p.accountId===account.id&&p.staffOwnerId===account.ownerId).map(p=>({id:p.id,name:JSON.parse(p.document).name as string,revision:p.revision}))
  moves.push({accountId: account.id, fromId: account.ownerId, toId, drafts, openTasks: snapshot.tasks.filter(t => t.accountId === account.id && t.ownerId === account.ownerId && account.ownerId !== null && t.completedAt === null).length})
 }
 return {moves, diagnostics, canApply: diagnostics.length === 0, books: settings.capacities.map(c => ({...c, assigned: counts.get(c.personId) ?? 0}))}
}
