import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { startWorker } from './worker.mjs'
import { importClient } from './import-door-client.mjs'
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
