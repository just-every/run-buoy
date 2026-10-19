import { apiCall, ApiError, type MutationResult } from './actions'
import type { Api, Fields } from './types'
import type { TeamPage, TeamPreview } from './team'
export async function mutateTeam(api:Api,request:Request,fields:Fields):Promise<MutationResult>{
 const send=<T>(path:string,body:unknown,method='POST')=>apiCall<T>(api,request,'/api/buoy/team'+path,method,body)
 const action=fields.action
 if(action==='team-preview-rules'||action==='team-preview-handover'||action==='team-preview-rebalance')return {teamPreview:await send<TeamPreview>('/preview',fields.mode!=='handover'?{mode:fields.mode}:{mode:'handover',fromId:fields.fromId,toId:fields.toId,note:fields.note})}
 if(action==='team-apply'){
  await send('/apply',{mode:fields.mode,fingerprint:fields.fingerprint,...(fields.mode==='handover'?{fromId:fields.fromId,toId:fields.toId,note:fields.note}:{})})
  return {redirect:'/app/team',message:'Reviewed assignment applied. Handover notes are on each account.'}
 }
 const data=await apiCall<TeamPage>(api,request,'/api/buoy/team'), input={teams:data.teams,capacities:data.capacities,rules:data.rules,territories:data.territories}
 if(action==='team-capacity')input.capacities=[...data.capacities.filter(c=>c.personId!==fields.personId),{personId:fields.personId,capacity:Number(fields.capacity)}]
 else if(action==='team-create')input.teams.push({id:crypto.randomUUID(),name:fields.name,pod:fields.pod,personIds:[]})
 else if(action==='team-member'){
  const team=input.teams.find(t=>t.id===fields.teamId);if(!team)throw new ApiError('Team not found.')
  team.personIds=team.personIds.filter(id=>id!==fields.personId);if(fields.change==='add')team.personIds.push(fields.personId)
 }else if(action==='team-rule')input.rules.push({id:crypto.randomUUID(),name:fields.name,teamId:fields.teamId,...(fields.segmentId?{segmentId:fields.segmentId}:{}),...(fields.territory?{territory:fields.territory}:{})})
 else if(action==='team-rule-order'){
  const index=input.rules.findIndex(r=>r.id===fields.id), position=Number(fields.position)
  if(index<0||!Number.isInteger(position)||position<1||position>input.rules.length)throw new ApiError('Choose a current rule position.')
  const [rule]=input.rules.splice(index,1);input.rules.splice(position-1,0,rule)
 }else if(action==='team-territory')input.territories=[...data.territories.filter(t=>t.accountId!==fields.accountId),{accountId:fields.accountId,territory:fields.territory}]
 else throw new ApiError('Choose an available team action.')
 await send('/settings',input,'PUT');return {redirect:'/app/team',message:'Team settings saved.',saved:action}
}
