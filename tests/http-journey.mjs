import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
import {routeAuthorityMatrix} from './http-route-matrix.mjs'

// Real Worker requests and persisted read-back; only the mail edge is faked.
export async function bearerTransportJourney() {
 console.log('HTTP transport journey: starting real Worker')
 let instant=Date.parse('2026-10-28T12:00:00Z')
 const app=await startWorker({clock:()=>instant}),cookie=app.cookie
 console.log('HTTP transport journey: Worker ready')
 const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()}
 const owner=(path,method='GET',body)=>app.request('/api/buoy'+path,{cookie,method,body})
 const state=async()=>json(await owner('/state'))
 const audit=async()=>json(await owner('/audit'))
 const input={id:'synthetic-buoy-2020',name:'Harbour Transport',renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Signed renewal order R-2020',billing:null,support:null}
 const command={command:'renewal.prepare',input:{accountId:input.id,payload:{outcome:'renewed',reason:'Customer accepted renewal',evidence:'Signed renewal order R-2021'}}}
 const mint=async(label,extra={})=>json(await owner('/agent-tokens','POST',{label,scopes:['renewal.prepare'],expiresDays:1,...extra}),201)
 const request=(token,path,method,body,origin,withCookie)=>app.request('/api/buoy'+path,{token,cookie:withCookie?cookie:undefined,method,body,headers:{origin}})
 const effects=value=>({accounts:value.accounts,proposals:value.proposals,tasks:value.tasks,decisions:value.decisions})
 try {
  await json(await owner('/accounts','POST',input),201)
  await json(await owner('/agents/settings','PUT',{disabled:false}))
  const grant=await mint('Transport preparation')
  console.log('HTTP transport journey: scoped preparation combinations')
  for(const origin of [null,'https://foreign.invalid'])for(const withCookie of [false,true]){
   const before=await state(),beforeAudit=await audit()
   const prepared=await json(await request(grant.token,'/commands','POST',command,origin,withCookie),201)
   const saved=await state(),proposal=saved.proposals.find(row=>row.id===prepared.id)
   assert.ok(proposal,'The preparation is persisted, not just returned')
   assert.equal(proposal.preparedBy,`agent:${grant.id}:Transport preparation`,'Cookie presence cannot change the preparing actor')
   assert.equal(proposal.status,'prepared');assert.equal(proposal.approvedBy,null)
   assert.equal(proposal.accountId,input.id);assert.deepEqual(proposal.payload,command.input.payload)
   assert.equal(proposal.accountRevision,before.accounts[0].revision)
   assert.equal(proposal.preparedAt,new Date(instant).toISOString())
   assert.deepEqual(saved.accounts,before.accounts);assert.deepEqual(saved.tasks,before.tasks);assert.deepEqual(saved.decisions,before.decisions)
   const newEntries=(await audit()).entries.filter(row=>!beforeAudit.entries.some(old=>old.id===row.id))
   assert.equal(newEntries.filter(row=>row.action==='renewal.prepared').length,1)
   for(const action of ['renewal.prepared','agent.requested','agent.succeeded']){
    const entry=newEntries.find(row=>row.action===action)
    assert.ok(entry,action+' is persisted');assert.equal(entry.actor,`agent:${grant.id}`)
    assert.equal(entry.occurredAt,new Date(instant).toISOString())
   }
   for(const [path,method,body,status]of [
    ['/commands','POST',{command:'renewals.list'},403],
    ['/commands','POST',{command:'synthetic-buoy-unsupported'},400],
    [`/proposals/${prepared.id}/approve`,'POST',{},403],
    [`/accounts/${input.id}`,'PUT',{...input,name:'Unauthorized change',revision:saved.accounts[0].revision},403],
    ['/accounts','POST',{...input,id:'synthetic-buoy-2021'},403],
   ]){
    assert.equal((await request(grant.token,path,method,body,origin,withCookie)).status,status,`${method} ${path}: bearer scope survives cookie and Origin combinations`)
    assert.deepEqual(effects(await state()),effects(saved),'Refusal cannot approve, create or edit account work')
   }
  }
  // A narrower data grant must not borrow the owner's visible source classes.
  const reader=await mint('Account-only reader',{scopes:['renewals.list'],dataClasses:['account']})
  const listed=await json(await request(reader.token,'/commands','POST',{command:'renewals.list'},'https://foreign.invalid',true))
  assert.deepEqual(listed.accounts.map(row=>row.id),[input.id])
  for(const row of listed.accounts)for(const field of ['billing','support','sentiment','health'])assert.ok(!(field in row),'Cookie cannot widen data access to '+field)
  await json(await app.request('/auth/invite',{cookie,method:'POST',body:{email:'member@example.test',displayName:'Transport colleague',role:'member'}}),202)
  const member=await app.signIn('member@example.test')
  await routeAuthorityMatrix({app,cookie,member,account:input,proposal:(await state()).proposals[0],json})
  const revoked=await mint('Revoked preparation',{expiresDays:7}),expired=await mint('Expired preparation')
  console.log('HTTP transport journey: invalid, expired and revoked credentials')
  await json(await owner('/agent-tokens/'+revoked.id,'DELETE'))
  // Refresh the ordinary owner session just before the grant's expiry so it is
  // demonstrably live on both sides of the exact credential deadline.
  instant=expired.expiresAt-60000
  const liveCookie=await app.signIn('owner@example.test')
  assert.equal((await app.request('/api/buoy/commands',{cookie:liveCookie,token:expired.token,method:'POST',body:command,headers:{origin:null}})).status,201,'The expiring grant works with the live cookie before its deadline')
  instant=expired.expiresAt
  assert.ok(instant<revoked.expiresAt,'Revocation is exercised while the revoked credential would otherwise be unexpired')
  assert.equal((await app.request('/api/buoy/state',{cookie:liveCookie})).status,200)
  const before=effects(await json(await app.request('/api/buoy/state',{cookie:liveCookie})))
  const baselineAudit=await json(await app.request('/api/buoy/audit',{cookie:liveCookie}))
  for(const [label,token]of [['invalid','synthetic-buoy-invalid'],['expired',expired.token],['revoked',revoked.token]]){
   for(const origin of [null,app.origin,'https://foreign.invalid'])for(const [path,method,body]of [
    ['/commands','POST',command],
    ['/state','GET',undefined],
    [`/proposals/${before.proposals[0].id}/approve`,'POST',{}],
    [`/accounts/${input.id}`,'PUT',{...input,name:'Unauthorized expired edit',revision:before.accounts[0].revision}],
    ['/accounts','POST',{...input,id:'synthetic-buoy-2022'}],
   ]){
    const response=await app.request('/api/buoy'+path,{cookie:liveCookie,token,method,body,headers:{origin}})
    assert.equal(response.status,401,`${label} bearer with a live owner cookie cannot authorize ${method} ${path}`)
    assert.deepEqual(effects(await json(await app.request('/api/buoy/state',{cookie:liveCookie}))),before)
   }
  }
  assert.deepEqual(await json(await app.request('/api/buoy/audit',{cookie:liveCookie})),baselineAudit,'Invalid credentials create neither work nor an authenticated audit actor')
  // The same public operations work as the owner, proving refusals did not
  // merely hit a stale cookie, invalid revision or unapprovable proposal.
  const approved=before.proposals[0]
  await json(await app.request(`/api/buoy/proposals/${approved.id}/approve`,{cookie:liveCookie,method:'POST',body:{}}))
  const current=await json(await app.request('/api/buoy/state',{cookie:liveCookie}))
  assert.equal(current.decisions.length,1);assert.equal(current.decisions[0].proposalId,approved.id)
  await json(await app.request(`/api/buoy/accounts/${input.id}`,{cookie:liveCookie,method:'PUT',body:{...input,name:'Owner reviewed transport account',revision:current.accounts[0].revision}}))
  const final=await json(await app.request('/api/buoy/state',{cookie:liveCookie}))
  assert.equal(final.accounts[0].name,'Owner reviewed transport account')
  assert.equal(final.proposals.find(row=>row.id===approved.id).status,'approved')
 } finally {await app.close()}
}
