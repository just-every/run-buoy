import {adoptionPage} from './adoption';
import type {AdoptionReport} from '../adoption';
import {customerPeoplePage,type CustomerPeoplePage,type CustomerFieldPreview} from './customer-people';
import type {MappingPreview} from './usage';
import { connectionsPage,type ConnectionsPage } from './connections';
import {usagePage,type UsagePage,type UsageCredential} from './usage';
import {fieldsPage,type FieldsPage} from './fields';
import {agentsPage,type AgentPage,type AgentCredential} from './agents';
import { outcomesPage, type OutcomesPage } from './outcomes';
import { segmentsPage, type SegmentsPage } from './segments';
import type { Bindings } from '../../auth.server';
import { auditPage, type AuditPage } from './audit';
import { accountPage } from './account';
import { ApiError, apiCall, mutate } from './actions';
import { escape, section } from './html';
import { backupsPage, importsPage, importsStyle } from './imports';
import { shell } from './shell';
import { canManage, type Api, type Fields, type Job, type State } from './types';
import { teamPage, type TeamPage, type TeamPreview } from './team';
import { notificationsPage, type InboxPage } from './notifications';
import { workPage } from './work';

/** Server-rendered product documents use the same authenticated public API as
 * other clients. No database access or independent authentication lives here. */
export async function buoyPage(request: Request, _env: Bindings, api: Api): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname === '/app/import' ? '/app/imports' : url.pathname;
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
  if ((path !== '/app' && path !== '/app/imports' && path !== '/app/backups' && path !== '/app/audit' && path !== '/app/notifications' && path !== '/app/team' && path !== '/app/segments' && path !== '/app/outcomes' && path !== '/app/customer-people' && path !== '/app/fields' && path !== '/app/usage' && path !== '/app/connections' && path !== '/app/adoption' && !account) || (match && !account)) return shell({ title: 'Page not found', body: section('Nothing here', '<p>This account or page could not be found.</p><p><a href="/app">Return to accounts</a></p>'), state, current: '/app', status: 404 });
  if (path === '/app/imports' && state.operator.role !== 'owner') return shell({ title: 'Owner access required', body: section('Owner access required', '<p>Only the owner can import accounts or manage Business imports.</p><p><a href="/app">Return to accounts</a></p>'), state, current: path, status: 403 });
  if ((path === '/app/audit' || path === '/app/team' || path === '/app/usage' || path === '/app/connections') && !canManage(state)) return shell({ title: 'Administrator access required', body: section('Administrator access required', '<p>Only the owner or an administrator can open this page.</p><p><a href="/app">Return to accounts</a></p>'), state, current: path, status: 403 });
  let usageCredential:UsageCredential|undefined;
  let fieldPreview:unknown;
  let customerFieldPreview:CustomerFieldPreview|undefined,usageMappingPreview:MappingPreview|undefined;
  let agentCredential:AgentCredential|undefined;
  let fields: Fields | undefined, error: string | undefined, teamPreview: TeamPreview | undefined, status = 200;
  if (request.method === 'POST') {
    try {
      if (Number(request.headers.get('content-length') ?? 0) > 1_048_576) throw new ApiError('This form is too large. Reduce its contents and try again.', 413);
      const data = await request.formData();
      fields = {};
      for (const [key, value] of data) { if (typeof value !== 'string') throw new ApiError('Use the import upload control for account files. This form accepts text fields only.'); fields[key] = value; }
      const result = await mutate(api, request, path, fields, account?.id);
      teamPreview = result.teamPreview;
      fieldPreview=result.fieldPreview;
      customerFieldPreview=result.customerFieldPreview;usageMappingPreview=result.usageMappingPreview;
      usageCredential=result.usageCredential;
      agentCredential=result.agentCredential;
      if (result.redirect) {
        const target = new URL(result.redirect, request.url);
        target.searchParams.set('success', result.message ?? 'Change saved.');
        if (result.saved) target.searchParams.set('saved', `${path}|${result.saved}`);
        return new Response(null, { status: 303, headers: { location: target.pathname + target.search, 'cache-control': 'no-store' } });
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'This change could not be saved. Try again.';
      status = caught instanceof ApiError ? caught.status : 400;
    }
  }
  // The runway opens one account in place: ?open=<id>, or ?open=none for none.
  const open = url.searchParams.has('open') ? (url.searchParams.get('open') === 'none' ? null : url.searchParams.get('open')) : undefined;
  const today = new Date().toISOString().slice(0, 10);
  let title = 'Renewals', body: string, head: string | undefined, style: string | undefined;
  if(path==='/app/adoption'){
    title='Product adoption';
    const query=new URLSearchParams([...url.searchParams].filter(([key,value])=>['on','accountId','personId','segmentId'].includes(key)&&value!==''));
    try{body=adoptionPage(await apiCall<AdoptionReport>(api,request,'/api/buoy/adoption?'+query.toString()),state,fields)}
    catch(caught){status=caught instanceof ApiError?caught.status:503;body=section('Adoption report unavailable',`<p>${escape(caught instanceof Error?caught.message:'Unable to load adoption measurements.')}</p><p><a href="/app/adoption">Clear report filters</a></p>`)}
  } else if(path==='/app/connections'){title='Connections';body=connectionsPage(await apiCall<ConnectionsPage>(api,request,'/api/buoy/connections'));
  } else if(path==='/app/customer-people'){title='Customer contacts and users';body=customerPeoplePage(await apiCall<CustomerPeoplePage>(api,request,'/api/buoy/customer-people'),state,fields,customerFieldPreview,url.searchParams.get('person')??fields?.personId);
  } else if(path==='/app/usage'){title='Usage intake';const data=await apiCall<UsagePage>(api,request,'/api/buoy/usage');const people=await apiCall<CustomerPeoplePage>(api,request,'/api/buoy/customer-people');body=usagePage({...data,customerPeople:people.records},state,fields,usageCredential,usageMappingPreview);
  } else if(path==='/app/fields'){title='Custom fields';body=fieldsPage(await apiCall<FieldsPage>(api,request,'/api/buoy/fields'),state,fields,fieldPreview,url.searchParams.get('account')??fields?.accountId);
  } else if(path==='/app/outcomes') {
    title='Playbook outcomes';body=outcomesPage(await apiCall<OutcomesPage>(api,request,'/api/buoy/outcomes'),state,fields);
  } else if(path==='/app/segments') {
    title='Segments';body=segmentsPage(await apiCall<SegmentsPage>(api,request,'/api/buoy/segments'),state,fields);
  } else if (path === '/app/team') {
    title = 'Team'; body = teamPage(await apiCall<TeamPage>(api,request,'/api/buoy/team'),state,fields,teamPreview);
  } else if (path === '/app/notifications') {
    title = 'Notifications'; body = notificationsPage(await apiCall<InboxPage>(api, request, '/api/buoy/notifications'), state, fields);
  } else if (path === '/app/audit') {
    title = 'Audit';
    try {
      body = auditPage(await apiCall<AuditPage>(api, request, '/api/buoy/audit?' + url.searchParams.toString()), url.searchParams);
      if(state.operator.role==='owner') body=agentsPage(await apiCall<AgentPage>(api,request,'/api/buoy/agents'),fields,agentCredential)+body;
    } catch (caught) {
      status = caught instanceof ApiError ? caught.status : 503;
      body = section('Audit unavailable', `<p>${escape(caught instanceof Error ? caught.message : 'Reload to read the audit.')}</p><p><a href="/app/audit">Clear filters and reload</a></p>`);
    }
  } else if (path === '/app/imports') {
    title = 'Imports'; style = importsStyle;
    try {
      const journal = await apiCall<{ jobs: Job[]; erasures?: unknown[] }>(api, request, '/api/buoy/imports');
      body = importsPage(journal.jobs, journal.erasures);
    } catch (caught) {
      body = importsPage(null) + section('Journal error', `<p>${escape(caught instanceof Error ? caught.message : 'Reload to read the import journal.')}</p>`);
      status = 503;
    }
  } else if (path === '/app/backups') {
    title = 'Backups'; body = backupsPage(state.operator.role === 'owner');
  } else if (account) {
    title = account.name; ({ head, body, style } = accountPage(state, account, fields, open, today));
    const usage=await apiCall<{sources:{name:string;sourceSystem:string;sourceReference:string;eventCount:number;observedAt:string;receivedAt:string;freshness:string;staleDays:number}[]}>(api,request,`/api/buoy/accounts/${encodeURIComponent(account.id)}/usage`);
    body+=section('Product usage evidence',usage.sources.length?`<ul class="records">${usage.sources.map(s=>`<li class="record"><h3>${escape(s.name)}</h3><p>${s.eventCount} observations · ${escape(s.freshness)} · stale after ${s.staleDays} UTC days</p><p>Source: ${escape(s.sourceSystem)} · reference: ${escape(s.sourceReference)}</p><p>Last observed ${escape(s.observedAt)} · received ${escape(s.receivedAt)}</p></li>`).join('')}</ul>`:'<p>Missing: no usage observation has an explicitly reviewed mapping to this account.</p>');
  } else {
    ({ head, body, style } = workPage(state, fields, open, today));
    if (url.searchParams.get('intro') === 'hidden') body = body.replace('<div data-introduction>', '<div data-introduction hidden>');
    if (url.searchParams.get('intro') === 'hidden') body = body.replace('<div class="below">', '<div class="below"><p class="show-intro"><a data-show-introduction href="/app?intro=show#first-use">Show first-use checklist</a></p>');
  }
  // Success messages are selected from known server outcomes, not arbitrary
  // text supplied in a link to this private page.
  const messages = new Set(['Adoption configuration saved.','Customer record saved.','Customer field saved.','Customer field values saved.','Exact identity mapping approved.','Usage source saved.', 'Ingestion credential revoked.', 'Field saved.', 'Field values saved.', 'Agent switch saved.', 'Agent credential revoked.', 'Tier names saved.', 'Outcome tracking started.', 'Segment saved.', 'Account classification saved.', 'Team settings saved.', 'Reviewed assignment applied. Handover notes are on each account.', 'Your notification preferences saved.', 'Notification marked read.', 'Mention sent to their inbox.', 'Account created.', 'Account source refresh saved.', 'Proposal prepared and awaiting approval.', 'CSM sentiment recorded.', 'Freshness thresholds saved.', 'Proposal approved. Review the recorded work or decision below.', 'Task completion recorded with evidence.', 'Account deleted.', 'Import undone.', 'Undo request recorded. Check its current state in the journal below.', 'Account owner saved. Open tasks moved to them.', 'Reminder timing saved.', 'Manager saved.', 'Away period and cover saved.']);
  const success = url.searchParams.get('success') ?? '';
  const response = await shell({ title, head, body, style, state, current: account ? '/app' : path, status, error, success: messages.has(success) ? success : undefined, backToAccounts: !!account, importDoor: path === '/app/imports' && state.operator.role === 'owner' });
  return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
}
