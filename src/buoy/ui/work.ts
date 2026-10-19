import { accountForm } from './account-form';
import { button, disclosure, escape, field, form, hidden, money, pathId, valueOf } from './html';
import { axisFor, quarters, runway } from './runway';
import { canManage, type Account, type Fields, type State } from './types';

export interface View { head: string; body: string; style?: string }

/** "$1,037,500": the invoices on the runway, one total per currency. */
function totals(accounts: Account[]): string {
  const sums = new Map<string, number>();
  for (const account of accounts) if (account.billing) sums.set(account.billing.currency, (sums.get(account.billing.currency) ?? 0) + account.billing.totalMinor);
  return [...sums].map(([currency, minor]) => money(minor, currency)).join(' + ');
}

export function runwayHead(title: string, accounts: Account[], today: string): string {
  const strong = [0, 2], facts = [quarters(axisFor(accounts, today)), `${accounts.length} account${accounts.length === 1 ? '' : 's'}`, totals(accounts)].filter(Boolean);
  return `<div class="title-line"><h1>${escape(title)}</h1>${facts.map((fact, index) => `<span class="dot" aria-hidden="true">·</span><span class="fact${strong.includes(index) ? ' strong' : ''}">${fact}</span>`).join('')}</div>`;
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
  return { head: runwayHead('Renewals', state.accounts, today), body: `${view.html}<div class="below"><div data-introduction>${intro}</div><div class="below-side">${create}${freshness}</div></div>`, style: view.css };
}
