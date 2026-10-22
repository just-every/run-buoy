import { redactionStatements, invalidateTransfersStatements } from '@runeditrun/rer/modules/portability/journal'
import { toD1Sql } from '@runeditrun/rer/modules/erasure/fence'
import { randomUUID } from 'node:crypto'
import { canonicalJson, sha256, readD1ImportJob, undoD1Import, retireD1ImportCustody, readD1ErasureJournal } from '../../modules/import-kit/src/d1/index.ts'
import { readAtomic } from '../../modules/import-kit/src/d1/database.ts'
import type { D1Database, ImportJob } from '../../modules/import-kit/src/d1/index.ts'
import { context, type Operator } from './context'
import { DESTINATION, KIND } from './source'
import { dependencyTables, sql } from './targets'
export { parseAccount, parseAccounts } from './validation'
export type { ImportedAccount, BillingSnapshot, SupportSnapshot } from './validation'
export { notErasedSql } from './targets'
export { KIT_NAME } from './source'

async function legacyContext(db: D1Database, operator: Operator, id: string) {
  const row = await db.prepare('SELECT principal_id FROM ik_jobs WHERE id=? AND destination=? AND NOT EXISTS(SELECT 1 FROM ik_door_plans p WHERE p.job_id=ik_jobs.id)').bind(id,DESTINATION).first<{principal_id:string}>()
  if (!row) throw new Error('IMPORT_USE_SHARED_DOOR')
  return context(db,operator,operator.role === 'owner' && row.principal_id === 'role:admin' ? {authorization:{...context(db,operator).authorization,principalId:row.principal_id}} : {})
}
export async function job(db: D1Database, operator: Operator, id: string) {
  const ctx = context(db,operator)
  const row = await db.prepare('SELECT principal_id,namespace,mapping_version FROM ik_jobs WHERE id=? AND destination=?').bind(id,DESTINATION).first<{principal_id:string;namespace:string;mapping_version:string}>()
  if (row) {ctx.namespace=row.namespace;ctx.mappingVersion=row.mapping_version}
  return readD1ImportJob(id,row?.principal_id === 'role:admin' && operator.role === 'owner' ? {...ctx,authorization:{...ctx.authorization,principalId:row.principal_id}} : ctx)
}
/** A strict undo checks ALL remaining account snapshots before it starts, then
 * fences the same documents/revisions/dependents in every reversal transaction.
 * Native dependent work must never disappear as a side effect of undo. */
export async function undo(db: D1Database, operator: Operator, id: string) {
  const legacy = await legacyContext(db,operator,id)
  await readD1ImportJob(id, legacy)
  const { results: rows } = await db.prepare("SELECT p.target_id,p.record_json,a.document,a.revision FROM ik_provenance p LEFT JOIN buoy_accounts a ON a.id=p.target_id WHERE p.job_id=? AND p.reversed=0 AND p.destination=? ORDER BY p.ordinal,p.effect_ordinal").bind(id, DESTINATION)
    .all<{ target_id: string; record_json: string; document: string | null; revision: string | null }>()
  for (const row of rows) {
    const record = JSON.parse(row.record_json) as { appliedRevision: string; valueHash: string }
    if (!row.document || row.revision !== record.appliedRevision || sha256(canonicalJson(JSON.parse(row.document))) !== record.valueHash) throw new Error('NATIVE_EDIT_CONFLICT')
  }
  const images = JSON.stringify(rows.map(row => ({ id: row.target_id, document: row.document, revision: row.revision })))
  const dependent = dependencyTables.map(table => `EXISTS(SELECT 1 FROM ${table} d WHERE d.account_id=p.target_id)`).join(' OR ')
  const guard = sql(`NOT EXISTS(SELECT 1 FROM ik_provenance p LEFT JOIN buoy_accounts a ON a.id=p.target_id LEFT JOIN json_each(?) image ON json_extract(image.value,'$.id')=p.target_id WHERE p.job_id=? AND p.reversed=0 AND (image.value IS NULL OR a.document IS NOT json_extract(image.value,'$.document') OR a.revision IS NOT json_extract(image.value,'$.revision') OR ${dependent}))`, images, id)
  const check = await db.prepare(`SELECT ${guard.sql} AS clear`).bind(...guard.params ?? []).first<{ clear: number }>()
  if (!check?.clear) throw new Error('NATIVE_DEPENDENCY_CONFLICT')
  return undoD1Import(id, {...legacy, authorization:{...legacy.authorization,predicate(action,destination){const gate=legacy.authorization.predicate(action,destination);return sql(`(${gate.sql}) AND (${guard.sql})`,...gate.params ?? [],...guard.params ?? [])}}})
}
export async function erase(db: D1Database, operator: Operator, id: string) {
  if (operator.role !== 'owner') throw new Error('Only the owner may erase an account.')
  // Retained source bytes, door snapshots, native rows and the restore fence commit together.
  const checkpoint = [...await invalidateTransfersStatements(db), ...await redactionStatements(db)].map(toD1Sql)
  const recordedAt = new Date().toISOString()
  const result = await retireD1ImportCustody({target:{kind:KIND,id}}, [
    // Record erasure and scrub prior refusals in the same kit transaction.
    sql("INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) SELECT ?,?,'account.erased',subject,'',? FROM buoy_audit_subjects WHERE account_id=?", randomUUID(), `person:${operator.id}`, recordedAt, id),
    sql("UPDATE buoy_audit SET subject=(SELECT subject FROM buoy_audit_subjects WHERE account_id=?),detail='Agent request refused; subject erased.' WHERE action='agent.refused' AND (subject=? OR substr(subject,instr(subject,' ')+1)=? OR substr(subject,instr(subject,' ')+1,?)=?)", id, `account ${id}`, `/api/buoy/accounts/${encodeURIComponent(id)}`, `/api/buoy/accounts/${encodeURIComponent(id)}/`.length, `/api/buoy/accounts/${encodeURIComponent(id)}/`),
    sql("UPDATE buoy_segments SET document=json_set(document,'$.accountIds',json((SELECT json_group_array(value) FROM json_each(document,'$.accountIds') WHERE value<>?))) WHERE EXISTS(SELECT 1 FROM json_each(document,'$.accountIds') WHERE value=?)",id,id),
    sql("UPDATE buoy_billing_runs SET customer_id=NULL,cursor_before=NULL,cursor_after=NULL WHERE (connection_id,customer_id) IN (SELECT connection_id,customer_id FROM buoy_billing_bindings WHERE account_id=?)",id),
    sql("DELETE FROM buoy_billing_webhook_events WHERE (connection_id,customer_id) IN (SELECT connection_id,customer_id FROM buoy_billing_bindings WHERE account_id=?)",id),
    sql("UPDATE buoy_billing_settings SET cursor=NULL,version=version+1,lease_until=0 WHERE connection_id IN (SELECT connection_id FROM buoy_billing_bindings WHERE account_id=?)",id),
    sql("UPDATE buoy_role_assignments SET document=json_set(document,'$.sharedAccountIds',json((SELECT json_group_array(value) FROM json_each(document,'$.sharedAccountIds') WHERE value<>?))),revision=lower(hex(randomblob(16))) WHERE EXISTS(SELECT 1 FROM json_each(document,'$.sharedAccountIds') WHERE value=?)",id,id),
    sql('DELETE FROM buoy_accounts WHERE id=?', id),
  ], context(db, operator), checkpoint)
  return { id: result.receiptId, state: 'erased' as const, erasedRecords: result.recordsErased, recordedAt: result.recordedAt }
}
export async function history(db: D1Database, operator: Operator) {
  const ctx = context(db, operator)
  // Journal read supplies current native authorization even when no jobs exist.
  const erasures = await readD1ErasureJournal(ctx)
  const { results } = await db.prepare('SELECT id FROM ik_jobs WHERE destination=? AND principal_id IN (?,?) AND NOT EXISTS(SELECT 1 FROM ik_door_plans p WHERE p.job_id=ik_jobs.id) ORDER BY rowid DESC LIMIT 100').bind(DESTINATION, `role:${operator.role}`, operator.role === 'owner' ? 'role:admin' : `role:${operator.role}`).all<{ id: string }>()
  const jobs: ImportJob[] = []
  for (const row of results) jobs.push(await job(db,operator,row.id))
  await readAtomic(context(db, operator), [])
  return { jobs, erasures }
}
