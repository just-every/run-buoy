import {apiCall,ApiError} from './actions'
import type {BindingPreview} from '../billing'
import type {Api,Fields} from './types'
export async function mutateBilling(api:Api,request:Request,fields:Fields){
 const path='/api/buoy/billing/'+encodeURIComponent(fields.connectionId??'')
 const send=<T>(target:string,body:unknown,method='POST')=>apiCall<T>(api,request,target,method,body)
 if(fields.action==='billing-bind-preview')return {billingPreview:await send<BindingPreview>(path+'/bindings/preview',{customerId:fields.customerId,accountId:fields.accountId})}
 if(fields.action==='billing-bind')await send(path+'/bindings',{token:fields.token})
 else if(fields.action==='billing-unbind')await send('/api/buoy/billing/bindings/'+encodeURIComponent(fields.bindingId),{revision:fields.revision},'DELETE')
 else if(fields.action==='billing-settings')await send(path+'/settings',{staleDays:Number(fields.staleDays)},'PUT')
 else if(fields.action==='billing-webhook')await send(path+'/webhook-secret',{secret:fields.secret},'PUT')
 else if(fields.action==='billing-sync')await send(path+'/sync',{})
 else throw new ApiError('Choose a Stripe billing action.')
 return {redirect:'/app/billing',message:'Stripe billing updated. Review its source status.'}
}
