import { auditRecord } from './audit-records'
import { insist, text, date, stmt, guard, commit, authority, requirePerson, id, now, type Actor } from './core'
import { localTime, taskTiming } from './settings'

// PLAY-002: task owners and cover. Until ROLE-001 and TEAM-001 add CS managers and
// teams, the owner or an admin assigns each account's CSM, names each person's
// manager and records a person's away period with a named cover (ct pattern 2).
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'], TYPES = ['risk', 'onboarding', 'adoption', 'renewal', 'expansion', 'general']
const ACTIVE = "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')"
/** Who handles a task on an installation calendar date: inside its owner's inclusive away
 * range, the named cover; otherwise the owner. Cover is computed, never copied, so
 * the task is back with its owner the day after the range ends. Binds the date twice. */
export const HANDLER = 'COALESCE((SELECT w.cover_id FROM buoy_away w WHERE w.person_id=t.owner_id AND w.starts_on<=? AND w.ends_on>=?),t.owner_id)'
async function personBatch(db: D1Database, actor: Actor, statements: D1PreparedStatement[]) {
 requirePerson(actor)
 await db.batch([authority(db, actor, true), ...statements, stmt(db, 'DELETE FROM buoy_assertions')])
}
const person = (value: unknown, label: string) => text(value, label, 100)

/** Reassignment moves every open task the previous CSM owned on this account. */
export async function assignAccount(db: D1Database, actor: Actor, accountId: string, input: Record<string, unknown>) {
 requirePerson(actor)
 insist(await stmt(db, 'SELECT 1 FROM buoy_accounts WHERE id=?', accountId).first(), 'Account not found.', 404)
 const ownerId = person(input.ownerId, 'Account owner')
 const prior = await stmt(db, 'SELECT owner_id FROM buoy_account_owners WHERE account_id=?', accountId).first<{owner_id:string}>()
 if (prior?.owner_id === ownerId) return {accountId, ownerId}
 const capacitySql = "SELECT json_extract(value,'$.capacity') AS capacity FROM buoy_team_settings,json_each(document,'$.capacities') WHERE json_extract(value,'$.personId')=?"
 const capacity = await stmt(db, capacitySql, ownerId).first<{capacity:number}>()
 const target = capacity?.capacity ?? null
 const count = (await stmt(db, 'SELECT count(*) AS n FROM buoy_account_owners WHERE owner_id=?', ownerId).first<{n:number}>())!.n
 insist(target === null || count < target, 'This CSM is at or over their capacity target. Preview a rebalance or choose another CSM.', 409)
 const note = input.note === undefined || input.note === '' ? (prior ? 'Account reassigned by hand.' : 'Assigned by hand.') : text(input.note, 'Handover note', 2000)
 await commit(db, actor, accountId, 'account.reassigned', [guard(db, ACTIVE, ownerId),
  guard(db, '(SELECT owner_id FROM buoy_account_owners WHERE account_id=?) IS ?', accountId, prior?.owner_id ?? null),
  guard(db, `NOT EXISTS(${capacitySql}) OR (SELECT count(*) FROM buoy_account_owners WHERE owner_id=?)<(${capacitySql})`, ownerId, ownerId, ownerId),
  stmt(db, 'UPDATE buoy_tasks SET owner_id=? WHERE account_id=? AND completed_at IS NULL AND owner_id=(SELECT owner_id FROM buoy_account_owners WHERE account_id=?)', ownerId, accountId, accountId),
  stmt(db, 'INSERT INTO buoy_handovers(id,account_id,from_id,to_id,note,actor_id,recorded_at) VALUES(?,?,?,?,?,?,?)', id(), accountId, prior?.owner_id ?? null, ownerId, note, actor.id, now()),
  stmt(db, 'INSERT INTO buoy_account_owners(account_id,owner_id,assigned_at) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET owner_id=excluded.owner_id,assigned_at=excluded.assigned_at', accountId, ownerId, now()),
  stmt(db, 'UPDATE buoy_accounts SET revision=? WHERE id=?',id(),accountId)], true)
 return {accountId, ownerId}
}
export async function setManager(db: D1Database, actor: Actor, personId: string, input: Record<string, unknown>) {
 const managerId = input.managerId === null ? null : person(input.managerId, 'Manager')
 insist(managerId !== personId, 'A person cannot be their own manager.')
 await personBatch(db, actor, [guard(db, ACTIVE, personId), ...(managerId ? [guard(db, ACTIVE, managerId)] : []),
  stmt(db, 'INSERT INTO buoy_people(person_id,manager_id) VALUES(?,?) ON CONFLICT(person_id) DO UPDATE SET manager_id=excluded.manager_id', personId, managerId),
  auditRecord(db, actor, 'person.manager-set', `person:${personId}`, managerId ? `manager person:${managerId}` : 'manager cleared')])
 return {personId, managerId}
}
export async function setAway(db: D1Database, actor: Actor, personId: string, input: Record<string, unknown>) {
 const coverId = person(input.coverId, 'Cover'), startsOn = date(input.startsOn, 'Away from'), endsOn = date(input.endsOn, 'Away through')
 insist(coverId !== personId, 'Name someone else as cover.')
 insist(startsOn <= endsOn, 'Away from must be on or before away through.')
 insist(Date.parse(endsOn) - Date.parse(startsOn) < 366 * 86400000, 'An away period is at most 366 days.')
 const overlap = await stmt(db, 'SELECT 1 FROM buoy_away WHERE person_id=? AND starts_on<=? AND ends_on>=?', personId, endsOn, startsOn).first()
 insist(!overlap, 'This person already has an away period in those dates.', 409)
 const awayId = id()
 await personBatch(db, actor, [guard(db, ACTIVE, personId), guard(db, ACTIVE, coverId),
  guard(db, 'NOT EXISTS(SELECT 1 FROM buoy_away WHERE person_id=? AND starts_on<=? AND ends_on>=?)', personId, endsOn, startsOn),
  stmt(db, 'INSERT INTO buoy_away(id,person_id,cover_id,starts_on,ends_on,recorded_at) VALUES(?,?,?,?,?,?)', awayId, personId, coverId, startsOn, endsOn, now()),
  auditRecord(db, actor, 'person.away-set', `person:${personId}`, `cover person:${coverId} from ${startsOn} through ${endsOn}`)])
 return {id: awayId, personId, coverId, startsOn, endsOn}
}
export const TASK_COLUMNS = `t.id,t.renewal_id AS renewalId,t.account_id AS accountId,t.proposal_id AS proposalId,t.title,t.due_date AS dueDate,t.owner_id AS ownerId,${HANDLER} AS handlerId,t.priority,t.type,t.completed_at AS completedAt,t.outcome,t.evidence`
/** Today in the installation's time zone: the day cover and reminders are judged on. */
export const taskToday = async (db: D1Database) => localTime((await taskTiming(db)).timeZone).date
export async function tasksOn(db: D1Database, requested?: string) {
 const on = requested === undefined ? await taskToday(db) : date(requested, 'Tasks date')
 return {on, tasks: (await stmt(db, `SELECT ${TASK_COLUMNS} FROM buoy_tasks t ORDER BY t.due_date,t.id`, on, on).all()).results}
}
/** Active people with their manager and away periods, for choosing owners and cover. */
export async function people(db: D1Database) {
 const [rows, away] = await db.batch<Record<string, string>>([
  db.prepare("SELECT o.id,o.display_name AS displayName,o.role,p.manager_id AS managerId FROM oa_operators o LEFT JOIN buoy_people p ON p.person_id=o.id WHERE o.status='active' ORDER BY o.display_name,o.id"),
  db.prepare('SELECT person_id AS personId,cover_id AS coverId,starts_on AS startsOn,ends_on AS endsOn FROM buoy_away ORDER BY starts_on,id')])
 return rows.results.map(row => ({...row, away: away.results.filter(item => item.personId === row.id).map(({personId: _, ...rest}) => rest)}))
}
