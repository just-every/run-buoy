import {seedChurnzeroArchive,assertChurnzeroRestored} from './churnzero-portability.mjs'
import {playConfig} from './play-fixture.mjs'
import {billingSource} from './billing-journey.mjs'
import {billingFixtureKey} from './billing-fixture.mjs'
import {seedBillingPortability,billingPortabilityImage,assertBillingArchiveRows,assertBillingPortability,assertBillingAwareAccounts,assertBillingAwareRevenue,assertBillingAwareScorecardHistory,billingAwareRecordImage,billingAwareAccountCatalog} from './billing-portability.mjs'
import {seedRecordPortability,recordPortabilityImage,assertRecordPortability} from './record-portability.mjs'
import {portableConfigurationCard,seedConfigurationPortability,assertConfigurationBacktest,assertConfigurationArchive} from './configuration-portability.mjs'
import { importClient } from './import-door-client.mjs'
import {seedTotangoArchive,assertTotangoArchiveRows,assertTotangoRestored} from './totango-api-journey.mjs'
// A real D1 installation, public HTTP writes, and public rer export/import.
// Source and destination run sequentially; only Stripe/mail network edges use synthetic provider records.
import assert from 'node:assert/strict'
import {mock} from 'node:test'
import {randomUUID,createHmac,createHash} from 'node:crypto'
import { cp, mkdtemp, rm, symlink, mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { startWorker } from './worker.mjs'
import {chromium} from '@playwright/test'
import {existsSync} from 'node:fs'
import {readAudit,archiveAudit,reconcileAuditScreen} from './audit-view.mjs'

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
const wallNow=Date.now.bind(Date),configurationNow=Date.now()
mock.timers.enable({apis:['Date'],now:configurationNow})
let running,browser,configurationClock=configurationNow
const stripe=billingSource()
const aiSelection=[{kind:'task',line:2},{kind:'risk',line:4},{kind:'expansion',line:6}]
const providerFetch=async request=>{
 if(new URL(request.url).hostname==='api.stripe.com')return stripe.fetch(request)
 assert.equal(request.url,'https://api.anthropic.com/v1/messages')
 const body=await request.json(),payload=JSON.parse(body.messages[0].content.slice(body.messages[0].content.indexOf('{')))
 if(payload.instructions.startsWith('Translate'))return Response.json({content:[{text:JSON.stringify(payload.records.kind==='scorecard'?portableConfigurationCard:{name:'Portable approved configuration',weeklyDropPercent:30,urgentTickets:1})}],usage:{input_tokens:100,output_tokens:100}})
 assert.ok(payload.instructions.startsWith('Identify'))
 return Response.json({content:[{text:JSON.stringify({proposals:aiSelection})}],usage:{input_tokens:100,output_tokens:100}})
}
// Server-to-server intake carries no browser Origin header. Dispatch the exact
// public HTTP request to the emitted Worker without a self-signed TLS transport.
const intake=(path,body,secret)=>running.dispatch(new Request(running.origin+path,{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body:JSON.stringify(body)}))
try{
 const source=await copy('source'),destination=await copy('destination'),broken=await copy('damaged'), archive=join(parent,'buoy.rer')
 running=await startWorker({root:source,secure:true,clock:()=>configurationClock,bindings:()=>({AI_ANTHROPIC_API_KEY:'synthetic-buoy-8340'}),providerFetch,persistenceDirectory:join(source,'.wrangler/state'),keepPersistence:true})
 const call=async(path,method='GET',body)=>{const response=await running.request('/api/buoy'+path,{method,body,cookie:running.cookie});assert.ok(response.ok,await response.clone().text());return response.json()}
 const allAudit=()=>readAudit(call)
 const fixture=JSON.parse(await readFile(join(root,'fixtures/move-in/accounts-synthetic.json'),'utf8'))
 const door=importClient(running.request,running.cookie), plan=await door.plan(fixture)
 const job=await door.apply(plan)
 assert.equal(job.state,'completed')
 const accountId=fixture.accounts[0].id
 const integration=await call('/v1/tokens','POST',{scopes:['accounts.read','accounts.write'],accountIds:[accountId],requestsPerMinute:10,expiresDays:1})
 const integrationRead=()=>running.dispatch(new Request(running.origin+'/api/buoy/v1/accounts/'+accountId,{headers:{authorization:'Bearer '+integration.token}}))
 assert.equal((await integrationRead()).status,200,'API-001 scoped server token reads before export')
 const integrationCurrent=await (await integrationRead()).json()
 const integrationWrite=await running.dispatch(new Request(running.origin+'/api/buoy/v1/accounts/'+accountId,{method:'PUT',headers:{authorization:'Bearer '+integration.token,'content-type':'application/json','idempotency-key':'synthetic-buoy-914-portable'},body:JSON.stringify(integrationCurrent)}))
 assert.equal(integrationWrite.status,200,'API-001 a real successful write creates replay custody before export')
 const planOwner=(await call('/state')).operator.id
 const planBook=await call('/playbooks','POST',{config:playConfig(planOwner,{name:'Portable plan work',steps:[{id:'task',kind:'task',title:'Portable plan follow-up',dueDays:2}]})})
 const planRun=await call('/playbooks/'+planBook.id+'/enroll','POST',{accountId,operationKey:'synthetic-buoy-1956'})
 const planPending=(await call('/playbooks')).runs.find(r=>r.id===planRun.id);await call('/proposals/'+planPending.proposalId+'/approve','POST',{})
 const planTask=(await call('/state')).tasks.find(t=>t.proposalId===planPending.proposalId)
 const planSegment=await call('/segments','POST',{name:'Portable milestone cohort',mode:'static',rules:{match:'all',conditions:[]},accountIds:[accountId],tier:null,stage:null,playbook:null})
 const planOutcome=await call('/outcomes','POST',{name:'Portable approved renewal milestone',segmentId:planSegment.id,kind:'renewed',windowDays:2,taskIds:[planTask.id],operationKey:'synthetic-buoy-1957'})
 const proposal=await call('/proposals','POST',{accountId,kind:'renewal',payload:{outcome:'renewed',reason:'Annual renewal accepted',evidence:'Signed renewal R-17'}})
 await call(`/proposals/${proposal.id}/approve`,'POST',{})
 const token=await call('/agent-tokens','POST',{label:'Portable preparation assistant'})
 assert.equal((await running.request('/api/buoy/accounts/'+accountId,{method:'PUT',body:{},token:token.token})).status,403)
 assert.equal((await running.request('/api/buoy/commands',{method:'POST',body:{command:'renewals.list'},token:token.token})).status,200)
 const erased={...fixture.accounts[0],id:'erase-before-backup',name:'Retired account'}
 const erasedImport=await door.plan({accounts:[...fixture.accounts,erased]},true)
 const erasedJob=await door.apply(erasedImport)
 await call('/accounts/erase-before-backup','DELETE',{confirmation:'Retired account'})
 assert.equal((await running.request('/auth/invite',{method:'POST',cookie:running.cookie,body:{email:'analyst@example.test',displayName:'Ana Lyst',role:'member'}})).status,202)
 const analyst=(await (await running.request('/auth/operators',{cookie:running.cookie})).json()).find(p=>p.email==='analyst@example.test')
 assert.equal((await running.request('/auth/operator/role',{method:'POST',cookie:running.cookie,body:{operatorId:analyst.id,role:'admin'}})).status,200)
 // USAGE-001: source/queued observations are portable; ingestion authority is not.
 const usageSource=await call('/usage/sources','POST',{name:'Portable product source',kind:'native',reference:'Buyer license meter'})
 const usageCredential=await call('/usage/sources/'+usageSource.id+'/credentials','POST',{label:'Portable source key',scope:['event']})
 const usageIntake=()=>intake('/api/buoy/usage/intake/'+usageSource.id,{type:'event',messageId:'portable-usage',event:'License opened',userId:'product-user',groupId:'product-company'},usageCredential.secret)
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
 const privacyIntake=secret=>intake('/api/buoy/usage/intake/'+usageSource.id,privacyIdentity,secret);
 assert.equal((await privacyIntake(usageCredential.secret)).status,202);
 const privacyMapping={sourceId:usageSource.id,userId:privacyIdentity.userId,groupId:privacyIdentity.groupId,accountId,personId:privacyPerson.id};
 const privacyPreview=await call('/usage/mappings/preview','POST',privacyMapping);await call('/usage/mappings','POST',{...privacyMapping,fingerprint:privacyPreview.fingerprint});
 const privacyBody={revision:(await call('/customer-people')).records.find(p=>p.id===privacyPerson.id).revision,confirmation:'synthetic-buoy-370',request:{verificationMethod:'verified-offline',receivedDate:new Date().toISOString().slice(0,10),requesterReference:randomUUID()}};
 const privacyExport=await call('/customer-people/'+privacyPerson.id+'/privacy/export','POST',privacyBody);
 const privacyDiscovery=await call('/customer-people/'+privacyPerson.id+'/privacy/preview','POST',{revision:privacyBody.revision,emails:[]});
 const privacyErased=await call('/customer-people/'+privacyPerson.id+'/privacy/erase','POST',{...privacyBody,fingerprint:privacyDiscovery.fingerprint,emails:[],redactions:[]});
 await call('/accounts','POST',{...fixture.accounts[0],id:'synthetic-buoy-375',name:'Held customer workspace'})
 const heldPerson=await call('/customer-people','POST',{kind:'contact',name:'synthetic-buoy-374',accountIds:['synthetic-buoy-375'],source:'Verified retention request'})
 const heldCurrent=async()=>(await call('/customer-people')).records.find(p=>p.id===heldPerson.id)
 await call('/customer-people/'+heldPerson.id+'/privacy/hold','POST',{revision:(await heldCurrent()).revision,confirmation:'synthetic-buoy-374',operation:'set',reason:'legal-obligation'})
 for(const portable_seats of [4,8])await call('/customer-people/'+heldPerson.id+'/fields','PUT',{revision:(await heldCurrent()).revision,values:{portable_seats},source:'Held customer revision'})
 const heldBody={revision:(await heldCurrent()).revision,confirmation:'synthetic-buoy-374',request:{verificationMethod:'verified-offline',receivedDate:new Date().toISOString().slice(0,10),requesterReference:randomUUID()}}
 const heldExport=await call('/customer-people/'+heldPerson.id+'/privacy/export','POST',heldBody)
 let heldVersionsBefore=heldExport.records.heldVersions
 assert.ok(heldVersionsBefore.some(v=>v.record_kind==='buoy_customer_values'&&JSON.parse(JSON.parse(v.document).document).portable_seats===4),'The intermediate held version is exported before backup')

 let privacyRequestsBefore=await call('/privacy/requests');
 let privacyReceiptsBefore=await call('/privacy/receipts');
 assert.equal(privacyExport.receipt.subject,privacyErased.receipt.subject);
 personState=await call('/customer-people');
 // INAPP-001 real archive: messages and receipts survive; dedicated authority does not.
 const inappSegment=await call('/segments','POST',{name:'Portable launch customers',mode:'static',accountIds:[accountId],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null});
 const inappCampaign=await call('/inapp/campaigns','POST',{sourceId:usageSource.id,segmentId:inappSegment.id,kind:'banner',title:'Portable reporting announcement',body:'Your reporting workspace is ready.',steps:[],maxViews:1,windowHours:24,enabled:true});
 const inappCredential=await call('/inapp/credentials','POST',{sourceId:usageSource.id,label:'Portable in-app server'});
 const inappSend=(action,body,credential=inappCredential.secret)=>intake('/api/buoy/inapp/'+action+'/'+usageSource.id,body,credential);
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
 const webhookIntake=()=>intake('/api/buoy/playbooks/intake/'+webhookBook.id,{accountId,operationKey:'synthetic-buoy-1760'},webhookKey.secret);
 assert.equal((await webhookIntake()).status,202);
 const portableCard=await call('/scorecards/publish','POST',{revision:recordIds.card.revision,config:{name:'Portable recorded health',measures:[{key:'billing',name:'Recorded allocation',field:'billing.allocatedMinor',min:0,max:100000,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[{segmentId:inappSegment.id,weights:{billing:2}}]}});
 const configurationHistory=await seedConfigurationPortability(call,value=>{configurationClock=value??configurationNow},configurationNow)
 const planChampion=await call('/customer-people','POST',{kind:'contact',name:'synthetic-buoy-1940',accountIds:[accountId],source:'synthetic-buoy-1941'});
 const successPlan=await call('/accounts/'+accountId+'/plans','POST',{accountRevision:(await call('/state')).accounts.find(a=>a.id===accountId).revision,name:'Portable internal success plan',taskIds:[planTask.id],milestones:[{id:'renewed',title:'Approved renewal evidence',objectiveId:'usage',outcomeId:planOutcome.id}],staffOwnerId:(await call('/state')).operator.id,customerOwnerId:planChampion.id,objectives:[{id:'usage',title:'Observed product use',kind:'metric',field:'adoption.current.eventCount',target:1,direction:'at-least',dueOn:'2027-03-01'},{id:'customer',title:'Actual customer confirmation required',kind:'customer-statement',dueOn:'2027-03-01'}]});
 await call('/portal-invitations','POST',{email:['portable-champion','example.test'].join('@'),displayName:'Portable champion'});
 const portalCookie=await running.signIn(['portable-champion','example.test'].join('@'));
 const portableGrant=await call('/accounts/'+accountId+'/portal-sharing','POST',{planId:successPlan.id,planRevision:successPlan.revision,email:['portable-champion','example.test'].join('@'),days:30,taskIds:[planTask.id]});
 const portalRead=await running.request('/api/buoy/portal/'+portableGrant.id,{cookie:portalCookie});assert.equal(portalRead.status,200);
 const portalRevision=(await portalRead.json()).revision;
 const portalConfirmed=await running.request('/api/buoy/portal/'+portableGrant.id+'/action',{cookie:portalCookie,method:'POST',body:{action:'confirm',revision:portalRevision,objectiveId:'customer',statement:'synthetic-buoy-1965'}});assert.equal(portalConfirmed.status,201);
 const portableAuthorEmail=['synthetic-buoy-1997','example.test'].join('@');
 assert.equal((await running.request('/auth/invite',{method:'POST',cookie:running.cookie,body:{email:portableAuthorEmail,displayName:'Synthetic portable plan author',role:'member'}})).status,202);
 const portableAuthorCookie=await running.signIn(portableAuthorEmail),portableAuthor=(await (await running.request('/auth/operators',{cookie:running.cookie})).json()).find(p=>p.email===portableAuthorEmail);
 await call('/roles/assignments','PUT',{revision:(await call('/roles')).revision,personId:portableAuthor.id,roleId:'cs-manager'});
 assert.equal((await running.request('/api/buoy/accounts/'+accountId+'/plans',{cookie:portableAuthorCookie})).status,200,'The source author has explicit plan read authority before export');
 const successPlansBefore=await call('/accounts/'+accountId+'/plans');
 assert.equal(successPlansBefore.plans[0].objectives[1].status,'achieved');
 assert.equal(successPlansBefore.plans.find(p=>p.id===successPlan.id).objectives[0].status,'achieved');
 assert.deepEqual(successPlansBefore.plans[0].linkedTasks.map(t=>t.id),[planTask.id]);assert.equal(successPlansBefore.plans[0].milestoneEvidence[0].status,'reached');assert.equal(successPlansBefore.plans[0].milestoneEvidence[0].kind,'renewed');
 const capturedPlanReview=await call('/reviews','POST',{accountId,name:'Confirmed plan review',kind:'QBR'});
 const capturedPlanReviewBefore=(await call('/reviews?id='+capturedPlanReview.id)).selected;
 assert.ok(capturedPlanReviewBefore.document.slides.find(s=>s.title==='Success plans and goal evidence').facts.some(f=>f.label.endsWith('Actual customer confirmation required')&&f.value==='achieved'));
 const scorecardBefore=await call('/scorecards');
 const revenueBefore=await call('/revenue');
 const surveysBefore=await call('/surveys');
 const retainedScorecard=await call('/scorecards/preview','POST',{historyId:scorecardBefore.history.find(h=>h.accountId===accountId).id});
 personState=await call('/customer-people');
 adoptionBefore=await call('/adoption');
 consumersBefore=await call('/adoption/consumers');

 const aiConfiguration=(await call('/ai')).settings;await call('/ai/settings','PUT',{...aiConfiguration,enabled:true,classes:['transcripts'],budgetMinor:100,requestMinor:100,requestsPerMinute:100,noTraining:true,termsReference:'synthetic-buoy-8050'});
 await call('/ai/schedules','POST',{name:'synthetic-buoy-8150',feature:'questions',accountId,question:'Prepare a meeting brief',hourUtc:12,authorize:true,policyRevision:(await call('/ai')).settings.revision});assert.equal((await call('/ai/schedules')).schedules.length,1);
 const prepareTranscript=async(target,base)=>{
  const lines=Array.from({length:7},(_,index)=>'synthetic-buoy-'+(base+index)),transcript=lines.join('\n')
  const prepared=await call('/ai/conversations','POST',{accountId:target,transcript,consent:true})
  const selected=aiSelection.map(p=>({kind:p.kind,line:lines[p.line-1],lineNumber:p.line}))
  assert.deepEqual(prepared.proposals.map(({kind,line,lineNumber})=>({kind,line,lineNumber})),selected,'AI-002 preparation cites the exact selected source lines')
  return {lines,transcript,selected,proposals:prepared.proposals}
 }
 const retainedTranscript=await prepareTranscript(accountId,8350)
 const discardedTranscript=await prepareTranscript(accountId,8360)
 for(const proposal of discardedTranscript.proposals)await call('/ai/proposals/'+proposal.id+'/decision','POST',{action:'discard'})
 const erasedTranscriptAccount={...fixture.accounts[0],id:'synthetic-buoy-8380',name:'synthetic-buoy-8381'}
 await call('/accounts','POST',erasedTranscriptAccount)
 const erasedTranscript=await prepareTranscript(erasedTranscriptAccount.id,8370)
 const erasedTask=await call('/ai/proposals/'+erasedTranscript.proposals[0].id+'/decision','POST',{action:'accept',dueDate:'2027-01-01'})
 const acceptedState=await call('/state'),acceptedTask=acceptedState.tasks.find(task=>task.id===erasedTask.taskId)
 assert.equal(acceptedTask?.title,erasedTranscript.lines[1],'AI-002 erasure fixture first creates the accepted native task')
 const acceptedProposal=acceptedState.proposals.find(proposal=>proposal.id===acceptedTask.proposalId)
 assert.equal(acceptedProposal?.payload.aiProposalId,erasedTranscript.proposals[0].id)
 await call('/accounts/'+erasedTranscriptAccount.id,'DELETE',{confirmation:erasedTranscriptAccount.name})
 const aiProposalsBefore=(await call('/ai/proposals')).proposals
 assert.deepEqual(aiProposalsBefore.map(({kind,line,lineNumber})=>({kind,line,lineNumber})),retainedTranscript.selected)
 const configurationDraft=await call('/ai/configuration','POST',{description:'Flag a weekly activity drop with an urgent ticket',consent:true})
 await call('/ai/configuration/'+configurationDraft.id+'/approve','POST',{approve:true,fingerprint:configurationDraft.fingerprint})
 const pendingConfiguration=await call('/ai/configuration','POST',{description:'Flag a weekly activity drop with an urgent ticket',consent:true})
 const configurationSignalsBefore=(await call('/ai/configuration')).signals
 const configurationBacktestBefore=await assertConfigurationBacktest(call,configurationHistory)
 const recordImage=await recordPortabilityImage(call,recordIds);
 const billingImage=await billingPortabilityImage(call,billingIds);
 // Later fixture writes can legitimately add held account revisions. Compare
 // restoration with the complete source image immediately before archiving.
 const heldBeforeArchive=await call('/customer-people/'+heldPerson.id+'/privacy/export','POST',{...heldBody,revision:(await heldCurrent()).revision})
 heldVersionsBefore=heldBeforeArchive.records.heldVersions
 privacyRequestsBefore=await call('/privacy/requests');privacyReceiptsBefore=await call('/privacy/receipts')
 // Repeated actions deliberately share actors, subjects, details and timestamps.
 // Independently expected tuples catch field swaps that page-wide text searches miss.
 const auditAgent=await call('/agent-tokens','POST',{label:'synthetic-buoy-9460',requestsPerMinute:1000})
 const unrelatedAudit=await allAudit(),expectedActions=[],fixtureClock=configurationClock
 for(let index=0;index<54;index++){
  configurationClock=fixtureClock+Math.floor(index/18)*1000
  const command=['synthetic-buoy-9461 <review & approve>','synthetic-buoy-9462','synthetic-buoy-9463'][index%3]
  const response=await running.request('/api/buoy/commands',{method:'POST',token:auditAgent.token,body:{command}})
  assert.equal(response.status,400)
  const actor='agent:'+auditAgent.id,occurredAt=new Date(configurationClock).toISOString()
  expectedActions.push({actor,action:'agent.requested',subject:actor,detail:'POST commands request received; outcome not recorded.',occurredAt},
   {actor,action:'agent.refused',subject:'command '+command,detail:'Unknown command. Agents can prepare; people approve.',occurredAt})
 }
 const fixtureAudit=await allAudit(),originalIds=new Set(unrelatedAudit.map(entry=>entry.id))
 const valueOrder=(a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))
 assert.deepEqual(fixtureAudit.filter(entry=>originalIds.has(entry.id)),unrelatedAudit,'Repeated native actions leave every unrelated audit tuple unchanged')
 assert.deepEqual(fixtureAudit.filter(entry=>!originalIds.has(entry.id)).map(({id,...tuple})=>tuple).sort(valueOrder),expectedActions.sort(valueOrder),'All 54 native requests persist exactly their independently expected attempt and refusal tuples')
 configurationClock=fixtureClock
 await call('/agent-tokens/'+auditAgent.id,'DELETE',{})
 const revokedAudit=await allAudit()
 assert.equal((await running.request('/api/buoy/commands',{method:'POST',token:auditAgent.token,body:{command:'renewals.list'}})).status,401)
 assert.deepEqual(await allAudit(),revokedAudit,'A revoked credential cannot add or expose an audit identity')
 const before=await call('/state'), beforeAudit=await allAudit(),sourceCallsBeforeRestore=stripe.calls.length
 assert.ok(before.accounts.find(a=>a.id===accountId).health.adoptionMeasures.some(m=>m.ruleId===portableAggregate.id&&m.matched&&m.health),'ADOPT-001 aggregate health is effective before archive export')
 for(const kind of ['auth.signed-in','auth.invited','auth.role-changed','account.created','account.erased','renewal.prepared','renewal.approved','agent.requested','agent.refused'])assert.ok(beforeAudit.some(entry=>entry.action===kind),`AUDIT-001 archive source records ${kind}`)
 assert.doesNotMatch(JSON.stringify(beforeAudit),/Retired account|erase-before-backup|example\.test|Ana Lyst|Harbour CS owner/,'AUDIT-001 erased account and people stay unnamed')
 browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 await reconcileAuditScreen(browser,running,beforeAudit,{screens:process.env.BUOY_AUDIT_SHOTS??join(root,'test-results/audit')})
 console.log('AUDIT-001 reconciled '+beforeAudit.length+' complete source tuples across every API and rendered page.')
 await running.close();running=null
 // Each export snapshots first, then records its own action for the next archive.
 const firstArchive=join(parent,'first.rer')
 await command(source,['export','--output',firstArchive])
 await command(source,['export','--output',archive])
 // Inspect the public archive format, never the live database. This independent
 // calculation proves a keyed fence, not merely a replay refusal that plain SHA
 // would also satisfy. No generated installation key is logged on failure.
 const archiveText=await readFile(archive,'utf8')
 const archiveRows=archiveText.trim().split('\n').map(line=>JSON.parse(line)).filter(record=>record.kind==='part').flatMap(part=>part.items).filter(item=>item.kind==='row')
 assertConfigurationArchive(archiveRows,configurationHistory)
 assert.ok(!archiveRows.some(item=>['buoy_configuration_drafts','buoy_configuration_accounts'].includes(item.table)),'Unpublished drafts and approval authority never enter an archive')
 assert.ok(archiveRows.some(item=>item.table==='buoy_configuration_signals'&&JSON.parse(item.row.document).name==='Portable approved configuration'),'Approved deterministic definitions are retained')
 const supportHistoryBefore=archiveRows.filter(item=>item.table==='buoy_support_history').map(item=>item.row)
 assert.ok(supportHistoryBefore.length>0,'Retained native support observations enter the actual archive')
 const aiArchiveRows=archiveRows.filter(item=>item.table==='buoy_ai_proposals').map(item=>item.row)
 assert.deepEqual(aiArchiveRows.map(({kind,line,line_number})=>({kind,line,lineNumber:line_number})).sort((a,b)=>a.lineNumber-b.lineNumber),retainedTranscript.selected,'AI-002 persisted proposals contain exactly the selected kind, source text and original line number')
 assert.deepEqual(aiArchiveRows.map(row=>row.id).sort(),retainedTranscript.proposals.map(row=>row.id).sort())
 for(const transcript of [retainedTranscript,discardedTranscript,erasedTranscript]){
  assert.ok(!archiveText.includes(JSON.stringify(transcript.transcript).slice(1,-1)),'AI-002 the full submitted transcript is absent from persisted export text')
  for(const [index,line]of transcript.lines.entries())if(transcript!==retainedTranscript||!aiSelection.some(p=>p.line===index+1))assert.ok(!archiveText.includes(line),'AI-002 unselected, discarded and account-erased source text is absent throughout the persisted export')
 }
 const firstRows=(await readFile(firstArchive,'utf8')).trim().split('\n').map(line=>JSON.parse(line)).filter(record=>record.kind==='part').flatMap(part=>part.items).filter(item=>item.kind==='row')
 assert.deepEqual(archiveAudit(firstRows),beforeAudit,'The first actual archive matches every tuple on all pre-export API and screen pages')
 const secondAudit=archiveAudit(archiveRows),beforeIds=new Set(beforeAudit.map(entry=>entry.id))
 assert.deepEqual(secondAudit.filter(entry=>beforeIds.has(entry.id)),beforeAudit,'The next archive preserves all original tuples without reassociation')
 const exportActions=secondAudit.filter(entry=>!beforeIds.has(entry.id))
 assert.equal(exportActions.length,1,'Only the preceding export action crosses the documented snapshot boundary')
 const exportAction=exportActions[0]
 assert.equal(exportAction.actor,'portability:direct');assert.equal(exportAction.action,'data.exported')
 assert.match(exportAction.subject,/^archive:[0-9a-f-]+$/)
 assert.equal(exportAction.detail,'Installation archive snapshot taken; delivery of the file is not recorded.')
 const archivedAudit=archiveRows.filter(item=>item.table==='buoy_audit').map(item=>item.row)
 for(const proposal of discardedTranscript.proposals){
  const receipts=archivedAudit.filter(row=>row.subject==='ai:'+proposal.id)
  assert.equal(receipts.length,1,'AI-002 discard leaves one opaque receipt')
  assert.equal(receipts[0].action,'ai.proposal-discarded');assert.equal(receipts[0].detail,'')
  assert.ok(!archiveRows.some(item=>item.table!=='buoy_audit'&&JSON.stringify(item.row).includes(proposal.id)),'AI-002 no discarded proposal survives outside its audit receipt')
 }
 assert.ok(!archiveRows.some(item=>item.table==='buoy_tasks'&&(item.row.id===acceptedTask.id||item.row.account_id===erasedTranscriptAccount.id)),'AI-002 account erasure removes accepted native tasks from the persisted export')
 assert.ok(!archiveRows.some(item=>item.table==='buoy_proposals'&&(item.row.id===acceptedProposal.id||item.row.account_id===erasedTranscriptAccount.id)),'AI-002 account erasure removes accepted native proposals from the persisted export')
 for(const transcript of [retainedTranscript,discardedTranscript,erasedTranscript])for(const line of transcript.lines)assert.ok(!JSON.stringify(archivedAudit).includes(line),'AI-002 audit custody contains no transcript source text')
 assert.ok(!archiveRows.some(item=>['buoy_report_shares','buoy_dashboard_shares','buoy_playbook_credentials','buoy_playbook_intake_limits'].includes(item.table)),'PLAY-001 webhook credentials and rate reservations are excluded from the real archive');
 assert.ok(!archiveRows.some(item=>['buoy_integration_tokens','buoy_integration_minutes','buoy_integration_receipts'].includes(item.table)),'API-001 integration authority and replay state are excluded from the actual archive');
 assert.ok(!archiveRows.some(item=>item.table==='buoy_role_assignments'),'Restored plan assignments never carry executable staff authority');
 assert.ok(!archiveRows.some(item=>['buoy_portal_grants','buoy_portal_recipients'].includes(item.table)),'Customer access never enters the real archive');
 assert.ok(archiveRows.some(item=>item.table==='buoy_plan_confirmations'&&item.row.plan_id===successPlan.id),'Authenticated customer evidence survives without restoring authority');
 assertBillingArchiveRows(archiveRows,billingImage);
 assert.ok(archiveRows.some(item=>item.table==='buoy_success_plans'&&item.row.id===successPlan.id),'The real archive contains the persisted success plan');
 assert.ok(archiveRows.some(item=>item.table==='buoy_success_plan_history'&&item.row.plan_id===successPlan.id),'The real archive contains success plan version history');
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
 const bootstrapStarted=wallNow()
 running=await startWorker({root:destination,secure:true,clock:()=>configurationNow,bindings:()=>({AI_ANTHROPIC_API_KEY:'synthetic-buoy-8340'}),providerFetch,persistenceDirectory:join(destination,'.wrangler/state'),keepPersistence:true})
 const bootstrapFinished=wallNow(),after=await call('/state')
 assert.deepEqual((await call('/ai/proposals')).proposals.sort((a,b)=>a.id.localeCompare(b.id)),aiProposalsBefore.toSorted((a,b)=>a.id.localeCompare(b.id)),'AI-002 only the retained exact source selections return after restore')
 assert.deepEqual((await call('/reviews?id='+capturedPlanReview.id)).selected,capturedPlanReviewBefore,'Captured plan review and source facts restore exactly');
 const restoredPlans=await call('/accounts/'+accountId+'/plans');assert.deepEqual({...restoredPlans,sharing:null},{...successPlansBefore,sharing:null},'PLAN-001 definitions, customer confirmation, task links and milestone evidence restore exactly');
 assert.deepEqual(restoredPlans.sharing.grants,[],'Restoration never restores portal authority');
 assert.equal((await running.request('/api/buoy/portal/'+portableGrant.id,{cookie:portalCookie})).status,401,'A former portal session cannot read a restored installation');
 await assertBillingPortability(call,running.request,running.cookie,billingImage)
 assert.equal(stripe.calls.length,sourceCallsBeforeRestore,'Restored native reads and rejected source/webhook attempts never call Stripe without fresh authority')
 await assertRecordPortability(call,(path,options)=>running.request(path,{...options,cookie:running.cookie}),recordIds,billingAwareRecordImage(recordImage,before.accounts,after.accounts,billingImage))
 assert.deepEqual(await call('/adoption/consumers'),consumersBefore,'ADOPT-001 configured adoption health thresholds and measured source evidence survive archive restore');
 assert.deepEqual(await call('/adoption'),adoptionBefore,'ADOPT-001 definitions, seats, current identities, metrics and gaps survive the real installation archive');
 assert.deepEqual(await call('/customer-people'),{...personState,accounts:billingAwareAccountCatalog(personState.accounts,before.accounts,after.accounts,billingImage)},'USAGE-001 ACCOUNT-004 customer records, memberships, typed fields, calculations and source history restore exactly');
 assert.equal((await call('/usage')).mappings[0].personId,usagePerson.id,'USAGE-001 reviewed mapping survives restore without an intake credential');
 const restoredConnection=(await call('/connections')).connections.find(row=>row.id===connection.id)
 assert.equal(restoredConnection.name,'Portable Stripe source')
 assert.equal(restoredConnection.freshness,'Reconnect required','CONNECT-001 restores retain metadata without credential authority')
 assert.equal((await running.request('/api/buoy/connections/'+connection.id+'/sync',{cookie:running.cookie,method:'POST',body:{}})).status,409)
 const restored=await allAudit(),archiveIds=new Set(secondAudit.map(entry=>entry.id)),added=restored.filter(entry=>!archiveIds.has(entry.id))
 assert.deepEqual(restored.filter(entry=>archiveIds.has(entry.id)),secondAudit,'Every exported audit tuple returns unchanged through all restored API pages')
 assert.equal(added.length,1,'The destination adds only its own bootstrap sign-in, never the second export action')
 const {occurredAt:bootstrapTime,...bootstrap}=added[0]
 assert.deepEqual(bootstrap,{id:added[0].id,actor:'person:'+after.operator.id,action:'auth.signed-in',subject:'person:'+after.operator.id,detail:'native session issued'})
 // Native sign-in triggers use SQLite's clock, independently of the JS fixture clock.
 assert.ok(Date.parse(bootstrapTime)>=bootstrapStarted&&Date.parse(bootstrapTime)<=bootstrapFinished,'The destination bootstrap records its actual sign-in instant')
 await reconcileAuditScreen(browser,running,restored)
 console.log('AUDIT-001 reconciled '+beforeAudit.length+' complete source tuples, both export snapshots and '+restored.length+' restored tuples across every API and rendered page.')
 assert.match(await (await running.request('/app/audit?action=data.exported',{cookie:running.cookie})).text(),/portability:direct/)
 assert.deepEqual((await call('/surveys')).responses,surveysBefore.responses,'Recorded survey response values, source references and immutable history restore exactly');
 assert.ok(restored.some(e=>e.action==='survey.response-recorded'),'Recorded survey audit restores');
 assertBillingAwareRevenue(await call('/revenue'),revenueBefore,billingImage);
 assert.ok(restored.some(e=>e.action==='revenue.contract-confirmed'),'Recurring confirmation audit survives archive restore');
 assert.deepEqual((await call('/ai/configuration')).drafts,[],'Restoration carries no pending configuration approval')
 assert.deepEqual((await call('/ai/configuration')).signals,configurationSignalsBefore,'Approved deterministic signal definitions survive real restoration')
 assert.equal((await running.request('/api/buoy/ai/configuration/'+pendingConfiguration.id,{cookie:running.cookie})).status,404,'Restored installations cannot reuse a pending draft')
 assert.deepEqual((await call('/ai/schedules')).schedules,[],'AI-006 standing authority never restores');assert.equal((await call('/ai')).enabled,false,'An archive never restores permission to send records to a model; the fresh owner must explicitly configure it.');
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
 assert.equal((await integrationRead()).status,401,'API-001 an exported token cannot authorize the restored installation');
 assert.equal((await usageIntake()).status,401,'USAGE-001 archived ingestion credentials cannot authorize restored intake')
 assert.equal((await call('/usage')).credentials.length,0,'No archived ingestion credentials restore');
 assert.deepEqual(await call('/privacy/requests'),privacyRequestsBefore,'Verified request records survive real archive restoration');
 assert.deepEqual(await call('/privacy/receipts'),privacyReceiptsBefore,'ERASE-002 opaque receipts restore exactly without exported customer contents');
 assert.ok(restored.some(e=>e.action==='customer.exported'&&e.subject===privacyErased.receipt.subject));
 assert.ok(restored.some(e=>e.action==='customer.erased'&&e.subject===privacyErased.receipt.subject));
 assert.ok(!(await call('/customer-people')).records.some(p=>p.id===privacyPerson.id),'ERASE-002 erased customer stays absent after restore');
 const restoredHeld=await call('/customer-people/'+heldPerson.id+'/privacy/export','POST',{...heldBody,revision:(await heldCurrent()).revision})
 assert.deepEqual(restoredHeld.records.heldVersions,heldVersionsBefore,'Every retained hold version survives real archive restoration')
 const restoredHoldPreview=await call('/customer-people/'+heldPerson.id+'/privacy/preview','POST',{revision:(await heldCurrent()).revision,emails:[]})
 assert.equal(restoredHoldPreview.held,true,'A restored hold does not release automatically')

 assert.deepEqual(await call('/usage/events'),usageEvents,'USAGE-001 queued payload/provenance survives the real archive')
 const usageAfter=await call('/usage');assert.equal(usageAfter.sources[0].id,usageSource.id);assert.equal(usageAfter.sources[0].eventCount,3);assert.equal(usageAfter.credentials.length,0)
 const freshUsage=await call('/usage/sources/'+usageSource.id+'/credentials','POST',{label:'Restored privacy replay probe',scope:['event']});
 assert.equal((await privacyIntake(freshUsage.secret)).status,409,'ERASE-002 restored digest custody refuses erased source replay with fresh authority');
 await call('/usage/credentials/'+freshUsage.credential.id,'DELETE',{});
 assert.equal((await running.request('/api/buoy/accounts',{method:'POST',body:erased,cookie:running.cookie})).status,409,'restored erasure tombstone prevents recreation')
 const restoredDoor=importClient(running.request,running.cookie)
 const replayUpload=await restoredDoor.upload({accounts:[erased]})
 const replay=await restoredDoor.send('plan',{uploadId:replayUpload})
 assert.equal(replay.status,409,await replay.clone().text())
 assert.equal((await replay.json()).error,'source_erased','IMPORT-001 restored source custody refuses a fresh native import')
 assert.equal((await restoredDoor.send('reconcile',{planId:erasedImport.planId})).status,410,'IMPORT-001 restored reviewed snapshot stays withdrawn')
 const retainedErasedJob=await call('/imports/'+erasedJob.id)
 assert.ok(!JSON.stringify(retainedErasedJob).includes(erased.name),'IMPORT-001 restored job retains no erased source name')
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
 const restoredAi=(await call('/ai')).settings
 await call('/ai/settings','PUT',{...restoredAi,enabled:true,classes:[],budgetMinor:100,requestMinor:100,requestsPerMinute:100,noTraining:true,termsReference:'synthetic-buoy-8524'})
 assert.deepEqual(await assertConfigurationBacktest(call,configurationHistory),configurationBacktestBefore,'A fresh scorecard draft selects the same latest historical result and exact missing history after real restoration')
 assert.equal((await running.request('/api/buoy/accounts/'+accountId+'/plans',{cookie:portableAuthorCookie})).status,401,'The old author session cannot read a restored plan');
 assert.equal((await running.request('/auth/invite',{method:'POST',cookie:running.cookie,body:{email:portableAuthorEmail,displayName:'Synthetic portable plan author',role:'member'}})).status,202);
 const destinationAuthorCookie=await running.signIn(portableAuthorEmail);
 assert.equal((await running.request('/api/buoy/accounts/'+accountId+'/plans',{cookie:destinationAuthorCookie})).status,403,'A fresh identity with the same mailbox inherits no archived plan rights');
 assert.equal((await running.request('/api/buoy/reviews?id='+capturedPlanReview.id,{cookie:destinationAuthorCookie})).status,403,'Retained review content also requires fresh local authorization');
 await running.close();running=null
 const restoredArchive=join(parent,'restored.rer');await command(destination,['export','--output',restoredArchive])
 const restoredRows=(await readFile(restoredArchive,'utf8')).trim().split('\n').map(line=>JSON.parse(line)).filter(record=>record.kind==='part').flatMap(part=>part.items).filter(item=>item.kind==='row')
 assertConfigurationArchive(restoredRows,configurationHistory)
 assert.deepEqual(restoredRows.filter(item=>item.table==='buoy_support_history').map(item=>item.row).sort((a,b)=>a.id-b.id),supportHistoryBefore.toSorted((a,b)=>a.id-b.id),'Dated support observations survive public archive restoration exactly')
 const restoredScoreRows=new Map(restoredRows.filter(item=>item.table==='buoy_scorecard_history').map(item=>[item.row.id,item.row]))
 for(const {row}of archiveRows.filter(item=>item.table==='buoy_scorecard_history'))assert.equal(restoredScoreRows.get(row.id).observed_seq,row.observed_seq,'Retained calculation ordering survives restoration')
 // A clean migration has no later derived work. The broad archive fixture
 // above publishes scorecards and calculated fields; those are dependencies
 // that intentionally prevent strict undo, so use fresh installations here.
 const totangoSource=await copy('totango-source'),totangoDestination=await copy('totango-destination'),totangoArchive=join(parent,'totango.rer')
 running=await startWorker({root:totangoSource,secure:true,persistenceDirectory:join(totangoSource,'.wrangler/state'),keepPersistence:true})
 const totangoImage=await seedTotangoArchive(running)
 const churnzeroImage=await seedChurnzeroArchive(running)
 await running.close();running=null
 await command(totangoSource,['export','--output',totangoArchive])
 const totangoRows=(await readFile(totangoArchive,'utf8')).trim().split('\n').map(line=>JSON.parse(line)).filter(record=>record.kind==='part').flatMap(part=>part.items).filter(item=>item.kind==='row')
 assertTotangoArchiveRows(totangoRows,totangoImage)
 assertTotangoArchiveRows(totangoRows,churnzeroImage)
 await command(totangoDestination,['import','--input',totangoArchive,'--yes'])
 running=await startWorker({root:totangoDestination,secure:true,persistenceDirectory:join(totangoDestination,'.wrangler/state'),keepPersistence:true})
 await assertTotangoRestored(running,totangoImage)
 await assertChurnzeroRestored(running,churnzeroImage)
 await running.close();running=null
 console.log('AUDIT-001 archive journey passed: audit entries match the screen and restore exactly; HTTP data, approvals and import custody survive; credentials excluded; populated and damaged restores refused; fresh owner can continue.')
}finally{if(browser)await browser.close();if(running)await running.close();await rm(parent,{recursive:true,force:true})}
