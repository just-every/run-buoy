import {snapshot,fence} from './segments/snapshot'
import {aggregateProof} from './adoption/proof'
import { account } from './accounts'
import { accountHealth } from './sentiment'
import { insist, text, date, object, stmt, guard, commit, id, now, requirePerson, type Actor } from './core'
import { PRIORITIES, TYPES } from './tasks'

// Revision-bound drafts and guarded approval adapted from Orbit approval-repository
// 38cef87571a413802dbaa7aa6afbab332d8cd778 and Nectar subscriptions
// c76a60ccffa39cc1a207b52c152bda16d6d7b1df. No outbound effect exists in Buoy R1.
export async function prepare(db: D1Database, actor: Actor, input: Record<string, unknown>) {
 const accountId = text(input.accountId, 'Account', 100), current = await account(db, accountId)
 const kind = input.kind, payload = object(input.payload)
 insist(kind === 'playbook' || kind === 'renewal', 'Choose playbook or renewal.')
 let normalized: Record<string, string>
 if (kind === 'playbook') {
  insist((await accountHealth(db, current)).status === 'at-risk', 'An at-risk signal is needed to prepare this playbook.', 409)
  // PLAY-002: priority and type default to medium and risk. The owner named here, else
  // the account's CSM at approval, else the approving person owns the task.
  insist(payload.priority === undefined || PRIORITIES.includes(String(payload.priority)), `Priority is one of ${PRIORITIES.join(', ')}.`)
  insist(payload.type === undefined || TYPES.includes(String(payload.type)), `Task type is one of ${TYPES.join(', ')}.`)
  normalized = {title: text(payload.title, 'Playbook action', 500), dueDate: date(payload.dueDate, 'Due date'), priority: String(payload.priority ?? 'medium'), type: String(payload.type ?? 'risk'),
   ...(payload.ownerId === undefined || payload.ownerId === '' ? {} : {ownerId: text(payload.ownerId, 'Task owner', 100)})}
 } else {
  insist(['renewed','churned','deferred'].includes(String(payload.outcome)), 'Choose a renewal outcome.')
  normalized = {outcome: String(payload.outcome), reason: text(payload.reason, 'Decision reason'), evidence: text(payload.evidence, 'Decision evidence')}
 }
 const image=kind==='playbook'?await snapshot(db):undefined
 const adoptionProof=image?await aggregateProof(image.value,current.id):undefined
 if(adoptionProof)normalized.adoptionProof=adoptionProof
 const proposalId = id(), at = now()
 await commit(db, actor, accountId, `${kind}.prepared`, [
  ...(image?[fence(db,image)]:[]),
  guard(db, 'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=?)', accountId, current.revision),
  stmt(db, "INSERT INTO buoy_proposals(id,account_id,kind,account_revision,snapshot,payload,status,prepared_by,prepared_at) VALUES(?,?,?,?,?,?,'prepared',?,?)", proposalId, accountId, kind, current.revision, JSON.stringify(current), JSON.stringify(normalized), `${actor.kind}:${actor.id}:${actor.displayName}`, at)])
 return {id: proposalId, accountId, kind, payload: normalized, status: 'prepared'}
}
export async function approve(db: D1Database, actor: Actor, proposalId: string) {
 requirePerson(actor)
 const proposal = await stmt(db, 'SELECT * FROM buoy_proposals WHERE id=?', proposalId).first<Record<string, string>>()
 insist(proposal, 'Proposal not found.', 404)
 // Replay does not duplicate the effect or overwrite the original approver.
 if (proposal.status === 'approved') return {id: proposalId, status: 'approved'}
 const current = await account(db, proposal.account_id), payload = JSON.parse(proposal.payload)
 insist(current.revision === proposal.account_revision, 'Evidence changed since preparation. Prepare a new proposal.', 409)
 if (proposal.kind === 'playbook' && !payload.segmentEntry) insist((await accountHealth(db, current)).status === 'at-risk', 'This account no longer has an at-risk signal. Prepare from current evidence.', 409)
 if(payload.segmentEntry)insist(await stmt(db,'SELECT 1 FROM buoy_segment_entries e JOIN buoy_segments s ON s.id=e.segment_id WHERE e.id=? AND e.proposal_id=? AND e.exited_at IS NULL AND s.revision=?',payload.segmentEntry,proposalId,payload.segmentRevision).first(),'Segment entry or configuration changed. Review a new entry.',409)
 const image=payload.adoptionProof?await snapshot(db):undefined
 if(image)insist(payload.adoptionProof===await aggregateProof(image.value,current.id),'Aggregate adoption evidence changed since preparation. Prepare a new proposal.',409)
 const at = now(), actorLabel = `person:${actor.id}:${actor.displayName}`, statements = [
  ...(image?[fence(db,image)]:[]),
  guard(db, "EXISTS(SELECT 1 FROM buoy_proposals p JOIN buoy_accounts a ON a.id=p.account_id WHERE p.id=? AND p.status='prepared' AND a.revision=p.account_revision)", proposalId),
  stmt(db, "UPDATE buoy_proposals SET status='approved',approved_by=?,approved_at=? WHERE id=?", actorLabel, at, proposalId)]
 if (payload.segmentEntry) statements.push(guard(db,'EXISTS(SELECT 1 FROM buoy_segment_entries e JOIN buoy_segments s ON s.id=e.segment_id WHERE e.id=? AND e.proposal_id=? AND e.exited_at IS NULL AND s.revision=?)',payload.segmentEntry,proposalId,payload.segmentRevision))
 if (proposal.kind === 'playbook') statements.push(
  ...(payload.ownerId ? [guard(db, "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')", payload.ownerId)] : []),
  stmt(db, 'INSERT INTO buoy_tasks(id,account_id,proposal_id,title,due_date,owner_id,priority,type) VALUES(?,?,?,?,?,COALESCE(?,(SELECT owner_id FROM buoy_account_owners WHERE account_id=?),?),?,?)', id(), current.id, proposalId, payload.title, payload.dueDate, payload.ownerId ?? null, current.id, actor.id, payload.priority ?? 'medium', payload.type ?? 'risk'))
 else statements.push(stmt(db, 'INSERT INTO buoy_decisions(id,account_id,proposal_id,outcome,reason,evidence,renewal_date,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)', id(), current.id, proposalId, payload.outcome, payload.reason, payload.evidence, current.renewalDate, actorLabel, at))
 statements.push(stmt(db, 'UPDATE buoy_accounts SET revision=? WHERE id=?', id(), current.id))
 await commit(db, actor, current.id, `${proposal.kind}.approved`, statements, true)
 return {id: proposalId, status: 'approved'}
}
export async function completeTask(db: D1Database, actor: Actor, taskId: string, input: Record<string, unknown>) {
 requirePerson(actor)
 const task = await stmt(db, 'SELECT * FROM buoy_tasks WHERE id=?', taskId).first<Record<string, string>>()
 insist(task, 'Task not found.', 404)
 // PLAY-002: completion records the outcome reason and its evidence.
 const outcome = text(input.outcome, 'Outcome reason', 500), evidence = text(input.evidence, 'Completion evidence')
 insist(!task.completed_at, 'Task is already complete.', 409)
 await commit(db, actor, task.account_id, 'playbook.completed', [
  guard(db, 'EXISTS(SELECT 1 FROM buoy_tasks WHERE id=? AND completed_at IS NULL)', taskId),
  stmt(db, 'UPDATE buoy_tasks SET completed_at=?,outcome=?,evidence=? WHERE id=?', now(), outcome, evidence, taskId),
  stmt(db, 'UPDATE buoy_accounts SET revision=? WHERE id=?', id(), task.account_id)], true)
 return {id: taskId, status: 'completed'}
}
