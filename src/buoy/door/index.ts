import { runtimeBindings, type Bindings } from '../../auth.server'
import branding from '../../branding.json'
import { createAgentDoor, type Trust } from '../../modules/agent-door/index.ts'
import { businessSettings } from './business'
import { buoyPeople } from './people'
import { currentDoorScopes, doorLocalCredentials, finishLocalDoorRequest, finalizeLocalDoorResponse } from './credentials'
import { buoyTools } from './tools'

export function ownerClaimTrust(original: Bindings): Trust | null {
 const env = runtimeBindings(original)
 if (!env.RER_OWNER_CLAIM_PUBLIC_KEYS || !env.RER_OWNER_CLAIM_ISSUER || !env.RER_OWNER_CLAIM_INSTALLATION_ID) return null
 return { issuer: env.RER_OWNER_CLAIM_ISSUER, installationId: env.RER_OWNER_CLAIM_INSTALLATION_ID, appOrigin: env.AUTH_ORIGIN, publicKeys: JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS) }
}

export function buoyDoor(original: Bindings, name = branding.name) {
 const env = runtimeBindings(original)
 return createAgentDoor({
  seed: 'buoy', name, specialist: 'customer success operator', origin: env.AUTH_ORIGIN, db: env.DB,
  capabilities: ['tools', 'policy', 'pause', 'audit', 'idempotency'],
  trust: ownerClaimTrust(env), tools: buoyTools(env), people: buoyPeople(env),
  notTools: [
   {clauses:['HTTP-001'],reason:'installation'},
   {clauses:['DATA-001','IMPORT-001'],reason:'import-door'},
   {clauses:['RESTORE-001','SCALE-001','BOUNDARY-001','BOUNDARY-002','BOUNDARY-003','BOUNDARY-004','BOUNDARY-005'],reason:'installation'},
   {clauses:['SITE-001','STYLE-001','A11Y-001'],reason:'screen'},
   {clauses:['MOBILE-001'],reason:'device'},
  ],
  localCredentials: doorLocalCredentials(env), currentScopes: principal => currentDoorScopes(env, principal),
 })
}

/** Both signed doors must precede ordinary application authentication redirects. */
export async function agentDoorResponse(request: Request, original: Bindings): Promise<Response | null> {
 const env = runtimeBindings(original), path = new URL(request.url).pathname
 if (['/api/rer/business-settings', '/rer-business-logo', '/rer-business.css'].includes(path)) return businessSettings(env).handle(request)
 if (!['/mcp', '/agents', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp', '/api/rer/agent-policy'].includes(path) && !path.startsWith('/agents/')) return null
 const name = await businessSettings(env).resolve('display_name', branding.name)
 try {
  const response = await buoyDoor(env, String(name)).handle(request)
  return response ? await finalizeLocalDoorResponse(request, response) : null
 } catch (cause) {
  await finishLocalDoorRequest(request, 500)
  throw cause
 }
}
