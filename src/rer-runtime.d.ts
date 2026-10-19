declare module '@runeditrun/rer/modules/portability/journal' {
 export function redactionStatements(db: import('./modules/import-kit/src/d1/types').D1Database): Promise<unknown[]>
 export function invalidateTransfersStatements(db: import('./modules/import-kit/src/d1/types').D1Database): Promise<unknown[]>
}
declare module '@runeditrun/rer/modules/erasure/fence' {
 export function toD1Sql(statement: unknown): import('./modules/import-kit/src/d1/types').D1Sql
}
