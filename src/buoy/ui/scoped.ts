import type {ProjectedState} from '../roles'
import {ApiError,apiCall} from './actions'
import {section} from './html'
import {scopedAccountsPage} from './roles'
import {searchPage,type SearchPage} from './search'
import {shell} from './shell'
import type {Api} from './types'

export async function scopedPage(request:Request,api:Api,state:ProjectedState){
 const url=new URL(request.url),path=url.pathname
 let title='Accounts',status=200,body:string
 if(!['GET','HEAD'].includes(request.method)){
  status=403;body=section('Action unavailable','<p>This action is not available to your assigned profile.</p>')
 }else if(path==='/app/search'){
  title='Search'
  try{body=searchPage(url.searchParams,url.searchParams.has('q')?await apiCall<SearchPage>(api,request,'/api/buoy/search?'+url.searchParams):undefined)}
  catch(error){status=error instanceof ApiError?error.status:503;body=searchPage(url.searchParams,undefined,error instanceof Error?error.message:'Search is unavailable. Try again.')}
 }else if(path==='/app')body=scopedAccountsPage(state)
 else if(/^\/app\/accounts\/[^/]+$/.test(path)){
  let accountId='';try{accountId=decodeURIComponent(path.slice('/app/accounts/'.length))}catch{}
  const account=state.accounts.find(a=>a.id===accountId);title=account?.name??'Account unavailable';status=account?200:404;body=scopedAccountsPage(state,accountId)
 }else{status=403;title='Access unavailable';body=section(title,'<p>This page is not available to your assigned profile.</p><p><a href="/app">Open accounts in your scope</a></p>')}
 const response=await shell({title,body,state,current:path==='/app/search'?path:'/app',status,backToAccounts:path.startsWith('/app/accounts/')})
 return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response
}
