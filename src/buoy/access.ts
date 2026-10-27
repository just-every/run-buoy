import { operatorAuth, runtimeBindings, type Bindings } from '../auth.server'
import { insist, id, text, object, stmt, requirePerson, type Actor } from './core'
import { mintPolicy, describedPolicy, policyFromRow, type PolicyRow } from './agent-policy/policy'
import { auditIfChanged } from './audit-records'
export async function digest(value: string) {
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('')
}
export async function actorFor(request: Request, original: Bindings): Promise<Actor> {
 const env = runtimeBindings(original), url = new URL(request.url)
 insist(url.origin === env.AUTH_ORIGIN && (!request.headers.has('host') || request.headers.get('host') === url.host), 'Invalid request host.', 403)
 const bearer = request.headers.get('authorization')
 if (bearer) {
  insist(bearer.startsWith('Bearer '), 'Invalid agent credential.', 401)
  const token = await stmt(env.DB, "SELECT t.id,t.label,t.scopes,t.data_classes,t.requests_per_minute,t.budget_minor FROM buoy_agent_tokens t JOIN oa_operators o ON o.id=t.owner_id WHERE t.token_hash=? AND t.revoked_at IS NULL AND t.expires_at>? AND o.status='active' AND o.role='owner' AND o.version=t.owner_version", await digest(bearer.slice(7)), Date.now()).first<{id: string; label: string} & PolicyRow>()
  insist(token, 'Agent credential expired or revoked.', 401)
  const agent: Actor = {id: token.id, tokenId: token.id, kind: 'agent', role: 'agent', displayName: token.label, agentPolicy: policyFromRow(token)}
  return agent
 }
 const session = await operatorAuth(env).getSession(request)
 insist(session, 'Sign in to continue.', 401)
 if (!['GET','HEAD'].includes(request.method)) insist(request.headers.get('origin') === env.AUTH_ORIGIN && request.headers.get('sec-fetch-site') !== 'cross-site', 'Invalid request origin.', 403)
 insist(url.pathname.startsWith('/api/buoy/portal/') || !await stmt(env.DB,'SELECT 1 FROM buoy_portal_recipients WHERE operator_id=? OR email=?',session.operator.id,session.operator.email).first(), 'Customer sessions cannot open internal work.',403)
 return {...session.operator, kind: 'person'}
}
export async function jsonBody(request: Request) {
 insist(request.headers.get('content-type')?.startsWith('application/json'), 'Send application/json.', 415)
 // Bound the stream itself, including requests with no Content-Length.
 const reader = request.body?.getReader(), chunks: Uint8Array[] = []; let size = 0
 if (reader) {for (;;) {const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if(size > 256000) {await reader.cancel(); insist(false, 'Upload exceeds 256 KB.', 413)} chunks.push(value)}}
 const bytes = new Uint8Array(size); let offset = 0
 for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength}
 let body: unknown
 try {body = JSON.parse(new TextDecoder().decode(bytes) || '{}')} catch {insist(false, 'Invalid JSON.')}
 return object(body)
}
export async function mintAgent(db: D1Database, actor: Actor, input: Record<string, unknown>) {
 requirePerson(actor, true)
 const label = text(input.label, 'Agent label', 100), tokenId = id(), policy = mintPolicy(input)
 const bytes = crypto.getRandomValues(new Uint8Array(32)), token = [...bytes].map(v => v.toString(16).padStart(2,'0')).join('')
 const expiresAt = Date.now() + policy.expiresDays * 86400000
 // AUDIT-001: issuing a credential is recorded in the same transaction, without its label.
 const [result] = await db.batch([stmt(db, "INSERT INTO buoy_agent_tokens(id,token_hash,label,owner_id,owner_version,expires_at,scopes,data_classes,requests_per_minute,budget_minor) SELECT ?,?,?,id,version,?,?,?,?,? FROM oa_operators WHERE id=? AND status='active' AND role='owner'", tokenId, await digest(token), label, expiresAt, JSON.stringify(policy.scopes), JSON.stringify(policy.dataClasses), policy.requestsPerMinute, policy.budgetMinor, actor.id),
  auditIfChanged(db, actor, 'agent.credential-issued', `agent:${tokenId}`, `expires ${new Date(expiresAt).toISOString()}`)])
 insist(result.meta.changes === 1, 'Owner authority changed.', 403)
 return {id: tokenId, token, expiresAt, commands: policy.scopes, policy: describedPolicy(policy)}
}
