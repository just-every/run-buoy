import { randomUUID } from 'node:crypto'
import { canonicalJson, sha256, planD1Import, createD1ImportJob, readD1ImportJob, resumeD1Import, undoD1Import, eraseD1ImportTarget, readD1ErasureJournal } from '../../modules/import-kit/src/d1/index.ts'
import { readAtomic } from '../../modules/import-kit/src/d1/database.ts'
import type { D1Database, ImportJob } from '../../modules/import-kit/src/d1/index.ts'
import { context, type Operator } from './context'
import { accountSource, mapping, DESTINATION, KIND } from './source'
import { dependencyTables, sql } from './targets'
import { parseAccounts, type ImportedAccount } from './validation'
export { parseAccount, parseAccounts } from './validation'
export type { ImportedAccount, BillingSnapshot, SupportSnapshot } from './validation'
export { notErasedSql } from './targets'
export { KIT_NAME } from './source'

async function requireCapacity(db: D1Database, accounts: ImportedAccount[]) {
  const count = await db.prepare("SELECT (SELECT count(*) FROM buoy_accounts)+(SELECT count(*) FROM json_each(?) i WHERE NOT EXISTS(SELECT 1 FROM buoy_accounts a WHERE a.id=i.value)) AS n").bind(JSON.stringify(accounts.map(account => account.id))).first<{ n: number }>()
  if ((count?.n ?? 0) > 500) throw new Error('Account limit is 500. Remove accounts before importing this upload.')
}

export async function preview(db: D1Database, operator: Operator, body: unknown) {
  const accounts = parseAccounts(body)
  const plan = await planD1Import(accountSource(accounts), mapping, context(db, operator))
  await requireCapacity(db, accounts)
  return { fingerprint: plan.fingerprint, counts: plan.counts, diagnostics: plan.diagnostics }
}
export async function apply(db: D1Database, operator: Operator, input: { accounts: unknown; fingerprint: string; operationKey: string }): Promise<ImportJob> {
  const accounts = parseAccounts({ accounts: input.accounts })
  if (typeof input.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(input.fingerprint)) throw new Error('A reviewed fingerprint is required. Preview this upload first.')
  if (typeof input.operationKey !== 'string' || !input.operationKey.trim() || input.operationKey.length > 200) throw new Error('A nonempty operation key of at most 200 characters is required.')
  // Keep caller labels out of retained headers: an operation key could itself
  // contain personal data. Its digest preserves the same idempotency contract.
  const ctx = context(db, operator, { reviewedFingerprint: input.fingerprint, operationKey: sha256(input.operationKey) })
  const plan = await planD1Import(accountSource(accounts), mapping, ctx)
  await requireCapacity(db, accounts)
  if (plan.fingerprint !== input.fingerprint) throw new Error('IMPORT_REVIEW_MISMATCH')
  // Kit compares the supplied review with the reconstructed plan. Never replace
  // the user's fingerprint with this newly calculated plan's fingerprint.
  const created = await createD1ImportJob(plan, ctx)
  return resumeD1Import(created.id, context(db, operator))
}
export function job(db: D1Database, operator: Operator, id: string) {
  return readD1ImportJob(id, context(db, operator))
}
/** A strict undo checks ALL remaining account snapshots before it starts, then
 * fences the same documents/revisions/dependents in every reversal transaction.
 * Native dependent work must never disappear as a side effect of undo. */
export async function undo(db: D1Database, operator: Operator, id: string) {
  await readD1ImportJob(id, context(db, operator))
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
  return undoD1Import(id, context(db, operator, {}, guard))
}
export async function erase(db: D1Database, operator: Operator, id: string) {
  if (operator.role !== 'owner') throw new Error('Only the owner may erase an account.')
  const receipt = randomUUID(), recordedAt = new Date().toISOString()
  const digest = sha256(canonicalJson([DESTINATION, KIND, id]))
  // Product and dependent rows (FK CASCADE), normalized source, retained native
  // evidence, provenance and permanent replay tombstones commit together.
  const result = await eraseD1ImportTarget(KIND, id, [
    sql(`INSERT INTO ik_d1_erasure_journal(id,destination,recorded_at,records_erased,jobs_retired,streams_retired,stores_json)
      SELECT ?,?,?,(SELECT count(*) FROM ik_d1_plan_index i WHERE i.target_identity=?),0,0,
      json_array(json_object('store','buoy_accounts','rows',(SELECT count(*) FROM buoy_accounts WHERE id=?)),
      ${dependencyTables.map(table => `json_object('store','${table}','rows',(SELECT count(*) FROM ${table} WHERE account_id=?))`).join(',')})`,
      receipt, DESTINATION, recordedAt, digest, id, ...dependencyTables.map(() => id)),
    sql('DELETE FROM buoy_accounts WHERE id=?', id),
  ], context(db, operator))
  return { id: receipt, state: 'erased' as const, erasedRecords: result.erasedRecords, recordedAt }
}
export async function history(db: D1Database, operator: Operator) {
  const ctx = context(db, operator)
  // Journal read supplies current native authorization even when no jobs exist.
  const erasures = await readD1ErasureJournal(ctx)
  const { results } = await db.prepare('SELECT id FROM ik_jobs WHERE destination=? AND principal_id=? ORDER BY rowid DESC LIMIT 100').bind(DESTINATION, `role:${operator.role}`).all<{ id: string }>()
  const jobs: ImportJob[] = []
  for (const row of results) jobs.push(await readD1ImportJob(row.id, context(db, operator)))
  await readAtomic(context(db, operator), [])
  return { jobs, erasures }
}
