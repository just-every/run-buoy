import assert from 'node:assert/strict'

export async function teamPlan({call,json},accountId,staffOwnerId,{customerOwnerId,name='Rollout success draft',taskIds=[],milestones=[]}={}){
 if(!customerOwnerId)customerOwnerId=(await json(await call('/customer-people','POST',{kind:'contact',name:'Rollout sponsor '+accountId,accountIds:[accountId],source:'synthetic-buoy-2301'}),201)).id
 const body={name,staffOwnerId,customerOwnerId,taskIds,milestones,objectives:[
  {id:'usage',title:'Adopt the agreed workflow',kind:'metric',field:'adoption.current.eventCount',target:10,direction:'at-least',dueOn:'2027-03-01'},
  {id:'statement',title:'Confirm the rollout outcome',kind:'customer-statement',dueOn:'2027-03-01'}]}
 const save=async(extra={})=>{
  const accountRevision=(await json(await call('/state'))).accounts.find(a=>a.id===accountId).revision
  const result=await json(await call('/accounts/'+accountId+'/plans','POST',{...body,...extra,accountRevision}),201)
  return (await json(await call('/accounts/'+accountId+'/plans'))).plans.find(p=>p.id===result.id)
 }
 return {accountId,body,save,row:await save()}
}

export async function teamPlanRows({call,json},accountIds){
 const rows=[]
 for(const accountId of accountIds)rows.push(...(await json(await call('/accounts/'+accountId+'/plans'))).plans)
 return rows.sort((a,b)=>a.id.localeCompare(b.id))
}

export function assertPlanHandover(before,after,selected,toId){
 assert.deepEqual(after.map(p=>p.id),before.map(p=>p.id),'Every plan is retained exactly once')
 for(const prior of before){
  const current=after.find(p=>p.id===prior.id)
  if(!selected.has(prior.id)){assert.deepEqual(current,prior,'Unselected plan is unchanged: '+prior.id);continue}
  assert.equal(current.staffOwnerId,toId,'Selected draft owner: '+prior.id)
  assert.notEqual(current.revision,prior.revision,'Selected draft revision changes: '+prior.id)
  assert.ok(Date.parse(current.updatedAt)>=Date.parse(prior.updatedAt))
  const stable=({staffOwnerId,revision,updatedAt,...rest})=>rest
  assert.deepEqual(stable(current),stable(prior),'Customer ownership, content, tasks and observations stay unchanged: '+prior.id)
 }
}
