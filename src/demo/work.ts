import type { Actor } from '../buoy/core'
import type { Account } from '../buoy/health'
import { prepare, approve, completeTask } from '../buoy/work'

/** Use the same validation, approvals, revisions and audit trail as real work.
 * Lookup keys make a repeated or interrupted seed safe to resume. */
export async function seedWork(db: D1Database, actor: Actor, accounts: Account[], day: (days: number) => string) {
  async function proposal(account: Account, kind: 'playbook' | 'renewal', payload: Record<string, string>, approved = false, completed = false) {
    const key = kind === 'playbook' ? 'title' : 'outcome'
    let record = await db.prepare(`SELECT id,status FROM buoy_proposals WHERE account_id=? AND kind=? AND json_extract(payload,'$.${key}')=?`).bind(account.id, kind, payload[key]).first<{ id: string; status: string }>()
    if (!record) record = await prepare(db, actor, { accountId: account.id, kind, payload })
    if (approved && record.status !== 'approved') await approve(db, actor, record.id)
    if (completed) {
      const task = await db.prepare('SELECT id,completed_at FROM buoy_tasks WHERE proposal_id=?').bind(record.id).first<{ id: string; completed_at: string | null }>()
      if (task && !task.completed_at) await completeTask(db, actor, task.id, { evidence: `Customer call with ${account.name} on ${day(-2)}; agreed next steps recorded in meeting notes.` })
    }
  }
  // The first account shows the whole working cycle: completed work, an agreed
  // renewal extension, an open task and a fresh proposal ready for approval.
  for (const index of [0, 6, 12, 18]) {
    const account = accounts[index]
    await proposal(account, 'playbook', { title: `Review overdue invoice with ${account.name}`, dueDate: day(-3) }, true, true)
  }
  for (const [index, outcome, reason] of [[0, 'deferred', 'A 30-day extension is agreed while procurement completes budget approval.'], [13, 'renewed', 'Annual renewal signed after the quarterly value review.'], [17, 'deferred', 'Procurement agreed a 30-day extension while budget approval completes.'], [22, 'churned', 'Customer is consolidating their marine operations into a parent company.']] as const) {
    const account = accounts[index]
    await proposal(account, 'renewal', { outcome, reason, evidence: `${account.name} customer confirmation ${day(-4)}` }, true)
  }
  for (const index of [0, 3, 6, 9, 12, 15, 18, 21]) {
    const account = accounts[index]
    await proposal(account, 'playbook', { title: `Follow up on the support plan with ${account.name}`, dueDate: day(3) }, true)
    await proposal(account, 'playbook', { title: `Confirm next steps with ${account.name}`, dueDate: day(7) })
  }
}
