import {apiCall, ApiError, type MutationResult} from './actions';
import type {Api, Fields} from './types';
import type {UsageCredential} from './usage';

export async function mutateUsage(api:Api, request:Request, fields:Fields):Promise<MutationResult> {
 const send=<T>(path:string,body:unknown,method='POST')=>apiCall<T>(api,request,'/api/buoy/usage'+path,method,body);
 if(fields.action==='usage-map-preview'||fields.action==='usage-map-approve'){
  const input={sourceId:fields.sourceId,userId:fields.userId||null,groupId:fields.groupId||null,accountId:fields.accountId,personId:fields.personId||null,...(fields.fingerprint?{fingerprint:fields.fingerprint}:{})};
  if(fields.action==='usage-map-preview')return {usageMappingPreview:await send('/mappings/preview',input)};
  await send('/mappings',input);return {redirect:'/app/usage',message:'Exact identity mapping approved.'};
 }
 const source='/sources/'+encodeURIComponent(fields.sourceId??'');
 const action=fields.action;
 if(action==='usage-source'){
  await send(fields.sourceId?source:'/sources',{name:fields.name,kind:fields.kind,reference:fields.reference,staleDays:Number(fields.staleDays)},fields.sourceId?'PUT':'POST');
  return {redirect:'/app/usage',message:'Usage source saved.',saved:action};
 }
 if(action==='usage-credential')return {usageCredential:await send<UsageCredential>(source+'/credentials',{label:fields.label,scope:['track','identify','group','event'].filter(type=>fields['scope_'+type]==='on')})};
 if(action==='usage-revoke'){
  await send('/credentials/'+encodeURIComponent(fields.id),{},'DELETE');
  return {redirect:'/app/usage',message:'Ingestion credential revoked.'};
 }
 throw new ApiError('This usage action is not supported.');
}
