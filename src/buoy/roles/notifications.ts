import {Problem,stmt,type Actor} from '../core'
import {readableIds,roleAccess,roleFence,scopeFence,scopeImage,type RoleAccess} from './access'

export interface RoleNotification {allowed:boolean;subject:string;content:string;restricted:boolean}
/** The recipient's current read boundary applies immediately before the mail
 * edge. Never copy free text, task/source titles or commercial details into an
 * assigned profile's external mailbox. Aggregate digests remain unported. */
export async function roleNotification(db:D1Database,personId:string,accountId:string,subject:string,content:string,origin:string):Promise<RoleNotification>{
 const denied:RoleNotification={allowed:false,subject:'',content:'',restricted:true}
 const person=await stmt(db,"SELECT id,role,display_name AS displayName FROM oa_operators WHERE id=? AND status='active'",personId).first<{id:string;role:string;displayName:string}>()
 if(!person)return denied
 const actor:Actor={...person,kind:'person'};let access:RoleAccess
 try{access=await roleAccess(db,actor)}catch(error){if(error instanceof Problem&&error.status===403)return denied;throw error}
 if(!access.restricted)return {allowed:true,subject,content,restricted:false}
 if(access.stale)return denied
 const image=await scopeImage(db)
 if(!readableIds(image.value,actor,access).includes(accountId))return denied
 const account=await stmt(db,"SELECT json_extract(document,'$.name') AS name FROM buoy_accounts WHERE id=? AND revision=?",accountId,image.value.accounts.find(row=>row.id===accountId)!.revision).first<{name:string}>()
 if(!account)return denied
 try{await db.batch([roleFence(db,actor,access),scopeFence(db,image),stmt(db,'DELETE FROM buoy_assertions')])}
 catch(error){if(error instanceof Error&&/constraint/i.test(error.message))return denied;throw error}
 return {allowed:true,subject:'Buoy: Account update',content:account.name+'\nAn account update is available in Buoy.\n'+new URL('/app/accounts/'+encodeURIComponent(accountId),origin).href+'\n',restricted:true}
}
