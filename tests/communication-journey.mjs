import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {startWorker} from './worker.mjs'
export const corpus=JSON.parse(await readFile(new URL('./fixtures/communication-month.json',import.meta.url),'utf8'))
export async function communicationFixture(){
 let invalid=false,onProvider;const sent=[]
 const app=await startWorker({clock:Date.parse('2026-10-25T12:00:00Z'),bindings:()=>({AI_ANTHROPIC_API_KEY:'synthetic-buoy-9900'}),providerFetch:async request=>{
  const body=await request.json(),payload=JSON.parse(body.messages[0].content.slice(body.messages[0].content.indexOf('{')));sent.push(payload)
  if(onProvider)await onProvider()
  const row=payload.records[0],result={score:20,citations:[{messageId:row.id,quote:invalid?'fabricated source quotation':row.body}],themes:[{theme:'frustration',messageId:row.id,quote:row.body}]}
  return Response.json({content:[{text:JSON.stringify(result)}],usage:{input_tokens:100,output_tokens:100}})
 }})
 const call=(path,method='GET',body,cookie=app.cookie)=>app.request('/api/buoy'+path,{method,body,cookie})
 const api=async(...args)=>{const response=await call(...args);assert.ok(response.ok,await response.clone().text());return response.json()}
 const configure=async(extra={})=>api('/ai/settings','PUT',{...(await api('/ai')).settings,enabled:true,communicationsEnabled:true,classes:['emails','tickets'],budgetMinor:100,requestMinor:10,inputUsdPerMillion:1,outputUsdPerMillion:5,requestsPerMinute:100,noTraining:true,termsReference:'synthetic-buoy-9901 unverified terms',...extra})
 const account=corpus.accounts[0];await api('/accounts','POST',{id:account.id,name:account.name,renewalDate:'2027-09-30',noticeDays:30,renewalEvidence:'synthetic-buoy-9902',billing:{observedAt:'2026-10-25',reference:'synthetic-buoy-9903',currency:'USD',totalMinor:0,creditsMinor:0,allocatedMinor:0,dueDate:'2026-11-01'},support:{observedAt:'2026-10-25',reference:'synthetic-buoy-9904',openTickets:0,urgentTickets:0}})
 const ingest=async(message=account.messages[0],extra={})=>api('/ai/communications','POST',{id:message.id,accountId:account.id,dataClass:message.dataClass,observedOn:message.observedAt.slice(0,10),body:message.text,...extra})
 const score=(extra={})=>call('/ai/communications/score','POST',{accountId:account.id,month:'2026-09',consent:true,...extra})
 return {app,api,call,sent,configure,account,ingest,score,setInvalid(value){invalid=value},setOnProvider(value){onProvider=value}}
}
export async function communicationJourney(){
 const f=await communicationFixture(),{app,api,call,configure,ingest,score,sent,account}=f
 try{
  await ingest();assert.equal((await api('/ai')).communicationsEnabled,false);assert.equal((await score()).status,403);assert.equal(sent.length,0)
  await configure();assert.equal((await score({consent:false})).status,403);assert.equal(sent.length,0)
  const result=await (await score()).json();assert.equal(result.score,20);assert.equal(result.band,'at-risk');assert.equal(result.themes[0].theme,'frustration');assert.equal(result.citations[0].quote,account.messages[0].text)
  assert.deepEqual(sent[0].records.map(r=>r.id),[account.messages[0].id]);assert.ok(!JSON.stringify(sent[0]).includes('expected'))
  const source=await app.request(result.citations[0].citation,{cookie:app.cookie});assert.equal(source.status,200);assert.ok((await source.text()).includes(account.messages[0].text))
  const read=async()=>(await api('/state')).accounts.find(a=>a.id===account.id).health
  assert.equal((await read()).status,'at-risk');assert.equal((await read()).communication.score,20)
  const card={name:'Communication health',measures:[{key:'communication',name:'Communication sentiment',field:'communications.score',min:0,max:100,weight:1,direction:'higher',missing:'unknown'},{key:'support',name:'Support',field:'support.urgentTickets',min:0,max:10,weight:1,direction:'lower',missing:'unknown'}],bands:{riskBelow:40,healthyAt:70},segments:[]}
  await api('/scorecards/publish','POST',{revision:null,config:card});assert.equal((await read()).score,60)
  const ticket=account.messages.find(m=>m.dataClass==='tickets');await ingest(ticket);assert.equal((await read()).communication,null)
  await configure({classes:['emails']});await score();assert.ok(sent.at(-1).records.every(r=>r.dataClass==='emails'))
  await configure({communicationsEnabled:false});assert.equal((await read()).communication,null);assert.equal((await read()).score,100);assert.match((await read()).reasons.join(' '),/disabled; removed from health/)
  await configure({classes:['tickets']});await score();assert.deepEqual(sent.at(-1).records.map(r=>r.id),[ticket.id]);assert.equal((await call('/ai/messages/'+account.messages[0].id)).status,403)
  await configure({classes:[]});assert.equal((await score()).status,403);assert.match((await read()).reasons.join(' '),/excluded/)
  await configure();f.setInvalid(true);assert.equal((await score()).status,502);assert.equal((await read()).communication,null);f.setInvalid(false)
  const before=sent.length;await configure({budgetMinor:0});assert.equal((await score()).status,403);assert.equal(sent.length,before)
  await configure({requestsPerMinute:1});assert.equal((await score()).status,429);assert.equal(sent.length,before)
  await configure();await api('/agents/settings','PUT',{disabled:true});assert.equal((await score()).status,409);assert.equal(sent.length,before);await api('/agents/settings','PUT',{disabled:false})
  await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'synthetic-buoy-9905@example.test',displayName:'Source reader',role:'member'}})
  const member=await app.signIn('synthetic-buoy-9905@example.test')
  for(const [path,method]of [['/ai/communications','POST'],['/ai/communications/score','POST'],['/ai/messages/'+ticket.id,'GET']])assert.equal((await call(path,method,method==='POST'?{}:undefined,member)).status,403)
  f.setOnProvider(async()=>configure({communicationsEnabled:false}));assert.equal((await score()).status,409);f.setOnProvider(undefined);assert.equal((await read()).communication,null)
  await configure()
  const person=await api('/customer-people','POST',{kind:'contact',name:'synthetic-buoy-9906',accountIds:[account.id],source:'Synthetic customer directory'})
  const linked={...account.messages[2],id:'synthetic-buoy-9907'};await ingest(linked,{personId:person.id});await score()
  const revision=(await api('/customer-people')).records.find(p=>p.id===person.id).revision,privacy='/customer-people/'+person.id+'/privacy/',preview=await api(privacy+'preview','POST',{revision,emails:[]})
  await api(privacy+'erase','POST',{revision,confirmation:'synthetic-buoy-9906',request:{verificationMethod:'verified-offline',receivedDate:'2026-10-25',requesterReference:randomUUID()},fingerprint:preview.fingerprint,emails:[],redactions:[]})
  assert.equal((await call('/ai/messages/'+linked.id)).status,404);assert.equal((await read()).communication,null)
  const token=await api('/agent-tokens','POST',{label:'Synthetic communication refusal'});assert.equal((await app.request('/api/buoy/ai/communications/score',{method:'POST',token:token.token,body:{accountId:account.id,month:'2026-09',consent:true}})).status,403)
  await score();await api('/accounts/'+account.id,'DELETE',{confirmation:account.name});assert.equal((await call('/ai/messages/'+ticket.id)).status,404)
  const audit=await api('/audit?action=ai.');assert.ok(audit.entries.some(e=>e.action==='ai.refused'));assert.ok(!JSON.stringify(audit).includes(account.messages[0].text))
 }finally{await app.close()}
}
