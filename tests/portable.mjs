import {billingSource} from './billing-journey.mjs'
import {billingFixtureKey} from './billing-fixture.mjs'
import {seedBillingPortability,billingPortabilityImage,assertBillingArchiveRows,assertBillingPortability,assertBillingAwareAccounts,assertBillingAwareRevenue,assertBillingAwareScorecardHistory} from './billing-portability.mjs'
import {seedRecordPortability,recordPortabilityImage,assertRecordPortability} from './record-portability.mjs'
import { importClient } from './import-door-client.mjs'
// A real D1 installation, public HTTP writes, and public rer export/import.
// Source and destination run sequentially; only Stripe/mail network edges use synthetic provider records.
import assert from 'node:assert/strict'
import {randomUUID,createHmac,createHash} from 'node:crypto'
import { cp, mkdtemp, rm, symlink, mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { startWorker } from './worker.mjs'

const root=resolve('.'), parent=await mkdtemp(join(tmpdir(),'buoy-portable-'))
const excluded=new Set(['node_modules','.git','.wrangler','.rer','.seed','.cache','.tanstack','exports','test-results'])
async function copy(name){
 const target=join(parent,name)
 await cp(root,target,{recursive:true,filter:path=>{const relative=path.slice(root.length+1);return !excluded.has(relative.split('/')[0])&&!relative.startsWith('.env')&&!relative.startsWith('.dev.vars')}})
 await symlink(join(root,'node_modules'),join(target,'node_modules'),'dir')
 return target
}
async function command(cwd,args,expected=0){
 const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}
 delete env.RER_LOCAL_OPERATION;delete env.RER_ONBOARDING_PROCESS_OWNER
 const child=spawn(process.execPath,[join(root,'node_modules/@runeditrun/rer/bin/rer.mjs'),...args],{cwd,env,stdio:['ignore','pipe','pipe']})
 let output='';for(const pipe of [child.stdout,child.stderr])pipe.on('data',chunk=>output+=chunk)
 const code=await new Promise((r,j)=>{child.once('error',j);child.once('close',r)})
 const safe=output.replace(/RER_OPEN[^\n]*/g,'RER_OPEN [private]').replace(/token=[^\s"&<>]+/g,'token=[private]')
 if(expected===0)assert.equal(code,0,safe.slice(-3000));else assert.notEqual(code,0,'Restore should refuse this destination or archive')
}
let running
const stripe=billingSource()
try{
 const source=await copy('source'),destination=await copy('destination'),broken=await copy('damaged'), archive=join(parent,'buoy.rer')
 running=await startWorker({root:source,secure:true,providerFetch:stripe.fetch,persistenceDirectory:join(source,'.wrangler/state'),keepPersistence:true})
 const call=async(path,method='GET',body)=>{const response=await running.request('/api/buoy'+path,{method,body,cookie:running.cookie});assert.ok(response.ok,await response.clone().text());return response.json()}
 const allAudit=async()=>{const entries=[];let offset=0;do{const page=await call('/audit?offset='+offset);entries.push(...page.entries);offset=page.nextOffset}while(offset!==null);return entries}
 const fixture=JSON.parse(await readFile(join(root,'fixtures/move-in/accounts-synthetic.json'),'utf8'))
 const door=importClient(running.request,running.cookie), plan=await door.plan(fixture)
 const job=await door.apply(plan)
 assert.equal(job.state,'completed')
 const accountId=fixture.accounts[0].id
 const proposal=await call('/proposals','POST',{accountId,kind:'renewal',payload:{outcome:'renewed',reason:'Annual renewal accepted',evidence:'Signed renewal R-17'}})
 await call(`/proposals/${proposal.id}/approve`,'POST',{})
 const token=await call('/agent-tokens','POST',{label:'Portable preparation assistant'})
 assert.equal((await running.request('/api/buoy/accounts/'+accountId,{method:'PUT',body:{},token:token.token})).status,403)
 assert.equal((await running.request('/api/buoy/commands',{method:'POST',body:{command:'renewals.list'},token:token.token})).status,200)
 const erased={...fixture.accounts[0],id:'erase-before-backup',name:'Retired account'}
 await call('/accounts','POST',erased)
 await call('/accounts/erase-before-backup','DELETE',{confirmation:'Retired account'})
 assert.equal((await running.request('/auth/invite',{method:'POST',cookie:running.cookie,body:{email:'analyst@example.test',displayName:'Ana Lyst',role:'member'}})).status,202)
 const analyst=(await (await running.request('/auth/operators',{cookie:running.cookie})).json()).find(p=>p.email==='analyst@example.test')
 assert.equal((await running.request('/auth/operator/role',{method:'POST',cookie:running.cookie,body:{operatorId:analyst.id,role:'admin'}})).status,200)
 // USAGE-001: source/queued observations are portable; ingestion authority is not.
 const usageSource=await call('/usage/sources','POST',{name:'Portable product source',kind:'native',reference:'Buyer license meter'})
 const usageCredential=await call('/usage/sources/'+usageSource.id+'/credentials','POST',{label:'Portable source key',scope:['event']})
 const usageIntake=()=>running.request('/api/buoy/usage/intake/'+usageSource.id,{method:'POST',headers:{authorization:'Bearer '+usageCredential.secret,'content-type':'application/json'},body:{type:'event',messageId:'portable-usage',event:'License opened',userId:'product-user',groupId:'product-company'}})
 assert.equal((await usageIntake()).status,202)
 const usagePerson=await call('/customer-people','POST',{kind:'user',name:'Portable customer user',accountIds:[accountId],source:'Reviewed license directory'});
 await call('/customer-fields','POST',{key:'portable_seats',label:'Portable seats',type:'number'});
 let personState=await call('/customer-people');
 await call('/customer-people/'+usagePerson.id+'/fields','PUT',{revision:personState.records.find(p=>p.id===usagePerson.id).revision,values:{portable_seats:12},source:'Confirmed license schedule'});
 await call('/customer-fields','POST',{key:'portable_ratio',label:'Portable ratio',type:'formula',formula:'custom.portable_seats / 20'});
 const mapping={sourceId:usageSource.id,userId:'product-user',groupId:'product-company',accountId,personId:usagePerson.id};
 const review=await call('/usage/mappings/preview','POST',mapping);await call('/usage/mappings','POST',{...mapping,fingerprint:review.fingerprint});
 // ERASE-002: export and erase a separate source-linked customer before the archive.
 const privacyPerson=await call('/customer-people','POST',{kind:'contact',name:'synthetic-buoy-370',accountIds:[accountId],source:'Reviewed customer privacy register'});
 const privacyIdentity={type:'event',event:'Privacy archive fixture',messageId:'synthetic-buoy-371',userId:'synthetic-buoy-372',groupId:'synthetic-buoy-373'};
 const privacyIntake=secret=>running.request('/api/buoy/usage/intake/'+usageSource.id,{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body:privacyIdentity});
 assert.equal((await privacyIntake(usageCredential.secret)).status,202);
 const privacyMapping={sourceId:usageSource.id,userId:privacyIdentity.userId,groupId:privacyIdentity.groupId,accountId,personId:privacyPerson.id};
 const privacyPreview=await call('/usage/mappings/preview','POST',privacyMapping);await call('/usage/mappings','POST',{...privacyMapping,fingerprint:privacyPreview.fingerprint});
 const privacyBody={revision:(await call('/customer-people')).records.find(p=>p.id===privacyPerson.id).revision,confirmation:'synthetic-buoy-370',request:{verificationMethod:'verified-offline',receivedDate:new Date().toISOString().slice(0,10),requesterReference:randomUUID()}};
 const privacyExport=await call('/customer-people/'+privacyPerson.id+'/privacy/export','POST',privacyBody);
 const privacyDiscovery=await call('/customer-people/'+privacyPerson.id+'/privacy/preview','POST',{revision:privacyBody.revision,emails:[]});
 const privacyErased=await call('/customer-people/'+privacyPerson.id+'/privacy/erase','POST',{...privacyBody,fingerprint:privacyDiscovery.fingerprint,emails:[],redactions:[]});
 const privacyRequestsBefore=await call('/privacy/requests');
 const privacyReceiptsBefore=await call('/privacy/receipts');
 assert.equal(privacyExport.receipt.subject,privacyErased.receipt.subject);
 personState=await call('/customer-people');
 // INAPP-001 real archive: messages and receipts survive; dedicated authority does not.
 const inappSegment=await call('/segments','POST',{name:'Portable launch customers',mode:'static',accountIds:[accountId],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null});
 const inappCampaign=await call('/inapp/campaigns','POST',{sourceId:usageSource.id,segmentId:inappSegment.id,kind:'banner',title:'Portable reporting announcement',body:'Your reporting workspace is ready.',steps:[],maxViews:1,windowHours:24,enabled:true});
 const inappCredential=await call('/inapp/credentials','POST',{sourceId:usageSource.id,label:'Portable in-app server'});
 const inappSend=(action,body,credential=inappCredential.secret)=>running.request('/api/buoy/inapp/'+action+'/'+usageSource.id,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body});
 const inappIdentity={userId:'product-user',groupId:'product-company'};
 const inappDelivery=(await (await inappSend('deliver',inappIdentity)).json()).messages[0];assert.equal(inappDelivery.id,inappCampaign.id);
 for(const kind of ['view','completion'])assert.equal((await inappSend('receipts',{...inappIdentity,campaignId:inappCampaign.id,deliveryId:inappDelivery.deliveryId,kind,messageId:'portable-'+kind})).status,202);
 const inappBefore=await call('/inapp'),inappTimeline=await call('/customer-people/'+usagePerson.id+'/timeline');
 assert.equal(inappTimeline.events.filter(e=>e.kind).length,2);
 const usageEvents=await call('/usage/events')
 await call('/adoption/definitions','POST',{kind:'feature',key:'license',name:'License opened',events:['License opened']});
 await call('/adoption/seats','PUT',{accountId,seats:20,reference:'Customer-approved license schedule',observedAt:'2026-10-01',staleDays:30});
 await call('/adoption/person-licenses','PUT',{accountId,personId:usagePerson.id,licensed:false,reference:'Prior individual register',observedAt:'2026-09-01'});
 await call('/adoption/person-licenses','PUT',{accountId,personId:usagePerson.id,licensed:true,reference:'Customer-approved individual register',observedAt:'2026-10-01'});
 await call('/accounts/'+accountId+'/owner','PUT',{ownerId:(await call('/state')).operator.id});
 const portableMeasure=await call('/adoption/consumers','POST',{name:'Portable license adoption measure',scope:'account',metric:'adoption.current.feature.license',op:'gte',value:1,health:true,alert:true,enabled:true});
 const portableAggregate=await call('/adoption/consumers','POST',{name:'Portable segment adoption health and alert',scope:'segment',segmentId:inappSegment.id,metric:'adoption.current.feature.license',op:'gte',value:1,health:true,alert:true,enabled:true});
 const portableNotice=(await call('/notifications')).items.find(i=>i.adoptionRuleId===portableMeasure.id);
 await call('/notifications/'+portableNotice.id+'/dismiss','POST',{reason:'Customer archive review is scheduled.',until:new Date(Date.now()+86400000).toISOString()});
 let consumersBefore=await call('/adoption/consumers');
 assert.equal(consumersBefore.evaluations.find(e=>e.accountId===accountId).measures.find(m=>m.ruleId===portableAggregate.id).matched,true,'ADOPT-001 segment aggregate alert measures are present before archive export');
 const adoptionAlertsBefore=(await call('/notifications')).items.filter(i=>i.title===portableMeasure.name);assert.equal(adoptionAlertsBefore.length,1,'ADOPT-001 source installation has one routed alert episode');
 let adoptionBefore=await call('/adoption');
 assert.equal(adoptionBefore.people.find(p=>p.id===usagePerson.id).metrics.current.utilization,1);
 assert.equal(adoptionBefore.personLicenseHistory.length,2);
 personState=await call('/customer-people'); // Include the intended account revision from the new seat observation.
 // CONNECT-001: provider credential ciphertext is excluded; source metadata survives.
 const connection=await call('/connections','POST',{name:'Portable Stripe source',key:billingFixtureKey});
 const billingIds=await seedBillingPortability(call,running.request,running.cookie,stripe,connection.id,running.signIn);
 const surveyBeforeRecord=await call('/surveys/responses','POST',{accountId,personId:usagePerson.id,surveyName:'Portable relationship review',kind:'nps',value:9,observedAt:new Date(Date.now()-1000).toISOString(),reference:'Received customer survey export',sourceResponseId:'synthetic-buoy-portable-survey',accountRevision:(await call('/state')).accounts.find(a=>a.id===accountId).revision});
 const contractBefore=await call('/accounts/'+accountId+'/contract','POST',{revision:(await call('/state')).accounts.find(a=>a.id===accountId).revision,contract:{currency:'USD',contractStart:'2026-01-01',contractEnd:'2027-12-31',lines:[{product:'Portable recurring workspace',quantity:20,amountMinor:6000000,frequency:'annual',entitlements:'20 reporting workspace seats'}],source:{reference:'Confirmed portable customer contract',confirmedOn:new Date().toISOString().slice(0,10)}}});
 const recordIds=await seedRecordPortability(call,fixture.accounts[0],usagePerson.id);
 const webhookBook=await call('/playbooks','POST',{config:{name:'Portable webhook authority boundary',ownerId:(await call('/state')).operator.id,enabled:true,reentryDays:30,failureThreshold:3,trigger:{kind:'webhook'},entry:null,exit:null,steps:[{id:'review',kind:'approval',title:'Review portable webhook enrollment'}]}});
 const webhookKey=await call('/playbooks/'+webhookBook.id+'/credentials','POST',{accountIds:[accountId]});
 const webhookIntake=()=>running.request('/api/buoy/playbooks/intake/'+webhookBook.id,{method:'POST',headers:{authorization:'Bearer '+webhookKey.secret,'content-type':'application/json'},body:{accountId,operationKey:'synthetic-buoy-1760'}});
 assert.equal((await webhookIntake()).status,202);
 const portableCard=await call('/scorecards/publish','POST',{revision:recordIds.card.revision,config:{name:'Portable recorded health',measures:[{key:'billing',name:'Recorded allocation',field:'billing.allocatedMinor',min:0,max:100000,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[{segmentId:inappSegment.id,weights:{billing:2}}]}});
 const scorecardBefore=await call('/scorecards');
 const revenueBefore=await call('/revenue');
 const surveysBefore=await call('/surveys');
 const retainedScorecard=await call('/scorecards/preview','POST',{historyId:scorecardBefore.history.find(h=>h.accountId===accountId).id});
 personState=await call('/customer-people');
 adoptionBefore=await call('/adoption');
 consumersBefore=await call('/adoption/consumers');
 const recordImage=await recordPortabilityImage(call,recordIds);
 const billingImage=await billingPortabilityImage(call,billingIds);
 const before=await call('/state'), beforeAudit=await allAudit(),sourceCallsBeforeRestore=stripe.calls.length
 assert.ok(before.accounts.find(a=>a.id===accountId).health.adoptionMeasures.some(m=>m.ruleId===portableAggregate.id&&m.matched&&m.health),'ADOPT-001 aggregate health is effective before archive export')
 for(const kind of ['auth.signed-in','auth.invited','auth.role-changed','account.created','account.erased','renewal.prepared','renewal.approved','agent.requested','agent.refused'])assert.ok(beforeAudit.some(entry=>entry.action===kind),`AUDIT-001 archive source records ${kind}`)
 assert.doesNotMatch(JSON.stringify(beforeAudit),/Retired account|erase-before-backup|example\.test|Ana Lyst|Harbour CS owner/,'AUDIT-001 erased account and people stay unnamed')
 for(let offset=0;offset<beforeAudit.length;offset+=50){
  const screen=await (await running.request('/app/audit?offset='+offset,{cookie:running.cookie})).text(),page=beforeAudit.slice(offset,offset+50)
  assert.equal((screen.match(/<article class="record">/g)??[]).length,page.length,'AUDIT-001 screen pages list every exported entry exactly once')
  for(const entry of page){assert.ok(screen.includes(entry.action));assert.ok(screen.includes(entry.subject));assert.ok(screen.includes(entry.occurredAt))}
 }
 await running.close();running=null
 // The first export's own record is taken with its snapshot; the next export carries it.
 await command(source,['export','--output',join(parent,'first.rer')])
 await command(source,['export','--output',archive])
 // Inspect the public archive format, never the live database. This independent
 // calculation proves a keyed fence, not merely a replay refusal that plain SHA
 // would also satisfy. No generated installation key is logged on failure.
 const archiveRows=(await readFile(archive,'utf8')).trim().split('\n').map(line=>JSON.parse(line)).filter(record=>record.kind==='part').flatMap(part=>part.items).filter(item=>item.kind==='row')
 assert.ok(!archiveRows.some(item=>['buoy_playbook_credentials','buoy_playbook_intake_limits'].includes(item.table)),'PLAY-001 webhook credentials and rate reservations are excluded from the real archive');
 assertBillingArchiveRows(archiveRows,billingImage);
 const replayKey=archiveRows.find(item=>item.table==='buoy_privacy_key')?.row.secret
 assert.ok(typeof replayKey==='string'&&/^[a-f0-9]{64}$/.test(replayKey),'Archive carries a 256-bit installation replay key')
 const fences=archiveRows.filter(item=>item.table==='buoy_erased_usage_identities').map(item=>item.row)
 const expectedFence='hmac:'+createHmac('sha256',Buffer.from(replayKey,'hex')).update(JSON.stringify([usageSource.id,privacyIdentity.userId])).digest('hex')
 assert.ok(fences.some(row=>row.source_id===usageSource.id&&row.identity_hash===expectedFence),'Archived fence equals an independently calculated source-bound HMAC-SHA-256')
 const unkeyed=createHash('sha256').update(privacyIdentity.userId).digest('hex')
 assert.ok(!fences.some(row=>row.identity_hash===unkeyed),'No guessable unkeyed erased-user digest remains')
 await command(destination,['import','--input',archive,'--yes'])
 await command(destination,['import','--input',archive,'--yes'],1)
 const bytes=await readFile(archive);bytes[Math.floor(bytes.length/2)]^=1
 const damaged=join(parent,'damaged.rer');await writeFile(damaged,bytes)
 await command(broken,['import','--input',damaged,'--yes'],1)
 running=await startWorker({root:destination,secure:true,providerFetch:stripe.fetch,persistenceDirectory:join(destination,'.wrangler/state'),keepPersistence:true})
 const after=await call('/state')
 await assertBillingPortability(call,running.request,running.cookie,billingImage)
 assert.equal(stripe.calls.length,sourceCallsBeforeRestore,'Restored native reads and rejected source/webhook attempts never call Stripe without fresh authority')
 await assertRecordPortability(call,(path,options)=>running.request(path,{...options,cookie:running.cookie}),recordIds,recordImage)
 assert.deepEqual(await call('/adoption/consumers'),consumersBefore,'ADOPT-001 configured adoption health thresholds and measured source evidence survive archive restore');
 assert.deepEqual(await call('/adoption'),adoptionBefore,'ADOPT-001 definitions, seats, current identities, metrics and gaps survive the real installation archive');
 assert.deepEqual(await call('/customer-people'),personState,'USAGE-001 ACCOUNT-004 customer records, memberships, typed fields, calculations and source history restore exactly');
 assert.equal((await call('/usage')).mappings[0].personId,usagePerson.id,'USAGE-001 reviewed mapping survives restore without an intake credential');
 const restoredConnection=(await call('/connections')).connections.find(row=>row.id===connection.id)
 assert.equal(restoredConnection.name,'Portable Stripe source')
 assert.equal(restoredConnection.freshness,'Reconnect required','CONNECT-001 restores retain metadata without credential authority')
 assert.equal((await running.request('/api/buoy/connections/'+connection.id+'/sync',{cookie:running.cookie,method:'POST',body:{}})).status,409)
 const restored=await allAudit(), added=restored.filter(entry=>!beforeAudit.some(prior=>prior.id===entry.id))
 assert.deepEqual(restored.filter(entry=>!added.includes(entry)),beforeAudit,'AUDIT-001 archive preserves exactly the audit entries shown before export')
 assert.deepEqual(added.map(entry=>[entry.action,entry.actor.replace(/[0-9a-f-]{36}$/,'id'),entry.detail]),[['auth.signed-in','person:id','native session issued'],['data.exported','portability:direct','Installation archive snapshot taken; delivery of the file is not recorded.']],'AUDIT-001 the export is recorded, and the destination records its own bootstrap sign-in')
 assert.match(added[1].subject,/^archive:[0-9a-f-]+$/)
 assert.match(await (await running.request('/app/audit?action=data.exported',{cookie:running.cookie})).text(),/portability:direct/)
 assert.deepEqual((await call('/surveys')).responses,surveysBefore.responses,'Recorded survey response values, source references and immutable history restore exactly');
 assert.ok(restored.some(e=>e.action==='survey.response-recorded'),'Recorded survey audit restores');
 assertBillingAwareRevenue(await call('/revenue'),revenueBefore,billingImage);
 assert.ok(restored.some(e=>e.action==='revenue.contract-confirmed'),'Recurring confirmation audit survives archive restore');
 const scorecardAfter=await call('/scorecards');
 assert.deepEqual(scorecardAfter.versions,scorecardBefore.versions,'Published scorecard versions and their dependency image restore exactly');
 assertBillingAwareScorecardHistory(scorecardAfter.history,scorecardBefore.history,billingImage);
 assert.equal(scorecardAfter.published.id,portableCard.versionId);
 assert.deepEqual(await call('/scorecards/preview','POST',{historyId:scorecardBefore.history.find(h=>h.accountId===accountId).id}),retainedScorecard,'Historical inputs, source evidence and calculation survive archive restore');
 assert.ok(restored.some(e=>e.action==='health.scorecard-published'&&e.subject==='scorecard:'+portableCard.versionId),'Scorecard publish audit restores with its opaque subject');
 assertBillingAwareAccounts(after.accounts,before.accounts,billingImage)
 assert.deepEqual(after.proposals,before.proposals)
 assert.deepEqual(after.decisions,before.decisions)
 assert.notEqual(after.operator.id,before.operator.id,'RESTORE-001 establishes a fresh owner, not the original native operator');
 assert.equal((await call('/notifications')).items.filter(i=>i.title===portableMeasure.name).length,0,'NOTIFY-001 ADOPT-001 a fresh owner cannot read the old recipient’s private inbox');
 await call('/accounts/'+accountId+'/owner','PUT',{ownerId:after.operator.id,note:'Fresh owner explicitly takes over restored adoption follow-up'});
 const freshAlerts=(await call('/notifications')).items.filter(i=>i.title===portableMeasure.name);
 assert.equal((await call('/notifications')).items.filter(i=>i.title===portableAggregate.name).length,1,'ADOPT-001 restored segment aggregate routes one fresh-owner alert');
 assert.equal(freshAlerts.length,1,'ADOPT-001 explicit restored-account reassignment routes one alert to the new recipient');
 assert.notEqual(freshAlerts[0].id,adoptionAlertsBefore[0].id);
 assert.equal(freshAlerts[0].dismissal,null,'SIGNAL-001 restored prior-recipient dismissal never suppresses the new owner');
 assert.ok(restored.some(e=>e.action==='signal.dismissed'),'SIGNAL-001 opaque dismissal audit survives archive restore');
 await call('/notifications/preferences','PUT',{frequency:'off',modes:{mention:'immediate',assignment:'immediate',signal:'immediate',approval:'immediate'}});
 assert.deepEqual((await call('/notifications')).items.filter(i=>i.title===portableMeasure.name),freshAlerts,'ADOPT-001 unchanged restored evidence does not duplicate the new recipient’s episode');
 assert.equal((await running.request('/api/buoy/commands',{method:'POST',body:{command:'renewals.list'},token:token.token})).status,401,'agent secrets are not restored')
 assert.equal((await webhookIntake()).status,401,'PLAY-001 restored run history cannot authorize old webhook intake');
 assert.equal((await usageIntake()).status,401,'USAGE-001 archived ingestion credentials cannot authorize restored intake')
 assert.equal((await call('/usage')).credentials.length,0,'No archived ingestion credentials restore');
 assert.deepEqual(await call('/privacy/requests'),privacyRequestsBefore,'Verified request records survive real archive restoration');
 assert.deepEqual(await call('/privacy/receipts'),privacyReceiptsBefore,'ERASE-002 opaque receipts restore exactly without exported customer contents');
 assert.ok(restored.some(e=>e.action==='customer.exported'&&e.subject===privacyErased.receipt.subject));
 assert.ok(restored.some(e=>e.action==='customer.erased'&&e.subject===privacyErased.receipt.subject));
 assert.ok(!(await call('/customer-people')).records.some(p=>p.id===privacyPerson.id),'ERASE-002 erased customer stays absent after restore');

 assert.deepEqual(await call('/usage/events'),usageEvents,'USAGE-001 queued payload/provenance survives the real archive')
 const usageAfter=await call('/usage');assert.equal(usageAfter.sources[0].id,usageSource.id);assert.equal(usageAfter.sources[0].eventCount,3);assert.equal(usageAfter.credentials.length,0)
 const freshUsage=await call('/usage/sources/'+usageSource.id+'/credentials','POST',{label:'Restored privacy replay probe',scope:['event']});
 assert.equal((await privacyIntake(freshUsage.secret)).status,409,'ERASE-002 restored digest custody refuses erased source replay with fresh authority');
 await call('/usage/credentials/'+freshUsage.credential.id,'DELETE',{});
 assert.equal((await running.request('/api/buoy/accounts',{method:'POST',body:erased,cookie:running.cookie})).status,409,'restored erasure tombstone prevents recreation')
 const inappAfter=await call('/inapp');
 assert.deepEqual(inappAfter,{...inappBefore,credentials:[]},'INAPP-001 campaigns portable, hash/credential table excluded');
 assert.deepEqual(await call('/customer-people/'+usagePerson.id+'/timeline'),inappTimeline,'INAPP-001 user receipts and provenance survive archive restore');
 assert.equal((await inappSend('deliver',inappIdentity)).status,401,'INAPP-001 archived server credential cannot authorize restored content');
 const freshInapp=await call('/inapp/credentials','POST',{sourceId:usageSource.id,label:'New owner server credential'});
 assert.deepEqual((await (await inappSend('deliver',inappIdentity,freshInapp.secret)).json()).messages,[],'INAPP-001 receipt-based cap and completion survive restore without old authority');
 const history=await (await running.request('/api/operator/import-history',{cookie:running.cookie})).json();assert.ok(history.history.some(item=>item.jobId===job.id))
 const followup=await call('/proposals','POST',{accountId,kind:'renewal',payload:{outcome:'deferred',reason:'Review next year',evidence:'Account review note CS-18'}})
 await call(`/proposals/${followup.id}/approve`,'POST',{})
 assert.equal((await call('/state')).decisions.length,before.decisions.length+1)
 const restoredBillingBeforeSchedule=await call('/billing');await running.scheduled();const restoredBillingAfterSchedule=await call('/billing');
 assert.equal(stripe.calls.length,sourceCallsBeforeRestore,'The restored scheduled Worker makes no next Stripe source call');
 assert.deepEqual(restoredBillingAfterSchedule,restoredBillingBeforeSchedule,'No restored source observation or billing run advances until the new owner reconnects');
 console.log('AUDIT-001 archive journey passed: audit entries match the screen and restore exactly; HTTP data, approvals and import custody survive; credentials excluded; populated and damaged restores refused; fresh owner can continue.')
}finally{if(running)await running.close();await rm(parent,{recursive:true,force:true})}
