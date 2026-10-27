import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {importClient} from './import-door-client.mjs'
import {startWorker} from './worker.mjs'
import {billingSource,billingFixtureKey} from './billing-journey.mjs'
import {BuoyUsage} from '../sdk/usage.mjs'

export async function trustFixture(){
 const instant=Date.parse('2026-10-27T12:00:10Z'),source=billingSource({now:instant}),app=await startWorker({providerFetch:source.fetch,clock:()=>instant}),call=(path,method='GET',body,extra={})=>app.request('/api/buoy'+path,{cookie:app.cookie,method,body,...extra})
 const api=async(path,method='GET',body,status=200,extra={})=>{const response=await call(path,method,body,extra);assert.equal(response.status,status,await response.clone().text());return response.json()}
 const on='2026-10-27',first='synthetic-buoy-7501',second='synthetic-buoy-7502',target='synthetic-buoy-7503'
 try{
  for(const [id,name]of [[first,'Synthetic duplicate'],[second,'Synthetic duplicate'],[target,'Synthetic correct company']])await api('/accounts','POST',{id,name,renewalDate:'2027-12-31',noticeDays:30,renewalEvidence:'Synthetic reviewed order',billing:{observedAt:id===second?'2020-01-01':on,reference:'synthetic-buoy-7504',currency:'USD',totalMinor:0,creditsMinor:0,allocatedMinor:0,dueDate:on},support:{observedAt:on,reference:'synthetic-buoy-7505',openTickets:0,urgentTickets:0}},201)
  let current=(await api('/state')).accounts.find(a=>a.id===first)
  await api('/accounts/'+first+'/contract','POST',{revision:current.revision,contract:{currency:'USD',contractStart:'2025-01-01',contractEnd:'2027-12-31',lines:[{id:'synthetic-buoy-7506',product:'Workspace',quantity:1,amountMinor:10000,frequency:'annual',entitlements:'Synthetic entitlement'}],source:{reference:'synthetic-buoy-7507',confirmedOn:on}}},201)
  const connection=await api('/connections','POST',{name:'Trust Stripe test fixture',key:billingFixtureKey},201),binding=await api('/billing/'+connection.id+'/bindings/preview','POST',{customerId:'synthetic-buoy-101',accountId:first})
  await api('/billing/'+connection.id+'/bindings','POST',{token:binding.token},201);await api('/billing/'+connection.id+'/sync','POST',{})
  const usage=await api('/usage/sources','POST',{name:'Segment reviewed source',kind:'segment',reference:'synthetic-buoy-7508',staleDays:30},201),credential=await api('/usage/sources/'+usage.id+'/credentials','POST',{label:'Synthetic server',scope:['track','group']},201)
  const person=await api('/customer-people','POST',{kind:'user',name:'Synthetic reviewed product user',accountIds:[first,target],source:'synthetic-buoy-7515: reviewed memberships in both companies'},201)
  const sdk=new BuoyUsage({origin:app.origin,sourceId:usage.id,credential:credential.secret,fetch:(url,options)=>app.dispatch(new Request(url,options))})
  await sdk.track({messageId:'synthetic-buoy-7509',type:'track',userId:'synthetic-buoy-7516',groupId:'synthetic-buoy-7510',timestamp:'2026-10-27T11:00:00Z',event:'Workspace opened'})
  const claim={sourceId:usage.id,userId:'synthetic-buoy-7516',groupId:'synthetic-buoy-7510',accountId:first,personId:person.id},preview=await api('/usage/mappings/preview','POST',claim)
  await api('/usage/mappings','POST',{...claim,fingerprint:preview.fingerprint},201)
  const card=await api('/scorecards');await api('/scorecards/publish','POST',{revision:card.revision,config:{name:'Attribution health',measures:[{key:'usage',name:'Recorded events',field:'adoption.current.eventCount',min:0,max:1,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]}},201)
  return {app,api,call,first,second,target,person,claim,source,sdk,correction:{...claim,accountId:target,reason:'synthetic-buoy-7511: source owner confirms this exact group belongs to the target company'}}
 }catch(error){await app.close();throw error}
}
export async function trustJourney(){
 const f=await trustFixture(),{app,api,call,first,second,target,correction}=f
 try{
  await app.request('/auth/invite',{cookie:app.cookie,method:'POST',body:{email:'synthetic-buoy-7512@example.test',displayName:'Trust member',role:'member'}})
  await app.request('/auth/invite',{cookie:app.cookie,method:'POST',body:{email:'synthetic-buoy-7513@example.test',displayName:'Trust admin',role:'admin'}})
  const member=await app.signIn('synthetic-buoy-7512@example.test'),admin=await app.signIn('synthetic-buoy-7513@example.test'),before=await api('/state'),priorMappings=(await api('/usage')).mappings
  for(const [path,method,body]of [['/trust','GET'],['/trust/scan','POST',{}],['/trust/mappings','POST',correction],['/trust/synthetic-buoy-7514/review','POST',{decision:'approve',reason:'Denied'}]]){
   assert.equal((await call(path,method,body,{cookie:undefined})).status,401)
   assert.equal((await call(path,method,body,{cookie:member})).status,403)
   if(method!=='GET')assert.equal((await call(path,method,body,{headers:{origin:'https://foreign.invalid'}})).status,403)
  }
  await api('/agents/settings','PUT',{disabled:false});const token=await api('/agent-tokens','POST',{label:'Synthetic trust authority probe'},201)
  for(const [path,method,body]of [['/trust','GET'],['/trust/scan','POST',{}],['/trust/mappings','POST',correction],['/trust/synthetic-buoy-7514/review','POST',{decision:'approve',reason:'Denied'}]])assert.equal((await call(path,method,body,{cookie:undefined,token:token.token})).status,403,'Agent credentials grant no trust-review authority')
  await api('/agent-tokens/'+token.id,'DELETE')
  await f.sdk.group({messageId:'synthetic-buoy-7517',userId:f.claim.userId,groupId:f.claim.groupId,timestamp:'2026-10-27T11:30:00Z',traits:{buoyAccountId:target}})
  const state=await api('/trust')
  assert.deepEqual(state.findings.map(row=>[row.kind,row.accountId]).sort(),[['arr',first],['duplicate',second],['mapping',target],['stale',second]],'Trust scan reports exactly the duplicate, ARR and stale findings')
  const mismatch=state.findings.find(row=>row.kind==='arr').evidence
  assert.equal(mismatch.contract.arrMinor,10000);assert.equal(mismatch.stripe.amounts[0].arr.roundedMinor,90000);assert.ok(mismatch.contract.reference);assert.match(mismatch.stripe.reference,/synthetic-buoy-101/)
  assert.deepEqual(state.findings.find(row=>row.kind==='duplicate').evidence.accounts.map(row=>row.id),[first,second])
  assert.equal(state.findings.find(row=>row.kind==='stale').evidence.sources[0].kind,'billing')
  await api('/trust/scan','POST',{},201);await api('/trust/scan','POST',{},201)
  assert.equal((await api('/trust')).proposals.length,4)
  const automatic=(await api('/trust')).proposals.find(row=>row.kind==='mapping');assert.equal(automatic.evidence.sourceClaim.messageId,'synthetic-buoy-7517');assert.equal(automatic.evidence.sourceClaim.payload.traits.buoyAccountId,target);assert.match(automatic.evidence.reference,/Unverified Segment claim/)
  assert.deepEqual((await api('/usage')).mappings,priorMappings);assert.deepEqual((await api('/state')).tasks,before.tasks)
  let proposed=await api('/trust/mappings','POST',correction,201)
  await api('/trust/mappings','POST',correction,201);assert.equal((await api('/trust')).proposals.length,5);proposed=automatic
  const review={decision:'approve',reason:'Reviewed exact source-owner evidence'}
  await f.sdk.group({messageId:'synthetic-buoy-7518',userId:f.claim.userId,groupId:f.claim.groupId,timestamp:'2026-10-27T11:40:00Z',traits:{buoyAccountId:'synthetic-buoy-unavailable'}})
  assert.equal((await call('/trust/'+proposed.id+'/review','POST',review)).status,409,'A superseded or unavailable source claim grants no correction')
  assert.equal((await api('/usage')).mappings.find(m=>m.groupId===correction.groupId).accountId,first)
  await f.sdk.group({messageId:'synthetic-buoy-7519',userId:f.claim.userId,groupId:f.claim.groupId,timestamp:'2026-10-27T11:50:00Z',traits:{buoyAccountId:target}})
  await api('/trust/scan','POST',{},201);proposed=(await api('/trust')).proposals.find(row=>row.evidence.sourceClaim?.messageId==='synthetic-buoy-7519');assert.ok(proposed)
  assert.equal((await call('/trust/'+proposed.id+'/review','POST',review,{cookie:member})).status,403)
  const initialScores=(await api('/scorecards')).accounts
  assert.equal(initialScores.find(a=>a.accountId===first).score,100);assert.equal(initialScores.find(a=>a.accountId===target).score,0)
  await api('/trust/'+proposed.id+'/review','POST',review,200,{cookie:admin})
  await api('/trust/'+proposed.id+'/review','POST',review,200,{cookie:admin})
  assert.equal((await api('/usage')).mappings.find(m=>m.groupId===correction.groupId).accountId,target,'Approved Segment correction changes the exact mapping')
  const scores=(await api('/scorecards')).accounts
  assert.equal(scores.find(a=>a.accountId===first).score,0);assert.equal(scores.find(a=>a.accountId===target).score,100)
  for(const accountId of [first,target]){
   const health=(await api('/accounts/'+accountId+'/health')).health
   assert.match(health.reasons.join(' '),/Data trust correction.*health refreshed after this change/,'Approved correction is noted on health');assert.doesNotMatch(health.reasons.join(' '),/Reviewed exact source-owner evidence/,'Health notes expose no private review reason')
   assert.match((await api('/state')).accounts.find(a=>a.id===accountId).health.reasons.join(' '),/Data trust correction/)
  }
  assert.equal((await api('/audit?action=trust.approved')).entries.length,1,'Replay adds no approval audit')
  assert.equal((await call('/trust/'+proposed.id+'/review','POST',{decision:'reject',reason:'Contradictory replay'})).status,409)
  // Stale target evidence refuses without changing the mapping or the decision.
  proposed=await api('/trust/mappings','POST',{...correction,accountId:first},201)
  const current=(await api('/state')).accounts.find(a=>a.id===first),{id,name,renewalDate,noticeDays,renewalEvidence,billing,support,revision}=current
  await api('/accounts/'+first,'PUT',{id,name,renewalDate,noticeDays,renewalEvidence,billing,support,revision})
  assert.equal((await call('/trust/'+proposed.id+'/review','POST',review)).status,409)
  assert.equal((await api('/trust')).proposals.find(p=>p.id===proposed.id).status,'prepared')
  assert.equal((await api('/usage')).mappings.find(m=>m.groupId===correction.groupId).accountId,target)
  await api('/trust/'+proposed.id+'/review','POST',{decision:'reject',reason:'Reject stale correction'})
  // Refresh findings after the mapping correction; approve tasks without merging or selecting authority.
  await api('/trust/scan','POST',{},201)
  const data=await api('/trust'),ownerId=(await api('/state')).operator.id
  for(const kind of ['duplicate','arr','stale']){
   const latest=data.proposals.find(row=>row.kind===kind&&row.status==='prepared'&&data.findings.some(finding=>JSON.stringify(finding.evidence)===JSON.stringify(row.evidence)))
   assert.ok(latest,'Current '+kind+' proposal')
   await api('/trust/'+latest.id+'/review','POST',{...review,ownerId,dueDate:'2027-01-01'},200,{cookie:admin})
   await api('/trust/'+latest.id+'/review','POST',{...review,ownerId,dueDate:'2027-01-01'},200,{cookie:admin})
  }
  const after=await api('/state');assert.equal(after.tasks.length,3);assert.ok(after.tasks.every(task=>task.ownerId===ownerId));assert.equal(after.accounts.length,3)
  const arr=(await api('/revenue')).reconciliation.find(row=>row.accountId===first);assert.equal(arr.contract.arrMinor,10000);assert.equal(arr.stripe.amounts[0].arr.roundedMinor,90000);assert.equal(arr.status,'pending')
  assert.deepEqual([...new Set(app.outbound.map(url=>new URL(url).hostname))].sort(),['api.resend.com','api.stripe.com'])
  assert.ok(f.source.calls.every(call=>call.method==='GET'))
  // Erasure removes proposal evidence from either side of the exact correction.
  await api('/accounts/'+target,'DELETE',{confirmation:'Synthetic correct company'})
  assert.equal((await api('/trust')).proposals.filter(row=>row.kind==='mapping').length,0)
 }finally{await app.close()}
}

export async function trustPrivacyJourney(){
 const f=await trustFixture(),{app,api,call,correction}=f,person=(await api('/customer-people')).records.find(p=>p.id===f.person.id)
 try{
  const proposal=await api('/trust/mappings','POST',{...correction,reason:'Reviewed with '+person.name},201)
  const url='/customer-people/'+person.id+'/privacy/',request={verificationMethod:'verified-offline',receivedDate:'2026-10-27',requesterReference:randomUUID()}
  const current=async()=>(await api('/customer-people')).records.find(p=>p.id===person.id)
  let body={revision:(await current()).revision,confirmation:person.name,request}
  const exported=await api(url+'export','POST',body)
  assert.deepEqual(exported.records.trustProposals?.map(p=>p.id)??[],[proposal.id],'Person export includes the exact linked trust proposal')
  const preview=await api(url+'preview','POST',{revision:body.revision})
  assert.equal(preview.counts.trustProposals,1)
  const matches=preview.matches.filter(m=>m.recordId===proposal.id)
  assert.ok(matches.some(m=>m.path==='evidence.preview.person.name'&&m.before===person.name),'Privacy preview offers copied native identity for review')
  assert.ok(matches.some(m=>m.path==='evidence.reference'&&m.before==='Reviewed with '+person.name))
  // Whole-customer holds retain the copied evidence and disclose it on export.
  await api(url+'hold','POST',{revision:body.revision,confirmation:person.name,operation:'set',reason:'legal-obligation'})
  body.revision=(await current()).revision
  const held=await api(url+'preview','POST',{revision:body.revision})
  assert.ok(held.matches.filter(m=>m.recordId===proposal.id).every(m=>m.held))
  assert.equal((await call(url+'erase','POST',{...body,fingerprint:held.fingerprint,redactions:[held.matches.find(m=>m.recordId===proposal.id).id]})).status,409)
  const retained=await api(url+'erase','POST',{...body,fingerprint:held.fingerprint})
  assert.equal(retained.receipt.outcome,'held');assert.equal(retained.receipt.retained.trustProposals,1)
  await api('/trust/'+proposal.id+'/review','POST',{decision:'reject',reason:'Reviewed with '+person.name})
  const heldExport=await api(url+'export','POST',{...body,revision:(await current()).revision})
  assert.ok(heldExport.records.heldVersions.some(v=>v.record_kind==='buoy_trust_proposals'&&v.document.includes(person.name)),'Hold captures changed trust evidence versions')
  await api(url+'hold','POST',{revision:(await current()).revision,confirmation:person.name,operation:'release',reason:'review-completed'})
  body.revision=(await current()).revision
  // An unlinked narrative still belongs in reviewed redaction, not structural identity rewriting.
  const createdOther=await api('/customer-people','POST',{kind:'contact',name:'Synthetic narrative owner',accountIds:[f.target],source:'synthetic-buoy-7530'},201),other=(await api('/customer-people')).records.find(p=>p.id===createdOther.id)
  const neighbor=await api('/customer-people','POST',{kind:'contact',name:'Synthetic held neighbor',accountIds:[f.first],source:'synthetic-buoy-7534'},201)
  let neighborRecord=(await api('/customer-people')).records.find(p=>p.id===neighbor.id)
  const neighborUrl='/customer-people/'+neighbor.id+'/privacy/'
  await api(neighborUrl+'hold','POST',{revision:neighborRecord.revision,confirmation:neighborRecord.name,operation:'set',reason:'legal-obligation'})
  const second=await api('/trust/mappings','POST',{...correction,reason:'Source reviewed by '+other.name},201)
  const otherUrl='/customer-people/'+other.id+'/privacy/',heldOtherPreview=await api(otherUrl+'preview','POST',{revision:other.revision})
  const heldMatch=heldOtherPreview.matches.find(m=>m.recordId===second.id)
  assert.equal(heldMatch.held,true,'A hold on the related account protects retained trust narratives')
  assert.equal((await call(otherUrl+'erase','POST',{revision:other.revision,confirmation:other.name,request,fingerprint:heldOtherPreview.fingerprint,redactions:[heldMatch.id]})).status,400)
  neighborRecord=(await api('/customer-people')).records.find(p=>p.id===neighbor.id)
  await api(neighborUrl+'hold','POST',{revision:neighborRecord.revision,confirmation:neighborRecord.name,operation:'release',reason:'review-completed'})
  const otherPreview=await api(otherUrl+'preview','POST',{revision:other.revision})
  const selected=otherPreview.matches.filter(m=>m.recordId===second.id)
  assert.equal(selected.length,1)
  await api(otherUrl+'erase','POST',{revision:other.revision,confirmation:other.name,request,fingerprint:otherPreview.fingerprint,redactions:selected.map(m=>m.id)})
  const redacted=(await api('/trust')).proposals.find(p=>p.id===second.id)
  assert.equal(redacted.evidence.reference,'Source reviewed by [redacted]');assert.equal(redacted.evidence.claim.personId,person.id)
  const alternate=await api('/customer-people','POST',{kind:'user',name:'Synthetic alternate product user',accountIds:[f.first,f.target],source:'synthetic-buoy-7533'},201)
  const replacement=await api('/trust/mappings','POST',{...correction,personId:alternate.id,reason:'Reviewed replacement identity'},201)
  const linked=await api(url+'export','POST',body)
  assert.deepEqual(linked.records.trustProposals.map(p=>p.id).sort(),[proposal.id,second.id,replacement.id].sort(),'Previous native identity copies are included as well as the proposed person')
  const latest=await api(url+'preview','POST',{revision:body.revision})
  assert.equal((await call(url+'erase','POST',{...body,fingerprint:preview.fingerprint})).status,409,'Changed trust work invalidates the earlier privacy preview')
  const erased=await api(url+'erase','POST',{...body,fingerprint:latest.fingerprint})
  assert.equal(erased.receipt.outcome,'erased')
  const trust=await api('/trust')
  assert.equal(trust.proposals.filter(p=>p.kind==='mapping').length,0,'Person erasure removes every linked trust identity copy')
  for(const value of [person.name,person.id,f.claim.userId])assert.ok(!JSON.stringify(trust).includes(value),'Trust response contains no erased identity '+value)
  assert.equal((await call('/trust/'+replacement.id+'/review','POST',{decision:'approve',reason:'Old erased evidence'})).status,404)
  assert.ok((await api('/customer-people')).records.some(p=>p.id===alternate.id),'Erasure preserves the unrelated proposed person')
  assert.equal((await api('/usage')).mappings.length,0)
  assert.ok(!(await api('/customer-people')).records.some(p=>p.id===person.id))
 }finally{await app.close()}
}
export async function trustUndoJourney(){
 const results=[]
 for(const side of ['primary','related']){
  const app=await startWorker({clock:()=>Date.parse('2026-10-27T12:00:10Z')}),door=importClient(app.request,app.cookie)
  const api=async(path,method='GET',body,status=200)=>{const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.equal(r.status,status,await r.clone().text());return r.json()}
  try{
   const account={id:'synthetic-buoy-900-duplicate',name:'Synthetic duplicate',renewalDate:'2027-12-31',noticeDays:30,renewalEvidence:'synthetic-buoy-7531',billing:null,support:null}
   await api('/accounts','POST',account,201)
   const id='synthetic-buoy-000-undo-'+side
   const plan=await door.plan({accounts:[{...account,id,name:side==='related'?account.name:'Synthetic imported trust',billing:side==='primary'?{observedAt:'2020-01-01',reference:'synthetic-buoy-7532',currency:'USD',totalMinor:0,creditsMinor:0,allocatedMinor:0,dueDate:'2026-10-27'}:null}]})
   await door.apply(plan)
   await api('/trust/scan','POST',{},201)
   const proposal=(await api('/trust')).proposals.find(p=>side==='primary'?p.accountId===id:p.relatedAccountId===id)
   assert.ok(proposal,'Prepared trust work on '+side+' account')
   const response=await door.send('undo',{planId:plan.planId})
   results.push([side,response.status,(await api('/state')).accounts.some(a=>a.id===id),(await api('/trust')).proposals.find(p=>p.id===proposal.id)?.status??null])
  }finally{await app.close()}
 }
 assert.deepEqual(results,[['primary',409,true,'prepared'],['related',409,true,'prepared']],'Import undo refuses both trust dependencies and preserves the account and pending work')
}
