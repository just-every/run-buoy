import { auditRecord } from './audit-records'
import { authority, guard, id, insist, now, requirePerson, stmt, text, type Actor } from './core'
import { assignmentInput, plan, settingsInput, type AssignmentInput, type Snapshot, type TeamSettings } from './team-plan'

// One deterministic database image is both the review input and the atomic guard.
// Include tasks and operator status so reviewed move counts and eligibility cannot drift.
const SNAPSHOT = `SELECT json_object(
 'segments',json((SELECT json_group_array(json_object('id',s.id,'name',json_extract(s.document,'$.name'),'accountId',e.account_id)) FROM buoy_segments s LEFT JOIN buoy_segment_entries e ON e.segment_id=s.id AND e.exited_at IS NULL)),
 'settings',(SELECT document FROM buoy_team_settings WHERE singleton=1),
 'accounts',json((SELECT json_group_array(json_object('id',id,'document',document,'revision',revision,'ownerId',owner_id,'assignedAt',assigned_at)) FROM
  (SELECT a.id,a.document,a.revision,o.owner_id,o.assigned_at FROM buoy_accounts a LEFT JOIN buoy_account_owners o ON o.account_id=a.id ORDER BY a.id))),
 'territories',json((SELECT json_group_array(json_object('accountId',account_id,'territory',territory)) FROM (SELECT * FROM buoy_account_territories ORDER BY account_id))),
 'people',json((SELECT json_group_array(json_object('id',id,'role',role,'status',status,'version',version)) FROM (SELECT id,role,status,version FROM oa_operators ORDER BY id))),
 'tasks',json((SELECT json_group_array(json_object('id',id,'accountId',account_id,'ownerId',owner_id,'completedAt',completed_at)) FROM (SELECT id,account_id,owner_id,completed_at FROM buoy_tasks ORDER BY id)))
 ) AS snapshot`
async function snapshot(db: D1Database) {
 const row = await db.prepare(SNAPSHOT).first<{snapshot: string}>()
 insist(row, 'Team configuration is unavailable.', 503)
 return {raw: row.snapshot, value: JSON.parse(row.snapshot) as Snapshot}
}
const snapshotGuard = (db: D1Database, raw: string) => guard(db, `(${SNAPSHOT})=?`, raw)
async function fingerprint(raw: string, input: AssignmentInput) {
 const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({snapshot: raw, input})))
 return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

const definitionsForTeam=(value:Snapshot)=>[...new Set(value.segments?.map(s=>s.id)??[])].map(id=>({id,name:value.segments?.find(s=>s.id===id)?.name??id}))

/** Same installation-wide read policy as accounts; mutation doors enforce owner/admin. */
export async function teamState(db: D1Database, _actor: Actor) {
 const {value} = await snapshot(db), settings = JSON.parse(value.settings) as TeamSettings
 const handovers = await db.prepare('SELECT id,account_id AS accountId,from_id AS fromId,to_id AS toId,note,actor_id AS actorId,recorded_at AS recordedAt FROM buoy_handovers ORDER BY recorded_at DESC,id DESC').all()
 const ownerIds = new Set([...value.people.filter(p=>p.status==='active').map(p=>p.id), ...settings.capacities.map(c => c.personId), ...value.accounts.flatMap(a => a.ownerId ? [a.ownerId] : [])])
 return {...settings, segments: definitionsForTeam(value), territories: value.territories,
  books: [...ownerIds].sort().map(personId => ({personId, capacity: settings.capacities.find(c => c.personId === personId)?.capacity ?? null,
   assigned: value.accounts.filter(a => a.ownerId === personId).length})),
  unassigned: value.accounts.filter(a => !a.ownerId).length, handovers: handovers.results}
}

/** Replace configuration, retaining existing territory metadata when omitted. */
export async function saveTeamSettings(db: D1Database, actor: Actor, input: Record<string, unknown>) {
 requirePerson(actor)
 const current = await snapshot(db), {settings, territories} = settingsInput(input, current.value)
 await db.batch([authority(db, actor, true), snapshotGuard(db, current.raw),
  stmt(db, 'UPDATE buoy_team_settings SET document=? WHERE singleton=1', JSON.stringify(settings)),
  stmt(db, 'DELETE FROM buoy_account_territories'),
  stmt(db, "INSERT INTO buoy_account_territories(account_id,territory) SELECT json_extract(value,'$.accountId'),json_extract(value,'$.territory') FROM json_each(?)", JSON.stringify(territories)),
  auditRecord(db, actor, 'team.settings-updated', 'installation:team'), stmt(db, 'DELETE FROM buoy_assertions')])
 return teamState(db, actor)
}

export async function previewAssignment(db: D1Database, actor: Actor, input: Record<string, unknown>) {
 requirePerson(actor)
 const normalized = assignmentInput(input), current = await snapshot(db)
 validateHandover(current.value, normalized)
 return {...plan(current.value, normalized), fingerprint: await fingerprint(current.raw, normalized), input: normalized}
}
function validateHandover(snapshot: Snapshot, input: AssignmentInput) {
 if (input.mode !== 'handover') return
 insist(snapshot.people.some(p => p.id === input.fromId), 'Outgoing owner not found.')
 insist(snapshot.people.some(p => p.id === input.toId && p.status === 'active'), 'Choose an active new owner.')
}

/** Apply the entire reviewed plan or nothing. Never split this batch: a book is atomic. */
export async function applyAssignment(db: D1Database, actor: Actor, input: Record<string, unknown>) {
 requirePerson(actor)
 const reviewed = text(input.fingerprint, 'Reviewed fingerprint', 64), normalized = assignmentInput(input), current = await snapshot(db)
 insist(/^[a-f0-9]{64}$/.test(reviewed) && reviewed === await fingerprint(current.raw, normalized), 'Assignment changed. Preview again before applying.', 409)
 validateHandover(current.value, normalized)
 const result = plan(current.value, normalized)
 insist(result.canApply, 'Assignment has unmatched accounts or insufficient capacity. Review the preview diagnostics.', 409)
 const moves = JSON.stringify(result.moves), recordedAt = now(), operationId = id()
 const note = normalized.mode === 'handover' ? normalized.note! : normalized.mode === 'rebalance' ? 'Rebalanced after a capacity change.' : 'Assigned by the reviewed team rules.'
 await db.batch([authority(db, actor, true), snapshotGuard(db, current.raw),
  stmt(db, `UPDATE buoy_tasks SET owner_id=(SELECT json_extract(m.value,'$.toId') FROM json_each(?) m WHERE json_extract(m.value,'$.accountId')=buoy_tasks.account_id)
   WHERE completed_at IS NULL AND EXISTS(SELECT 1 FROM json_each(?) m WHERE json_extract(m.value,'$.accountId')=buoy_tasks.account_id AND json_extract(m.value,'$.fromId')=buoy_tasks.owner_id)`, moves, moves),
  stmt(db, `INSERT INTO buoy_account_owners(account_id,owner_id,assigned_at) SELECT json_extract(value,'$.accountId'),json_extract(value,'$.toId'),? FROM json_each(?) WHERE 1
   ON CONFLICT(account_id) DO UPDATE SET owner_id=excluded.owner_id,assigned_at=excluded.assigned_at`, recordedAt, moves),
  stmt(db, "UPDATE buoy_accounts SET revision=lower(hex(randomblob(16))) WHERE id IN (SELECT json_extract(value,'$.accountId') FROM json_each(?))", moves),
  stmt(db, `INSERT INTO buoy_handovers(id,account_id,from_id,to_id,note,actor_id,recorded_at)
   SELECT ?||':'||key,json_extract(value,'$.accountId'),json_extract(value,'$.fromId'),json_extract(value,'$.toId'),?,?,? FROM json_each(?)`, operationId, note, actor.id, recordedAt, moves),
  // Same opaque account subject and action as accountAudit, using one bulk statement.
  stmt(db, "INSERT OR IGNORE INTO buoy_audit_subjects(account_id,subject) SELECT json_extract(value,'$.accountId'),lower(hex(randomblob(16))) FROM json_each(?)", moves),
  stmt(db, `INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at)
   SELECT ?||':'||m.key,?,'account.reassigned',s.subject,'',? FROM json_each(?) m JOIN buoy_audit_subjects s ON s.account_id=json_extract(m.value,'$.accountId')`, operationId, `person:${actor.id}`, recordedAt, moves),
  stmt(db, 'DELETE FROM buoy_assertions')])
 return {...result, operationId, recordedAt}
}
