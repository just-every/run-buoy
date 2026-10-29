import { runtimeBindings, type Bindings } from '../../auth.server'
import type { Principal } from '../../modules/agent-door/index.ts'
import { COMMANDS, DATA_CLASSES, policyFromRow, type AgentPolicy, type PolicyRow, type RequestCommand } from '../agent-policy/policy'

export interface LocalAgentGrant extends PolicyRow {
 id: string; label: string; owner_id: string; owner_version: number; expires_at: number; disabled: number; requests: number
 ownerId: string; ownerVersion: number; policy: AgentPolicy
}
const sha256 = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('')
interface LocalRequest { env: Bindings; grant: LocalAgentGrant; id: string; command: RequestCommand }
const requests = new WeakMap<Request, LocalRequest>()
const ledger = (entry: LocalRequest, status: 'attempt' | 'succeeded' | 'refused', reason: string) => entry.env.DB.prepare('INSERT INTO buoy_agent_ledger(id,request_id,token_id,command,status,reason,spent_minor,occurred_at) VALUES(?,?,?,?,?,?,0,?)')
 .bind(status === 'attempt' ? entry.id : crypto.randomUUID(), entry.id, entry.grant.id, entry.command, status, reason, new Date().toISOString())
const requestAudit = (entry: LocalRequest, action: string, detail: string) => entry.env.DB.prepare('INSERT INTO buoy_audit(id,actor,action,subject,detail,occurred_at) VALUES(?,?,?,?,?,?)')
 .bind(crypto.randomUUID(), `agent:${entry.grant.id} for person:${entry.grant.ownerId}`, action, `agent:${entry.grant.id}`, detail, new Date().toISOString())

/** The native ledger never stores request arguments, tokens or arbitrary errors. */
export async function finishLocalDoorRequest(request: Request, outcomeStatus: number, code?: string): Promise<void> {
 const entry = requests.get(request)
 if (!entry) return
 requests.delete(request)
 const succeeded = outcomeStatus < 400 && !code
 const reason = succeeded ? 'Command completed.' : outcomeStatus === 429 || code === 'rate_limited' ? 'Request rate exceeded.' : outcomeStatus >= 500 ? 'Operation failed.' : 'Authority or policy refused.'
 await entry.env.DB.batch([ledger(entry, succeeded ? 'succeeded' : 'refused', reason), requestAudit(entry, succeeded ? 'agent.succeeded' : 'agent.refused', `${entry.command}: ${reason}`)])
}

/** MCP communicates tool refusal inside an HTTP 200 response. */
export async function localDoorOutcome(response: Response): Promise<{ status: number; code?: string }> {
 let rpc: { error?: { data?: { code?: unknown } }; result?: { isError?: boolean; resultType?: string; _meta?: Record<string, unknown> } }
 try { rpc = await response.clone().json() as typeof rpc } catch { return { status: response.status } }
 const meta = rpc.result?._meta?.['com.runeditrun/error'] as { code?: unknown } | undefined
 const value = rpc.error?.data?.code ?? meta?.code
 const code = typeof value === 'string' ? value : rpc.result?.resultType === 'input_required' ? 'approval_required' : undefined
 const refused = !!rpc.error || rpc.result?.isError || code
 return { status: response.status >= 400 ? response.status : refused ? code === 'rate_limited' ? 429 : 403 : response.status, code }
}

/** All local MCP methods, including listing, retain native rate and ledger rules. */
export async function finalizeLocalDoorResponse(request: Request, original: Response): Promise<Response> {
 const entry = requests.get(request)
 let response = original
 if (entry && entry.grant.requests > entry.grant.policy.requestsPerMinute) {
  let id: unknown = null
  try { id = (await original.clone().json() as { id?: unknown }).id ?? null } catch { /* Empty notification response. */ }
  const headers = new Headers(original.headers)
  headers.delete('content-length')
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  headers.set('retry-after', String(Math.max(1, Math.ceil((60000 - Date.now() % 60000) / 1000))))
  response = new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message: 'Agent request limit reached.', data: { code: 'rate_limited' } } }), { status: 429, headers })
 }
 const outcome = await localDoorOutcome(response)
 await finishLocalDoorRequest(request, outcome.status, outcome.code)
 return response
}

/** Re-read the native issuer fence; the door's saved principal is never a grant. */
export async function localAgentGrant(original: Bindings, tokenId: string): Promise<LocalAgentGrant | null> {
 const env = runtimeBindings(original)
 const row = await env.DB.prepare(`SELECT t.id,t.label,t.owner_id,t.owner_version,t.expires_at,t.scopes,t.data_classes,t.requests_per_minute,t.budget_minor,s.disabled,
  COALESCE((SELECT requests FROM buoy_agent_minutes WHERE token_id=t.id AND minute=?),0) AS requests
  FROM buoy_agent_tokens t JOIN oa_operators o ON o.id=t.owner_id JOIN buoy_agent_settings s ON s.singleton=1
  WHERE t.id=? AND t.revoked_at IS NULL AND t.expires_at>? AND o.status='active' AND o.role='owner' AND o.version=t.owner_version
  AND NOT EXISTS(SELECT 1 FROM buoy_portal_recipients p WHERE p.operator_id=o.id OR p.email=o.email)`)
  .bind(Math.floor(Date.now() / 60000), tokenId, Date.now()).first<Omit<LocalAgentGrant, 'ownerId' | 'ownerVersion' | 'policy'>>()
 if (!row) return null
 const policy = policyFromRow(row)
 if (!Array.isArray(policy.scopes) || policy.scopes.some(scope => !COMMANDS.includes(scope)) || !Array.isArray(policy.dataClasses) || policy.dataClasses.some(kind => !DATA_CLASSES.includes(kind))) return null
 return { ...row, ownerId: row.owner_id, ownerVersion: row.owner_version, policy }
}

export function doorLocalCredentials(original: Bindings) {
 const env = runtimeBindings(original)
 return async (request: Request) => {
  const url = new URL(request.url), bearer = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)
  if (!bearer || url.origin !== env.AUTH_ORIGIN || request.headers.has('host') && request.headers.get('host') !== url.host) return null
  const previous = requests.get(request)
  if (previous) return { sponsor: { id: previous.grant.ownerId }, agent: { id: previous.grant.id, name: previous.grant.label }, clientId: previous.grant.id, scopes: [...previous.grant.policy.scopes] }
  const token = await env.DB.prepare('SELECT id FROM buoy_agent_tokens WHERE token_hash=?').bind(await sha256(bearer[1]!)).first<{ id: string }>()
  const grant = token ? await localAgentGrant(env, token.id) : null
  if (!grant) return null
  const minute = Math.floor(Date.now() / 60000)
  const name = request.headers.get('mcp-name'), command = name === 'buoy.workspace.snapshot' ? 'renewals.list' : name?.startsWith('buoy.') ? name.slice(5) : null
  const entry: LocalRequest = { env, grant, id: crypto.randomUUID(), command: COMMANDS.includes(command as typeof COMMANDS[number]) ? command as typeof COMMANDS[number] : request.headers.get('mcp-method') === 'tools/list' ? 'commands.read' : 'commands.request' }
  const [reservation] = await env.DB.batch([
   env.DB.prepare('INSERT INTO buoy_agent_minutes(token_id,minute,requests) VALUES(?,?,1) ON CONFLICT(token_id,minute) DO UPDATE SET requests=requests+1 RETURNING requests').bind(grant.id, minute),
   ledger(entry, 'attempt', 'Authenticated request received.'),
   requestAudit(entry, 'agent.requested', `${entry.command}: authenticated MCP request received; outcome not recorded.`),
   env.DB.prepare('DELETE FROM buoy_agent_minutes WHERE token_id=? AND minute<?').bind(grant.id, minute - 1),
  ])
  grant.requests = Number((reservation.results[0] as { requests: number }).requests)
  requests.set(request, entry)
  return { sponsor: { id: grant.ownerId }, agent: { id: grant.id, name: grant.label }, clientId: grant.id, scopes: [...grant.policy.scopes] }
 }
}

export async function currentDoorScopes(original: Bindings, principal: Principal): Promise<string[]> {
 // Business tokens carry consent. Their client id can equal a local token id
 // without borrowing that local token's grant or changing their authority.
 if (principal.consent !== undefined) return [...principal.scopes]
 if (principal.clientId !== principal.agent.id) return []
 const grant = await localAgentGrant(original, principal.agent.id)
 return grant && grant.ownerId === principal.person.id ? [...grant.policy.scopes] : []
}
