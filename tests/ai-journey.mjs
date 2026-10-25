import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
import {scriptedQuestions,scriptedResponse} from './ai-question-edge.mjs'

export async function aiFixture(){
 const sent=[];let invalid=false,fail=false,generatedInvalid=false,onProvider,indexes=null,selectedProposals=null,scripted=false
 const app=await startWorker({clock:Date.parse('2026-10-25T12:00:00Z'),bindings:()=>({AI_ANTHROPIC_API_KEY:'synthetic-buoy-8000',AI_OPENAI_API_KEY:'synthetic-buoy-8010'}),providerFetch:async request=>{
  assert.equal(request.headers.get(new URL(request.url).hostname==='api.anthropic.com'?'x-api-key':'authorization'),new URL(request.url).hostname==='api.anthropic.com'?'synthetic-buoy-8000':'Bearer synthetic-buoy-8010','Provider selection never forwards another provider credential');const body=await request.json();sent.push({url:request.url,body});if(fail)return new Response('unavailable',{status:503})
  const payload=JSON.parse(body.messages[0].content.slice(body.messages[0].content.indexOf('{')))
  if(onProvider)await onProvider()
  const result=scripted?scriptedResponse(payload):payload.instructions.startsWith('Generate')?(generatedInvalid?{claims:[{text:'Unsupported claim',sources:generatedInvalid==='missing'?[]:[{index:generatedInvalid==='quote'?0:99999,quote:'invented'}]}]}:{claims:payload.records.map((r,index)=>({text:r.accountName+' has recorded '+r.field+' evidence: '+r.quote,sources:[{index,quote:r.quote}]}))}):invalid?{indexes:[999999]}:payload.instructions.startsWith('Identify')?{proposals:selectedProposals??[{kind:'task',line:1},{kind:'risk',line:2},{kind:'expansion',line:3}]}:{indexes:indexes??payload.records.map((_,i)=>i)}
  const content=JSON.stringify(result)
  return Response.json(body.model==='synthetic-buoy-openai'?{choices:[{message:{content}}],usage:{prompt_tokens:100,completion_tokens:100}}:{content:[{text:content}],usage:{input_tokens:100,output_tokens:100}})
 }})
 const call=(path,method='GET',body,cookie=app.cookie)=>app.request('/api/buoy'+path,{method,body,cookie})
 const api=async(...args)=>{const r=await call(...args);assert.ok(r.ok,await r.clone().text());return r.json()}
 const configure=async(extra={})=>{const {settings}=await api('/ai');return api('/ai/settings','PUT',{...settings,enabled:true,classes:['tickets','revenue','transcripts'],budgetMinor:100,requestMinor:100,requestsPerMinute:100,noTraining:true,termsReference:'synthetic-buoy-8001 no-training agreement',...extra})}
 for(const [id,name]of [['synthetic-buoy-8002','Visible Harbour'],['synthetic-buoy-8003','Outside Coastal']])await api('/accounts','POST',{id,name,renewalDate:'2027-12-31',noticeDays:30,renewalEvidence:'synthetic-buoy-8004',billing:null,support:null})
 return {app,api,call,sent,configure,setScripted(value){scripted=value},setIndexes(value){indexes=value},setProposals(value){selectedProposals=value},setGeneratedInvalid(value){generatedInvalid=value},setOnProvider(value){onProvider=value},setInvalid(value){invalid=value},setFail(value){fail=value}}
}
export async function seedQuestionEvidence({api}){
 const rows=[{id:'synthetic-buoy-8002',name:'Visible Harbour',amountMinor:65432100,totalMinor:98765432,openTickets:12,urgentTickets:3,reference:'synthetic-buoy-8021',renewalDate:'2026-12-31'}, {id:'synthetic-buoy-8020',name:'Selected Harbour',amountMinor:12345600,totalMinor:45678901,openTickets:7,urgentTickets:2,reference:'synthetic-buoy-8022',renewalDate:'2027-02-15'}]
 for(const row of rows){
  const current=(await api('/state')).accounts.find(a=>a.id===row.id)
  const document={id:row.id,name:row.name,renewalDate:row.renewalDate,noticeDays:30,renewalEvidence:row.reference,billing:{observedAt:'2026-10-25',reference:row.reference+' invoice',currency:'USD',totalMinor:row.totalMinor,creditsMinor:0,allocatedMinor:0,dueDate:'2026-10-24'},support:{observedAt:'2026-10-25',reference:row.reference+' tickets',openTickets:row.openTickets,urgentTickets:row.urgentTickets}}
  await api('/accounts'+(current?'/'+row.id:''),current?'PUT':'POST',{...document,...(current?{revision:current.revision}:{})})
  await api('/accounts/'+row.id+'/contract','POST',{revision:(await api('/state')).accounts.find(a=>a.id===row.id).revision,contract:{currency:'USD',contractStart:'2026-01-01',contractEnd:'2027-12-31',source:{reference:row.reference,confirmedOn:'2026-10-25'},lines:[{product:'Recorded subscription',quantity:1,amountMinor:row.amountMinor,frequency:'annual',entitlements:row.reference}]}})
 }
 return rows
}
export async function aiQuestionJourney(){
 const f=await aiFixture(),{app,api,call,sent,configure}=f
 try{
  await configure({classes:['tickets','revenue']})
  const fixtures=await seedQuestionEvidence(f)
  await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'synthetic-buoy-8005@example.test',displayName:'Scoped CSM',role:'member'}})
  const cookie=await app.signIn('synthetic-buoy-8005@example.test'),person=(await api('/state','GET',undefined,cookie)).operator
  for(const row of fixtures)await api('/accounts/'+row.id+'/owner','PUT',{ownerId:person.id})
  for(const role of ['csm','support','sales','finance']){
   await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:role,scope:{kind:'own'}})
   const expected=role==='sales'?[]:fixtures.map(row=>({id:row.id,name:row.name,renewalDate:row.renewalDate,health:'at-risk',commercial:role==='support'?{currency:'USD',label:'100,000 or more USD'}:{currency:'USD',arrMinor:row.amountMinor,mrrMinor:row.amountMinor/12},citation:'/app/accounts/'+row.id}))
   f.setScripted(true)
   for(const [questionIndex,question] of scriptedQuestions.entries()){
    const answer=await api('/ai/questions','POST',{question,consent:true},cookie)
    const payload=JSON.parse(sent.at(-1).body.messages[0].content.slice(sent.at(-1).body.messages[0].content.indexOf('{')))
    assert.deepEqual(payload.records,expected,'Every transmitted field equals the current permitted projection for '+role)
    const selected=role==='sales'?[]:[[expected[0]],[expected[1]],expected,[],[]][questionIndex]
    assert.deepEqual(answer.claims,selected,'Question-specific substantive selection for '+role+': '+question)
    assert.ok(answer.missing.some(s=>s.includes('executive contacts')))
    for(const excluded of ['emails','transcripts','usage'])assert.ok(answer.missing.includes(excluded+' excluded by owner policy.'))
    for(const c of answer.claims)assert.equal((await app.request(c.citation,{cookie})).status,200)
    for(const value of [answer,sent.at(-1)])assert.doesNotMatch(JSON.stringify(value),/Outside Coastal|synthetic-buoy-8003|98765432|45678901|synthetic-buoy-8021|synthetic-buoy-8022|openTickets|urgentTickets/)
   }
  }
  f.setScripted(false);f.setIndexes(null)
  const before=sent.length;assert.equal((await call('/ai/questions','POST',{question:'Consent missing'})).status,403);assert.equal(sent.length,before)
  f.setInvalid(true);assert.equal((await call('/ai/questions','POST',{question:'Invalid citation',consent:true})).status,502)
  const agent=await api('/agent-tokens','POST',{label:'synthetic-buoy-8006'});assert.equal((await app.request('/api/buoy/ai/questions',{method:'POST',token:agent.token,body:{question:'No agent paid scope',consent:true}})).status,403)
 }finally{await app.close()}
}
export async function aiConversationJourney(){
 const f=await aiFixture(),{app,api,call,configure}=f
 try{
  await configure()
  await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'synthetic-buoy-8008@example.test',displayName:'Transcript administrator',role:'member'}})
  const colleague=await app.signIn('synthetic-buoy-8008@example.test'),operator=(await api('/state','GET',undefined,colleague)).operator
  const lines=['synthetic-buoy-8030 private unselected opening','I commit to send synthetic-buoy-8031 implementation checklist.','synthetic-buoy-8032 private unselected context','A competitor synthetic-buoy-8033 was mentioned.','synthetic-buoy-8034 private unselected context','We request synthetic-buoy-8035 expansion.','synthetic-buoy-8036 private unselected ending']
  const expected=[{kind:'task',line:lines[1],lineNumber:2},{kind:'risk',line:lines[3],lineNumber:4},{kind:'expansion',line:lines[5],lineNumber:6}]
  const exact=proposals=>proposals.map(({kind,line,lineNumber})=>({kind,line,lineNumber}))
  const absent=(value,values)=>{for(const line of values)assert.ok(!JSON.stringify(value).includes(line),'Source text is absent from this retained public image')}
  const input={accountId:'synthetic-buoy-8002',transcript:lines.join('\n'),consent:true}
  f.setProposals([{kind:'task',line:2},{kind:'risk',line:4},{kind:'expansion',line:6}])
  const calls=f.sent.length
  for(const path of ['/ai/conversations','/ai/proposals/synthetic-buoy-absent/decision'])assert.equal((await call(path,'POST',input,colleague)).status,403)
  assert.equal((await call('/ai/proposals','GET',undefined,colleague)).status,403);assert.equal(f.sent.length,calls)
  await app.request('/auth/operator/role',{method:'POST',cookie:app.cookie,body:{operatorId:operator.id,role:'admin'}})
  const admin=await app.signIn('synthetic-buoy-8008@example.test')
  assert.equal((await call('/ai/settings','PUT',{},admin)).status,403)
  const prepared=await api('/ai/conversations','POST',input,admin)
  assert.deepEqual(exact(prepared.proposals),expected)
  const retained=(await api('/ai/proposals')).proposals
  assert.deepEqual(exact(retained),expected)
  assert.deepEqual(retained.map(p=>p.status),['pending','pending','pending'])
  absent(retained,[lines[0],lines[2],lines[4],lines[6]])
  assert.ok((await api('/ai')).costs.some(c=>c.feature==='conversations'&&c.chargedMinor===1));assert.deepEqual((await api('/state')).tasks,[])
  const [task,risk,expansion]=prepared.proposals
  for(const suggestion of [risk,expansion])assert.equal((await call('/ai/proposals/'+suggestion.id+'/decision','POST',{action:'accept',dueDate:'2027-01-01'})).status,409)
  const accepted=await api('/ai/proposals/'+task.id+'/decision','POST',{action:'accept',dueDate:'2027-01-01'})
  const saved=(await api('/state')).tasks;assert.equal(saved.length,1);assert.equal(saved[0].id,accepted.taskId);assert.equal(saved[0].title,task.line)
  assert.equal((await call('/ai/proposals/'+task.id+'/decision','POST',{action:'accept',dueDate:'2027-01-01'})).status,409)
  await api('/ai/proposals/'+expansion.id+'/decision','POST',{action:'discard'})
  const afterDiscard=(await api('/ai/proposals')).proposals
  assert.deepEqual(exact(afterDiscard),expected.slice(0,2));assert.deepEqual(afterDiscard.map(p=>p.status),['accepted','pending']);assert.equal((await api('/state')).tasks.length,1)
  absent({proposals:afterDiscard,state:await api('/state')},[lines[0],lines[2],lines[4],lines[5],lines[6]])
  const audit=(await api('/audit?action=ai.')).entries;assert.ok(audit.some(e=>e.action==='ai.proposal-discarded'));absent(audit,lines.map(line=>line.match(/synthetic-buoy-\d+/)[0]))
  await api('/accounts/synthetic-buoy-8002','DELETE',{confirmation:'Visible Harbour'});assert.deepEqual((await api('/ai/proposals')).proposals,[])
  const remaining=await api('/state');assert.deepEqual(remaining.tasks,[]);assert.ok(!remaining.proposals.some(p=>p.accountId==='synthetic-buoy-8002'))
  absent({remaining,proposals:await api('/ai/proposals'),audit:await api('/audit?action=ai.')},lines.map(line=>line.match(/synthetic-buoy-\d+/)[0]))
 }finally{await app.close()}
}
export async function aiControlJourney(){
 const f=await aiFixture(),{app,api,call,sent,configure}=f
 try{
  assert.equal((await api('/ai')).enabled,false);assert.equal((await api('/ai')).trainingAttestation.status,'unverified');assert.equal((await call('/ai/questions','POST',{question:'Default off',consent:true})).status,403);assert.equal(sent.length,0)
  const original=(await api('/ai')).settings
  for(const extra of [{noTraining:false,termsReference:'synthetic-buoy-8040'},{noTraining:undefined,termsReference:'synthetic-buoy-8040'},{noTraining:true,termsReference:''}]){
   assert.equal((await call('/ai/settings','PUT',{...original,enabled:true,noTraining:true,...extra})).status,400)
   assert.deepEqual((await api('/ai')).settings,original);assert.equal((await api('/ai')).enabled,false);assert.equal(sent.length,0)
  }
  const termsReference='synthetic-buoy-8041 owner recorded no-training agreement'
  await configure({classes:['tickets'],model:'synthetic-buoy-anthropic',termsReference})
  const reloaded=await api('/ai');assert.equal(reloaded.settings.termsReference,termsReference);assert.equal(reloaded.enabled,true);assert.equal(reloaded.trainingAttestation.status,'unverified')
  let count=sent.length
  assert.equal((await call('/ai/conversations','POST',{accountId:'synthetic-buoy-8002',transcript:'synthetic-buoy-private-transcript',consent:true})).status,403);assert.equal(sent.length,count)
  await api('/ai/questions','POST',{question:'Prepare a meeting brief',consent:true});assert.equal(sent.at(-1).body.model,'synthetic-buoy-anthropic');assert.equal(sent.at(-1).url,'https://api.anthropic.com/v1/messages');assert.doesNotMatch(JSON.stringify(sent),/private-transcript/)
  assert.ok((await api('/ai')).costs.some(c=>c.feature==='questions'&&c.chargedMinor===1))
  await configure();count=sent.length
  for(const consent of [undefined,false]){assert.equal((await call('/ai/conversations','POST',{accountId:'synthetic-buoy-8002',transcript:'synthetic-buoy-8042 unapproved transcript',consent})).status,403);assert.equal(sent.length,count);assert.deepEqual((await api('/ai/proposals')).proposals,[])}
  assert.doesNotMatch(JSON.stringify(sent),/synthetic-buoy-8042/)
  await api('/ai/conversations','POST',{accountId:'synthetic-buoy-8002',transcript:'One commitment.\nA competitor.\nExpansion.',consent:true});assert.ok((await api('/ai')).costs.some(c=>c.feature==='conversations'&&c.chargedMinor===1))
  await configure({provider:'openai',model:'synthetic-buoy-openai'});await api('/ai/questions','POST',{question:'Current accounts',consent:true});assert.equal(sent.at(-1).url,'https://api.openai.com/v1/chat/completions')
  await configure({provider:'compatible'});count=sent.length;assert.equal((await call('/ai/questions','POST',{question:'Missing selected-provider credential',consent:true})).status,409);assert.equal(sent.length,count)
  await configure({provider:'openai',model:'synthetic-buoy-openai',budgetMinor:2});count=sent.length;assert.equal((await call('/ai/questions','POST',{question:'Over budget',consent:true})).status,403);assert.equal(sent.length,count)
  await configure({requestsPerMinute:1});count=sent.length;assert.equal((await call('/ai/questions','POST',{question:'Minute cap',consent:true})).status,429);assert.equal(sent.length,count)
  await configure();await api('/agents/settings','PUT',{disabled:true});count=sent.length;assert.equal((await call('/ai/questions','POST',{question:'Killed',consent:true})).status,409);assert.equal(sent.length,count);await api('/agents/settings','PUT',{disabled:false})
  await configure({enabled:false});count=sent.length;assert.equal((await call('/ai/questions','POST',{question:'Off',consent:true})).status,403);assert.equal(sent.length,count)
  const page=await(await app.request('/app/ai',{cookie:app.cookie})).text();assert.doesNotMatch(page,/id="ai-question"|id="ai-conversation"/)
  await configure({provider:'anthropic',model:'synthetic-buoy-anthropic'});f.setFail(true);assert.equal((await call('/ai/questions','POST',{question:'Provider unavailable',consent:true})).status,502);assert.ok((await api('/ai')).costs.some(c=>c.status==='unknown'&&c.heldMinor>0))
  await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'synthetic-buoy-8007@example.test',displayName:'Ordinary colleague',role:'member'}});const member=await app.signIn('synthetic-buoy-8007@example.test');assert.equal((await call('/ai/settings','PUT',{},member)).status,403)
 }finally{await app.close()}
}

export async function aiScheduleJourney(){
 const f=await aiFixture(),{app,api,call,sent,configure}=f
 try{
  await configure()
  await app.scheduled('0 * * * *',Date.parse('2026-10-25T12:00:00Z'));assert.equal(sent.length,0,'No standing consent means no scheduled request')
  const grant={name:'synthetic-buoy-8100 daily review',feature:'questions',accountId:'synthetic-buoy-8002',question:'Prepare a meeting brief',hourUtc:12,authorize:true,policyRevision:(await api('/ai')).settings.revision}
  assert.equal((await call('/ai/schedules','POST',{...grant,authorize:false})).status,403);assert.equal(sent.length,0)
  await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'synthetic-buoy-8101@example.test',displayName:'Schedule administrator',role:'admin'}})
  const admin=await app.signIn('synthetic-buoy-8101@example.test')
  assert.equal((await call('/ai/schedules','POST',grant,admin)).status,403);assert.equal((await call('/ai/schedules','GET',undefined,admin)).status,403)
  const row=(await api('/ai/schedules','POST',grant)).schedules[0]
  assert.equal(row.feature,grant.feature);assert.equal(row.name,grant.name);assert.equal(row.account_id,grant.accountId);assert.equal(row.question,grant.question);assert.equal(row.hour_utc,grant.hourUtc);assert.deepEqual(row.policy,(await api('/ai')).settings,'Standing consent records the entire reviewed model, classes, tariffs and limits');assert.deepEqual((await api('/ai/schedules')).schedules,[row])
  await app.scheduled('0 * * * *',Date.parse('2026-10-25T11:00:00Z'));assert.equal(sent.length,0)
  await Promise.all([app.scheduled('0 * * * *',Date.parse('2026-10-25T12:00:00Z')),app.scheduled('0 * * * *',Date.parse('2026-10-25T12:00:00Z'))]);assert.equal(sent.length,1,'Concurrent replay reserves only one provider call');assert.doesNotMatch(JSON.stringify(sent),/Outside Coastal|8003/)
  assert.equal((await call('/ai/schedules/'+row.id,'DELETE',{revision:row.revision},admin)).status,403)
  await api('/ai/schedules/'+row.id,'DELETE',{revision:row.revision})
  const count=sent.length;await app.scheduled('0 * * * *',Date.parse('2026-10-26T12:00:00Z'));assert.equal(sent.length,count,'Revocation stops subsequent scheduled requests')
  const fresh=(await api('/ai/schedules','POST',grant)).schedules.find(s=>!s.revoked_at)
  await configure({classes:[]});await app.scheduled('0 * * * *',Date.parse('2026-10-26T12:00:00Z'));assert.equal(sent.length,count,'Changed policy requires fresh consent')
  assert.ok(fresh)
  const audit=(await api('/audit?action=ai.schedule')).entries;for(const action of ['ai.schedule-authorized','ai.schedule-completed','ai.schedule-revoked'])assert.ok(audit.some(e=>e.action===action),action)
  const receipt=audit.find(e=>e.action==='ai.schedule-completed');assert.match(receipt.detail,/Request receipt [a-f0-9-]+\. Output not retained\./);const requestAudit=(await api('/audit?action=ai.requested')).entries;assert.ok(requestAudit.some(e=>receipt.detail.includes(e.subject.slice(3))))
  assert.doesNotMatch(JSON.stringify(audit),/Prepare a meeting brief|daily review/)
  await configure()
  const preserved=(await api('/ai/schedules','POST',{...grant,policyRevision:(await api('/ai')).settings.revision})).schedules.find(s=>!s.revoked_at&&s.policy_revision!==fresh.policy_revision)
  assert.ok(preserved);assert.equal(preserved.last_slot,null)
  const ledgerBefore=(await api('/ai')).costs,requestsBefore=(await api('/audit?action=ai.requested')).entries,countBefore=sent.length
  const ownerId=(await api('/state')).operator.id
  assert.equal((await app.request('/auth/step-up',{method:'POST',cookie:app.cookie,body:{action:'owner:transfer'}})).status,202)
  const proof=app.mails.findLast(mail=>mail.to.includes('owner@example.test'))
  const proofUrl=new URL(proof.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'))
  assert.equal((await app.request(proofUrl.pathname+proofUrl.search,{cookie:app.cookie})).status,200)
  assert.equal((await app.request('/auth/confirm',{method:'POST',cookie:app.cookie,body:{token:proofUrl.searchParams.get('token')}})).status,303)
  assert.equal((await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'synthetic-buoy-8102@example.test',displayName:'Second owner',role:'owner'}})).status,202)
  const second=await app.signIn('synthetic-buoy-8102@example.test')
  for(const status of ['inactive','active']){
   const changed=await app.request('/auth/operator/status',{method:'POST',cookie:second,body:{operatorId:ownerId,status}})
   assert.equal(changed.status,200);const owner=await changed.json();assert.ok(owner.version>preserved.owner_version);assert.equal(owner.role,'owner');assert.equal(owner.status,status)
  }
  app.cookie=await app.signIn('owner@example.test')
  assert.deepEqual((await api('/ai/schedules')).schedules.find(s=>s.id===preserved.id),preserved,'Native owner reactivation preserves the stored schedule without renewing its authority')
  await app.scheduled('0 * * * *',Date.parse('2026-10-27T12:00:00Z'))
  assert.equal(sent.length,countBefore,'A changed owner version makes no subsequent provider request')
  assert.deepEqual((await api('/ai')).costs,ledgerBefore,'A changed owner version makes no request or cost reservation')
  assert.deepEqual((await api('/audit?action=ai.requested')).entries,requestsBefore,'No request receipt is created')
  assert.deepEqual((await api('/ai/schedules')).schedules.find(s=>s.id===preserved.id),preserved,'No daily slot reservation is created')
  await api('/accounts/synthetic-buoy-8002','DELETE',{confirmation:'Visible Harbour'});assert.equal((await api('/ai/schedules')).schedules.length,0,'Account erasure removes its scheduled question')
 }finally{await app.close()}
}
export async function aiGeneratedJourney(){
 const f=await aiFixture(),{app,api,call,sent,configure}=f
 try{
  await configure()
  await seedQuestionEvidence(f)
  await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'synthetic-buoy-8200@example.test',displayName:'Generated answer reader',role:'member'}})
  const cookie=await app.signIn('synthetic-buoy-8200@example.test'),person=(await api('/state','GET',undefined,cookie)).operator
  for(const accountId of ['synthetic-buoy-8002','synthetic-buoy-8020'])await api('/accounts/'+accountId+'/owner','PUT',{ownerId:person.id})
  f.setScripted(true)
  for(const role of ['csm','support']){
   await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:role,scope:{kind:'own'}})
   for(const [questionIndex,question] of scriptedQuestions.entries()){
    const answer=await api('/ai/answers','POST',{question,consent:true},cookie)
    const expected=[
     [['Harbour risk assessment: '+JSON.stringify({status:'at-risk'}),'synthetic-buoy-8002','health']],
     [['Next-quarter renewal: '+JSON.stringify({renewalDate:'2027-02-15'}),'synthetic-buoy-8020','renewal']],
     [
      ['Meeting preparation: '+JSON.stringify({name:'Visible Harbour'}),'synthetic-buoy-8002','identity'],
      ['Meeting preparation: '+JSON.stringify({renewalDate:'2026-12-31'}),'synthetic-buoy-8002','renewal'],
      ['Meeting preparation: '+JSON.stringify({status:'at-risk'}),'synthetic-buoy-8002','health'],
      ['Meeting preparation: '+JSON.stringify({name:'Selected Harbour'}),'synthetic-buoy-8020','identity'],
      ['Meeting preparation: '+JSON.stringify({renewalDate:'2027-02-15'}),'synthetic-buoy-8020','renewal'],
      ['Meeting preparation: '+JSON.stringify({status:'at-risk'}),'synthetic-buoy-8020','health'],
     ],[],[],
    ][questionIndex]
    assert.deepEqual(answer.claims.map(c=>[c.text,c.citations[0].accountId,c.citations[0].field]),expected,'Independent substantive generated answer: '+question)
    assert.ok(answer.missing.some(s=>s.includes('executive contacts')));assert.ok(answer.missing.some(s=>s.includes('detailed usage')))
    for(const claim of answer.claims){assert.ok(claim.text&&claim.citations.length);for(const source of claim.citations){const receipt=await app.request(source.citation,{cookie});assert.equal(receipt.status,200);assert.deepEqual((await receipt.json()).source,source);assert.ok(claim.text.includes(source.quote))}}
    assert.doesNotMatch(JSON.stringify(answer),/Outside Coastal|8003/);assert.doesNotMatch(JSON.stringify(sent.at(-1)),/Outside Coastal|8003/);if(role==='support'){assert.doesNotMatch(JSON.stringify(answer),/65432100|5452675|urgentTickets|8201/);assert.doesNotMatch(JSON.stringify(sent.at(-1)),/65432100|5452675|urgentTickets|8201/);const payload=JSON.parse(sent.at(-1).body.messages[0].content.slice(sent.at(-1).body.messages[0].content.indexOf('{')));assert.ok(payload.records.some(s=>s.field==='commercial'&&s.value.label==='100,000 or more USD'))}
   }
  }
  f.setScripted(false)
  const source=(await api('/ai/answers','POST',{question:'Meeting brief',consent:true},cookie)).claims[0].citations[0]
  const unchangedAuthority=(await api('/state','GET',undefined,cookie)).accounts.map(a=>a.id)
  const changed=(await api('/state')).accounts.find(a=>a.id==='synthetic-buoy-8002')
  await api('/accounts/'+changed.id,'PUT',{...changed,name:'Updated Harbour',revision:changed.revision})
  assert.deepEqual((await api('/state','GET',undefined,cookie)).accounts.map(a=>a.id),unchangedAuthority,'The reader retains the same account authority')
  assert.equal((await app.request(source.citation,{cookie})).status,409,'An old citation refuses changed evidence while the reader remains authorized')
  const refreshed=(await api('/ai/answers','POST',{question:'Meeting brief',consent:true},cookie)).claims[0].citations[0]
  assert.equal((await app.request(refreshed.citation,{cookie})).status,200,'A fresh citation reads the changed permitted source')
  for(const invalid of [true,'quote','missing']){f.setGeneratedInvalid(invalid);assert.equal((await call('/ai/answers','POST',{question:'Invalid source',consent:true},cookie)).status,502)}f.setGeneratedInvalid(false)
  const before=sent.length;assert.equal((await call('/ai/answers','POST',{question:'Without consent'},cookie)).status,403);assert.equal(sent.length,before)
  assert.equal((await app.request('/api/buoy/ai/evidence/synthetic-buoy-8003/identity?revision=absent',{cookie})).status,404)
  await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:'support',scope:{kind:'own'},commercial:'none'})
  assert.equal((await app.request('/api/buoy/ai/evidence/synthetic-buoy-8002/billing?revision='+source.revision,{cookie})).status,404)
  f.setOnProvider(async()=>{await api('/accounts/synthetic-buoy-8002/owner','PUT',{ownerId:(await api('/state')).operator.id})})
  assert.equal((await call('/ai/answers','POST',{question:'Scope changed during call',consent:true},cookie)).status,409);f.setOnProvider(undefined)
  assert.equal((await app.request(source.citation,{cookie})).status,404,'Old citation cannot bypass current scope')
 }finally{await app.close()}
}
