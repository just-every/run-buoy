import { authConfig, operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { operatorAuthPeople, type PeopleAdapter, type Person } from '../../modules/agent-door/index.ts'

/** Portal recipients are customer identities, never internal staff sponsors. */
export function buoyPeople(original: Bindings): PeopleAdapter {
 const env = runtimeBindings(original)
 const native = operatorAuthPeople({ db: env.DB, allowList: authConfig(env).allowList, session: request => operatorAuth(env).getSession(request) })
 const paired = !!(env.RER_OWNER_CLAIM_PUBLIC_KEYS && env.RER_OWNER_CLAIM_ISSUER && env.RER_OWNER_CLAIM_INSTALLATION_ID)
 const policyRoles = new WeakMap<Person, 'owner' | 'editor' | null>()
 const staff = async (person: Person | null) => {
  if (!person?.active || await env.DB.prepare('SELECT 1 FROM buoy_portal_recipients WHERE operator_id=? OR email=?').bind(person.id, person.email).first()) return null
  if (paired) policyRoles.set(person, (await native.businessMember!(person))?.role ?? null)
  return person
 }
 return {
  person: async id => staff(await native.person(id)),
  sponsor: async claims => staff(await native.sponsor(claims)),
  businessMember: async person => await staff(person) ? native.businessMember!(person) : null,
  businessRole: person => paired ? policyRoles.get(person) ?? null : person.role === 'owner' ? 'owner' : person.role === 'admin' ? 'editor' : null,
  async session(request) {
   const url = new URL(request.url)
   if (request.headers.has('authorization') || url.origin !== env.AUTH_ORIGIN || request.headers.has('host') && request.headers.get('host') !== url.host || request.headers.get('sec-fetch-site') === 'cross-site'
    || !['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== env.AUTH_ORIGIN) return null
   return staff(await native.session(request))
  },
 }
}
