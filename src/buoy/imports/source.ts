import { canonicalJson, sha256 } from '../../modules/import-kit/src/d1/index.ts'
import type { ImportMapping, Json, SourceBundle } from '../../modules/import-kit/src/d1/index.ts'
import type { ImportedAccount } from './validation'
export const KIT_NAME = 'Account, billing and support JSON v1'
export const DESTINATION = 'buoy-accounts'
export const KIND = 'customer-account'
export const NAMESPACE = 'buoy-account-json-v1'
export const mapping: ImportMapping = { version: 'v1', map: record => ({ effects: [{ targetKind: KIND, targetId: record.sourceId, value: record.payload }] }) }
/** The hash identifies the entire normalized upload, including IDs and evidence.
 * Exact uploaded bytes are deliberately not retained; normalized custody is.
 * Reused from Base default-seed people integration at fc0e1041efa55771142bbb57c4ab4743147e264d. */
export function accountSource(accounts: ImportedAccount[]): SourceBundle {
  const bytes = canonicalJson({ accounts }), hash = sha256(bytes)
  return {
    artifacts: [{ name: 'accounts.json', sha256: hash, size: new TextEncoder().encode(bytes).byteLength, original: { status: 'unavailable', reason: 'not-supplied' } }],
    diagnostics: [{severity: 'warning', code: 'NORMALIZED_CUSTODY', message: 'The normalized account snapshot is retained. Original upload bytes and external evidence files are not copied.'}],
    records: accounts.map((account, index) => ({ namespace: NAMESPACE, kind: KIND, sourceId: account.id, payload: account as unknown as Json,
      payloadHash: sha256(canonicalJson(account)), artifactHash: hash, location: { artifact: 'accounts.json', row: index + 1 } })),
  }
}
