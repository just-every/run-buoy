import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'

export async function aiFixture(){
 const sent=[];let invalid=false,fail=false
 const app=await startWorker({clock:Date.parse('2026-10-25T12:00:00Z'),bindings:()=>({AI_ANTHROPIC_API_KEY:'synthetic-buoy-8000',AI_OPENAI_API_KEY:'synthetic-buoy-8010'}),providerFetch:async request=>{
  assert.equal(request.headers.get(new URL(request.url).hostname==='api.anthropic.com'?'x-api-key':'authorization'),new URL(request.url).hostname==='api.anthropic.com'?'synthetic-buoy-8000':'Bearer synthetic-buoy-8010','Provider selection never forwards another provider credential');const body=await request.json();sent.push({url:request.url,body});if(fail)return new Response('unavailable',{status:503})
  const payload=JSON.parse(body.messages[0].content.slice(body.messages[0].content.indexOf('{')))
  const result=invalid?{indexes:[999999]}:payload.instructions.startsWith('Identify')?{proposals:[{kind:'task',line:1},{kind:'risk',line:2},{kind:'expansion',line:3}]}:{indexes:payload.records.map((_,i)=>i)}
  const content=JSON.stringify(result)
  return Response.json(body.model==='synthetic-buoy-openai'?{choices:[{message:{content}}],usage:{prompt_tokens:100,completion_tokens:100}}:{content:[{text:content}],usage:{input_tokens:100,output_tokens:100}})
 }})
 const call=(path,method='GET',body,cookie=app.cookie)=>app.request('/api/buoy'+path,{method,body,cookie})
 const api=async(...args)=>{const r=await call(...args);assert.ok(r.ok,await r.clone().text());return r.json()}
 const configure=async(extra={})=>{const {settings}=await api('/ai');return api('/ai/settings','PUT',{...settings,enabled:true,classes:['tickets','revenue','transcripts'],budgetMinor:100,requestMinor:100,requestsPerMinute:100,noTraining:true,termsReference:'synthetic-buoy-8001 no-training agreement',...extra})}
 for(const [id,name]of [['synthetic-buoy-8002','Visible Harbour'],['synthetic-buoy-8003','Outside Coastal']])await api('/accounts','POST',{id,name,renewalDate:'2027-12-31',noticeDays:30,renewalEvidence:'synthetic-buoy-8004',billing:null,support:null})
 return {app,api,call,sent,configure,setInvalid(value){invalid=value},setFail(value){fail=value}}
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
  await configure();const prepared=await api('/ai/conversations','POST',{accountId:'synthetic-buoy-8002',transcript:'I commit to send the implementation checklist.\nA competitor was mentioned.\nWe request an expansion.',consent:true})
  assert.equal(prepared.proposals.length,3);assert.deepEqual(prepared.proposals.map(p=>p.lineNumber),[1,2,3]);assert.deepEqual((await api('/state')).tasks,[])
  const [task,risk,expansion]=prepared.proposals
  assert.equal((await call('/ai/proposals/'+risk.id+'/decision','POST',{action:'accept',dueDate:'2027-01-01'})).status,409)
  const accepted=await api('/ai/proposals/'+task.id+'/decision','POST',{action:'accept',dueDate:'2027-01-01'})
  const saved=(await api('/state')).tasks;assert.equal(saved.length,1);assert.equal(saved[0].id,accepted.taskId);assert.equal(saved[0].title,task.line)
  assert.equal((await call('/ai/proposals/'+task.id+'/decision','POST',{action:'accept',dueDate:'2027-01-01'})).status,409)
  await api('/ai/proposals/'+expansion.id+'/decision','POST',{action:'discard'})
  assert.ok(!(await api('/ai/proposals')).proposals.some(p=>p.id===expansion.id));assert.equal((await api('/state')).tasks.length,1)
  const audit=(await api('/audit?action=ai.')).entries;assert.ok(audit.some(e=>e.action==='ai.proposal-discarded'));assert.doesNotMatch(JSON.stringify(audit),/implementation checklist|competitor was/)
  await api('/accounts/synthetic-buoy-8002','DELETE',{confirmation:'Visible Harbour'});assert.deepEqual((await api('/ai/proposals')).proposals,[])
 }finally{await app.close()}
}
export async function aiControlJourney(){
 const f=await aiFixture(),{app,api,call,sent,configure}=f
 try{
  await configure({classes:['tickets'],model:'synthetic-buoy-anthropic'})
  let count=sent.length
  assert.equal((await call('/ai/conversations','POST',{accountId:'synthetic-buoy-8002',transcript:'synthetic-buoy-private-transcript',consent:true})).status,403);assert.equal(sent.length,count)
  await api('/ai/questions','POST',{question:'Prepare a meeting brief',consent:true});assert.equal(sent.at(-1).body.model,'synthetic-buoy-anthropic');assert.equal(sent.at(-1).url,'https://api.anthropic.com/v1/messages');assert.doesNotMatch(JSON.stringify(sent),/private-transcript/)
  assert.ok((await api('/ai')).costs.some(c=>c.feature==='questions'&&c.chargedMinor===1))
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
