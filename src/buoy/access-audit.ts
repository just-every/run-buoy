import { normalizeEmail } from '../modules/operator-auth/index.mjs'
import { auditRecord } from './audit-records'

type Person = { id: string; role: string; status: string }
type Sessions = { getSession(request: Request): Promise<{ operator: { id: string } } | null> }
const DOORS: Record<string, string> = { '/auth/invite': 'auth.invited', '/auth/invite/cancel': 'auth.invitation-cancelled', '/auth/operator/role': 'auth.role-changed', '/auth/operator/status': 'auth.status-changed' }

// Base's doors refuse bodies over 8 KiB; a larger body is never read here.
async function input(request: { body: ReadableStream<Uint8Array> | null; headers: Headers }): Promise<Record<string, unknown>> {
 const reader = request.body?.getReader(), decoder = new TextDecoder()
 let text = ''
 for (let size = 0; reader;) {
  const next = await reader.read(); if (next.done) break
  size += next.value.byteLength; if (size > 8192) { await reader.cancel(); return {} }
  text += decoder.decode(next.value, { stream: true })
 }
 if ((request.headers.get('content-type') ?? '').startsWith('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text))
 try { const value = JSON.parse(text); return value && typeof value === 'object' ? value : {} } catch { return {} }
}
const person = (db: D1Database, column: 'id' | 'email', value: unknown) =>
 typeof value === 'string' ? db.prepare(`SELECT id,role,status FROM oa_operators WHERE ${column}=?`).bind(value).first<Person>() : Promise.resolve(null)

// AUDIT-001: Base's access doors grant, change and remove a person's role or
// status. After the door reports success, record the signed-in actor, the
// person's opaque id and the change (role or status values only, never an
// email or display name). An unchanged role or status adds no entry.
export async function auditedAccessChange(request: Request, db: D1Database, auth: Sessions, handle: (request: Request) => Promise<Response | null>) {
 const action = DOORS[new URL(request.url).pathname]
 if (!action || request.method !== 'POST') return handle(request)
 const body = await input(request.clone()), session = await auth.getSession(request)
 const invite = action === 'auth.invited', column = invite ? 'email' : 'id'
 const key = invite ? (typeof body.email === 'string' ? normalizeEmail(body.email) : null) : body.operatorId
 const before = await person(db, column, key), response = await handle(request)
 if (!response?.ok || !session) return response
 const after = await person(db, column, key)
 const field = action === 'auth.role-changed' ? 'role' : 'status'
 if (!after || (!invite && before?.[field] === after[field])) return response
 const detail = invite ? `invited as ${after.role}` : `${before?.[field]} -> ${after[field]}`
 await auditRecord(db, { kind: 'person', id: session.operator.id }, action, `person:${after.id}`, detail).run()
 return response
}
