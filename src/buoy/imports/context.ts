import type { D1Database, D1ImportContext, D1Sql } from '../../modules/import-kit/src/d1/index.ts'
import { accountTargets, sql } from './targets'
import { DESTINATION, NAMESPACE } from './source'
export type Operator = { id: string; role: string }
/** Role custody survives archive restore to a replacement native operator row.
 * Current authority is rechecked before and after every D1 kit batch. */
export function context(db: D1Database, operator: Operator, extra: Partial<D1ImportContext> = {}, undoGuard?: D1Sql): D1ImportContext {
  return {
    destination: DESTINATION, namespace: NAMESPACE, mappingVersion: 'v1', batchSize: 50,
    reversalPolicy: 'strict', storage: { database: db, targets: accountTargets },
    authorization: {
      principalId: `role:${operator.role}`,
      predicate(action) {
        const gate = sql("EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role=? AND role IN ('owner','admin'))", operator.id, operator.role)
        const guards = [gate]
        if (action === 'erase') guards.push(sql("?='owner'", operator.role))
        if (action === 'undo' && undoGuard) guards.push(undoGuard)
        return sql(guards.map(g => `(${g.sql})`).join(' AND '), ...guards.flatMap(g => g.params ?? []))
      },
    }, ...extra,
  }
}
