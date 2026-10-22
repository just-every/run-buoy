import {apiCall,ApiError} from './actions'
import type {Api,Fields} from './types'

export async function mutateRoles(api:Api,request:Request,fields:Fields){
 const send=(path:string,body:unknown,method='POST')=>apiCall(api,request,'/api/buoy/roles'+path,method,body)
 const scope={kind:fields.scopeKind,...(fields.scopeKind==='segment'?{segmentId:fields.segmentId}:{})}
 if(fields.action==='role-assign')await send('/assignments',{revision:fields.revision,personId:fields.personId,roleId:fields.roleId,scope,commercial:fields.commercial,sharedAccountIds:Object.keys(fields).filter(k=>k.startsWith('share:')&&fields[k]==='on').map(k=>k.slice(6)),grants:{concessionLimitMinor:fields.concessionLimitMinor===''?null:Number(fields.concessionLimitMinor),renewalOutcome:fields.renewalOutcome==='on'}},'PUT')
 else if(fields.action==='role-define')await send('/definitions',{revision:fields.revision,name:fields.roleName,scope,commercial:fields.commercial,permissions:{...Object.fromEntries(Object.entries(fields).filter(([key])=>key.startsWith('permission:')).map(([key,value])=>[key.slice(11),value])),erase:'none'}})
 else if(fields.action==='role-remove')await send('/assignments/'+encodeURIComponent(fields.personId),{revision:fields.revision},'DELETE')
 else throw new ApiError('Choose a role configuration action.')
 return {redirect:'/app/roles',saved:fields.action==='role-assign'?'role-assignment':fields.action==='role-define'?'role-definition':undefined,message:'Role configuration saved.'}
}
