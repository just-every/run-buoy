import type { Bindings } from '../../auth.server';
import { accountPage } from './account';
import { ApiError, apiCall, mutate } from './actions';
import { escape, section } from './html';
import { backupsPage, importsPage } from './imports';
import { shell } from './shell';
import { canManage, type Api, type Fields, type Job, type Preview, type State } from './types';
import { workPage } from './work';

/** Server-rendered product documents use the same authenticated public API as
 * other clients. No database access or independent authentication lives here. */
export async function buoyPage(request: Request, _env: Bindings, api: Api): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname;
  if (path !== '/app' && !path.startsWith('/app/')) return null;
  let state: State;
  try { state = await apiCall<State>(api, request, '/api/buoy/state'); }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) return new Response(null, { status: 303, headers: { location: `/signin?returnTo=${encodeURIComponent(path + url.search)}`, 'cache-control': 'no-store' } });
    return shell({ title: 'Work unavailable', body: section('Unable to load Buoy', '<p>Your work could not be loaded. Refresh this page to try again.</p><p><a href="/app">Return to accounts</a></p>'), state: null, current: '/app', status: error instanceof ApiError ? error.status : 503 });
  }
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) {
    const response = await shell({ title: 'Action unavailable', body: section('Action unavailable', '<p>This request method is not supported. <a href="/app">Return to accounts</a>.</p>'), state, current: '/app', status: 405 });
    response.headers.set('allow', 'GET, HEAD, POST');
    return response;
  }
  const match = path.match(/^\/app\/accounts\/([^/]+)$/);
  let accountId: string | undefined;
  try { accountId = match ? decodeURIComponent(match[1]) : undefined; } catch { /* The shell below renders a 404. */ }
  const account = accountId ? state.accounts.find(item => item.id === accountId) : undefined;
  if ((path !== '/app' && path !== '/app/imports' && path !== '/app/backups' && !account) || (match && !account)) return shell({ title: 'Page not found', body: section('Nothing here', '<p>This account or page could not be found.</p><p><a href="/app">Return to accounts</a></p>'), state, current: '/app', status: 404 });
  if (path === '/app/imports' && !canManage(state)) return shell({ title: 'Imports', body: section('Administrator access required', '<p>Only the owner or an administrator can preview, apply or undo an import.</p><p><a href="/app">Return to accounts</a></p>'), state, current: path, status: 403 });
  let fields: Fields | undefined, error: string | undefined, preview: Preview | undefined, status = 200;
  if (request.method === 'POST') {
    try {
      if (Number(request.headers.get('content-length') ?? 0) > 1_048_576) throw new ApiError('This upload is too large. Submit at most 50 accounts in a smaller JSON snapshot.', 413);
      const data = await request.formData();
      fields = {};
      for (const [key, value] of data) { if (typeof value !== 'string') throw new ApiError('Paste account JSON as text. File upload fields are not supported.'); fields[key] = value; }
      const result = await mutate(api, request, path, fields, account?.id);
      preview = result.preview;
      if (result.redirect) {
        const target = new URL(result.redirect, request.url);
        target.searchParams.set('success', result.message ?? 'Change saved.');
        if (result.saved) target.searchParams.set('saved', `${path}|${result.saved}`);
        return new Response(null, { status: 303, headers: { location: target.pathname + target.search, 'cache-control': 'no-store' } });
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'This change could not be saved. Try again.';
      status = caught instanceof ApiError ? caught.status : 400;
      if (fields?.action === 'import-apply' && fields.fingerprint) preview = { fingerprint: fields.fingerprint, counts: null, diagnostics: [{ message: 'Apply was not confirmed. Review the error above. Preview again if the source or destination changed.' }] };
    }
  }
  // The runway opens one account in place: ?open=<id>, or ?open=none for none.
  const open = url.searchParams.has('open') ? (url.searchParams.get('open') === 'none' ? null : url.searchParams.get('open')) : undefined;
  const today = new Date().toISOString().slice(0, 10);
  let title = 'Renewals', body: string, head: string | undefined, style: string | undefined;
  if (path === '/app/imports') {
    title = 'Imports';
    try {
      const journal = await apiCall<{ jobs: Job[]; erasures?: unknown[] }>(api, request, '/api/buoy/imports');
      body = importsPage(journal.jobs, fields, preview, journal.erasures);
    } catch (caught) {
      body = importsPage(null, fields, preview) + section('Journal error', `<p>${escape(caught instanceof Error ? caught.message : 'Reload to read the import journal.')}</p>`);
      status = 503;
    }
  } else if (path === '/app/backups') {
    title = 'Backups'; body = backupsPage(state.operator.role === 'owner');
  } else if (account) {
    title = account.name; ({ head, body, style } = accountPage(state, account, fields, open, today));
  } else {
    ({ head, body, style } = workPage(state, fields, open, today));
    if (url.searchParams.get('intro') === 'hidden') body = body.replace('<div data-introduction>', '<div data-introduction hidden>');
    if (url.searchParams.get('intro') === 'hidden') body = body.replace('<div class="below">', '<div class="below"><p class="show-intro"><a data-show-introduction href="/app?intro=show#first-use">Show first-use checklist</a></p>');
  }
  // Success messages are selected from known server outcomes, not arbitrary
  // text supplied in a link to this private page.
  const messages = new Set(['Account created.', 'Account source refresh saved.', 'Proposal prepared and awaiting approval.', 'CSM sentiment recorded.', 'Proposal approved. Review the recorded work or decision below.', 'Task completion recorded with evidence.', 'Account deleted.', 'Import completed. The journal below records its result.', 'Import request recorded. Check its current state in the journal below.', 'Import undone.', 'Undo request recorded. Check its current state in the journal below.']);
  const success = url.searchParams.get('success') ?? '';
  const response = await shell({ title, head, body, style, state, current: account ? '/app' : path, status, error, success: messages.has(success) ? success : undefined, backToAccounts: !!account });
  return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
}
