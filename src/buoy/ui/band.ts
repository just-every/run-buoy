import { button, clock, day, escape, form, hidden, healthLabel, money, pathId } from './html';
import type { Sheet } from './runway';
import { canManage, type Account, type State } from './types';

// One account opened in place on its own lane: its dated evidence at left, the
// finding anchored at the today line with the next step, and the open work beside it.
export const actorName = (value: string | null | undefined) => escape(value?.split(':').slice(2).join(':') || 'Recorded operator');
const capital = (value: string) => value[0].toUpperCase() + value.slice(1);
const when = (value: string) => `${day(value)}${value.length > 10 ? `<small>${clock(value)}</small>` : ''}`;

interface Pin { at: string; text: string; tag: string; tone: string }
function pins(state: State, account: Account, today: string): Pin[] {
  const list: Pin[] = [], billing = account.billing, support = account.support, sentiment = account.health.sentiment;
  if (billing) {
    const balance = billing.totalMinor - billing.creditsMinor - billing.allocatedMinor, overdue = balance > 0 && billing.dueDate < today;
    list.push({ at: billing.observedAt, text: overdue ? `${money(balance, billing.currency)} overdue` : `${money(billing.totalMinor, billing.currency)} invoiced${balance > 0 ? '' : ', paid'}`, tag: 'Billing', tone: overdue ? 'bad' : 'good' });
  }
  if (support) list.push({ at: support.observedAt, text: support.urgentTickets ? `${escape(support.urgentTickets)} urgent of ${escape(support.openTickets)} open tickets` : `${escape(support.openTickets)} open tickets, none urgent`, tag: 'Support', tone: support.urgentTickets ? 'bad' : 'good' });
  if (sentiment) list.push({ at: sentiment.recordedAt, text: `${escape(capital(sentiment.rating))} sentiment · ${escape(sentiment.by)}`, tag: 'CSM', tone: sentiment.expired ? '' : sentiment.rating === 'red' ? 'bad' : sentiment.rating === 'green' ? 'good' : 'watch' });
  // Source evidence first, as the pins of the picked screen; then the newest proposal still awaiting approval.
  const waiting = state.proposals.find(item => item.accountId === account.id && item.status === 'prepared' && item.accountRevision === account.revision);
  if (waiting) list.push({ at: waiting.preparedAt, text: `${actorName(waiting.preparedBy)} prepared ${waiting.kind === 'playbook' ? 'a playbook' : 'a renewal decision'}`, tag: 'Awaiting approval', tone: 'watch' });
  return list.sort((a, b) => a.at.localeCompare(b.at)).slice(-4);
}

export function band(state: State, account: Account, sheet: Sheet, today: string): string {
  const base = `/app/accounts/${pathId(account.id)}`, status = account.health.status;
  const timeline = pins(state, account, today).map(pin => `<li class="${pin.tone}"><time>${when(pin.at)}</time><span>${pin.text} <span class="tag">${escape(pin.tag)}</span></span></li>`).join('');
  const prepared = state.proposals.find(item => item.accountId === account.id && item.status === 'prepared' && item.accountRevision === account.revision);
  const reasons = account.health.reasons.slice(0, 2).map(reason => `<li>${escape(reason)}</li>`).join('');
  const finding = `<div class="rw-finding"><img src="/brand/mark.svg" alt="Buoy" width="44" height="44"><div><p><strong>${healthLabel(status)}</strong> · ${status === 'at-risk' ? 'what the evidence shows today' : status === 'unknown' ? 'evidence Buoy is missing today' : 'no risk signal today'}</p><ul>${reasons}</ul></div></div>`;
  let primary: string;
  if (prepared && canManage(state)) primary = `<p class="rw-proposal">${actorName(prepared.preparedBy)} prepared <b>${prepared.kind === 'playbook' ? escape(prepared.payload.title) : `Renewal decision: ${escape(prepared.payload.outcome)}`}</b>${prepared.payload.dueDate ? ` · due ${day(prepared.payload.dueDate)}` : ''}</p>` + form(`runway-approve-${prepared.id}`, base, hidden('action', 'approve') + hidden('id', prepared.id) + button(prepared.kind === 'playbook' ? 'Approve and create task' : 'Approve renewal decision'));
  else if (status === 'at-risk') primary = `<a class="button" href="${base}#prepare-playbook">Prepare a playbook</a>`;
  else primary = `<a class="button" href="${base}#prepare-decision">Prepare a renewal decision</a>`;
  const task = state.tasks.find(item => item.accountId === account.id && !item.completedAt);
  const decision = state.decisions.find(item => item.accountId === account.id);
  const work = task ? `<a class="rw-card" href="${base}#tasks"><span class="rw-doc" aria-hidden="true"></span><span><strong>${escape(task.title)}</strong><small>Approved task · due ${day(task.dueDate)}</small></span><span class="rw-chevron" aria-hidden="true">›</span></a>`
    : decision ? `<a class="rw-card" href="${base}#decisions"><span class="rw-doc" aria-hidden="true"></span><span><strong>Renewal decision: ${escape(capital(decision.outcome))}</strong><small>Recorded by ${actorName(decision.recordedBy)} · ${day(decision.recordedAt)}</small></span><span class="rw-chevron" aria-hidden="true">›</span></a>` : '';
  const offset = sheet.rule(`padding-left:clamp(0px,calc((100% - var(--rw-room)) * ${(sheet.at(today) / 100).toFixed(4)}),calc(100% - 900px))`);
  return `<div class="rw-band"><ol class="rw-pins" aria-label="${escape(account.name)} evidence">${timeline || '<li><span>No dated evidence recorded yet.</span></li>'}</ol><div class="rw-work ${offset}"><article class="rw-exception ${status}">${finding}<div class="rw-actions">${primary}<a class="button secondary" href="${base}#evidence">Show evidence</a></div></article><aside class="rw-side"><p class="rw-sticky">${escape(account.name.split(' ')[0])} renews by ${escape(new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${account.renewalDate}T00:00:00Z`)))}!</p>${work}</aside></div></div>`;
}
