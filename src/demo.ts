import type { Bindings } from './auth.server'
import { saveAccount } from './buoy/accounts'
import type { Actor } from './buoy/core'
import { demoAccounts, demoDates } from './demo/accounts'
import { seedWork } from './demo/work'

/** Only Base's RER_DEMO guard calls this hook, in its isolated database. */
export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }) {
  const owner = await env.DB.prepare("SELECT id FROM oa_operators WHERE email=? AND role='owner' AND status='active'").bind(ownerEmail).first<{ id: string }>()
  if (!owner) return
  const actor: Actor = { id: owner.id, displayName: 'Maya Patel', kind: 'person', role: 'owner' }
  await env.DB.batch([
    env.DB.prepare('UPDATE oa_operators SET display_name=? WHERE id=?').bind(actor.displayName, owner.id),
    env.DB.prepare('INSERT INTO oa_first_run(singleton,completed_by,completed_at) VALUES(1,?,?) ON CONFLICT DO NOTHING').bind(owner.id, now.getTime()),
  ])
  const accounts = demoAccounts(now)
  for (const account of accounts) {
    const exists = await env.DB.prepare('SELECT id FROM buoy_accounts WHERE id=?').bind(account.id).first()
    if (!exists) await saveAccount(env.DB, actor, { ...account })
  }
  await seedWork(env.DB, actor, accounts, demoDates(now))
}
