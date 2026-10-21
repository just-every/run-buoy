import assert from 'node:assert/strict'
import {createInappClient} from '../sdk/inapp.mjs'
import {createInappRelay} from '../sdk/relay.mjs'
import {inappFixture} from './inapp-fixture.mjs'
export async function inappJourney(app){
 const f=await inappFixture(app),{api,client,source,identity,outside,created,people,accounts,issued}=f
 const read=()=>api('/inapp'),state=await read()
 assert.equal(state.campaigns.length,4);assert.deepEqual(state.credentials[0].scope,['inapp']);assert.ok(state.credentials[0].creatorId);assert.equal(state.credentials[0].lastUsedAt,null)
 assert.ok(!JSON.stringify(state).includes(issued.secret));assert.ok(!JSON.stringify(state).includes('token_hash'))
 assert.deepEqual((await client.deliver(outside)).messages,[],'INAPP-001 mapped out-of-segment user gets no content')
 assert.deepEqual((await client.deliver({userId:'unknown',groupId:' Workspace 0 '})).messages,[],'INAPP-001 unknown exact claim gets no content')
 const unknown={userId:'unknown',groupId:'unknown-workspace',campaignId:created.banner.id,kind:'completion',messageId:'unmapped-completion'}
 assert.equal((await client.receipt(unknown)).accepted,1)
 assert.equal((await client.receipt(unknown)).duplicates,1)
 assert.ok((await api('/usage')).review.some(r=>r.userId==='unknown'&&r.eventCount===1),'INAPP-001 unknown receipt waits in usage review')
 assert.equal((await api('/customer-people/'+people[0].id+'/timeline')).events.length,0)
 // All concurrent requests compete in the same cap transaction, including pending reservations.
 const delivered=await Promise.all(Array.from({length:4},()=>client.deliver(identity)))
 const messages=delivered.flatMap(r=>r.messages)
 assert.equal(messages.length,4);assert.deepEqual(new Set(messages.map(m=>m.kind)),new Set(['announcement','banner','checklist','walkthrough']))
 assert.deepEqual((await client.deliver(identity)).messages,[],'INAPP-001 pending reservations prevent concurrent overspend without claiming a view')
 const before=(await api('/state')).accounts.find(a=>a.id===accounts[0].id).revision
 for(const message of messages){
  const receipt={...identity,campaignId:message.id,deliveryId:message.deliveryId,kind:'view',messageId:'view-'+message.id}
  assert.equal((await client.receipt(receipt)).accepted,1)
  assert.equal((await client.receipt({...receipt,kind:'completion'})).duplicates,1,'INAPP-001 source/message first payload wins')
  assert.equal((await client.receipt({...receipt,messageId:'second-view-'+message.id})).duplicates,1,'INAPP-001 repeated delivery view is counted once')
  assert.equal((await client.receipt({...receipt,kind:message.kind==='banner'?'dismissal':'completion',messageId:'done-'+message.id})).accepted,1)
 }
 assert.notEqual((await api('/state')).accounts.find(a=>a.id===accounts[0].id).revision,before)
 assert.equal((await read()).credentials[0].lastUsedAt!==null,true)
 const timeline=await api('/customer-people/'+people[0].id+'/timeline');assert.equal(timeline.events.length,8);assert.equal(timeline.events.filter(e=>e.kind==='completion').length,3);assert.equal((await read()).receipts.filter(r=>r.personId===people[0].id).length,8)
 assert.deepEqual((await client.deliver(identity)).messages,[],'INAPP-001 receipts enforce cap/terminal suppression server-side')
 // Separate sources and credentials cannot see content or inject arbitrary account/person identities.
 const second=await api('/usage/sources','POST',{name:'Other source',kind:'native',reference:'Second product'})
 const other=await api('/inapp/credentials','POST',{sourceId:second.id,label:'Other product server'})
 const cross=createInappClient({origin:app.origin,sourceId:source.id,credential:other.secret,fetch:(u,i)=>app.dispatch(new Request(u,i))})
 await assert.rejects(()=>cross.deliver(identity),e=>e.status===401)
 const intake=await api('/usage/sources/'+source.id+'/credentials','POST',{label:'Usage only',scope:['event']})
 const raw=(action,body,secret=issued.secret,headers={})=>app.dispatch(new Request(app.origin+'/api/buoy/inapp/'+action+'/'+source.id,{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json',...headers},body:JSON.stringify(body)}))
 assert.equal((await raw('deliver',identity,issued.secret,{origin:app.origin})).status,403)
 assert.equal((await raw('deliver',identity,intake.secret)).status,401,'INAPP-001 usage credential confers no in-app scope')
 assert.equal((await raw('deliver',{...identity,personId:people[1].id})).status,400)
 assert.equal((await raw('receipts',{...outside,campaignId:messages[0].id,deliveryId:messages[0].deliveryId,kind:'view',messageId:'stolen-delivery'})).status,409)
 const relay=createInappRelay({client,authenticate:async request=>request.headers.get('cookie')==='product-session=valid'?identity:null})
 const relayRequest=(body,headers={})=>new Request('https://product.example.test/inapp-relay',{method:'POST',headers:{origin:'https://product.example.test','content-type':'application/json',...headers},body:JSON.stringify(body)})
 assert.equal((await relay(relayRequest({action:'deliver'}))).status,401)
 assert.equal((await relay(relayRequest({action:'deliver'},{cookie:'product-session=valid',origin:'https://foreign.invalid'}))).status,403)
 // Two different people in one account have separate caps; a second reviewed
 // source identity for the original person shares that person's existing cap.
 const colleague=await api('/customer-people','POST',{kind:'user',name:'Harbour product colleague',accountIds:[accounts[0].id],source:'Reviewed customer product directory'})
 for(const [userId,personId]of [['colleague',colleague.id],['alias',people[0].id]]){
  const claim={sourceId:source.id,userId,groupId:identity.groupId,accountId:accounts[0].id,personId},preview=await api('/usage/mappings/preview','POST',claim)
  await api('/usage/mappings','POST',{...claim,fingerprint:preview.fingerprint})
 }
 assert.equal((await client.deliver({userId:'colleague',groupId:identity.groupId})).messages.length,4,'INAPP-001 caps belong to people rather than whole accounts')
 assert.equal((await client.deliver({userId:'alias',groupId:identity.groupId})).messages.length,0,'INAPP-001 reviewed aliases share a person cap')
 const fresh=await f.create('banner',{title:'Relay identity proof',maxViews:2})
 const spoof=await (await relay(relayRequest({action:'deliver',userId:outside.userId,groupId:outside.groupId},{cookie:'product-session=valid'}))).json()
 assert.equal(spoof.messages[0].id,fresh.id,'INAPP-001 relay overwrites browser-supplied identity')
 await api('/inapp/campaigns/'+fresh.id,'PUT',{enabled:false});assert.deepEqual((await client.deliver(identity)).messages,[])
 await app.request('/auth/invite',{cookie:app.cookie,method:'POST',body:{email:'inapp-colleague@example.test',displayName:'Product colleague',role:'member'}})
 const member=await app.signIn('inapp-colleague@example.test'),agent=await api('/agent-tokens','POST',{label:'In-app refusal proof'})
 assert.equal((await app.request('/api/buoy/inapp',{cookie:member})).status,403)
 assert.equal((await app.request('/api/buoy/inapp')).status,401)
 assert.equal((await app.request('/api/buoy/inapp',{token:agent.token})).status,403)
 assert.equal((await app.request('/api/buoy/customer-people/'+people[0].id+'/timeline',{cookie:member})).status,200)
 assert.equal((await app.request('/api/buoy/customer-people/'+people[0].id+'/timeline')).status,401)
 assert.equal((await app.request('/api/buoy/customer-people/'+people[0].id+'/timeline',{token:agent.token})).status,403)
 assert.equal((await raw('deliver',identity,agent.token)).status,403)
 assert.equal((await raw('receipts',{...identity,campaignId:fresh.id,kind:'view',messageId:'denied-agent'},agent.token)).status,403)
 for(const [path,method,body]of [['/inapp/campaigns' ,'POST',{}],['/inapp/campaigns/'+fresh.id,'PUT',{enabled:true}],['/inapp/credentials','POST',{sourceId:source.id,label:'Denied'}],['/inapp/credentials/'+issued.credential.id,'DELETE',{}]]){
  assert.equal((await app.request('/api/buoy'+path,{cookie:app.cookie,method,body,headers:{origin:'https://foreign.invalid'}})).status,403)
  assert.equal((await app.request('/api/buoy'+path,{method,body})).status,401)
  assert.equal((await app.request('/api/buoy'+path,{cookie:member,method,body})).status,403)
  assert.equal((await app.request('/api/buoy'+path,{token:agent.token,method,body})).status,403)
 }
 await api('/inapp/credentials/'+issued.credential.id,'DELETE',{})
 await assert.rejects(()=>client.deliver(identity),e=>e.status===401)
 await assert.rejects(()=>client.receipt({...identity,campaignId:fresh.id,kind:'view',messageId:'revoked',deliveryId:spoof.messages[0].deliveryId}),e=>e.status===401)
 await api('/accounts/'+accounts[0].id,'DELETE',{confirmation:accounts[0].name})
 assert.equal((await api('/customer-people/'+people[0].id+'/timeline')).events.length,0,'INAPP-001 account erasure retires receipt/delivery/source custody')
 console.log('INAPP-001 public HTTP: all formats, reviewed targeting, concurrent caps, usage/timelines, unmapped review, dedupe, separate authority, relay spoofing, revocation and erasure passed.')
}
