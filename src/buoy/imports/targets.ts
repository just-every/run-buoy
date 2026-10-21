import { canonicalJson, sha256 } from '../../modules/import-kit/src/d1/index.ts'
import type { D1Sql, D1TargetAdapter, TargetRow } from '../../modules/import-kit/src/d1/index.ts'
import { DESTINATION, KIND } from './source'
export const sql = (sql: string, ...params: unknown[]): D1Sql => ({ sql, params })
export const dependencyTables = ['buoy_survey_responses', 'buoy_recurring_contract_current', 'buoy_recurring_contract_versions', 'buoy_scorecard_results', 'buoy_scorecard_history', 'buoy_adoption_alert_state', 'buoy_adoption_person_licenses', 'buoy_adoption_person_license_history', 'buoy_adoption_seats', 'buoy_adoption_seat_history', 'buoy_customer_value_sources', 'buoy_customer_history_accounts', 'buoy_customer_result_accounts', 'buoy_customer_memberships', 'buoy_usage_mappings', 'buoy_field_values', 'buoy_field_results', 'buoy_field_history', 'buoy_outcome_accounts', 'buoy_classifications', 'buoy_segment_entries', 'buoy_proposals', 'buoy_tasks', 'buoy_decisions', 'buoy_sentiments', 'buoy_account_owners', 'buoy_inbox', 'buoy_account_territories', 'buoy_handovers'] as const
export function noDependencies(id: string): D1Sql {
  return sql(dependencyTables.map(table => `NOT EXISTS(SELECT 1 FROM ${table} WHERE account_id=?)`).join(' AND '), ...dependencyTables.map(() => id))
}
/** This predicate MUST be fenced inside the native create transaction, alongside
 * authority. A read-only precheck alone cannot prevent an erasure/create race. */
export function notErasedSql(id: string): D1Sql {
  return sql('NOT EXISTS(SELECT 1 FROM ik_d1_erased_targets WHERE destination=? AND identity=?)', DESTINATION, sha256(canonicalJson([DESTINATION, KIND, id])))
}
type NativeRow = { id: string; document: string; revision: string; created_at: string }
function target(row: NativeRow): TargetRow {
  return { destination: DESTINATION, targetKind: KIND, targetId: row.id, revision: row.revision, value: JSON.parse(row.document) }
}
export const accountTargets: D1TargetAdapter = {
  async read(db, _destination, kind, id) {
    if (kind !== KIND) return undefined
    const row = await db.prepare('SELECT id,document,revision,created_at FROM buoy_accounts WHERE id=?').bind(id).first<NativeRow>()
    return row ? target(row) : undefined
  },
  matches(row, _destination, _kind, id) {
    return row ? sql('EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND document=? AND revision=?)', id, canonicalJson(row.value), row.revision)
      : sql('NOT EXISTS(SELECT 1 FROM buoy_accounts WHERE id=?)', id)
  },
  matchesMany(rows) {
    const images=JSON.stringify(rows.map(row=>({id:row.targetId,document:canonicalJson(row.value),revision:row.revision})))
    return [sql(`(SELECT count(*) FROM buoy_accounts)=? AND (SELECT count(*) FROM json_each(?) i JOIN buoy_accounts a ON a.id=json_extract(i.value,'$.id') WHERE a.document=json_extract(i.value,'$.document') AND a.revision=json_extract(i.value,'$.revision'))=?`,rows.length,images,rows.length)]
  },
  matchesCount: count => sql('(SELECT count(*) FROM buoy_accounts)=?', count),
  write(row) {
    const notErased = notErasedSql(row.targetId)
    return [sql("SELECT CASE WHEN ((SELECT count(*) FROM buoy_accounts)<500 OR EXISTS(SELECT 1 FROM buoy_accounts WHERE id=?)) THEN 1 ELSE json('ACCOUNT_LIMIT') END", row.targetId), sql(`SELECT CASE WHEN (${notErased.sql}) THEN 1 ELSE json('IMPORT_SOURCE_ERASED') END`, ...notErased.params ?? []),
      sql("INSERT INTO buoy_accounts(id,document,revision,created_at) VALUES(?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(id) DO UPDATE SET document=excluded.document,revision=excluded.revision", row.targetId, canonicalJson(row.value), row.revision),
      sql('INSERT OR IGNORE INTO buoy_audit_subjects(account_id,subject) VALUES(?,lower(hex(randomblob(16))))', row.targetId)]
  },
  remove(_destination, _kind, id) {
    const clear = noDependencies(id)
    return [sql(`SELECT CASE WHEN (${clear.sql}) THEN 1 ELSE json('NATIVE_DEPENDENCY_CONFLICT') END`, ...clear.params ?? []), sql('DELETE FROM buoy_accounts WHERE id=?', id)]
  },
  async list(db) {
    return (await db.prepare('SELECT id,document,revision,created_at FROM buoy_accounts ORDER BY id').all<NativeRow>()).results.map(target)
  },
}
