import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { startWorker } from './worker.mjs'
import { importClient } from './import-door-client.mjs'

// One public-door journey covers the destructive path and complete retained reads.
export async function accountErasureJourney({request,cookie,member,account}) {
 const call=(path,method='GET',body,extra={})=>request('/api/buoy'+path,{method,body,cookie,...extra})
 const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()}
 const door=importClient(request,cookie)
 const erased={...account('synthetic-buoy-918001'),name:'synthetic-buoy-918002',renewalEvidence:'synthetic-buoy-918003',
  billing:{...account().billing,reference:'synthetic-buoy-918004'},support:{...account().support,reference:'synthetic-buoy-918005'}}
 const kept={...account('synthetic-buoy-918011'),name:'synthetic-buoy-918012',renewalEvidence:'synthetic-buoy-918013',
  billing:{...account().billing,reference:'synthetic-buoy-918014'},support:{...account().support,reference:'synthetic-buoy-918015'}}
 const sourceMarkers=[erased.id,erased.name,erased.renewalEvidence,erased.billing.reference,erased.support.reference]
 const workMarkers=['synthetic-buoy-918006','synthetic-buoy-918007','synthetic-buoy-918008']
 const plan=await door.plan({accounts:[erased,kept]}), job=await door.apply(plan)
 assert.equal((await door.json('reconcile',{planId:plan.planId})).counts.present,2)
 const audit=async()=>{
  const pages=[];let offset=0
  do {const page=await json(await call('/audit?offset='+offset));pages.push(page);offset=page.nextOffset} while(offset!==null)
  return pages
 }
 const work=async(accountId,title,reason,evidence)=>{
  const proposal=await json(await call('/proposals','POST',{accountId,kind:'playbook',payload:{title,dueDate:'2027-01-31'}}),201)
  await json(await call(`/proposals/${proposal.id}/approve`,'POST',{}))
  const decision=await json(await call('/proposals','POST',{accountId,kind:'renewal',payload:{outcome:'renewed',reason,evidence}}),201)
  await json(await call(`/proposals/${decision.id}/approve`,'POST',{}))
 }
 await work(kept.id,'synthetic-buoy-918016','synthetic-buoy-918017','synthetic-buoy-918018')
 const priorAuditIds=new Set((await audit()).flatMap(page=>page.entries).map(entry=>entry.id))
 await work(erased.id,...workMarkers)
 const read=async()=>({
  state:await json(await call('/state')),
  job:await json(await call(`/imports/${job.id}`)),
  journal:await json(await call('/imports')),
  history:await json(await request('/api/operator/import-history',{cookie})),
  status:await door.json('status',{planId:plan.planId}),
  audit:await audit(),
 })
 const before=await read()
 for(const marker of sourceMarkers){
  assert.ok(JSON.stringify(before.state).includes(marker),`Seeded state contains ${marker}`)
 }
 assert.equal(before.job.id,job.id);assert.equal(before.job.total,2);assert.equal(before.job.erasedRecords,0)
 for(const marker of workMarkers)assert.ok(JSON.stringify(before.state).includes(marker),`Seeded work contains ${marker}`)
 for(const key of ['proposals','tasks','decisions'])assert.ok(before.state[key].some(row=>row.accountId===erased.id),`${key} is populated before erasure`)
 assert.ok(before.history.history.some(row=>row.jobId===job.id),'The inspected history contains the imported job')
 const evidence=before.audit.flatMap(page=>page.entries).filter(entry=>!priorAuditIds.has(entry.id))
 assert.deepEqual(evidence.map(entry=>entry.action).sort(),['playbook.approved','playbook.prepared','renewal.approved','renewal.prepared'])
 const subject=evidence[0].subject
 for(const entry of evidence){assert.equal(entry.subject,subject);assert.match(entry.subject,/^[0-9a-f]{32}$/);assert.match(entry.actor,/^person:[0-9a-f-]+$/);assert.ok(Number.isFinite(Date.parse(entry.occurredAt)))}
 assert.equal((await door.send('undo',{planId:plan.planId})).status,409,'Dependent work refuses undo')
 const refused=await read()
 assert.deepEqual(refused.state,before.state,'Refused undo preserves every native record and work item')
 assert.deepEqual(refused.audit,before.audit,'Refused undo adds no product effect')
 assert.equal((await call('/accounts/'+erased.id,'DELETE',{confirmation:erased.name},{cookie:member})).status,403)
 assert.deepEqual(await read(),refused,'Member erasure changes no data or custody')
 assert.equal((await call('/accounts/'+erased.id,'DELETE',{confirmation:kept.name})).status,400)
 assert.deepEqual(await read(),refused,'A wrong name confirmation changes nothing')
 const receipt=await json(await call('/accounts/'+erased.id,'DELETE',{confirmation:erased.name}))
 assert.equal(receipt.state,'erased');assert.ok(receipt.erasedRecords>0)
 const after=await read()
 for(const [doorName,body] of Object.entries(after))for(const marker of [...sourceMarkers,...workMarkers]){
  assert.ok(!JSON.stringify(body).includes(marker),`${doorName} retains no ${marker}`)
 }
 for(const key of ['accounts','proposals','tasks','decisions']){
  assert.deepEqual(after.state[key],before.state[key].filter(row=>(key==='accounts'?row.id:row.accountId)!==erased.id),`Erasure preserves every unrelated ${key} row`)
 }
 assert.equal(after.job.id,job.id)
 assert.equal(after.job.total,2);assert.equal(after.job.erasedRecords,1,'The populated two-record job tombstones only the erased account')
 const journal=after.journal.erasures.find(entry=>entry.receiptId===receipt.id)
 assert.ok(journal,'The complete journal retains the opaque receipt')
 assert.ok(journal.stores.some(store=>store.store==='ik_door_plan_chunks'),'The journal inventories withdrawn door custody')
 const retained=after.audit.flatMap(page=>page.entries)
 for(const entry of evidence)assert.deepEqual(retained.find(row=>row.id===entry.id),entry,'Earlier opaque work evidence survives')
 const erasedAudit=retained.filter(entry=>entry.action==='account.erased'&&entry.subject===subject)
 assert.equal(erasedAudit.length,1);assert.equal(erasedAudit[0].actor,`person:${before.state.operator.id}`)
 assert.equal((await call('/accounts','POST',erased)).status,409,'A permanent target tombstone refuses recreation')
 const withdrawn=await door.send('reconcile',{planId:plan.planId});assert.equal(withdrawn.status,410)
 assert.ok(!JSON.stringify(await withdrawn.json()).includes(erased.name))
 const replay=await door.json('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint})
 assert.equal(replay.job.id,job.id,'Replay returns its original job without restoring an erased record')
 assert.equal(replay.job.state,after.job.state,'A refused reversal cannot resume forward application')
 assert.deepEqual(await read(),after,'Recreation refusal, withdrawn reconciliation and replay preserve the erased state')
}

export async function importDoorJourney() {
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
 const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey), issuer='https://business.example.test', installationId='buoy-test-installation'
 const bindings=on=>origin=>({RER_IMPORT_DOOR:on,RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_APP_ORIGIN:origin,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify({test:jwk})})
 const value=id=>({id,name:'Imported Harbour',renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Signed order form',billing:null,support:null})
 for(const provisioned of [false,true]) {
  const app=await startWorker({bindings:bindings(provisioned?'on':'off')})
  try {
   const {request,cookie,origin}=app, door=importClient(request,cookie)
   const settings=async()=> (await request('/api/operator/import-settings',{cookie})).json()
   assert.equal((await settings()).enabled,provisioned,'IMPORT-001 first owner claim enables Business only with RER_IMPORT_DOOR=on')
   const grant=async(action,extra={})=>{
    const now=Math.floor(Date.now()/1000), encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url')
    const head=encode({alg:'ES256',typ:'rer-import-grant+jwt',kid:'test'}), payload=encode({v:1,iss:issuer,aud:origin,installationId,email:'owner@example.test',jti:randomUUID(),iat:now,exp:now+240,action,namespace:'buoy-account-json-v1',maxBytes:256000,maxChunks:10,maxRecords:50,...extra}), input=head+'.'+payload
    return input+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,Buffer.from(input))).toString('base64url')
   }
   const business=async(action,body,extra={})=> request('/api/rer/import/'+action,{method:'POST',body,token:await grant(action,extra)})
   const input={accounts:[value('door-native')]}, before=await (await request('/api/buoy/state',{cookie})).json()
   assert.equal((await door.send('uploads',{}, {cookie:undefined})).status,401)
   assert.equal((await door.send('uploads',{}, {headers:{origin:'https://foreign.invalid'}})).status,403)
   await request('/auth/invite',{method:'POST',cookie,body:{email:'colleague@example.test',displayName:'Colleague',role:'member'}})
   const member=await app.signIn('colleague@example.test')
   assert.equal((await door.send('uploads',{}, {cookie:member})).status,401)
   assert.equal((await request('/app/imports',{cookie:member})).status,403)
   assert.equal((await business('status',{})).status,provisioned?400:404,'IMPORT-001 disabled grants stay closed')
   const plan=await door.plan(input)
   assert.deepEqual((await (await request('/api/buoy/state',{cookie})).json()).accounts,before.accounts,'IMPORT-001 planning writes no native records')
   const secondCookie=await app.signIn('owner@example.test'), session=await (await request('/auth/session',{cookie:secondCookie})).json()
   assert.equal((await request('/auth/session/revoke',{method:'POST',cookie,body:{sessionId:session.id}})).status,204)
   assert.equal((await door.send('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint},{cookie:secondCookie})).status,401,'IMPORT-001 revoked session cannot mutate a reviewed plan')
   const job=await door.apply(plan)
   const report=await door.json('reconcile',{planId:plan.planId});assert.equal(report.ok,true);assert.equal(report.counts.present,1)
   assert.equal((await request('/api/operator/import-history',{cookie})).status,200)
   const history=(await (await request('/api/operator/import-history',{cookie})).json()).history
   assert.ok(history.some(row=>row.jobId===job.id && /approved by/.test(row.caption)))
   const catchup=await door.plan({accounts:[{...value('door-native'),renewalEvidence:'Revised signed order'},...Array.from({length:49},(_,i)=>value('door-batch-'+i))]},true)
   assert.equal(catchup.differences.replacements.length,1)
   assert.equal(catchup.differences.additions.length,49)
   const runCookie=await app.signIn('owner@example.test'), runSession=await (await request('/auth/session',{cookie:runCookie})).json()
   const firstBatch=await door.json('apply',{planId:catchup.planId,reviewedFingerprint:catchup.fingerprint},{cookie:runCookie})
   assert.equal(firstBatch.job.state,'applying','IMPORT-001 largest upload is a durable multi-batch mutation')
   const paused=(await (await request('/api/buoy/state',{cookie})).json()).accounts
   await request('/auth/session/revoke',{method:'POST',cookie,body:{sessionId:runSession.id}})
   assert.equal((await door.send('apply',{planId:catchup.planId,reviewedFingerprint:catchup.fingerprint},{cookie:runCookie})).status,401,'IMPORT-001 session revocation stops an import mid-mutation')
   assert.deepEqual((await (await request('/api/buoy/state',{cookie})).json()).accounts,paused,'IMPORT-001 revoked continuation writes no native values')
   await door.apply(catchup)
   const fullReport=await door.json('reconcile',{planId:catchup.planId})
   assert.equal(fullReport.ok,true);assert.equal(fullReport.counts.present,50,'IMPORT-001 largest supported upload reconciles native values')
   await door.undo(catchup)
   const update={enabled:false}
   assert.equal((await request('/api/operator/import-settings',{method:'POST',cookie,body:update})).status,200)
   await request('/auth/session',{cookie})
   assert.equal((await settings()).enabled,false,'IMPORT-001 later owner path never reopens an explicit disabled door')
   assert.equal((await door.undo(plan)).state,'undone','IMPORT-001 owner undo works while Business is disabled')
   await request('/api/operator/import-settings',{method:'POST',cookie,body:{enabled:true}})
   const approvedAt=new Date().toISOString()
   const businessClient=importClient((path,options)=>{
    const action=path.split('/').at(-1), body=options.body
    return business(action,body,action==='apply'?{fingerprint:body.reviewedFingerprint,approvalRecordId:'test-business-approval',approvedAt}:{})
   })
   const businessPlan=await businessClient.plan({accounts:[value('door-business')]})
   await businessClient.apply(businessPlan)
   const mixed=(await (await request('/api/operator/import-history',{cookie})).json()).history
   assert.ok(mixed.some(entry=>entry.planId===businessPlan.planId && /approved via Business by/.test(entry.caption)),'IMPORT-001 Business and owner share honest approval history')
   await request('/api/operator/import-settings',{method:'POST',cookie,body:{enabled:false}})
   assert.equal((await door.undo(businessPlan)).state,'undone','IMPORT-001 owner can undo a Business job while Business is disabled')
   await request('/api/operator/import-settings',{method:'POST',cookie,body:{enabled:true,revokedKids:['test']}})
   assert.deepEqual((await settings()).revokedKids,['test'])
   assert.equal((await business('status',{})).status,403,'IMPORT-001 key revocation survives re-enable')
   // New plan, native edit and strict undo protection through the shared path.
   const edited=await door.plan({accounts:[value('door-edited')]}), applied=await door.apply(edited)
   const current=(await (await request('/api/buoy/state',{cookie})).json()).accounts.find(a=>a.id==='door-edited')
   assert.equal((await request('/api/buoy/accounts/door-edited',{method:'PUT',cookie,body:{...value('door-edited'),name:'Owner edited Harbour',revision:current.revision}})).status,200)
   assert.equal((await door.send('undo',{planId:edited.planId})).status,409,'IMPORT-001 native edit protects the owner record')
   assert.equal((await request('/api/buoy/accounts/door-edited',{method:'DELETE',cookie,body:{confirmation:'Owner edited Harbour'}})).status,200)
   assert.equal((await door.send('reconcile',{planId:edited.planId})).status,410,'ERASE-001 retained door snapshot is withdrawn')
   const erasures=await (await request('/api/buoy/imports',{cookie})).json()
   const stores=erasures.erasures.flatMap(e=>e.stores)
   assert.ok(stores.some(s=>s.store==='ik_door_plan_chunks'),'ERASE-001 journal inventories retained door custody')
   assert.ok(applied.id)
  } finally {await app.close()}
 }
}
