import { accountForm } from './account-form';
import { button, date, disclosure, escape, field, form, hidden, money, pathId, personSelect, section, titleLine, valueOf } from './html';
import { axisFor, quarters, runway } from './runway';
import { canManage, personName, type Account, type Fields, type State } from './types';

export interface View { head: string; body: string; style?: string }

/** "$1,037,500": the invoices on the runway, one total per currency. */
function totals(accounts: Account[]): string {
  const sums = new Map<string, number>();
  for (const account of accounts) if (account.billing) sums.set(account.billing.currency, (sums.get(account.billing.currency) ?? 0) + account.billing.totalMinor);
  return [...sums].map(([currency, minor]) => money(minor, currency)).join(' + ');
}

export function runwayHead(title: string, accounts: Account[], today: string): string {
  const strong = [0, 2], facts = [quarters(axisFor(accounts, today)), `${accounts.length} account${accounts.length === 1 ? '' : 's'}`, totals(accounts)].filter(Boolean);
  return titleLine(escape(title), facts, strong);
}

export function workPage(state: State, values: Fields | undefined, open: string | null | undefined, today: string): View {
  const manage = canManage(state), first = state.accounts[0];
  const href = (fragment = '') => first ? `/app/accounts/${pathId(first.id)}${fragment}` : manage ? '#create-account' : '#accounts';
  const steps: [string, string, boolean][] = [
    [`<a href="${manage ? '#create-account' : '/app'}">Create an account</a>${manage ? ' or <a href="/app/imports">import accounts</a>' : ' with your owner or administrator'}`, state.accounts.length ? 'account records exist' : 'still needed', state.accounts.length > 0],
    [`<a href="${href()}">Review health and its source evidence</a>`, '', false],
    [`<a href="${href('#prepare-playbook')}">Prepare a playbook</a>`, state.proposals.some(p => p.kind === 'playbook') ? 'preparation recorded' : 'still needed', state.proposals.some(p => p.kind === 'playbook')],
    [`<a href="${href('#proposals')}">Approve the playbook and complete its task with evidence</a>`, state.tasks.some(t => t.completedAt) ? 'completed work recorded' : 'still needed', state.tasks.some(t => t.completedAt)],
    [`<a href="${href('#prepare-decision')}">Prepare a renewal decision for approval</a>`, state.decisions.length ? 'approved decision recorded' : 'still needed', state.decisions.length > 0],
  ];
  const checklist = `<ol class="checklist">${steps.map(([step, note, done]) => `<li${done ? ' class="done"' : ''}>${step}${note ? ` <span class="step-note">— ${note}</span>` : ''}</li>`).join('')}</ol>`;
  const intro = `<section class="panel introduction" id="first-use"><div class="intro-head"><h2>First use</h2><a href="/app?intro=hidden">Hide this checklist</a></div><p>Follow the account from source evidence to an approved renewal decision. Health describes the recorded evidence; it is not a churn prediction.</p>${checklist}</section>`;
  const empty = `<div class="rw-empty"><img src="/brand/mark.svg" alt="" width="56" height="56"><p><strong>No accounts yet.</strong> ${manage ? 'Create an account or import your existing source records to begin.' : 'Your owner or administrator adds accounts and their source records.'}</p>${manage ? '<div class="rw-actions"><a class="button" href="#create-account">Create account</a><a class="button secondary" href="/app/imports">Import accounts</a></div>' : ''}</div>`;
  const view = runway(state, state.accounts, today, open, '/app', empty);
  const create = manage
    ? disclosure('Create account', 'Name, renewal date, notice period and the billing and support evidence you hold.', accountForm(undefined, values), 'create-account', !state.accounts.length || values?.action === 'account-create')
    : '<section class="panel note-panel"><h2>Adding accounts</h2><p>Your owner or administrator can add and refresh account sources. You can prepare work and renewal decisions on an existing account.</p></section>';
  const limits = state.settings.staleness, v = (name: string, fallback: unknown) => values?.action === 'staleness' ? valueOf(values, name, fallback) : fallback;
  const explain = '<p>Billing and support snapshots are entered by hand or moved in from a file. Each source kind goes stale after its own number of days; health then names it as stale.</p>';
  const freshness = disclosure('Evidence freshness', `Billing goes stale after ${limits.billingDays} days, support after ${limits.supportDays}.`, manage ? explain + form('staleness', '/app', hidden('action', 'staleness') + `<div class="form-grid">${field('billingDays', 'Billing snapshots stale after (days)', v('billingDays', limits.billingDays), 'number', true, 'min="1" max="365" step="1"')}${field('supportDays', 'Support snapshots stale after (days)', v('supportDays', limits.supportDays), 'number', true, 'min="1" max="365" step="1"')}</div>` + button('Save freshness thresholds')) : `${explain}<p>Billing snapshots go stale after ${escape(limits.billingDays)} days and support snapshots after ${escape(limits.supportDays)} days.</p>`, 'evidence-freshness', values?.action === 'staleness');
  // PLAY-002: the signed-in person's reminders and escalations, and the owner/admin cover settings.
  const kinds = { 'due-soon': 'Due soon', 'due-today': 'Due today', escalated: 'Escalated to you' };
  const reminders = state.notifications.length ? section('Your reminders', `<ul class="reasons">${state.notifications.map(item => `<li><strong>${kinds[item.kind]}</strong>: <a href="/app/accounts/${pathId(item.accountId)}#tasks">${escape(item.title)}</a> for ${escape(item.accountName)}, due ${date(item.dueDate)}. ${escape(item.emailLabel)}.</li>`).join('')}</ul>`, 'reminders') : '';
  const timing = state.settings.tasks, t = (name: string, fallback: unknown) => values?.action === 'task-timing' ? valueOf(values, name, fallback) : fallback, mine = (action: string) => values?.action === action;
  const away = state.people.flatMap(person => person.away.map(period => `<li>${escape(person.displayName)} away ${date(period.startsOn)} through ${date(period.endsOn)}; ${escape(personName(state, period.coverId))} covers.</li>`)).join('');
  const cover = manage ? disclosure('Task reminders and cover', `Reminders ${timing.remindDaysBefore} day${timing.remindDaysBefore === 1 ? '' : 's'} before and on the due date; overdue tasks escalate after ${timing.escalateAfterDays} day${timing.escalateAfterDays === 1 ? '' : 's'}.`,
    `<p>Task dates follow ${escape(timing.timeZone ?? 'UTC')}. Each day’s reminders are recorded and emailed from 8 am there. Reminders go to the person handling a task, in Buoy and by email. An overdue task escalates to its owner’s manager, or to the owner of this installation when no manager is named. While someone is away, their cover handles their open tasks; the tasks return the day after.</p>`
    + form('task-timing', '/app', hidden('action', 'task-timing') + `<div class="form-grid">${field('remindDaysBefore', 'Remind this many days before', t('remindDaysBefore', timing.remindDaysBefore), 'number', true, 'min="1" max="30" step="1"')}${field('escalateAfterDays', 'Escalate this many days overdue', t('escalateAfterDays', timing.escalateAfterDays), 'number', true, 'min="1" max="30" step="1"')}${field('timeZone', 'Time zone for task dates (blank for UTC)', t('timeZone', timing.timeZone ?? ''), 'text', false, 'placeholder="America/Chicago" autocomplete="off"')}</div>` + button('Save reminder timing'))
    + form('manager', '/app', hidden('action', 'manager') + personSelect('personId', 'Person', state.people, mine('manager') ? valueOf(values, 'personId') : '', 'Choose a person') + personSelect('managerId', 'Their manager', state.people, mine('manager') ? valueOf(values, 'managerId') : '', 'No manager named', false) + button('Save manager'))
    + form('away', '/app', hidden('action', 'away') + personSelect('personId', 'Person away', state.people, mine('away') ? valueOf(values, 'personId') : '', 'Choose a person') + personSelect('coverId', 'Named cover', state.people, mine('away') ? valueOf(values, 'coverId') : '', 'Choose cover') + `<div class="form-grid">${field('startsOn', 'Away from', mine('away') ? valueOf(values, 'startsOn') : '', 'date')}${field('endsOn', 'Away through', mine('away') ? valueOf(values, 'endsOn') : '', 'date')}</div>` + button('Save away period'))
    + (away ? `<ul class="reasons">${away}</ul>` : ''), 'task-cover', ['task-timing', 'manager', 'away'].some(mine)) : '';
  return { head: runwayHead('Renewals', state.accounts, today), body: `${view.html}${state.accounts.length ? `<p>${escape(state.accounts[0].health.interpretation)}</p>` : ''}<div class="below"><div data-introduction>${intro}</div><div class="below-side">${reminders}${create}${freshness}${cover}</div></div>`, style: view.css };
}
