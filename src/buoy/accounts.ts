import {currentScores} from './scorecards'
import {consumerMeasurements} from './adoption/consumers'
import { canonicalJson } from '../modules/import-kit/src/d1/index.ts'
import { Problem, insist, stmt, guard, commit, id, now, requirePerson, type Actor } from './core'
import { health, noticeDate, outlook, type Account } from './health'
import { parseAccounts, notErasedSql } from './imports/index'
import { latestSentiments, today } from './sentiment'
import { staleness, taskTiming } from './settings'
import { TASK_COLUMNS, people, taskToday } from './tasks'
import { notifications } from './reminders'

export async function account(db: D1Database, accountId: string) {
 const row = await stmt(db, 'SELECT * FROM buoy_accounts WHERE id=?', accountId).first<{id: string; document: string; revision: string; created_at: string}>()
 if (!row) throw new Problem(404, 'Account not found.')
 return { ...JSON.parse(row.document) as Account, revision: row.revision }
}
export async function saveAccount(db: D1Database, actor: Actor, input: Record<string, unknown>, accountId?: string) {
 requirePerson(actor)
 const value = parseAccounts({accounts: [{...input, id: accountId ?? input.id ?? id(), revision: undefined}].map(({revision: _revision, ...rest}) => rest)})[0]
 const statements: D1PreparedStatement[] = []
 if (accountId) {
  const prior = await account(db, accountId)
  insist(input.revision === prior.revision, 'Account changed. Reload before saving.', 409)
  statements.push(guard(db, 'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)', accountId, prior.revision),
   stmt(db, 'UPDATE buoy_accounts SET document=?,revision=? WHERE id=?', canonicalJson(value), id(), accountId))
 } else {
  const tombstone = notErasedSql(value.id)
  statements.push(guard(db, tombstone.sql, ...(tombstone.params ?? [])), guard(db, '(SELECT count(*) FROM buoy_accounts)<500'),
   stmt(db, 'INSERT INTO buoy_accounts(id,document,revision,created_at) VALUES(?,?,?,?)', value.id, canonicalJson(value), id(), now()))
 }
 await commit(db, actor, value.id, accountId ? 'account.updated' : 'account.created', statements, true)
 return account(db, value.id)
}
export async function state(db: D1Database, actor: Actor) {
 const taskDay = await taskToday(db)
 const result = await db.batch<Record<string, unknown>>([
  db.prepare('SELECT a.document,a.revision,o.owner_id AS ownerId FROM buoy_accounts a LEFT JOIN buoy_account_owners o ON o.account_id=a.id ORDER BY json_extract(a.document,\'$.renewalDate\'),a.id'),
  db.prepare('SELECT id,account_id AS accountId,kind,payload,status,account_revision AS accountRevision,snapshot,prepared_by AS preparedBy,prepared_at AS preparedAt,approved_by AS approvedBy,approved_at AS approvedAt FROM buoy_proposals ORDER BY prepared_at DESC,id'),
  db.prepare(`SELECT ${TASK_COLUMNS} FROM buoy_tasks t ORDER BY t.due_date,t.id`).bind(taskDay, taskDay),
  db.prepare('SELECT d.id,d.account_id AS accountId,d.proposal_id AS proposalId,COALESCE(o.outcome,d.outcome) AS outcome,d.reason,d.evidence,d.renewal_date AS renewalDate,d.recorded_by AS recordedBy,d.recorded_at AS recordedAt FROM buoy_decisions d LEFT JOIN buoy_decision_outcomes o ON o.decision_id=d.id ORDER BY d.recorded_at DESC,d.id')])
 const handovers = (await db.prepare('SELECT account_id AS accountId,from_id AS fromId,to_id AS toId,note,actor_id AS actorId,recorded_at AS recordedAt FROM buoy_handovers ORDER BY recorded_at DESC,id').all()).results
 const classifications=(await db.prepare('SELECT account_id,tier,stage FROM buoy_classifications').all<{account_id:string;tier:string|null;stage:string|null}>()).results
 const memberships=(await db.prepare('SELECT e.account_id AS accountId,s.id,s.document,e.entered_at AS enteredAt FROM buoy_segment_entries e JOIN buoy_segments s ON s.id=e.segment_id WHERE e.exited_at IS NULL').all<{accountId:string;id:string;document:string;enteredAt:string}>()).results
 const sentiments = await latestSentiments(db), limits = await staleness(db), on = today(), adoption = await consumerMeasurements(db,on), scores=await currentScores(db)
 return {operator: {id: actor.id, displayName: actor.displayName, role: actor.role}, settings: {staleness: limits, tasks: await taskTiming(db)},
  people: await people(db), notifications: await notifications(db, actor),
  accounts: result[0].results.map(row => {const a = JSON.parse(String(row.document)) as Account; const judged = sentiments.get(a.id) ?? null; return {...a, tier:classifications.find(c=>c.account_id===a.id)?.tier??null,stage:classifications.find(c=>c.account_id===a.id)?.stage??null,segments:memberships.filter(m=>m.accountId===a.id).map(m=>({id:m.id,name:JSON.parse(m.document).name,enteredAt:m.enteredAt})), revision: row.revision, ownerId: row.ownerId ?? null, handovers: handovers.filter(h=>h.accountId===a.id), health: health(a, on, judged, limits, adoption.get(a.id)??[],scores.get(a.id)), outlook: outlook(a, on, judged, limits, adoption.get(a.id)??[],scores.get(a.id)), noticeDate: noticeDate(a)}}),
  proposals: result[1].results.map(row => ({...row, payload: JSON.parse(String(row.payload)), snapshot: JSON.parse(String(row.snapshot))})),
  tasks: result[2].results, decisions: result[3].results}
}
