import {button,disclosure,field,form,hidden,pathId,textarea,valueOf} from './html'
import type {Fields} from './types'

export interface ScopedEditableAccount {id:string;name:string;renewalDate:string;revision:string;noticeDays?:number}
/** Accept a safe projected account only; source evidence is a new explicit
 * entry, never an existing hidden value copied into the form or its draft. */
export function scopedAccountEditForm(account:ScopedEditableAccount,fields?:Fields){
 const draft=fields?.action==='scoped-account-edit'?fields:undefined,v=(key:string,initial:unknown='')=>valueOf(draft,key,initial)
 return disclosure('Edit account details','Update this account within your current edit authority.',form('scoped-account-edit','/app/accounts/'+pathId(account.id),
  hidden('action','scoped-account-edit')+hidden('revision',v('revision',account.revision))+
  field('name','Account name',v('name',account.name),'text',true,'maxlength="200"')+
  field('renewalDate','Renewal date',v('renewalDate',account.renewalDate),'date')+
  field('noticeDays','Notice period (days)',v('noticeDays',account.noticeDays??''),'number',true,'min="0" max="3650" step="1"')+
  textarea('renewalEvidence','New renewal evidence',v('renewalEvidence'),true,'maxlength="500"')+
  '<p>Enter the notice period and a confirmation source explicitly. Source evidence that is outside your field access is not prefilled.</p>'+button('Save account details')),
  'scoped-account-edit-panel',!!draft)
}
