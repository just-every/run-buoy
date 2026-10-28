import assert from 'node:assert/strict'

// Public reads surround each refused request, including the retained kit job.
export function importAuthority({request,cookie,door,member,revoked}) {
 const read=async response=>({status:response.status,body:await response.json()})
 async function snapshot(plan,job) {
  const paths=['/api/buoy/state','/api/buoy/imports','/api/operator/import-history','/api/operator/import-settings',...(job?['/api/buoy/imports/'+job.id]:[])]
  const result=[]
  for(const path of paths)result.push(await read(await request(path,{cookie})))
  if(plan)for(const action of ['status','reconcile'])result.push(await read(await door.send(action,{planId:plan.planId})))
  return result
 }
 const actors=[['anonymous',{cookie:undefined},401],['member',{cookie:member},401],['revoked session',{cookie:revoked},401],['cross-origin',{headers:{origin:'https://foreign.invalid'}},403]]
 async function owner(action,body,plan,job) {
  for(const [actor,extra,status] of actors) {
   const before=await snapshot(plan,job)
   const response=action==='settings'
    ?await request('/api/operator/import-settings',{method:'POST',cookie,body,...extra})
    :await door.send(action,body,extra)
   assert.equal(response.status,action==='settings'&&actor==='cross-origin'?401:status,`${actor} cannot call import ${action}: ${await response.text()}`)
   assert.deepEqual(await snapshot(plan,job),before,`${actor} import ${action} leaves native state, jobs, journal, history, settings and reconciliation unchanged`)
  }
 }
 async function business(send,cases,status,plan,job) {
  for(const [action,body] of cases) {
   const before=await snapshot(plan,job), response=await send(action,body)
   assert.equal(response.status,status,`Business import ${action} is refused: ${await response.text()}`)
   assert.deepEqual(await snapshot(plan,job),before,`Refused Business ${action} leaves all public import and native reads unchanged`)
  }
 }
 return {owner,business,snapshot}
}
