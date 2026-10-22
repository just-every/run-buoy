import {guard,insist,stmt,text,type Actor} from '../core'
import {approveWithAuthorization} from '../work'
import {hierarchyApprovalFence,hierarchyApprovalImage} from '../hierarchy-approval'
import {commercialFor,readableIds,roleAccess,roleFence,scopeFence,scopeImage,type RoleAccess} from './access'

type ScopeImage=Awaited<ReturnType<typeof scopeImage>>
export interface ScopedRenewalReview {
 id:string;accountId:string;accountName:string;revision:string;sourceRevision:string|null
 outcome:string;reason:string;evidence:string
 renewal?:{expectedArrMinor:number;resultArrMinor:number;currency:string}
}
export interface ScopedRenewalApprovals {proposals:ScopedRenewalReview[]}

/** Renewal authority intersects readable scope, both declared scopes and full
 * commercial access. A share never extends a CSM's outcome authority. */
export function mayApproveScopedRenewal(image:ScopeImage['value'],actor:Actor,access:RoleAccess,accountId:string){
 if(!access.restricted||access.stale||!readableIds(image,actor,access).includes(accountId))return false
 const account=image.accounts.find(row=>row.id===accountId)!
 if(commercialFor(access,actor,account.ownerId)!=='full')return false
 if(access.roleId==='csm'&&account.ownerId!==actor.id)return false
 if(access.permissions.renewals==='yes')return true
 if(access.permissions.renewals==='granted')return access.grants.renewalOutcome&&account.ownerId===actor.id
 return access.permissions.renewals==='team'&&image.people.some(person=>person.id===account.ownerId&&person.status==='active'&&person.managerId===actor.id)
}

/** A deliberately narrow review projection: no snapshots, preparer identities,
 * unrelated proposal kinds, hidden accounts or partially visible money. */
export async function scopedRenewalApprovals(db:D1Database,actor:Actor,provided?:RoleAccess):Promise<ScopedRenewalApprovals>{
 const access=provided??await roleAccess(db,actor),image=await scopeImage(db)
 const rows=await db.prepare("SELECT p.id,p.account_id,p.account_revision,p.payload,a.document FROM buoy_proposals p JOIN buoy_accounts a ON a.id=p.account_id WHERE p.kind='renewal' AND p.status='prepared' AND p.account_revision=a.revision ORDER BY p.prepared_at,p.id").all<{id:string;account_id:string;account_revision:string;payload:string;document:string}>()
 const proposals:ScopedRenewalReview[]=[],fences:D1PreparedStatement[]=[]
 for(const row of rows.results){
  if(!mayApproveScopedRenewal(image.value,actor,access,row.account_id))continue
  const payload=JSON.parse(row.payload) as Record<string,string>,account=JSON.parse(row.document) as {name:string}
  const hierarchy=await hierarchyApprovalImage(db,row.account_id)
  if(payload.hierarchyProof!==hierarchy.proof)continue
  const review:ScopedRenewalReview={id:row.id,accountId:row.account_id,accountName:account.name,revision:row.account_revision,sourceRevision:payload.renewalRevision??null,outcome:payload.outcome,reason:payload.reason,evidence:payload.evidence}
  if(payload.renewalId){
   const source=await stmt(db,'SELECT revision,document FROM buoy_renewals WHERE id=? AND account_id=?',payload.renewalId,row.account_id).first<{revision:string;document:string}>()
   if(!source||source.revision!==payload.renewalRevision)continue
   const renewal=JSON.parse(source.document) as {expectedArrMinor:number;currency:string;outcome?:string}
   if(renewal.outcome)continue
   review.renewal={expectedArrMinor:renewal.expectedArrMinor,resultArrMinor:Number(payload.resultArrMinor),currency:renewal.currency}
   fences.push(guard(db,'EXISTS(SELECT 1 FROM buoy_renewals WHERE id=? AND account_id=? AND revision=?)',payload.renewalId,row.account_id,source.revision))
  }
  proposals.push(review)
  fences.push(hierarchyApprovalFence(db,hierarchy))
  fences.push(guard(db,"EXISTS(SELECT 1 FROM buoy_proposals WHERE id=? AND kind='renewal' AND status='prepared' AND account_revision=? AND payload=?)",row.id,row.account_revision,row.payload))
 }
 await db.batch([roleFence(db,actor,access),scopeFence(db,image),...fences,stmt(db,'DELETE FROM buoy_assertions')])
 return {proposals}
}

/** Uses the actual native actor, never an owner/admin substitute. The shared
 * native transaction still owns stale-source, hierarchy and decision effects. */
export async function approveScopedRenewal(db:D1Database,actor:Actor,proposalId:string,input:Record<string,unknown>,_provided?:RoleAccess){
 insist(Object.keys(input).every(key=>['revision','sourceRevision'].includes(key)),'Only reviewed revision and source revision are accepted.',403)
 return approveWithAuthorization(db,actor,proposalId,async proposal=>{
  const access=await roleAccess(db,actor),image=await scopeImage(db)
  insist(proposal.kind==='renewal'&&mayApproveScopedRenewal(image.value,actor,access,proposal.account_id),'This renewal is outside your current approval authority.',403)
  const revision=text(input.revision,'Reviewed account revision',100),payload=JSON.parse(proposal.payload) as Record<string,string>
  const sourceRevision=input.sourceRevision===undefined||input.sourceRevision===null||input.sourceRevision===''?null:text(input.sourceRevision,'Reviewed renewal source revision',100)
  insist(revision===proposal.account_revision&&sourceRevision===(payload.renewalRevision??null),'The reviewed renewal evidence changed. Reload the approval queue.',409)
  return [roleFence(db,actor,access),scopeFence(db,image),guard(db,'EXISTS(SELECT 1 FROM buoy_proposals WHERE id=? AND kind=? AND account_id=? AND account_revision=? AND payload=? AND status=?)',proposalId,proposal.kind,proposal.account_id,proposal.account_revision,proposal.payload,proposal.status)]
 })
}
