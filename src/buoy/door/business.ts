import { authConfig, operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { operatorMail } from '../../mail.server.mjs'
import { createBusinessSettings, type BusinessManifest, type Guard, type ManagedMember, type TeamAdapter } from '../../modules/business-settings/index.ts'
// These copied OA internals have no declaration files; keep their typed seam here.
// @ts-expect-error OA runtime module has no declarations.
import { configure as nativeConfigure } from '../../modules/operator-auth/config.mjs'
// @ts-expect-error OA runtime module has no declarations.
import { opaqueToken as nativeOpaqueToken, hashToken as nativeHashToken } from '../../modules/operator-auth/crypto.mjs'
// @ts-expect-error OA runtime module has no declarations.
import { linkMessage as nativeLinkMessage } from '../../modules/operator-auth/identity/email-link/message.mjs'
// @ts-expect-error OA runtime module has no declarations.
import { defaultRolePolicy as nativeRolePolicy, emailAllowed as nativeEmailAllowed } from '../../modules/operator-auth/accounts/roles.mjs'
import type { Operator, Action, Role, RolePolicy, AuthConfig, AuthPresentation } from '../../modules/operator-auth/index.mjs'

type Config = AuthConfig & { invitationSeconds: number; linkSeconds: number; branding: AuthPresentation }
const configure = nativeConfigure as (input: AuthConfig) => Config
const opaqueToken = nativeOpaqueToken as () => string
const hashToken = nativeHashToken as (secret: string, purpose: string, token: string) => Promise<string>
const linkMessage = nativeLinkMessage as (config: Config, token: { kind: 'invite' }, url: string) => { subject: string; text: string; html: string }
const defaultRolePolicy = nativeRolePolicy as RolePolicy
const emailAllowed = nativeEmailAllowed as (email: string, allowList?: string[]) => boolean

export const businessManifest: BusinessManifest = { settings: 1, values: ['display_name'], team: { roles: { admin: 'admin', member: 'member' } } }
type BusinessBindings = Bindings & { RER_BUSINESS_TRUST?: string }
const columns = 'id,email,display_name AS displayName,role,status,version,created_at AS createdAt'
const ownerSql = "SELECT o.id FROM oa_operators o LEFT JOIN oa_bootstrap b ON b.claim_id=o.id WHERE o.role='owner' AND o.status='active' ORDER BY b.claim_id IS NULL,o.created_at,o.id LIMIT 1"

/** The standard OA schema's native invitation protocol, prepared into Business's
 * atomic settings batch. Confirmation remains OA's ordinary /auth/confirm. */
export function businessTeam(original: Bindings): TeamAdapter {
 const env = runtimeBindings(original), db = env.DB, auth = operatorAuth(env), config = configure(authConfig(env))
 const read = (id: string) => db.prepare(`SELECT ${columns} FROM oa_operators WHERE id=?`).bind(id).first<Operator>()
 const byEmail = (email: string) => db.prepare(`SELECT ${columns} FROM oa_operators WHERE email=?`).bind(email).first<Operator>()
 return {
  async ownerEmail() { return (await auth.accounts.owner())?.email ?? null },
  async prepare({ members, managed, ownerEmail, roles, guard }) {
   const claimed = await auth.accounts.owner(), owner = claimed ? await read(claimed.id) : null
   if (!owner || owner.email !== ownerEmail || owner.status !== 'active' || owner.role !== 'owner' || !emailAllowed(owner.email, config.allowList)) throw new Error('business_owner_required')
   if (![roles.admin, roles.member].every(role => role === 'admin' || role === 'member')) throw new Error('business_role_invalid')
   const statements: D1PreparedStatement[] = [], deliveries: Array<() => Promise<void>> = [], rows: ManagedMember[] = []
   const fence: Guard = { sql: `(${guard.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=? AND version=? AND role='owner' AND status='active' AND id=(${ownerSql}))`, args: [...guard.args, owner.id, owner.email, owner.version] }
   const assert = (sql: string, args: unknown[] = []) => statements.push(db.prepare(`INSERT INTO bs_assert(value) VALUES(CASE WHEN (${sql}) THEN 1 ELSE NULL END)`).bind(...args))
   assert(fence.sql, fence.args)
   const audit = (action: string, target: string) => statements.push(db.prepare(`INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) SELECT ?,?,?,?,? WHERE ${fence.sql}`)
    .bind(crypto.randomUUID(), owner.id, action, JSON.stringify({ operatorId: target, via: 'via Business', ownerId: owner.id }), Date.now(), ...fence.args))
   const allow = async (action: Action, target?: Operator, role?: Role) => {
    if (target?.role === 'owner' || !await defaultRolePolicy({ actor: owner, action, target, role })) throw new Error('business_team_denied')
   }
   const targetFence = (target: Operator): Guard => ({ sql: `(${fence.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=? AND role=? AND status=? AND version=?)`, args: [...fence.args, target.id, target.email, target.role, target.status, target.version] })
   const update = async (target: Operator, next: Pick<Operator, 'role' | 'status' | 'displayName'>, action: Action) => {
    await allow(action, target, next.role)
    const live = targetFence(target), changed = target.role !== next.role || target.status !== next.status
    assert(live.sql, live.args)
    statements.push(db.prepare(`UPDATE oa_operators SET role=?,status=?,display_name=? WHERE id=? AND role!='owner' AND ${live.sql}`).bind(next.role, next.status, next.displayName, target.id, ...live.args))
    const result = { ...target, ...next, version: target.version + Number(changed) }
    const after = targetFence(result); assert(after.sql, after.args)
    audit(action, target.id)
    return result
   }
   const invite = async (target: Operator | null, email: string, name: string, role: 'admin' | 'member', cancelled: boolean): Promise<Operator> => {
    await allow('operators:invite', target ?? undefined, role)
    if (!emailAllowed(email, config.allowList)) throw new Error('business_email_not_allowed')
    const at = Date.now(), token = opaqueToken(), tokenId = crypto.randomUUID(), targetId = target?.id ?? crypto.randomUUID()
    const expiresAt = at + config.invitationSeconds * 1000, hash = await hashToken(config.SESSION_SECRET, 'link', token)
    if (target) {
     const live = targetFence(target); assert(live.sql, live.args)
     if (cancelled) {
      assert('EXISTS(SELECT 1 FROM oa_invitation_cancellations WHERE operator_id=?)', [target.id])
      target = await update(target, { ...target, status: 'invited', displayName: name }, 'operators:reactivate')
     }
     if (target.displayName !== name) target = await update(target, { ...target, displayName: name }, 'operators:role')
    } else {
     assert('NOT EXISTS(SELECT 1 FROM oa_operators WHERE id=? OR email=?)', [targetId, email])
     statements.push(db.prepare(`INSERT INTO oa_operators(id,email,display_name,role,status,created_at) SELECT ?,?,?,?,'invited',? WHERE ${fence.sql}`).bind(targetId, email, name, role, at, ...fence.args))
     target = { id: targetId, email, displayName: name, role, status: 'invited', version: 1, createdAt: at }
    }
    const live = targetFence(target)
    statements.push(db.prepare(`INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,issuer_id,issuer_version,return_to,created_at,expires_at)
     SELECT ?,?,'invite',id,version,?,?,?, ?,? FROM oa_operators WHERE id=? AND status='invited' AND ${live.sql}`)
     .bind(tokenId, hash, owner.id, owner.version, '/app', at, expiresAt, targetId, ...live.args))
    assert('EXISTS(SELECT 1 FROM oa_tokens WHERE id=? AND operator_id=? AND operator_version=?)', [tokenId, targetId, target.version])
    statements.push(db.prepare(`UPDATE oa_tokens SET revoked_at=? WHERE operator_id=? AND id!=? AND consumed_at IS NULL AND ${live.sql}`).bind(at, targetId, tokenId, ...live.args))
    audit('operators:invite', targetId)
    deliveries.push(async () => {
     const issued = await db.prepare(`SELECT 1 FROM oa_tokens t JOIN oa_operators o ON o.id=t.operator_id JOIN oa_operators i ON i.id=t.issuer_id WHERE t.id=? AND t.revoked_at IS NULL AND t.consumed_at IS NULL AND t.expires_at>? AND o.status='invited' AND o.version=t.operator_version AND i.status='active' AND i.role='owner' AND i.version=t.issuer_version`).bind(tokenId, Date.now()).first()
     if (!issued) return
     const sender = operatorMail(env), url = new URL('/auth/confirm', env.AUTH_ORIGIN)
     url.searchParams.set('token', token)
     try {
      if (!sender || !config.MAIL_FROM) throw new Error('mail_unavailable')
      const result = await sender.send({ deliveryId: tokenId, from: config.MAIL_FROM, to: [email], ...linkMessage(config, { kind: 'invite' }, url.href), headers: { 'Auto-Submitted': 'auto-generated' } })
      if (result.status !== 'accepted' && !(result.status === 'development' && config.local)) throw new Error('mail_unavailable')
     } catch {
      await db.prepare('UPDATE oa_tokens SET revoked_at=? WHERE id=?').bind(Date.now(), tokenId).run()
      throw new Error('mail_unavailable')
     }
    })
    return target
   }
   const desired = new Map(members.map(member => [member.email, member])), previous = new Map(managed.map(row => [row.email, row]))
   for (const email of new Set([...desired.keys(), ...previous.keys()])) {
    const member = desired.get(email), prior = previous.get(email)
    let target = prior?.operatorId ? await read(prior.operatorId) : await byEmail(email)
    if (target?.role === 'owner' || !prior?.operatorId && (target || email === owner.email) || prior?.operatorId && !target) {
     rows.push({ email, operatorId: prior?.operatorId ?? null, invite: member?.invite ?? prior?.invite ?? 0, state: 'conflict' }); continue
    }
    if (!member) {
     if (!target) { if (prior) rows.push(prior); continue }
     if (target.status !== 'inactive') target = await update(target, { ...target, status: 'inactive' }, 'operators:deactivate')
     const live = targetFence(target)
     statements.push(db.prepare(`UPDATE oa_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=? AND ${live.sql}`).bind(Date.now(), target.id, ...live.args), db.prepare(`UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=? AND ${live.sql}`).bind(Date.now(), target.id, ...live.args))
     rows.push({ email, operatorId: target.id, invite: prior!.invite, state: 'inactive' }); continue
    }
    const role = roles[member.role] as 'admin' | 'member', oldRole = target?.role
    if (target && target.role !== role) target = await update(target, { ...target, role }, 'operators:role')
    const cancelled = !!target && target.status === 'inactive' && !!await db.prepare('SELECT 1 FROM oa_invitation_cancellations WHERE operator_id=?').bind(target.id).first()
    if (target?.status === 'inactive' && !cancelled) target = await update(target, { ...target, status: 'active' }, 'operators:reactivate')
    if (!target || cancelled || target.status === 'invited' && (member.invite > (prior?.invite ?? -1) || oldRole !== role)) target = await invite(target, target?.email ?? email, member.name, role, cancelled)
    else if (target.displayName !== member.name) target = await update(target, { ...target, displayName: member.name }, 'operators:role')
    rows.push({ email, operatorId: target.id, invite: member.invite, state: target.status })
   }
   return { statements, rows, async afterCommit() {
    const results = await Promise.allSettled(deliveries.map(deliver => deliver()))
    if (results.some(result => result.status === 'rejected')) throw new Error('mail_unavailable')
   } }
  },
 }
}

export function businessSettings(original: BusinessBindings) {
 const env = runtimeBindings(original) as BusinessBindings
 return createBusinessSettings({ db: env.DB, trust: env.RER_BUSINESS_TRUST, business: businessManifest, team: businessTeam(env) })
}
