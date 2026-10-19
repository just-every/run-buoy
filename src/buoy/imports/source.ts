import type { ImportMapping } from '../../modules/import-kit/src/d1/index.ts'
export const KIT_NAME = 'Account, billing and support JSON v1'
export const DESTINATION = 'buoy-accounts'
export const KIND = 'customer-account'
export const NAMESPACE = 'buoy-account-json-v1'
export const mapping: ImportMapping = { version: 'v1', map: record => ({ effects: [{ targetKind: KIND, targetId: record.sourceId, value: record.payload }] }) }
