import { button, field, form, hidden, textarea, valueOf } from './html';
import type { Account, Fields } from './types';

export function accountForm(account?: Account, values?: Fields): string {
  const v = (name: string, fallback: unknown = '') => valueOf(values, name, fallback);
  const source = (kind: 'billing' | 'support') => {
    const data = account?.[kind];
    const enabled = values ? values[`${kind}Enabled`] === 'on' : !!data;
    const entry = (name: string, label: string, fallback: unknown, type = 'text', extra = '') => field(`${kind}.${name}`, label, v(`${kind}.${name}`, fallback), type, enabled, `data-group="${kind}" ${extra}`);
    const common = entry('observedAt', 'Observation date (UTC)', data?.observedAt?.slice(0, 10), 'date') + entry('reference', 'Source reference', data?.reference);
    const specific = kind === 'billing'
      ? entry('currency', 'Currency (three-letter code)', account?.billing?.currency, 'text', 'pattern="[A-Za-z]{3}" maxlength="3"') + entry('totalMinor', 'Invoice total (minor units)', account?.billing?.totalMinor, 'number', 'min="0" step="1"') + entry('creditsMinor', 'Credits (minor units)', account?.billing?.creditsMinor, 'number', 'min="0" step="1"') + entry('allocatedMinor', 'Allocated payments (minor units)', account?.billing?.allocatedMinor, 'number', 'min="0" step="1"') + entry('dueDate', 'Payment due date', account?.billing?.dueDate, 'date')
      : entry('openTickets', 'Open tickets', account?.support?.openTickets, 'number', 'min="0" step="1"') + entry('urgentTickets', 'Urgent tickets', account?.support?.urgentTickets, 'number', 'min="0" step="1"');
    return `<fieldset><legend>${kind === 'billing' ? 'Billing evidence' : 'Support evidence'}</legend><label class="check"><input type="checkbox" name="${kind}Enabled" data-source="${kind}"${enabled ? ' checked' : ''}> Include ${kind} observation</label><div class="form-grid">${common}${specific}</div></fieldset>`;
  };
  return form(account ? 'account-update' : 'account-create', account ? `/app/accounts/${encodeURIComponent(account.id)}` : '/app', hidden('action', account ? 'account-update' : 'account-create') + (account ? hidden('revision', v('revision', account.revision)) : '')
    + `<div class="form-grid">${field('name', 'Account name', v('name', account?.name))}${field('renewalDate', 'Renewal date', v('renewalDate', account?.renewalDate), 'date')}${field('noticeDays', 'Notice period (days)', v('noticeDays', account?.noticeDays ?? 30), 'number', true, 'min="0" step="1"')}</div>`
    + textarea('renewalEvidence', 'Renewal evidence reference', v('renewalEvidence', account?.renewalEvidence))
    + '<p>Use the source’s observation date and reference. Amounts are whole minor units: 100 means 1.00 for a two-decimal currency. Missing sources remain unknown.</p>' + source('billing') + source('support')
    + button(account ? 'Save source refresh' : 'Create account'));
}

export function accountBody(values: Fields, id?: string): Record<string, unknown> {
  const number = (key: string) => { const value = values[key]; if (!value?.trim()) throw new Error(`Enter ${key.replaceAll('.', ' ')}.`); const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${key.replaceAll('.', ' ')} must be a nonnegative whole number.`); return parsed; };
  const billing = values.billingEnabled === 'on' ? { observedAt: values['billing.observedAt'], reference: values['billing.reference'], currency: values['billing.currency']?.toUpperCase(), totalMinor: number('billing.totalMinor'), creditsMinor: number('billing.creditsMinor'), allocatedMinor: number('billing.allocatedMinor'), dueDate: values['billing.dueDate'] } : null;
  const support = values.supportEnabled === 'on' ? { observedAt: values['support.observedAt'], reference: values['support.reference'], openTickets: number('support.openTickets'), urgentTickets: number('support.urgentTickets') } : null;
  return { ...(id ? { id, revision: values.revision } : {}), name: values.name, renewalDate: values.renewalDate, noticeDays: number('noticeDays'), renewalEvidence: values.renewalEvidence, billing, support };
}
