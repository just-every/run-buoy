import { jsonBody } from '../access'
import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { createImportOperatorHandler, readImportDoorHistory, writeImportDoorSettings } from '../../modules/import-kit/src/door/operator.ts'
import { createImportDoorHandler, enableDoorAtFirstClaim } from '../../modules/import-kit/src/door/index.ts'
import type { D1Sql, Json, ParsedRecord } from '../../modules/import-kit/src/d1/index.ts'
import { mapping, DESTINATION, KIND, NAMESPACE } from './source'
import { parseAccount, parseAccounts } from './validation'
import { accountTargets, sql } from './targets'

// Stable across deployment, claim modes and archive recovery.
export const DOOR_KEY = 'buoy:accounts'
export async function importOwner(request: Request, original: Bindings): Promise<D1Sql | null> {
 const env = runtimeBindings(original), url = new URL(request.url)
 if (request.headers.has('authorization') || url.origin !== env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host') !== url.host)
  || request.headers.get('sec-fetch-site') === 'cross-site' || (!['GET','HEAD'].includes(request.method) && request.headers.get('origin') !== env.AUTH_ORIGIN)) return null
 const session = await operatorAuth(env).getSession(request)
 if (!session || session.operator.role !== 'owner') return null
 return sql(`EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
  WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
  AND s.operator_version=o.version AND o.version=? AND o.status='active' AND o.role='owner' AND o.email=?
  AND (s.kind!='oidc' OR EXISTS(SELECT 1 FROM oa_provider_sessions p JOIN oa_auth_settings a
   ON a.singleton=1 AND a.idp_sign_in=1 AND a.generation=p.generation WHERE p.session_id=s.id))
  AND NOT EXISTS(SELECT 1 FROM oa_provider_session_pins p WHERE p.session_id=s.id AND NOT EXISTS(
   SELECT 1 FROM oa_identity_providers i WHERE i.provider_id=p.provider_id AND i.status='linked'
    AND i.issuer=p.issuer AND i.client_id=p.client_id AND i.linked_at=p.linked_at)))`, session.id, session.operator.id, session.operator.version, session.operator.email)
}
export async function enableProvisionedImportDoor(env: Bindings) {
 if (env.RER_IMPORT_DOOR !== 'on') return
 const owner = sql("EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active')", env.OWNER_EMAIL.trim().toLowerCase())
 if (await env.DB.prepare(`SELECT ${owner.sql} AS ok`).bind(...owner.params ?? []).first<{ok:number}>().then(row => row?.ok)) await enableDoorAtFirstClaim(env.DB, DOOR_KEY, owner)
}
function parse(input: Json, index: number): ParsedRecord[] {
 try {
  const accounts = input && !Array.isArray(input) && typeof input === 'object' && 'accounts' in input ? parseAccounts(input) : [parseAccount(input)]
  return accounts.map(account => ({ kind: KIND, sourceId: account.id, payload: account as unknown as Json }))
 } catch (error) { return [{kind:'unsupported', sourceId:`unsupported:${index}`, payload:{reason:error instanceof Error ? error.message : 'Invalid account snapshot'}}] }
}
const doorMapping = { ...mapping, map: (record: Parameters<typeof mapping.map>[0]) => record.kind === KIND ? mapping.map(record) : {effects:[],rejection:String((record.payload as {reason?:string}).reason ?? 'Unsupported account snapshot')} }
const json = (body: unknown, status = 200) => Response.json(body,{status,headers:{'cache-control':'no-store'}})
export async function importDoorResponse(request: Request, original: Bindings): Promise<Response | null> {
 const path = new URL(request.url).pathname
 if (!path.startsWith('/api/operator/import') && !path.startsWith('/api/rer/import/')) return null
 const env = runtimeBindings(original)
 const runtime = {database:env.DB, targets:accountTargets, destination:DESTINATION, ownerPrincipalId:'role:owner', format:'json' as const, parse, mapping:doorMapping, limits:{maxBytes:256000,maxRecords:50}}
 try {
  if (path.startsWith('/api/rer/import/')) {
   if (!env.RER_OWNER_CLAIM_PUBLIC_KEYS || !env.RER_OWNER_CLAIM_ISSUER || !env.RER_OWNER_CLAIM_INSTALLATION_ID) return json({error:'not_found'},404)
   return createImportDoorHandler({...runtime, installationId:DOOR_KEY, claim:{issuer:env.RER_OWNER_CLAIM_ISSUER,installationId:env.RER_OWNER_CLAIM_INSTALLATION_ID, appOrigin:env.RER_OWNER_CLAIM_APP_ORIGIN ?? env.AUTH_ORIGIN, expectedEmail:env.OWNER_EMAIL,publicKeys:JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS)}})(request)
  }
  if (path.startsWith('/api/operator/import/')) return createImportOperatorHandler({...runtime, installationId:DOOR_KEY, namespace:NAMESPACE,appOrigin:env.AUTH_ORIGIN,ownerEmail:env.OWNER_EMAIL,authorize:req => importOwner(req,env)})(request)
  if (!['/api/operator/import-settings','/api/operator/import-history'].includes(path)) return null
  if ((path.endsWith('history') && request.method !== 'GET') || !['GET','POST'].includes(request.method)) return json({error:'method_not_allowed'},405)
  const owner = await importOwner(request,env)
  if (!owner) return json({error:'owner_required'},401)
  if (path.endsWith('history')) return json({history:await readImportDoorHistory(env.DB,DOOR_KEY,owner)})
  if (request.method === 'POST') {
   const input = await jsonBody(request)
   if (Object.keys(input).some(key=>!['enabled','revokedKids'].includes(key)) || typeof input.enabled !== 'boolean' || (input.revokedKids !== undefined && (!Array.isArray(input.revokedKids) || input.revokedKids.length>100 || input.revokedKids.some(k => typeof k !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(k))))) return json({error:'invalid_settings'},400)
   await writeImportDoorSettings(env.DB,DOOR_KEY,{enabled:input.enabled,revokedKids:input.revokedKids as string[]|undefined},owner)
  }
  const results = await env.DB.batch([env.DB.prepare(`SELECT CASE WHEN (${owner.sql}) THEN 1 ELSE json('OWNER_REQUIRED') END`).bind(...owner.params ?? []),env.DB.prepare('SELECT enabled FROM ik_door_settings WHERE installation_id=?').bind(DOOR_KEY),env.DB.prepare('SELECT kid FROM ik_door_revoked_keys WHERE installation_id=? ORDER BY kid').bind(DOOR_KEY),env.DB.prepare(`SELECT CASE WHEN (${owner.sql}) THEN 1 ELSE json('OWNER_REQUIRED') END`).bind(...owner.params ?? [])])
  return json({enabled:(results[1].results as {enabled:number}[])[0]?.enabled === 1,revokedKids:(results[2].results as {kid:string}[]).map(row => row.kid)})
 } catch (error) { const failure = error as {code?:string;status?:number}; return json({error:failure.code ?? 'import_conflict'},failure.status ?? 409) }
}
