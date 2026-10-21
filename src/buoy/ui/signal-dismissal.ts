import {button,escape,field,form,hidden,textarea} from './html'
import type {Fields} from './types'

export type SignalDismissal = {reason:string;until:string;createdAt:string}
export function signalDismissal(item:{id:string;adoptionRuleId?:string|null;dismissal?:SignalDismissal|null},fields?:Fields){
 if(!item.adoptionRuleId)return ''
 const editing=fields?.action==='notification-dismiss'&&fields.id===item.id
 const retained=item.dismissal?`<p><strong>${Date.parse(item.dismissal.until)>Date.now()?'Dismissed':'Dismissal expired'}</strong> · Until ${escape(item.dismissal.until)} UTC</p><p>${escape(item.dismissal.reason)}</p>`:''
 return retained+`<details${editing?' open':''}><summary>Dismiss this adoption signal</summary><p>Keep this evidence and suppress new alerts for this rule, account and your inbox until the stated UTC instant. Other recipients and health calculations continue. Pending email is withdrawn; mail already attempted cannot be recalled.</p>`
  +form('dismiss-'+item.id,'/app/notifications',hidden('action','notification-dismiss')+hidden('id',item.id)+textarea('reason','Dismissal reason',editing?fields.reason:'',true,'maxlength="1000"')+field('until','Dismiss until (ISO UTC)',editing?fields.until:'','text',true,'placeholder="2026-10-23T09:00:00.000Z"')+button('Dismiss signal'))+'</details>'
}
