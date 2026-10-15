import type { Bindings } from './auth.server'
import { demoAccounts, demoDates } from './demo/accounts'

/** Only Base's RER_DEMO guard calls this hook. No network or normal setup data. */
export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }) {
  const owner = await env.DB.prepare("SELECT id,display_name FROM oa_operators WHERE email=? AND role='owner' AND status='active'").bind(ownerEmail).first<{ id: string; display_name: string }>()
  if (!owner) return
  const actor = `person:${owner.id}:${owner.display_name}`, day = demoDates(now)
  const at = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString()
  const sql = (query: string, ...values: (string | number | null)[]) => env.DB.prepare(query).bind(...values)
  const accounts = demoAccounts(now), statements: D1PreparedStatement[] = [
    sql('INSERT INTO oa_first_run(singleton,completed_by,completed_at) VALUES(1,?,?) ON CONFLICT DO NOTHING', owner.id, now.getTime()),
  ]
  for (const account of accounts) {
    statements.push(sql('INSERT INTO buoy_accounts(id,document,revision,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING',
      account.id, JSON.stringify(account), `${account.id}-current`, at(-45)))
  }
  // Separate accounts keep prepared approvals current and the completed history
  // faithful to the app's revision-bound approval model.
  for (const [index, approved, complete] of [[0, false, false], [3, false, false], [6, true, false], [9, true, false], [12, true, true], [15, true, true], [18, false, false], [21, true, false]] as const) {
    const account = accounts[index], proposal = `${account.id}-playbook`
    const payload = { title: index % 6 === 0 ? `Resolve overdue invoice with ${account.name}` : `Review urgent support case with ${account.name}`, dueDate: day(complete ? -3 : index - 2) }
    statements.push(sql('INSERT INTO buoy_proposals(id,account_id,kind,account_revision,snapshot,payload,status,prepared_by,prepared_at,approved_by,approved_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',
      proposal, account.id, 'playbook', `${account.id}-${approved ? 'reviewed' : 'current'}`, JSON.stringify(account), JSON.stringify(payload), approved ? 'approved' : 'prepared', actor, at(-8), approved ? actor : null, approved ? at(-7) : null))
    if (approved) statements.push(sql('INSERT INTO buoy_tasks(id,account_id,proposal_id,title,due_date,completed_at,evidence) VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',
      `${account.id}-task`, account.id, proposal, payload.title, payload.dueDate, complete ? at(-2) : null,
      complete ? `Customer call with ${account.name} on ${day(-2)}; agreed next steps recorded in meeting notes.` : null))
  }
  for (const [index, outcome, reason] of [[13, 'renewed', 'Annual renewal signed after the quarterly value review.'], [17, 'deferred', 'Procurement agreed a 30-day extension while budget approval completes.'], [22, 'churned', 'Customer is consolidating their marine operations into a parent company.']] as const) {
    const account = accounts[index], proposal = `${account.id}-renewal`, evidence = `${account.name} customer confirmation ${day(-4)}`
    const payload = { outcome, reason, evidence }
    statements.push(sql('INSERT INTO buoy_proposals(id,account_id,kind,account_revision,snapshot,payload,status,prepared_by,prepared_at,approved_by,approved_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',
      proposal, account.id, 'renewal', `${account.id}-reviewed`, JSON.stringify(account), JSON.stringify(payload), 'approved', actor, at(-5), actor, at(-4)),
      sql('INSERT INTO buoy_decisions(id,account_id,proposal_id,outcome,reason,evidence,renewal_date,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',
        `${account.id}-decision`, account.id, proposal, outcome, reason, evidence, account.renewalDate, actor, at(-4)))
  }
  await env.DB.batch(statements)
}
