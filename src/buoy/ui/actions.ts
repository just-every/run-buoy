import { accountBody } from './account-form';
import type { Api, Fields, Job, Preview } from './types';

export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function apiCall<T>(api: Api, original: Request, path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers = new Headers(original.headers);
  headers.delete('content-length');
  headers.delete('content-type');
  headers.set('accept', 'application/json');
  if (body !== undefined) headers.set('content-type', 'application/json');
  const response = await api(new Request(new URL(path, original.url), { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    const message = typeof record.error === 'string' ? record.error : typeof record.message === 'string' ? record.message : 'This request could not be completed. Reload and try again.';
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export function importAccounts(source: string): unknown[] {
  let input: unknown;
  try { input = JSON.parse(source); } catch { throw new ApiError('Enter valid JSON containing an accounts array. Your upload has been retained below.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray((input as { accounts?: unknown }).accounts)) throw new ApiError('The upload must be an object containing an accounts array.');
  if (Object.keys(input).some(key => key !== 'accounts')) throw new ApiError('Only the accounts property is supported at the top level of an upload.');
  const accounts = (input as { accounts: unknown[] }).accounts;
  if (accounts.length < 1 || accounts.length > 50) throw new ApiError('An upload must contain between 1 and 50 accounts.');
  return accounts;
}
export interface MutationResult { redirect?: string; message?: string; preview?: Preview; saved?: string }
export async function mutate(api: Api, request: Request, path: string, fields: Fields, accountId?: string): Promise<MutationResult> {
  // Browser form posts must carry their real same-origin Origin. The API also
  // authenticates and authorizes every forwarded write independently.
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new ApiError('This form must be submitted from this Buoy installation. Reload and try again.', 403);
  const send = <T>(url: string, body: unknown, method = 'POST') => apiCall<T>(api, request, url, method, body);
  const accountPath = `/api/buoy/accounts/${encodeURIComponent(accountId ?? '')}`;
  const action = fields.action;
  if (path === '/app/notifications') {
    if (action === 'notification-preferences') {
      await send('/api/buoy/notifications/preferences', {frequency: fields.frequency, modes: {mention:fields.mention,assignment:fields.assignment,signal:fields.signal,approval:fields.approval}}, 'PUT');
      return {redirect:path,message:'Your notification preferences saved.',saved:action};
    }
    if (action === 'notification-read') {
      await send(`/api/buoy/notifications/${encodeURIComponent(fields.id)}/read`, {});
      return {redirect:path,message:'Notification marked read.'};
    }
    if (action === 'mention') {
      await send(`/api/buoy/accounts/${encodeURIComponent(fields.accountId)}/mentions`, {personId:fields.personId,note:fields.note});
      return {redirect:path,message:'Mention sent to their inbox.',saved:action};
    }
  }
  if (path === '/app' && action === 'account-create') {
    const account = await send<{ id: string }>('/api/buoy/accounts', accountBody(fields));
    return { redirect: `/app/accounts/${encodeURIComponent(account.id)}`, message: 'Account created.', saved: 'account-create' };
  }
  if (path === '/app' && action === 'staleness') {
    await send('/api/buoy/settings/staleness', { billingDays: Number(fields.billingDays), supportDays: Number(fields.supportDays) }, 'PUT');
    return { redirect: '/app', message: 'Freshness thresholds saved.', saved: 'staleness' };
  }
  if (path === '/app' && action === 'task-timing') {
    await send('/api/buoy/settings/tasks', { remindDaysBefore: Number(fields.remindDaysBefore), escalateAfterDays: Number(fields.escalateAfterDays), timeZone: fields.timeZone || null }, 'PUT');
    return { redirect: '/app', message: 'Reminder timing saved.', saved: 'task-timing' };
  }
  if (path === '/app' && action === 'manager') {
    await send(`/api/buoy/people/${encodeURIComponent(fields.personId)}/manager`, { managerId: fields.managerId || null }, 'PUT');
    return { redirect: '/app', message: 'Manager saved.', saved: 'manager' };
  }
  if (path === '/app' && action === 'away') {
    await send(`/api/buoy/people/${encodeURIComponent(fields.personId)}/away`, { coverId: fields.coverId, startsOn: fields.startsOn, endsOn: fields.endsOn });
    return { redirect: '/app', message: 'Away period and cover saved.', saved: 'away' };
  }
  if (accountId) {
    if (action === 'account-update') {
      await send(accountPath, accountBody(fields, accountId), 'PUT');
      return { redirect: path, message: 'Account source refresh saved.', saved: 'account-update' };
    }
    if (action === 'playbook' || action === 'renewal') {
      const payload = action === 'playbook' ? { title: fields.title, dueDate: fields.dueDate, priority: fields.priority, type: fields.type, ...(fields.ownerId ? { ownerId: fields.ownerId } : {}) } : { outcome: fields.outcome, reason: fields.reason, evidence: fields.evidence };
      await send('/api/buoy/proposals', { accountId, kind: action === 'playbook' ? 'playbook' : 'renewal', payload });
      return { redirect: path, message: 'Proposal prepared and awaiting approval.', saved: action };
    }
    if (action === 'sentiment') {
      await send(`${accountPath}/sentiment`, { rating: fields.rating, reason: fields.reason, days: Number(fields.days) });
      return { redirect: path, message: 'CSM sentiment recorded.', saved: 'sentiment' };
    }
    if (action === 'approve') {
      await send(`/api/buoy/proposals/${encodeURIComponent(fields.id)}/approve`, {});
      return { redirect: path, message: 'Proposal approved. Review the recorded work or decision below.', saved: `approve-${fields.id}` };
    }
    if (action === 'complete') {
      await send(`/api/buoy/tasks/${encodeURIComponent(fields.id)}/complete`, { outcome: fields.outcome, evidence: fields.evidence });
      return { redirect: path, message: 'Task completion recorded with evidence.', saved: `complete-${fields.id}` };
    }
    if (action === 'account-owner') {
      await send(`${accountPath}/owner`, { ownerId: fields.ownerId }, 'PUT');
      return { redirect: path, message: 'Account owner saved. Open tasks moved to them.', saved: 'account-owner' };
    }
    if (action === 'delete') {
      await send(accountPath, { confirmation: fields.confirmation }, 'DELETE');
      return { redirect: '/app', message: 'Account deleted.', saved: 'delete' };
    }
  }
  if (path === '/app/imports') {
    if (action === 'import-preview') {
      const accounts = importAccounts(fields.source);
      const preview = await send<Preview>('/api/buoy/imports/preview', { accounts });
      return { preview };
    }
    if (action === 'import-apply') {
      const accounts = importAccounts(fields.source);
      const job = await send<Job>('/api/buoy/imports/apply', { accounts, fingerprint: fields.fingerprint, operationKey: fields.operationKey });
      return { redirect: path, message: job.state === 'completed' ? 'Import completed. The journal below records its result.' : 'Import request recorded. Check its current state in the journal below.', saved: 'import-apply' };
    }
    if (action === 'import-undo') {
      const job = await send<Job>(`/api/buoy/imports/${encodeURIComponent(fields.id)}/undo`, {});
      return { redirect: path, message: job.state === 'undone' ? 'Import undone.' : 'Undo request recorded. Check its current state in the journal below.', saved: `undo-${fields.id}` };
    }
  }
  throw new ApiError('This form action is not available on this page.', 400);
}
