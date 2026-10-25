import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'

export async function aiFixture(){
 const sent=[];let invalid=false,fail=false,generatedInvalid=false,onProvider
 const app=await startWorker({clock:Date.parse('2026-10-25T12:00:00Z'),bindings:()=>({AI_ANTHROPIC_API_KEY:'synthetic-buoy-8000',AI_OPENAI_API_KEY:'synthetic-buoy-8010'}),providerFetch:async request=>{
  assert.equal(request.headers.get(new URL(request.url).hostname==='api.anthropic.com'?'x-api-key':'authorization'),new URL(request.url).hostname==='api.anthropic.com'?'synthetic-buoy-8000':'Bearer synthetic-buoy-8010','Provider selection never forwards another provider credential');const body=await request.json();sent.push({url:request.url,body});if(fail)return new Response('unavailable',{status:503})
  const payload=JSON.parse(body.messages[0].content.slice(body.messages[0].content.indexOf('{')))
  if(onProvider)await onProvider()
  const result=payload.instructions.startsWith('Generate')?(generatedInvalid?{claims:[{text:'Unsupported claim',sources:generatedInvalid==='missing'?[]:[{index:generatedInvalid==='quote'?0:99999,quote:'invented'}]}]}:{claims:payload.records.map((r,index)=>({text:r.accountName+' has recorded '+r.field+' evidence: '+r.quote,sources:[{index,quote:r.quote}]}))}):invalid?{indexes:[999999]}:payload.instructions.startsWith('Identify')?{proposals:[{kind:'task',line:1},{kind:'risk',line:2},{kind:'expansion',line:3}]}:{indexes:payload.records.map((_,i)=>i)}
  const content=JSON.stringify(result)
  return Response.json(body.model==='synthetic-buoy-openai'?{choices:[{message:{content}}],usage:{prompt_tokens:100,completion_tokens:100}}:{content:[{text:content}],usage:{input_tokens:100,output_tokens:100}})
 }})
 const call=(path,method='GET',body,cookie=app.cookie)=>app.request('/api/buoy'+path,{method,body,cookie})
 const api=async(...args)=>{const r=await call(...args);assert.ok(r.ok,await r.clone().text());return r.json()}
 const configure=async(extra={})=>{const {settings}=await api('/ai');return api('/ai/settings','PUT',{...settings,enabled:true,classes:['tickets','revenue','transcripts'],budgetMinor:100,requestMinor:100,requestsPerMinute:100,noTraining:true,termsReference:'synthetic-buoy-8001 no-training agreement',...extra})}
 for(const [id,name]of [['synthetic-buoy-8002','Visible Harbour'],['synthetic-buoy-8003','Outside Coastal']])await api('/accounts','POST',{id,name,renewalDate:'2027-12-31',noticeDays:30,renewalEvidence:'synthetic-buoy-8004',billing:null,support:null})
 return {app,api,call,sent,configure,setGeneratedInvalid(value){generatedInvalid=value},setOnProvider(value){onProvider=value},setInvalid(value){invalid=value},setFail(value){fail=value}}
}
export async function aiQuestionJourney(){
 const f=await aiFixture(),{app,api,call,sent,configure}=f
 try{
  await configure()
  await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'synthetic-buoy-8005@example.test',displayName:'Scoped CSM',role:'member'}})
  const cookie=await app.signIn('synthetic-buoy-8005@example.test'),person=(await api('/state','GET',undefined,cookie)).operator
  await api('/accounts/synthetic-buoy-8002/owner','PUT',{ownerId:person.id})
  for(const role of ['csm','support']){
   await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:role,scope:{kind:'own'}})
   for(const question of ['Why is Harbour at risk?','Which accounts renew next quarter?','Prepare a meeting brief','Which accounts have no executive contact?','What evidence is missing?']){
    const answer=await api('/ai/questions','POST',{question,consent:true},cookie)
    assert.deepEqual(answer.claims.map(c=>c.id),['synthetic-buoy-8002'])
    assert.ok(answer.missing.some(s=>s.includes('executive contacts')))
    for(const c of answer.claims)assert.equal((await app.request(c.citation,{cookie})).status,200)
    assert.doesNotMatch(JSON.stringify(answer),/Outside Coastal|8003/)
    assert.doesNotMatch(JSON.stringify(sent.at(-1)),/Outside Coastal|8003/)
   }
  }
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
  const input={accountId:'synthetic-buoy-8002',transcript:'I commit to send the implementation checklist.\nA competitor was mentioned.\nWe request an expansion.\nsynthetic-buoy-unselected-line',consent:true}
  const calls=f.sent.length
  for(const path of ['/ai/conversations','/ai/proposals/synthetic-buoy-absent/decision'])assert.equal((await call(path,'POST',input,colleague)).status,403)
  assert.equal((await call('/ai/proposals','GET',undefined,colleague)).status,403);assert.equal(f.sent.length,calls)
  await app.request('/auth/operator/role',{method:'POST',cookie:app.cookie,body:{operatorId:operator.id,role:'admin'}})
  const admin=await app.signIn('synthetic-buoy-8008@example.test')
  assert.equal((await call('/ai/settings','PUT',{},admin)).status,403)
  const prepared=await api('/ai/conversations','POST',input,admin)
  assert.equal(prepared.proposals.length,3);assert.doesNotMatch(JSON.stringify(await api('/ai/proposals')),/unselected-line/);assert.ok((await api('/ai')).costs.some(c=>c.feature==='conversations'&&c.chargedMinor===1));assert.deepEqual(prepared.proposals.map(p=>p.lineNumber),[1,2,3]);assert.deepEqual((await api('/state')).tasks,[])
  const [task,risk,expansion]=prepared.proposals
  assert.equal((await call('/ai/proposals/'+risk.id+'/decision','POST',{action:'accept',dueDate:'2027-01-01'})).status,409)
  const accepted=await api('/ai/proposals/'+task.id+'/decision','POST',{action:'accept',dueDate:'2027-01-01'})
  const saved=(await api('/state')).tasks;assert.equal(saved.length,1);assert.equal(saved[0].id,accepted.taskId);assert.equal(saved[0].title,task.line)
  assert.equal((await call('/ai/proposals/'+task.id+'/decision','POST',{action:'accept',dueDate:'2027-01-01'})).status,409)
  await api('/ai/proposals/'+expansion.id+'/decision','POST',{action:'discard'})
  assert.ok(!(await api('/ai/proposals')).proposals.some(p=>p.id===expansion.id));assert.equal((await api('/state')).tasks.length,1)
  const audit=(await api('/audit?action=ai.')).entries;assert.ok(audit.some(e=>e.action==='ai.proposal-discarded'));assert.doesNotMatch(JSON.stringify(audit),/implementation checklist|competitor was/)
  await api('/accounts/synthetic-buoy-8002','DELETE',{confirmation:'Visible Harbour'});assert.deepEqual((await api('/ai/proposals')).proposals,[]);const remaining=await api('/state');assert.deepEqual(remaining.tasks,[]);assert.ok(!remaining.proposals.some(p=>p.accountId==='synthetic-buoy-8002'));assert.doesNotMatch(JSON.stringify(await api('/audit?action=ai.')),/implementation checklist|competitor was|unselected-line/)
 }finally{await app.close()}
}
export async function aiControlJourney(){
 const f=await aiFixture(),{app,api,call,sent,configure}=f
 try{
  assert.equal((await api('/ai')).enabled,false);assert.equal((await api('/ai')).trainingAttestation.status,'unverified');assert.equal((await call('/ai/questions','POST',{question:'Default off',consent:true})).status,403);assert.equal(sent.length,0)
  await configure({classes:['tickets'],model:'synthetic-buoy-anthropic'})
  let count=sent.length
  assert.equal((await call('/ai/conversations','POST',{accountId:'synthetic-buoy-8002',transcript:'synthetic-buoy-private-transcript',consent:true})).status,403);assert.equal(sent.length,count)
  await api('/ai/questions','POST',{question:'Prepare a meeting brief',consent:true});assert.equal(sent.at(-1).body.model,'synthetic-buoy-anthropic');assert.equal(sent.at(-1).url,'https://api.anthropic.com/v1/messages');assert.doesNotMatch(JSON.stringify(sent),/private-transcript/)
  assert.ok((await api('/ai')).costs.some(c=>c.feature==='questions'&&c.chargedMinor===1))
  await configure();await api('/ai/conversations','POST',{accountId:'synthetic-buoy-8002',transcript:'One commitment.\nA competitor.\nExpansion.',consent:true});assert.ok((await api('/ai')).costs.some(c=>c.feature==='conversations'&&c.chargedMinor===1))
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
  assert.equal(row.feature,'questions');assert.deepEqual(row.policy.classes,['tickets','revenue','transcripts']);assert.equal(row.policy.provider,'anthropic');assert.equal(row.policy.budgetMinor,100)
  await app.scheduled('0 * * * *',Date.parse('2026-10-25T11:00:00Z'));assert.equal(sent.length,0)
  await Promise.all([app.scheduled('0 * * * *',Date.parse('2026-10-25T12:00:00Z')),app.scheduled('0 * * * *',Date.parse('2026-10-25T12:00:00Z'))]);assert.equal(sent.length,1,'Concurrent replay reserves only one provider call');assert.doesNotMatch(JSON.stringify(sent),/Outside Coastal|8003/)
  assert.equal((await call('/ai/schedules/'+row.id,'DELETE',{revision:row.revision},admin)).status,403)
  await api('/ai/schedules/'+row.id,'DELETE',{revision:row.revision})
  const count=sent.length;await app.scheduled('0 * * * *',Date.parse('2026-10-26T12:00:00Z'));assert.equal(sent.length,count,'Revocation stops subsequent scheduled requests')
  const fresh=(await api('/ai/schedules','POST',grant)).schedules.find(s=>!s.revoked_at)
  await configure({classes:[]});await app.scheduled('0 * * * *',Date.parse('2026-10-26T12:00:00Z'));assert.equal(sent.length,count,'Changed policy requires fresh consent')
  assert.ok(fresh)
  const audit=(await api('/audit?action=ai.schedule')).entries;for(const action of ['ai.schedule-authorized','ai.schedule-completed','ai.schedule-revoked'])assert.ok(audit.some(e=>e.action===action),action)
  assert.doesNotMatch(JSON.stringify(audit),/Prepare a meeting brief|daily review/)
  await api('/accounts/synthetic-buoy-8002','DELETE',{confirmation:'Visible Harbour'});assert.equal((await api('/ai/schedules')).schedules.length,0,'Account erasure removes its scheduled question')
 }finally{await app.close()}
}
export async function aiGeneratedJourney(){
 const f=await aiFixture(),{app,api,call,sent,configure}=f
 try{
  await configure()
  const current=(await api('/state')).accounts.find(a=>a.id==='synthetic-buoy-8002')
  await api('/accounts/synthetic-buoy-8002','PUT',{id:current.id,name:current.name,revision:current.revision,renewalDate:current.renewalDate,noticeDays:current.noticeDays,renewalEvidence:current.renewalEvidence,billing:current.billing,support:{observedAt:'2026-10-25',reference:'synthetic-buoy-8201',openTickets:12,urgentTickets:3}})
  await api('/accounts/synthetic-buoy-8002/contract','POST',{revision:(await api('/state')).accounts.find(a=>a.id==='synthetic-buoy-8002').revision,contract:{currency:'USD',contractStart:'2026-01-01',contractEnd:'2027-12-31',source:{reference:'synthetic-buoy-8202',confirmedOn:'2026-10-25'},lines:[{id:'synthetic-buoy-8203',product:'Recorded subscription',quantity:1,amountMinor:65432100,frequency:'annual',entitlements:'synthetic-buoy-8204'}]}})
  await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'synthetic-buoy-8200@example.test',displayName:'Generated answer reader',role:'member'}})
  const cookie=await app.signIn('synthetic-buoy-8200@example.test'),person=(await api('/state','GET',undefined,cookie)).operator
  await api('/accounts/synthetic-buoy-8002/owner','PUT',{ownerId:person.id})
  for(const role of ['csm','support']){
   await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:role,scope:{kind:'own'}})
   for(const question of ['Why is Harbour at risk?','Which accounts renew next quarter?','Prepare a meeting brief','Which accounts have no executive contact?','What evidence is missing?']){
    const answer=await api('/ai/answers','POST',{question,consent:true},cookie)
    assert.ok(answer.claims.length>=3);assert.ok(answer.missing.some(s=>s.includes('executive contacts')))
    for(const claim of answer.claims){assert.ok(claim.text&&claim.citations.length);for(const source of claim.citations){const receipt=await app.request(source.citation,{cookie});assert.equal(receipt.status,200);assert.deepEqual((await receipt.json()).source,source);assert.ok(claim.text.includes(source.quote))}}
    assert.doesNotMatch(JSON.stringify(answer),/Outside Coastal|8003/);assert.doesNotMatch(JSON.stringify(sent.at(-1)),/Outside Coastal|8003/);if(role==='support'){assert.doesNotMatch(JSON.stringify(answer),/65432100|5452675|urgentTickets|8201/);assert.doesNotMatch(JSON.stringify(sent.at(-1)),/65432100|5452675|urgentTickets|8201/);assert.ok(answer.claims.some(c=>c.citations.some(s=>s.field==='commercial'&&s.value.label==='100,000 or more USD')))}
   }
  }
  const source=(await api('/ai/answers','POST',{question:'Meeting brief',consent:true},cookie)).claims[0].citations[0]
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
