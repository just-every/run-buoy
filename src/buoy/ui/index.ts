import {configurationPage} from './configuration';
import {dataTrustPanel} from './data-trust';
import type {TrustPage} from '../data-trust';
import {aiPage} from './ai';
import {reviewsPage,type ReviewsPage} from './reviews';
import {reportsPage,type ReportsPage,type ReportResult} from './reports';
import {forecastPage,type ForecastPage} from './forecast';
import {plansPanel,type PlansPage} from './plans';
import {connectedBillingPanel} from './connected-billing';
import {billingPage,type BillingState,type BindingPreview} from './billing';
import type {ProjectedState} from '../roles';
import {scopedPage} from './scoped';
import {rolesPage,type RolesPage} from './roles';
import {reportingPage,type RetentionPage,type RatePage} from './reporting';
import {searchPage,type SearchPage} from './search';
import {playbooksPanel,type PlayPage} from './playbooks';
import type {accountActivity} from '../activity';
import {hierarchyPage,type HierarchyPage} from './hierarchy';
import {workspacePage,type WorkspacePage,type CsmHome,type WorkspaceListPreview,type WorkspaceBulkPreview} from './workspace';
import {renewalsPage,type RenewalPage,type RenewalPreview} from './renewals';
import {privacyControls,privacyReceipts,type PrivacyReceipt,type PrivacyPreview,type PrivacyHold} from './privacy';
import {surveyPage,surveyPersonTimeline,type SurveyPage} from './surveys';
import {revenuePage,type RevenuePage} from './revenue';
import {scorecardsPage,type ScorecardPage,type ScorecardPreview} from './scorecards';
import type {ConsumerPage} from './adoption-consumers';
import {inappPage,type InappPage,type InappCredential} from './inapp';
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
import { escape, section, button } from './html';
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
  if(path==='/app/ai/configuration')return configurationPage(request,api,state);
  if(['/app/ai','/app/settings/ai'].includes(path))return aiPage(request,api,state);
  if('roleAccess' in state)return scopedPage(request,api,state as unknown as ProjectedState);
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) {
    const response = await shell({ title: 'Action unavailable', body: section('Action unavailable', '<p>This request method is not supported. <a href="/app">Return to accounts</a>.</p>'), state, current: '/app', status: 405 });
    response.headers.set('allow', 'GET, HEAD, POST');
    return response;
  }
  const match = path.match(/^\/app\/accounts\/([^/]+)$/);
  let accountId: string | undefined;
  try { accountId = match ? decodeURIComponent(match[1]) : undefined; } catch { /* The shell below renders a 404. */ }
  const account = accountId ? state.accounts.find(item => item.id === accountId) : undefined;
  if ((path !== '/app' && path !== '/app/imports' && path !== '/app/backups' && path !== '/app/audit' && path !== '/app/notifications' && path !== '/app/team' && path !== '/app/segments' && path !== '/app/outcomes' && path !== '/app/customer-people' && path !== '/app/fields' && path !== '/app/usage' && path !== '/app/connections' && path !== '/app/adoption' && path !== '/app/inapp' && path !== '/app/reviews' && path !== '/app/reports' && path !== '/app/forecast' && path !== '/app/renewals' && path !== '/app/workspace' && path !== '/app/search' && path !== '/app/revenue' && path !== '/app/roles' && path !== '/app/billing' && !account) || (match && !account)) return shell({ title: 'Page not found', body: section('Nothing here', '<p>This account or page could not be found.</p><p><a href="/app">Return to accounts</a></p>'), state, current: '/app', status: 404 });
  if (path === '/app/imports' && state.operator.role !== 'owner') return shell({ title: 'Owner access required', body: section('Owner access required', '<p>Only the owner can import accounts or manage Business imports.</p><p><a href="/app">Return to accounts</a></p>'), state, current: path, status: 403 });
  if ((path === '/app/reviews' || path === '/app/audit' || path === '/app/team' || path === '/app/usage' || path === '/app/connections' || path === '/app/inapp' || path === '/app/roles' || path === '/app/billing') && !canManage(state)) return shell({ title: 'Administrator access required', body: section('Administrator access required', '<p>Only the owner or an administrator can open this page.</p><p><a href="/app">Return to accounts</a></p>'), state, current: path, status: 403 });
  let billingPreview:BindingPreview|undefined;
  let workspaceListPreview:WorkspaceListPreview|undefined,workspaceBulkPreview:WorkspaceBulkPreview|undefined;
  let renewalFieldPreview:RenewalPreview|undefined;
  let usageCredential:UsageCredential|undefined;
  let inappCredential:InappCredential|undefined;
  let fieldPreview:unknown,scorecardPreview:ScorecardPreview|undefined;
  let privacyPreview:PrivacyPreview|undefined;
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
      if(result.privacyExport)return new Response(JSON.stringify(result.privacyExport,null,2),{headers:{'content-type':'application/json; charset=utf-8','content-disposition':'attachment; filename="buoy-customer-export.json"','cache-control':'no-store','x-content-type-options':'nosniff'}});
      billingPreview=result.billingPreview;
      workspaceListPreview=result.workspaceListPreview;workspaceBulkPreview=result.workspaceBulkPreview;
      renewalFieldPreview=result.renewalFieldPreview;
      teamPreview = result.teamPreview;
      fieldPreview=result.fieldPreview;scorecardPreview=result.scorecardPreview;
      privacyPreview=result.privacyPreview;customerFieldPreview=result.customerFieldPreview;usageMappingPreview=result.usageMappingPreview;
      usageCredential=result.usageCredential;inappCredential=result.inappCredential;
      agentCredential=result.agentCredential;
      if (result.redirect) {
        const target = new URL(result.redirect, request.url);
        target.searchParams.set('success', result.message ?? 'Change saved.');
        if (result.saved) target.searchParams.set('saved', `${path}|${result.saved}`);
        return new Response(null, { status: 303, headers: { location: target.pathname + target.search + target.hash, 'cache-control': 'no-store' } });
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
  if(path==='/app/reviews'){title='Business reviews';const selected=fields?.id??url.searchParams.get('review');try{body=reviewsPage(await apiCall<ReviewsPage>(api,request,'/api/buoy/reviews'+(selected?'?id='+encodeURIComponent(selected):'')),state,fields)}catch(caught){status=caught instanceof ApiError?caught.status:503;body=section('Business review unavailable','<p role="alert">'+escape(caught instanceof Error?caught.message:'Reload to read current reviews.')+'</p><p><a href="/app/reviews">Return to business reviews</a></p>')}
  } else if(path==='/app/reports'){title='Reports and dashboards';try{const data=await apiCall<ReportsPage>(api,request,'/api/buoy/reports'),selected=data.dashboards.find(d=>d.id===url.searchParams.get('dashboard')),ids=selected?selected.reportIds:url.searchParams.get('report')?[url.searchParams.get('report')!]:[];const results:ReportResult[]=[];for(const id of ids)results.push(await apiCall<ReportResult>(api,request,'/api/buoy/reports/'+encodeURIComponent(id)));body=reportsPage(data,results,fields)}catch(caught){status=caught instanceof ApiError?caught.status:503;body=section('Reports unavailable','<p>'+escape(caught instanceof Error?caught.message:'Reload to read current reports.')+'</p><p><a href="/app/reports">Reload reports</a></p>')}
  } else if(path==='/app/forecast'){title='Renewal forecast';const query=fields?.returnQuery?new URLSearchParams(fields.returnQuery):url.searchParams;try{body=forecastPage(query,await apiCall<ForecastPage>(api,request,'/api/buoy/renewals/forecast?'+query),fields)}catch(caught){status=caught instanceof ApiError?caught.status:503;body=section('Forecast unavailable','<p>'+escape(caught instanceof Error?caught.message:'Reload to read the forecast.')+'</p><p><a href="/app/forecast">Open the current forecast</a></p>')}
  } else if(path==='/app/billing'){title='Stripe billing';body=billingPage(await apiCall<BillingState>(api,request,'/api/buoy/billing'),billingPreview);
  } else if(path==='/app/roles'){title='Roles and permissions';body=rolesPage(await apiCall<RolesPage>(api,request,'/api/buoy/roles'),fields);
  } else if(path==='/app/revenue'){title='Revenue and retention';const rates=canManage(state)?await apiCall<RatePage>(api,request,'/api/buoy/revenue/rates'):undefined;try{const query=new URLSearchParams([...url.searchParams].filter(([k,v])=>!['success','saved'].includes(k)&&v!==''));body=reportingPage(query,await apiCall<RetentionPage>(api,request,'/api/buoy/revenue/retention?'+query.toString()),rates,fields)}catch(caught){status=caught instanceof ApiError?caught.status:503;body=reportingPage(url.searchParams,undefined,rates,fields,caught instanceof Error?caught.message:'Unable to load retention. Try again.')}
  } else if(path==='/app/search'){title='Search';try{body=searchPage(url.searchParams,url.searchParams.has('q')?await apiCall<SearchPage>(api,request,'/api/buoy/search?'+url.searchParams.toString()):undefined)}catch(caught){status=caught instanceof ApiError?caught.status:503;body=searchPage(url.searchParams,undefined,caught instanceof Error?caught.message:'Unable to read search results. Try again.')}
  } else if(path==='/app/workspace'){title='Your workspace';try{body=workspacePage(await apiCall<WorkspacePage>(api,request,'/api/buoy/workspace'+(url.searchParams.has('view')?'?view='+encodeURIComponent(url.searchParams.get('view')!):'')),await apiCall<CsmHome>(api,request,'/api/buoy/workspace/home'+(url.searchParams.has('person')?'?person='+encodeURIComponent(url.searchParams.get('person')!):'')),state,fields,workspaceListPreview,workspaceBulkPreview)}catch(caught){status=caught instanceof ApiError?caught.status:503;body=section('Workspace unavailable','<p>'+escape(caught instanceof Error?caught.message:'Reload to read your workspace.')+'</p><p><a href="/app/workspace">Open your own workspace</a></p>')}
  } else if(path==='/app/renewals'){title='Renewal pipeline';body=renewalsPage(await apiCall<RenewalPage>(api,request,'/api/buoy/renewals'+(url.searchParams.has('quarter')?'?quarter='+encodeURIComponent(url.searchParams.get('quarter')!):'')),state,fields,renewalFieldPreview,url.searchParams.get('renewal')??fields?.renewalId);
  } else if(path==='/app/inapp'){title='In-app campaigns';body=inappPage(await apiCall<InappPage>(api,request,'/api/buoy/inapp'),state,fields,inappCredential);
  } else if(path==='/app/adoption'){
    title='Product adoption';
    const query=new URLSearchParams([...url.searchParams].filter(([key,value])=>['on','accountId','personId','segmentId'].includes(key)&&value!==''));
    try{body=adoptionPage(await apiCall<AdoptionReport>(api,request,'/api/buoy/adoption?'+query.toString()),state,fields,await apiCall<ConsumerPage>(api,request,'/api/buoy/adoption/consumers'))}
    catch(caught){status=caught instanceof ApiError?caught.status:503;body=section('Adoption report unavailable',`<p>${escape(caught instanceof Error?caught.message:'Unable to load adoption measurements.')}</p><p><a href="/app/adoption">Clear report filters</a></p>`)}
  } else if(path==='/app/connections'){title='Connections';body=section('Stripe billing','<p><a href="/app/billing">Review account bindings, subscriptions and payment risk</a></p>')+connectionsPage(await apiCall<ConnectionsPage>(api,request,'/api/buoy/connections'));
  } else if(path==='/app/customer-people'){title='Customer contacts and users';body=customerPeoplePage(await apiCall<CustomerPeoplePage>(api,request,'/api/buoy/customer-people'),state,fields,customerFieldPreview,url.searchParams.get('person')??fields?.personId);
    const personId=url.searchParams.get('person')??fields?.personId??(await apiCall<CustomerPeoplePage>(api,request,'/api/buoy/customer-people')).records[0]?.id;
    if(state.operator.role==='owner'){
      const data=await apiCall<CustomerPeoplePage>(api,request,'/api/buoy/customer-people'),person=data.records.find(p=>p.id===personId);
      if(person){const privacy=await apiCall<{holders:unknown[];hold:PrivacyHold|null}>(api,request,'/api/buoy/customer-people/'+encodeURIComponent(person.id)+'/privacy');body+=privacyControls(person,privacy.holders,fields,privacyPreview,privacy.hold);}
      body+=privacyReceipts((await apiCall<{receipts:PrivacyReceipt[]}>(api,request,'/api/buoy/privacy/receipts')).receipts);
    }
    if(personId)body+=surveyPersonTimeline(await apiCall<SurveyPage>(api,request,'/api/buoy/surveys'),personId);
    if(personId){const timeline=await apiCall<{events:{event:string;campaignTitle?:string;kind?:string;observedAt:string;sourceReference:string}[];nextCursor:string|null}>(api,request,'/api/buoy/customer-people/'+encodeURIComponent(personId)+'/timeline'+(url.searchParams.has('cursor')?'?cursor='+encodeURIComponent(url.searchParams.get('cursor')!):''));body+=section('Customer usage timeline',timeline.events.length?'<ol class="journal">'+timeline.events.map(e=>'<li class="record"><h3>'+escape(e.event)+'</h3><p>'+escape(e.campaignTitle??'Usage observation')+'</p><p>Observed (UTC): '+escape(e.observedAt)+'</p><p>Source reference: '+escape(e.sourceReference)+'</p></li>').join('')+'</ol>'+(timeline.nextCursor?'<p><a href="/app/customer-people?person='+encodeURIComponent(personId)+'&amp;cursor='+encodeURIComponent(timeline.nextCursor)+'">Earlier usage observations</a></p>':''):'<p>No attributed usage observations for this customer.</p>','customer-usage-timeline');}
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
      body=dataTrustPanel(await apiCall<TrustPage>(api,request,'/api/buoy/trust'),state,fields)+body;
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
    body+=connectedBillingPanel(account.stripeBilling,today);
    if(canManage(state))body+=plansPanel(await apiCall<PlansPage>(api,request,'/api/buoy/accounts/'+encodeURIComponent(account.id)+'/plans'),state,account.id,(await apiCall<CustomerPeoplePage>(api,request,'/api/buoy/customer-people')).records,fields);

    if(canManage(state))body+=playbooksPanel(await apiCall<PlayPage>(api,request,'/api/buoy/playbooks?accountId='+encodeURIComponent(account.id)),state,account.id,fields);
    const organization=await apiCall<HierarchyPage>(api,request,'/api/buoy/accounts/'+encodeURIComponent(account.id)+'/hierarchy');
    const activityQuery=new URLSearchParams();for(const [pageKey,apiKey]of [['activityEntry','entry'],['activityCursor','cursor'],['activityKind','kind'],['activityPerson','personId'],['activitySource','source']])if(url.searchParams.get(pageKey))activityQuery.set(apiKey,url.searchParams.get(pageKey)!);
    const activity=await apiCall<Awaited<ReturnType<typeof accountActivity>>>(api,request,'/api/buoy/accounts/'+encodeURIComponent(account.id)+'/activity?'+activityQuery);
    const nextActivity=new URLSearchParams(url.searchParams);if(activity.nextCursor)nextActivity.set('activityCursor',activity.nextCursor);
    const activitySelect=(key:string,label:string,choices:{id:string;name:string}[])=>'<label>'+escape(label)+'<select aria-label="'+escape(label)+'" name="'+escape(key)+'"><option value="">All</option>'+choices.map(c=>'<option value="'+escape(c.id)+'"'+(url.searchParams.get(key)===c.id?' selected':'')+'>'+escape(c.name)+'</option>').join('')+'</select></label>';
    body+=section('Current record activity','<p>'+escape(activity.interpretation)+'</p><form method="get" action="/app/accounts/'+encodeURIComponent(account.id)+'#record-activity">'+activitySelect('activityKind','Activity kind',activity.filters.kinds)+activitySelect('activityPerson','Customer person',organization.stakeholders)+activitySelect('activitySource','Activity source',activity.filters.sources)+button('Filter record activity')+'</form><p role="status">Showing '+activity.records.length+' matching activity '+(activity.records.length===1?'entry':'entries')+'.</p><ol class="journal">'+activity.records.map(r=>'<li class="record"><h3><a href="'+escape(r.href)+'">'+escape(r.title)+'</a></h3><p>'+escape(activity.filters.kinds.find(k=>k.id===r.kind)?.name??r.kind)+' · '+escape(r.occurredAt)+' UTC</p><p>Source: '+escape(activity.filters.sources.find(s=>s.id===r.source)?.name??'Earlier product source')+' · Reference: '+escape(r.reference)+'</p></li>').join('')+'</ol>'+(activity.nextCursor?'<p><a href="/app/accounts/'+encodeURIComponent(account.id)+'?'+escape(nextActivity.toString())+'#record-activity">Earlier record activity</a></p>':''),'record-activity');
    body+=hierarchyPage(organization,await apiCall<ScorecardPage>(api,request,'/api/buoy/scorecards'),state,fields);
    body+=surveyPage(await apiCall<SurveyPage>(api,request,'/api/buoy/surveys'),state,account.id,fields);
    body+=revenuePage(await apiCall<RevenuePage>(api,request,'/api/buoy/revenue'),state,account.id,fields);
    const usage=await apiCall<{sources:{name:string;sourceSystem:string;sourceReference:string;eventCount:number;observedAt:string;receivedAt:string;freshness:string;staleDays:number}[]}>(api,request,`/api/buoy/accounts/${encodeURIComponent(account.id)}/usage`);
    body+=section('Product usage evidence',usage.sources.length?`<ul class="records">${usage.sources.map(s=>`<li class="record"><h3>${escape(s.name)}</h3><p>${s.eventCount} observations · ${escape(s.freshness)} · stale after ${s.staleDays} UTC days</p><p>Source: ${escape(s.sourceSystem)} · reference: ${escape(s.sourceReference)}</p><p>Last observed ${escape(s.observedAt)} · received ${escape(s.receivedAt)}</p></li>`).join('')}</ul>`:'<p>Missing: no usage observation has an explicitly reviewed mapping to this account.</p>','product-usage');
  } else {
    ({ head, body, style } = workPage(state, fields, open, today));
    if (url.searchParams.get('intro') === 'hidden') body = body.replace('<div data-introduction>', '<div data-introduction hidden>');
    body+=section('Your workspace','<p><a href="/app/workspace">Open today’s work, live account/user lists and saved views</a>.</p>');
    body+=section('Revenue and retention','<p><a href="/app/revenue">Open revenue and retention reporting</a> from confirmed terms and explicit reporting rates.</p>');
    body+=section('Renewal pipeline','<p><a href="/app/renewals">Open the contract-driven renewal board, list and approved outcomes</a>.</p>');
    body+=scorecardsPage(await apiCall<ScorecardPage>(api,request,'/api/buoy/scorecards'),state,fields,scorecardPreview);
    if (url.searchParams.get('intro') === 'hidden') body = body.replace('<div class="below">', '<div class="below"><p class="show-intro"><a data-show-introduction href="/app?intro=show#first-use">Show first-use checklist</a></p>');
  }
  // Success messages are selected from known server outcomes, not arbitrary
  // text supplied in a link to this private page.
  const messages = new Set(['Data trust findings prepared for review.','Group correction prepared; mapping unchanged until approval.','Data trust decision recorded.','Internal success plan saved.','Business review saved.','Report saved.','Dashboard saved.','Stripe billing updated. Review its source status.','Role configuration saved.','Reporting rates published.','Organization and stakeholder roles saved.','Record scorecard saved.','View saved.','Saved view deleted.','Reviewed bulk change applied.','Renewal pipeline saved.','Renewal configuration saved.','Renewal field saved.','Renewal field values saved.','Renewal outcome prepared.','Renewal outcome approved.','External holders recorded.','Customer erased. Review the privacy receipt.','Signal dismissed until your chosen UTC instant.','Received survey response recorded.','Recurring contract confirmed.','Scorecard published.','In-app campaign created.','In-app campaign enabled.','In-app campaign disabled.','In-app credential revoked.','Adoption configuration saved.','Customer record saved.','Customer field saved.','Customer field values saved.','Exact identity mapping approved.','Usage source saved.', 'Ingestion credential revoked.', 'Field saved.', 'Field values saved.', 'Agent switch saved.', 'Agent credential revoked.', 'Tier names saved.', 'Outcome tracking started.', 'Segment saved.', 'Account classification saved.', 'Team settings saved.', 'Reviewed assignment applied. Handover notes are on each account.', 'Your notification preferences saved.', 'Notification marked read.', 'Mention sent to their inbox.', 'Account created.', 'Account source refresh saved.', 'Proposal prepared and awaiting approval.', 'CSM sentiment recorded.', 'Freshness thresholds saved.', 'Proposal approved. Review the recorded work or decision below.', 'Task completion recorded with evidence.', 'Account deleted.', 'Import undone.', 'Undo request recorded. Check its current state in the journal below.', 'Account owner saved. Open tasks moved to them.', 'Reminder timing saved.', 'Manager saved.', 'Away period and cover saved.']);
  const success = url.searchParams.get('success') ?? '';
  const response = await shell({ title, head, body, style, state, current: account ? '/app' : path, status, error, success: messages.has(success) ? success : undefined, backToAccounts: !!account, importDoor: path === '/app/imports' && state.operator.role === 'owner' });
  return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
}
