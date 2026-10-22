import {canonicalJson} from '../../modules/import-kit/src/d1/index.ts'
import {accountAudit} from '../audit-records'
import {guard,id,insist,stmt,text,type Actor} from '../core'
import {parseAccounts} from '../imports/validation'
import {readableIds,roleAccess,roleFence,scopeFence,scopeImage,type RoleAccess} from './access'

const EDITABLE=['name','renewalDate','noticeDays','renewalEvidence'] as const
type EditField=typeof EDITABLE[number]
type ScopeImage=Awaited<ReturnType<typeof scopeImage>>
export function mayEditScopedAccount(image:ScopeImage['value'],actor:Actor,access:RoleAccess,accountId:string){
 if(!access.restricted||access.stale||!readableIds(image,actor,access).includes(accountId))return false
 const account=image.accounts.find(row=>row.id===accountId)!
 if(access.permissions.edit==='all')return true
 if(access.permissions.edit==='own')return account.ownerId===actor.id
 return access.permissions.edit==='team'&&image.people.some(person=>person.id===account.ownerId&&person.status==='active'&&person.managerId===actor.id)
}
/** UI affordance only. The operation repeats this check and fences the effect. */
export async function canEditScopedAccount(db:D1Database,actor:Actor,accountId:string,provided?:RoleAccess){
 const access=provided??await roleAccess(db,actor),image=await scopeImage(db)
 return mayEditScopedAccount(image.value,actor,access,accountId)
}
/** PATCH only the named native noncommercial fields. No native role is borrowed,
 * and unsubmitted snapshots/fields are copied from the real stored record. */
export async function editScopedAccount(db:D1Database,actor:Actor,accountId:string,input:Record<string,unknown>,provided?:RoleAccess){
 const access=provided??await roleAccess(db,actor),image=await scopeImage(db)
 insist(mayEditScopedAccount(image.value,actor,access,accountId),'This account is outside your current edit authority.',403)
 insist(Object.keys(input).every(key=>key==='revision'||(EDITABLE as readonly string[]).includes(key)),'Only account name, renewal date, notice period and renewal evidence can be changed through this door.',403)
 insist(EDITABLE.some(key=>Object.hasOwn(input,key)),'Supply at least one account field to change.')
 const revision=text(input.revision,'Current account revision',100)
 const current=await stmt(db,'SELECT document,revision FROM buoy_accounts WHERE id=?',accountId).first<{document:string;revision:string}>()
 insist(current,'Account not found.',404)
 insist(current.revision===revision&&image.value.accounts.find(row=>row.id===accountId)?.revision===revision,'Account evidence changed. Reload before saving.',409)
 const stored=JSON.parse(current.document) as Record<string,unknown>
 const patch=Object.fromEntries(EDITABLE.map(key=>[key,Object.hasOwn(input,key)?input[key]:stored[key]]))
 const validated=parseAccounts({accounts:[{id:accountId,...patch,billing:stored.billing,support:stored.support}]})[0]
 // Validation may normalize inputs; take only the explicitly editable fields.
 // In particular, never replace the retained billing/support source objects
 // with caller values or with a reconstructed commercial projection.
 const next={...stored,...Object.fromEntries(EDITABLE.map(key=>[key,validated[key as EditField]]))},nextRevision=id()
 await db.batch([
  roleFence(db,actor,access),scopeFence(db,image),
  guard(db,'EXISTS(SELECT 1 FROM buoy_accounts WHERE id=? AND revision=? AND document=?)',accountId,revision,current.document),
  stmt(db,'UPDATE buoy_accounts SET document=?,revision=? WHERE id=?',canonicalJson(next),nextRevision,accountId),
  ...accountAudit(db,actor,accountId,'account.updated'),stmt(db,'DELETE FROM buoy_assertions'),
 ])
 return {id:accountId,revision:nextRevision}
}
