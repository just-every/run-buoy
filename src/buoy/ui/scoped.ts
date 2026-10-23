import {reportsPage,type ReportsPage,type ReportResult} from './reports'
import {forecastPage,type ForecastPage} from './forecast'
import {mutate} from './actions'
import {scopedRenewalApprovalPage} from './scoped-renewal-approval'
import type {ScopedRenewalApprovals} from '../roles/renewal-approval'
import {scopedReportsPage} from './scoped-reports'
import type {ScopedRetentionReport} from '../roles/reports'
import type {ScopedWorkspaceHome} from '../roles/workspace'
import {scopedWorkspacePage} from './scoped-workspace'
import type {ProjectedState} from '../roles'
import {ApiError,apiCall} from './actions'
import {section} from './html'
import type {Fields} from './types'
import {scopedAccountsPage} from './roles'
import {searchPage,type SearchPage} from './search'
import {shell} from './shell'
import type {Api} from './types'

export async function scopedPage(request:Request,api:Api,state:ProjectedState){
 const url=new URL(request.url),path=url.pathname
 let title='Accounts',status=200,body:string,error:string|undefined,fields:Fields|undefined
 let accountId='';try{if(/^\/app\/accounts\/[^/]+$/.test(path))accountId=decodeURIComponent(path.slice('/app/accounts/'.length))}catch{}
 const selected=state.accounts.find(a=>a.id===accountId)
 if(request.method==='POST'&&path==='/app/forecast'){
  try{fields=Object.fromEntries([...await request.formData()].map(([key,value])=>[key,typeof value==='string'?value:'']));const result=await mutate(api,request,path,fields);if(result.redirect)return new Response(null,{status:303,headers:{location:result.redirect,'cache-control':'no-store'}})}catch(caught){status=caught instanceof ApiError?caught.status:503;error=caught instanceof Error?caught.message:'Forecast override could not be recorded.'}
 }
 if(request.method==='POST'&&path==='/app/approvals'){
  try{
   if(request.headers.get('origin')!==url.origin)throw new ApiError('Submit this form from this installation.',403)
   fields=Object.fromEntries([...await request.formData()].map(([key,value])=>[key,typeof value==='string'?value:'']))
   if(fields.action!=='scoped-renewal-approve'||!fields.proposalId)throw new ApiError('This approval action is unavailable.',403)
   await apiCall(api,request,'/api/buoy/proposals/'+encodeURIComponent(fields.proposalId)+'/approve','POST',{revision:fields.revision,sourceRevision:fields.sourceRevision||null})
   return new Response(null,{status:303,headers:{location:'/app/approvals?recorded=1#scoped-renewal-approvals','cache-control':'no-store'}})
  }catch(caught){status=caught instanceof ApiError?caught.status:503;error=caught instanceof Error?caught.message:'The renewal outcome could not be approved.'}
 }
 if(request.method==='POST'&&selected?.canEdit){
  try{
   if(request.headers.get('origin')!==url.origin)throw new ApiError('Submit this form from this installation.',403)
   fields=Object.fromEntries([...await request.formData()].map(([key,value])=>[key,typeof value==='string'?value:'']))
   if(fields.action!=='scoped-account-edit')throw new ApiError('This action is unavailable.',403)
   await apiCall(api,request,'/api/buoy/accounts/'+encodeURIComponent(accountId),'PATCH',{revision:fields.revision,name:fields.name,renewalDate:fields.renewalDate,noticeDays:fields.noticeDays?Number(fields.noticeDays):null,renewalEvidence:fields.renewalEvidence})
   return new Response(null,{status:303,headers:{location:path+'?saved='+encodeURIComponent(path+'|scoped-account-edit')+'#scoped-account','cache-control':'no-store'}})
  }catch(caught){status=caught instanceof ApiError?caught.status:503;error=caught instanceof Error?caught.message:'The account could not be changed.'}
 }
 if(path==='/app/reports'&&['GET','HEAD'].includes(request.method)){title='Reports and dashboards';try{const data=await apiCall<ReportsPage>(api,request,'/api/buoy/reports'),selected=data.dashboards.find(d=>d.id===url.searchParams.get('dashboard')),ids=selected?selected.reportIds:url.searchParams.get('report')?[url.searchParams.get('report')!]:[];const results:ReportResult[]=[];for(const id of ids)results.push(await apiCall<ReportResult>(api,request,'/api/buoy/reports/'+encodeURIComponent(id)));body=reportsPage(data,results)}catch(caught){status=caught instanceof ApiError?caught.status:503;body=section('Reports unavailable','<p>Your current profile cannot read this report selection.</p>')}}else if(path==='/app/forecast'){title='Renewal forecast';const query=fields?.returnQuery?new URLSearchParams(fields.returnQuery):url.searchParams;try{body=forecastPage(query,await apiCall<ForecastPage>(api,request,'/api/buoy/renewals/forecast?'+query),fields)}catch(caught){status=caught instanceof ApiError?caught.status:503;body=section('Forecast unavailable','<p>Your current profile cannot read this selection.</p>')}}else if(path==='/app/approvals'&&(['GET','HEAD'].includes(request.method)||fields?.action==='scoped-renewal-approve')){
  title='Renewal reviews'
  try{body=scopedRenewalApprovalPage(await apiCall<ScopedRenewalApprovals>(api,request,'/api/buoy/renewals/approvals'),fields)}
  catch(caught){status=caught instanceof ApiError?caught.status:503;body=section('Review unavailable','<p>Your current profile cannot review renewal decisions.</p>')}
 }else if(request.method==='POST'&&selected?.canEdit){title=selected.name;body=scopedAccountsPage(state,accountId,fields)}else if(!['GET','HEAD'].includes(request.method)){
  status=403;body=section('Action unavailable','<p>This action is not available to your assigned profile.</p>')
 }else if(path==='/app/revenue'){
  title='Retention'
  try{body=scopedReportsPage(url.searchParams,await apiCall<ScopedRetentionReport>(api,request,'/api/buoy/revenue/retention?'+url.searchParams))}
  catch(caught){status=caught instanceof ApiError?caught.status:503;body=scopedReportsPage(url.searchParams,undefined,caught instanceof Error?caught.message:'The report is unavailable.')}
 }else if(path==='/app/workspace'){
  title='Your workspace'
  try{body=scopedWorkspacePage(await apiCall<ScopedWorkspaceHome>(api,request,'/api/buoy/workspace/home'+(url.searchParams.has('person')?'?person='+encodeURIComponent(url.searchParams.get('person')!):'')))}
  catch(error){status=error instanceof ApiError?error.status:503;body=section('Workspace unavailable','<p>Your current profile cannot open this home.</p><p><a href="/app/workspace">Open your own workspace</a></p>')}
 }else if(path==='/app/search'){
  title='Search'
  try{body=searchPage(url.searchParams,url.searchParams.has('q')?await apiCall<SearchPage>(api,request,'/api/buoy/search?'+url.searchParams):undefined,undefined,true)}
  catch(error){status=error instanceof ApiError?error.status:503;body=searchPage(url.searchParams,undefined,error instanceof Error?error.message:'Search is unavailable. Try again.',true)}
 }else if(path==='/app')body=scopedAccountsPage(state)
 else if(/^\/app\/accounts\/[^/]+$/.test(path)){
  const account=state.accounts.find(a=>a.id===accountId);title=account?.name??'Account unavailable';status=account?200:404;body=scopedAccountsPage(state,accountId)
 }else{status=403;title='Access unavailable';body=section(title,'<p>This page is not available to your assigned profile.</p><p><a href="/app">Open accounts in your scope</a></p>')}
 const response=await shell({title,body,state,current:['/app/search','/app/workspace','/app/revenue','/app/approvals','/app/forecast'].includes(path)?path:'/app',status,error,success:path==='/app/approvals'&&url.searchParams.get('recorded')==='1'?'Renewal outcome recorded.':undefined,backToAccounts:path.startsWith('/app/accounts/')})
 return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response
}
