import {insist,stmt,type Actor} from '../core'
import {commercialFor,readableIds,roleAccess,roleFence,scopeFence,scopeImage} from '../roles/access'
import {mayEditScopedAccount} from '../roles/account-edit'

// Plan prose and retained review commentary may contain commercial details.
// Require the complete field class rather than attempting to redact free text.
export async function planAccess(db:D1Database,actor:Actor,accountId:string,write=false){
 const role=await roleAccess(db,actor),image=await scopeImage(db)
 insist(role.restricted||['owner','admin'].includes(actor.role),'A permitted staff profile is required.',403)
 const account=image.value.accounts.find(a=>a.id===accountId)
 insist(account,'Account not found.',404)
 insist(!role.stale&&readableIds(image.value,actor,role).includes(accountId)&&commercialFor(role,actor,account.ownerId)==='full','This plan is outside your current account or field authority.',403)
 const canEdit=role.restricted?mayEditScopedAccount(image.value,actor,role,accountId):['owner','admin'].includes(actor.role)
 insist(!write||canEdit,'Your current profile cannot edit this plan.',403)
 // Customers remain separate even when called without the HTTP dispatcher.
 insist(!await stmt(db,'SELECT 1 FROM buoy_portal_recipients WHERE operator_id=?',actor.id).first(),'Customer access uses the portal.',403)
 return {role,image,canEdit,fences:()=>[roleFence(db,actor,role),scopeFence(db,image)]}
}
