import type {BindingPreview} from '../billing';
import type {PrivacyPreview,PrivacyReceipt} from './privacy';
import type {WorkspaceListPreview,WorkspaceBulkPreview} from './workspace';
import type {RenewalPreview} from './renewals';
import {surveyForm} from './surveys';
import {revenueReconciliationForm} from './revenue-reconciliation';
import {contractForm} from './revenue';
import {scorecardFormConfig,type ScorecardPreview} from './scorecards';
import {mutateInapp,type InappCredential} from './inapp';
import {mutateCustomerPeople} from './customer-people';
import type {CustomerFieldPreview} from './customer-people';
import type {MappingPreview} from './usage';
import {mutateUsage} from './usage-actions';
import type {UsageCredential} from './usage';
import type { AgentCredential } from './agents';
import { mutateTeam } from './team-actions';
import type { TeamPreview } from './team';
import { accountBody } from './account-form';
import type { Api, Fields, Job } from './types';

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

export interface MutationResult { billingPreview?:BindingPreview; privacyPreview?:PrivacyPreview; workspaceListPreview?:WorkspaceListPreview; workspaceBulkPreview?:WorkspaceBulkPreview; renewalFieldPreview?:RenewalPreview; privacyExport?:unknown; scorecardPreview?:ScorecardPreview; inappCredential?:InappCredential; customerFieldPreview?:CustomerFieldPreview; usageMappingPreview?:MappingPreview; usageCredential?:UsageCredential; fieldPreview?:unknown; agentCredential?:AgentCredential; redirect?: string; message?: string; saved?: string; teamPreview?: TeamPreview }
export async function mutate(api: Api, request: Request, path: string, fields: Fields, accountId?: string): Promise<MutationResult> {
  // Browser form posts must carry their real same-origin Origin. The API also
  // authenticates and authorizes every forwarded write independently.
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new ApiError('This form must be submitted from this Buoy installation. Reload and try again.', 403);
  const send = <T>(url: string, body: unknown, method = 'POST') => apiCall<T>(api, request, url, method, body);
  const accountPath = `/api/buoy/accounts/${encodeURIComponent(accountId ?? '')}`;
  const action = fields.action;
  if(path==='/app/reviews') {
    const parse=(value:string)=>{try{return JSON.parse(value)}catch{throw new ApiError('Enter valid follow-up JSON.')}};
    let result:{id:string}|undefined;
    if(action==='review-create')result=await send('/api/buoy/reviews',{name:fields.name,accountId:fields.accountId,kind:fields.kind,start:fields.start,end:fields.end});
    else if(action==='review-edit') {const slides=Object.keys(fields).filter(k=>k.startsWith('title:')).sort((a,b)=>Number(a.slice(6))-Number(b.slice(6))).map(k=>({title:fields[k],commentary:fields['commentary:'+k.slice(6)]??''}));await send('/api/buoy/reviews/'+encodeURIComponent(fields.id),{revision:fields.revision,slides},'PUT');result={id:fields.id};}
    else if(action==='review-approve'){await send('/api/buoy/reviews/'+encodeURIComponent(fields.id)+'/review',{revision:fields.revision,confirmation:fields.confirmation});result={id:fields.id};}
    else if(action==='review-meeting'){await send('/api/buoy/reviews/'+encodeURIComponent(fields.id)+'/meetings',{revision:fields.revision,accountRevision:fields.accountRevision,operationKey:fields.operationKey,heldOn:fields.heldOn,evidence:fields.evidence,followups:parse(fields.followups)});result={id:fields.id};}
    else throw new ApiError('This review action is unavailable.');
    return {redirect:path+'?review='+encodeURIComponent(result!.id),message:'Business review saved.',saved:action};
  }
  if(path==='/app/reports') {
    const parse=(value:string)=>{try{return JSON.parse(value)}catch{throw new ApiError('Enter valid report JSON.')}};
    const split=(value:string)=>(value??'').split(',').map(s=>s.trim()).filter(Boolean);
    if(action==='report-create') {const saved=await send<{id:string}>('/api/buoy/reports',{spec:{name:fields.name,object:'account',rules:parse(fields.rules),segmentId:fields.segmentId||null,groupBy:fields.groupBy,measure:fields.measure,operation:fields.operation,formula:fields.formula||null,chart:fields.chart,sharedRoles:split(fields.sharedRoles)}});return {redirect:path+'?report='+encodeURIComponent(saved.id),message:'Report saved.',saved:'report-create'};}
    if(action==='report-edit'){const saved=await send<{id:string}>('/api/buoy/reports',{id:fields.id,revision:fields.revision,spec:parse(fields.spec)});return {redirect:path+'?report='+encodeURIComponent(saved.id),message:'Report saved.',saved:'report-edit-'+fields.id};}
    if(action==='dashboard-create'){const saved=await send<{id:string}>('/api/buoy/dashboards',{name:fields.name,reportIds:split(fields.reportIds),sharedRoles:split(fields.sharedRoles)});return {redirect:path+'?dashboard='+encodeURIComponent(saved.id),message:'Dashboard saved.',saved:'dashboard-create'};}
    throw new ApiError('This report action is unavailable.');
  }
  if(path==='/app/forecast'){
    if(action==='forecast-override')await send('/api/buoy/renewals/'+encodeURIComponent(fields.renewalId)+'/forecast-override',{revision:fields.revision,category:fields.category,reason:fields.reason});
    else if(action==='forecast-snapshot')await send('/api/buoy/renewals/forecast/snapshots',{});
    else throw new ApiError('Choose a forecast action.');
    const query=new URLSearchParams(fields.returnQuery??'');for(const key of [...query.keys()])if(!['period','start','on','ownerId','teamId','segmentId','snapshotId'].includes(key))query.delete(key);
    return {redirect:'/app/forecast?'+query,message:action==='forecast-override'?'Reasoned forecast override recorded.':'Weekly forecast snapshot retained.'};
  }
  if(path==='/app/billing')return (await import('./billing-actions')).mutateBilling(api,request,fields);
  if(path==='/app/roles')return (await import('./role-actions')).mutateRoles(api,request,fields);
  if(path==='/app/revenue'&&action==='rates'){let rates:unknown;try{rates=JSON.parse(fields.rates)}catch{throw new ApiError('Enter valid JSON for the rate periods.')}await send('/api/buoy/revenue/rates',{revision:fields.revision||null,table:{name:fields.name,mode:fields.mode,rates}});return {redirect:path+'#rate-table-panel',message:'Reporting rates published.',saved:'rate-table-editor'}}
  if(accountId&&action==='plan-save'){
    let objectives:unknown;try{objectives=JSON.parse(fields.objectives)}catch{throw new ApiError('Enter valid JSON for the objectives.')}
    await send(accountPath+'/plans',{...(fields.planId?{id:fields.planId,revision:fields.revision}:{}),accountRevision:fields.accountRevision,name:fields.name,staffOwnerId:fields.staffOwnerId,customerOwnerId:fields.customerOwnerId,objectives});
    return {redirect:path+'#success-plans',message:'Internal success plan saved.',saved:'plan-edit-'+(fields.planId||'new')};
  }
  if(accountId&&action==='play-publish'){
    let config:unknown;try{config=JSON.parse(fields.config)}catch{throw new ApiError('Enter valid JSON for the playbook configuration.')}
    await send('/api/buoy/playbooks',{...(fields.playbookId?{id:fields.playbookId,revision:fields.revision}:{}),config});return {redirect:path+'#playbooks',message:'Playbook version published.',saved:'playbook-edit-'+(fields.playbookId||'new')};
  }
  if(accountId&&action==='play-enroll'){await send('/api/buoy/playbooks/'+encodeURIComponent(fields.playbookId)+'/enroll',{accountId,operationKey:fields.operationKey});return {redirect:path+'#playbooks',message:'Playbook enrollment recorded.'}}
  if(accountId&&action==='play-outcome'){await send('/api/buoy/outcomes',{name:fields.name,segmentId:fields.segmentId,kind:fields.kind,windowDays:Number(fields.windowDays),runIds:[fields.runId],operationKey:fields.operationKey});return {redirect:'/app/outcomes',message:'Run outcome tracking started.',saved:'play-outcome-'+fields.runId}}
  if(accountId&&action==='play-action'){await send('/api/buoy/playbook-runs/'+encodeURIComponent(fields.runId)+'/action',{revision:fields.revision,action:fields.runAction,...(fields.reference?{reference:fields.reference}:{}),...(fields.outcome?{outcome:fields.outcome}:{}),...(fields.ownerId?{ownerId:fields.ownerId}:{})});return {redirect:path+'#playbooks',message:'Run action recorded.',saved:'play-run-'+fields.runId}}
  if(accountId&&action==='account-hierarchy'){
    const selected=new Map<string,string[]>();for(const [key,value]of Object.entries(fields))if(key.startsWith('stakeholder:')&&value==='on'){const [,personId,role]=key.split(':');selected.set(personId,[...(selected.get(personId)??[]),role]);}
    await send(accountPath+'/hierarchy',{revision:fields.revision,parentId:fields.parentId||null,kind:fields.kind,accountExecutiveId:fields.accountExecutiveId||null,executiveSponsorId:fields.executiveSponsorId||null,supportOwnerId:fields.supportOwnerId||null,stakeholders:[...selected].map(([personId,roles])=>({personId,roles})),source:fields.source},'PUT');return {redirect:path+'#account-hierarchy',message:'Organization and stakeholder roles saved.',saved:'account-hierarchy-form'};
  }
  if(accountId&&action==='account-scorecard'){await send(accountPath+'/scorecard',{revision:fields.revision,versionId:fields.versionId||null},'PUT');return {redirect:path+'#health-scorecard',message:'Record scorecard saved.',saved:'account-scorecard'}}
  if(accountId&&action==='survey-response'){await send('/api/buoy/surveys/responses',surveyForm(fields,accountId));return {redirect:path+'#surveys',message:'Received survey response recorded.'}}
  if(accountId&&action==='revenue-reconcile'){await send(accountPath+'/revenue-reconciliation',revenueReconciliationForm(fields));return {redirect:path+'#revenue-reconciliation',message:'Revenue mismatch resolved; both sources retained.'}}
  if(accountId&&action==='contract'){await send(accountPath+'/contract',contractForm(fields));return {redirect:path+'#revenue',message:'Recurring contract confirmed.'}}
  if(path==='/app'&&action==='scorecard'){
    const config=scorecardFormConfig(fields);
    if(fields.scorecardIntent==='preview')return {scorecardPreview:await send<ScorecardPreview>('/api/buoy/scorecards/preview',{config})};
    if(fields.scorecardIntent!=='publish')throw new ApiError('Choose preview or publish.');
    await send('/api/buoy/scorecards/publish',{revision:fields.revision||null,config});
    return {redirect:'/app#health-scorecard',message:'Scorecard published.'};
  }
  if(path==='/app'&&action==='scorecard-history-preview')return {scorecardPreview:await send<ScorecardPreview>('/api/buoy/scorecards/preview',{versionId:fields.versionId,...(fields.historyId?{historyId:fields.historyId}:{})})};
  if(path==='/app/workspace'){
    const parse=(text:string)=>{try{return JSON.parse(text)}catch{throw new ApiError('Enter valid JSON for the workspace configuration.')}};
    if(action==='workspace-view'){
      const view={name:fields.name,kind:fields.kind,shared:fields.shared==='on',rules:parse(fields.rules),columns:fields.columns.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),sort:{field:fields.sortField,direction:fields.direction}};
      if(fields.intent==='preview')return {workspaceListPreview:await send<WorkspaceListPreview>('/api/buoy/workspace/lists/preview',view)};
      if(fields.intent!=='save')throw new ApiError('Choose preview or save.');
      const saved=await send<{id:string}>('/api/buoy/workspace/views',{view,...(fields.viewId?{id:fields.viewId,revision:fields.revision}:{})});return {redirect:path+'?view='+encodeURIComponent(saved.id),message:'View saved.',saved:'workspace-view'};
    }
    if(action==='workspace-view-delete'){await send('/api/buoy/workspace/views/'+encodeURIComponent(fields.viewId),{revision:fields.revision},'DELETE');return {redirect:path,message:'Saved view deleted.'}}
    if(action==='workspace-bulk-preview'){
      const input={operationKey:fields.operationKey,kind:fields.kind,recordIds:Object.keys(fields).filter(k=>k.startsWith('record:')&&fields[k]==='on').map(k=>k.slice(7)),action:fields.bulkAction,...(fields.bulkAction==='assign'?{ownerId:fields.ownerId,note:fields.note}:fields.bulkAction==='enroll'?(fields.playbookId?{playbookId:fields.playbookId}:{title:fields.title,dueDate:fields.dueDate}):fields.bulkAction==='segment'?{segmentId:fields.segmentId}:{})};return {workspaceBulkPreview:await send<WorkspaceBulkPreview>('/api/buoy/workspace/bulk/preview',input)};
    }
    if(action==='workspace-bulk-apply'){await send('/api/buoy/workspace/bulk/apply',{...parse(fields.input),fingerprint:fields.fingerprint});return {redirect:path,message:'Reviewed bulk change applied.',saved:'workspace-selection'}}
    throw new ApiError('This workspace action is unavailable.');
  }
  if(path==='/app/renewals'){
    const record='/api/buoy/renewals/'+encodeURIComponent(fields.renewalId??'');
    const target=path+(fields.renewalId?'?renewal='+encodeURIComponent(fields.renewalId):'');
    if(action==='renewal-settings'){await send('/api/buoy/renewals/settings',{revision:fields.revision,leadDays:Number(fields.leadDays),stages:fields.stages.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)},'PUT');return {redirect:path,message:'Renewal configuration saved.',saved:'renewal-settings'}}
    if(action==='renewal-edit'){await send(record,{revision:fields.revision,stage:fields.stage,forecast:fields.forecast,ownerId:fields.ownerId||null,riskReasons:fields.riskReasons.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)},'PUT');return {redirect:target,message:'Renewal pipeline saved.',saved:'renewal-edit'}}
    if(action==='renewal-outcome'){await send('/api/buoy/proposals',{accountId:fields.accountId,kind:'renewal',payload:{renewalId:fields.renewalId,outcome:fields.outcome,resultArrMinor:Number(fields.resultArrMinor),reason:fields.reason,evidence:fields.evidence}});return {redirect:target,message:'Renewal outcome prepared.',saved:'renewal-outcome'}}
    if(action==='renewal-approve'){await send('/api/buoy/proposals/'+encodeURIComponent(fields.proposalId)+'/approve',{});return {redirect:target,message:'Renewal outcome approved.'}}
    if(action==='renewal-field'){
      let definition:unknown;try{definition=JSON.parse(fields.definition)}catch{throw new ApiError('Enter a valid JSON field definition.')}
      if(fields.intent==='preview')return {renewalFieldPreview:await send<RenewalPreview>('/api/buoy/renewal-fields/preview',definition)};
      if(fields.intent!=='save')throw new ApiError('Choose preview or save.');
      await send('/api/buoy/renewal-fields',definition);return {redirect:target,message:'Renewal field saved.',saved:'renewal-field'};
    }
    if(action==='renewal-values'){let values:unknown;try{values=JSON.parse(fields.values)}catch{throw new ApiError('Enter valid JSON renewal values.')}await send(record+'/fields',{revision:fields.revision,values,source:fields.source},'PUT');return {redirect:target,message:'Renewal field values saved.',saved:'renewal-values'}}
    throw new ApiError('This renewal action is unavailable.');
  }
  if(path==='/app/inapp')return mutateInapp(api,request,fields);
  if(path==='/app/connections'){
    if(action==='connection-add')await send('/api/buoy/connections',{name:fields.name,key:fields.key});
    else if(action==='connection-key')await send('/api/buoy/connections/'+encodeURIComponent(fields.id)+'/credential',{key:fields.key},'PUT');
    else if(action==='connection-sync')await send('/api/buoy/connections/'+encodeURIComponent(fields.id)+'/sync',{});
    else if(action==='connection-disconnect')await send('/api/buoy/connections/'+encodeURIComponent(fields.id),{},'DELETE');
    else throw new ApiError('This connection action is not available.');
    return {redirect:path,message:action==='connection-sync'?'Sync attempt recorded. Check its result below.':'Connection updated.'};
  }
  if(path==='/app/adoption') {
    if(action==='adoption-definition')await send('/api/buoy/adoption/definitions',{kind:fields.kind,key:fields.key,name:fields.name,events:fields.events.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)});
    else if(action==='adoption-person-license'){
      if(!['','true','false'].includes(fields.licensed))throw new ApiError('Choose a recorded individual license status.');
      await send('/api/buoy/adoption/person-licenses',{accountId:fields.licenseAccountId,personId:fields.licensePersonId,licensed:fields.licensed===''?null:fields.licensed==='true',...(fields.licensed!==''?{reference:fields.licenseReference,observedAt:fields.licenseObservedAt,staleDays:Number(fields.licenseStaleDays)}:{})},'PUT');
    }
    else if(action==='adoption-consumer'){
      if(![fields.consumerHealth,fields.consumerAlert,fields.consumerEnabled].every(v=>['true','false'].includes(v)))throw new ApiError('Choose measure effects and enabled status.');
      await send('/api/buoy/adoption/consumers',{...(fields.consumerId?{id:fields.consumerId,revision:fields.revision}:{}),name:fields.consumerName,scope:fields.consumerScope,...(fields.consumerScope==='segment'?{segmentId:fields.consumerSegment}:{}),metric:fields.consumerMetric,op:fields.consumerOp,value:fields.consumerValue===''?null:Number(fields.consumerValue),health:fields.consumerHealth==='true',alert:fields.consumerAlert==='true',enabled:fields.consumerEnabled==='true'});
    }
    else if(action==='adoption-seats')await send('/api/buoy/adoption/seats',{accountId:fields.accountId,seats:fields.seats===''?null:Number(fields.seats),...(fields.seats!==''?{reference:fields.reference,observedAt:fields.observedAt,staleDays:Number(fields.staleDays)}:{})},'PUT');
    else throw new ApiError('This adoption action is not available.');
    return {redirect:path,message:'Adoption configuration saved.',saved:action==='adoption-consumer'?(fields.consumerId?'adoption-consumer-form-'+fields.consumerId:'adoption-consumer-new'):action};
  }
  if(path==='/app/customer-people'&&['privacy-holders','privacy-export','privacy-erase','privacy-preview','privacy-hold'].includes(action)){
    const base='/api/buoy/customer-people/'+encodeURIComponent(fields.personId)+'/privacy/';
    if(action==='privacy-holders'){
      let holders:unknown;try{holders=JSON.parse(fields.holders)}catch{throw new ApiError('Enter a valid JSON array of external holders.')}
      await send(base+'holders',{revision:fields.revision,holders},'PUT');
      return {redirect:path+'?person='+encodeURIComponent(fields.personId),message:'External holders recorded.'};
    }
    if(action==='privacy-hold'){
      await send(base+'hold',{revision:fields.revision,confirmation:fields.confirmation,operation:fields.operation,reason:fields.reason});
      return {redirect:path+'?person='+encodeURIComponent(fields.personId),message:'Customer hold '+(fields.operation==='release'?'released':'set')+'.'};
    }
    const emails=(fields.emails??'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    if(action==='privacy-preview')return {privacyPreview:await send<PrivacyPreview>(base+'preview',{revision:fields.revision,emails})};
    const result=await send<{receipt:PrivacyReceipt}>(base+(action==='privacy-export'?'export':'erase'),{revision:fields.revision,confirmation:fields.confirmation,request:{verificationMethod:fields.verificationMethod,receivedDate:fields.receivedDate,requesterReference:fields.requesterReference},...(action==='privacy-erase'?{emails,fingerprint:fields.fingerprint,redactions:Object.keys(fields).filter(k=>k.startsWith('redact:')&&fields[k]==='on').map(k=>k.slice(7))}:{})});
    return action==='privacy-export'?{privacyExport:result}:{redirect:path+'#privacy-receipts',message:result.receipt.outcome==='held'?'Customer retained under hold. Review the receipt.':'Customer erased. Review the privacy receipt.'};
  }
  if(path==='/app/customer-people')return mutateCustomerPeople(api,request,fields);
  if(path==='/app/usage')return mutateUsage(api,request,fields);
  if(path==='/app/fields') {
    const parse=(value:string)=>{try{return JSON.parse(value)}catch{throw new ApiError('Enter valid JSON.')}};
    if(action==='field-preview')return {fieldPreview:await send('/api/buoy/fields/preview',parse(fields.definition))};
    if(action==='field-definition'){
      await send('/api/buoy/fields',{key:fields.key,label:fields.label,type:fields.type,...(['picklist','multi-select'].includes(fields.type)?{options:fields.options.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)}:{}),...(fields.type==='formula'?{formula:fields.formula}:{})});
      return {redirect:path,message:'Field saved.',saved:'field-definition'};
    }
    if(action==='field-values'){
      await send(`/api/buoy/accounts/${encodeURIComponent(fields.accountId)}/fields`,{values:parse(fields.values),revision:fields.revision,source:fields.source},'PUT');
      return {redirect:`${path}?account=${encodeURIComponent(fields.accountId)}`,message:'Field values saved.',saved:`field-values-${fields.accountId}`};
    }
  }
  if(path==='/app/audit') {
    if(action==='trust-scan'){await send('/api/buoy/trust/scan',{});return {redirect:path+'#data-trust',message:'Data trust findings prepared for review.'};}
    if(action==='trust-mapping'){await send('/api/buoy/trust/mappings',{sourceId:fields.sourceId,userId:fields.userId||null,groupId:fields.groupId,personId:fields.personId||null,accountId:fields.accountId,reason:fields.reason});return {redirect:path+'#data-trust',message:'Group correction prepared; mapping unchanged until approval.'};}
    if(action==='trust-review'){await send('/api/buoy/trust/'+encodeURIComponent(fields.id)+'/review',{decision:fields.decision,reason:fields.reason,...(fields.ownerId?{ownerId:fields.ownerId,dueDate:fields.dueDate}:{})});return {redirect:path+'#data-trust',message:'Data trust decision recorded.'};}
    if(action==='agent-issue') {
      const scopes=[['scopeList','renewals.list'],['scopePlaybook','playbook.prepare'],['scopeRenewal','renewal.prepare']].filter(([name])=>fields[name]==='on').map(([,value])=>value);
      const dataClasses=[['classAccount','account'],['classBilling','billing'],['classSupport','support'],['classSentiment','sentiment']].filter(([name])=>fields[name]==='on').map(([,value])=>value);
      return {agentCredential:await send<AgentCredential>('/api/buoy/agent-tokens',{label:fields.label,scopes,dataClasses,expiresDays:Number(fields.expiresDays),requestsPerMinute:Number(fields.requestsPerMinute),budgetMinor:Number(fields.budgetMinor)})};
    }
    if(action==='agent-switch'){await send('/api/buoy/agents/settings',{disabled:fields.disabled==='on'},'PUT');return {redirect:path,message:'Agent switch saved.',saved:action};}
    if(action==='agent-revoke'){await send(`/api/buoy/agent-tokens/${encodeURIComponent(fields.id)}`,{},'DELETE');return {redirect:path,message:'Agent credential revoked.'};}
  }
  if(path==='/app/outcomes'&&action==='outcome-start'){
    await send('/api/buoy/outcomes',{name:fields.name,segmentId:fields.segmentId,kind:fields.kind,windowDays:Number(fields.windowDays),taskIds:fields.taskIds.split(',').map(s=>s.trim()).filter(Boolean),operationKey:fields.operationKey});
    return {redirect:path,message:'Outcome tracking started.',saved:'outcome-start-form'};
  }
  if (path === '/app/segments') {
    if(action==='segment-tiers'){await send('/api/buoy/segments/tiers',{tiers:fields.tiers.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)},'PUT');return {redirect:path,message:'Tier names saved.',saved:action}}
    if(action==='segment-save') {
      let conditions:unknown;try{conditions=JSON.parse(fields.conditions)}catch{throw new ApiError('Enter a valid JSON array of rule conditions.')}
      await send('/api/buoy/segments',{...(fields.segmentId?{id:fields.segmentId,revision:fields.revision}:{}),name:fields.name,mode:fields.mode,rules:{match:fields.match,conditions},accountIds:fields.accountIds.split(',').map(s=>s.trim()).filter(Boolean),tier:fields.tier||null,stage:fields.stage||null,playbook:fields.playbookTitle?{title:fields.playbookTitle,dueDays:Number(fields.dueDays)}:null});
      return {redirect:path,message:'Segment saved.',saved:fields.segmentId?`segment-edit-${fields.segmentId}`:'segment-create'};
    }
    if(action==='segment-classify') {
      await send(`/api/buoy/accounts/${encodeURIComponent(fields.accountId)}/classification`,{tier:fields.tier||null,stage:fields.stage||null},'PUT');
      return {redirect:path,message:'Account classification saved.',saved:action};
    }
  }
  if (path === '/app/team') return mutateTeam(api,request,fields);
  if (path === '/app/notifications') {
    if (action === 'notification-dismiss') {
      await send(`/api/buoy/notifications/${encodeURIComponent(fields.noticeId)}/dismiss`, {reason:fields.reason,until:fields.until});
      return {redirect:path,message:'Signal dismissed until your chosen UTC instant.',saved:'dismiss-'+fields.noticeId};
    }
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
      await send(`${accountPath}/owner`, { ownerId: fields.ownerId, ...(fields.note ? {note:fields.note} : {}) }, 'PUT');
      return { redirect: path, message: 'Account owner saved. Open tasks moved to them.', saved: 'account-owner' };
    }
    if (action === 'delete') {
      await send(accountPath, { confirmation: fields.confirmation }, 'DELETE');
      return { redirect: '/app', message: 'Account deleted.', saved: 'delete' };
    }
  }
  if (path === '/app/imports') {
    if (action === 'import-undo') {
      const job = await send<Job>(`/api/buoy/imports/${encodeURIComponent(fields.id)}/undo`, {});
      return { redirect: path, message: job.state === 'undone' ? 'Import undone.' : 'Undo request recorded. Check its current state in the journal below.', saved: `undo-${fields.id}` };
    }
  }
  throw new ApiError('This form action is not available on this page.', 400);
}
