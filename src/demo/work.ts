import { mintAgent } from '../buoy/access'
import { usDay, type Actor } from '../buoy/core'
import type { Account } from '../buoy/health'
import { recordSentiment } from '../buoy/sentiment'
import { prepare, approve, completeTask } from '../buoy/work'

/** Use the same validation, approvals, revisions and audit trail as real work.
 * Lookup keys make a repeated or interrupted seed safe to resume. Approvals
 * change an account's revision, so the proposal left awaiting approval is
 * prepared last, by Buoy's agent, as the commands API would. */
export async function seedWork(db: D1Database, owner: Actor, accounts: Account[], day: (days: number) => string) {
  // People's work falls on weekdays: a weekend date moves back to Friday before the start, forward to Monday after it.
  const workday = (days: number): string => [0, 6].includes(new Date(day(days)).getUTCDay()) ? workday(days + (days < 0 ? -1 : 1)) : day(days)
  const find = (slug: string) => accounts.find(account => account.id === `demo-${slug}`)!
  async function proposal(actor: Actor, account: Account, kind: 'playbook' | 'renewal', payload: Record<string, string>, approved = false, completed = '') {
    const key = kind === 'playbook' ? 'title' : 'outcome'
    let record = await db.prepare(`SELECT id,status FROM buoy_proposals WHERE account_id=? AND kind=? AND json_extract(payload,'$.${key}')=?`).bind(account.id, kind, payload[key]).first<{ id: string; status: string }>()
    if (!record) record = await prepare(db, actor, { accountId: account.id, kind, payload })
    if (approved && record.status !== 'approved') await approve(db, owner, record.id)
    if (completed) {
      const task = await db.prepare('SELECT id,completed_at FROM buoy_tasks WHERE proposal_id=?').bind(record.id).first<{ id: string; completed_at: string | null }>()
      if (task && !task.completed_at) await completeTask(db, owner, task.id, { evidence: completed })
    }
  }
  const cascade = find('cascade')
  if (!await db.prepare('SELECT 1 FROM buoy_sentiments WHERE account_id=?').bind(cascade.id).first())
    await recordSentiment(db, owner, cascade.id, { rating: 'red', reason: 'Champion Dana Ruiz left; the renewal call is canceled until a new sponsor is named.', days: 30 })
  await proposal(owner, cascade, 'playbook', { title: 'Acknowledge the health alert and call Cascade’s operations lead', dueDate: workday(-1) }, true, `Call with Cascade Freight operations on ${usDay(workday(-1))}; Zendesk #48213 and the route-export drop confirmed.`)
  await proposal(owner, cascade, 'playbook', { title: 'Champion change: introduce Rob Tanaka as executive sponsor', dueDate: workday(3) }, true)
  for (const [slug, outcome, reason] of [['tri-county', 'renewed', 'Annual renewal signed after the quarterly value review.'], ['juniper', 'deferred', 'Procurement agreed a 30-day extension while the seat expansion is priced.']] as const) {
    const account = find(slug)
    await proposal(owner, account, 'renewal', { outcome, reason, evidence: `${account.name} customer confirmation ${usDay(workday(-4))}` }, true)
  }
  const pending = { title: 'Reopen Zendesk #48213 until route exports resume', dueDate: workday(1) }
  if (!await db.prepare("SELECT 1 FROM buoy_proposals WHERE account_id=? AND json_extract(payload,'$.title')=?").bind(cascade.id, pending.title).first()) {
    const token = await mintAgent(db, owner, { label: 'Buoy' })
    await proposal({ id: token.id, tokenId: token.id, kind: 'agent', role: 'agent', displayName: 'Buoy' }, cascade, 'playbook', pending)
  }
}
