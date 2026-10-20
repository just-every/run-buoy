import assert from 'node:assert/strict'
import {BuoyUsage} from '../sdk/usage.mjs'
// USAGE-001: public Worker intake, complete carrier and reviewed attribution.
export async function usageJourney({call,json,request,cookie,member,signIn,dispatch,origin}) {
 const read=async()=>json(await call('/usage')),post=async(path,body)=>json(await call('/usage'+path,'POST',body),201)
 const before=(await json(await call('/state'))).accounts
 const source=await post('/sources',{name:'Segment production',kind:'segment',reference:'Segment workspace Northstar / web',staleDays:30})
 const issued=await post(`/sources/${source.id}/credentials`,{label:'Server webhook',scope:['track','identify','group']})
 const sdk=new BuoyUsage({origin,sourceId:source.id,credential:issued.secret,fetch:(url,options)=>dispatch(new Request(url,options))})
 const message=(messageId,type='track',userId='user-0',groupId='group-0')=>({messageId,type,userId,groupId,timestamp:new Date().toISOString(),...(['track','event'].includes(type)?{event:'Workspace opened'}:{traits:{email:'owner@example.test'}})})
 const routes=[['GET','/usage'],['GET','/usage/events'],['POST','/usage/sources',{name:'Denied',kind:'native',reference:'Denied'}],['PUT',`/usage/sources/${source.id}`,{name:'Denied',kind:'segment',reference:'Denied'}],['POST',`/usage/sources/${source.id}/credentials`,{label:'Denied'}],['DELETE',`/usage/credentials/${issued.credential.id}`,{}]]
 const agent=await json(await call('/agent-tokens','POST',{label:'USAGE-001 scope probe'}),201)
 for(const[method,path,body]of routes){
  assert.equal((await request('/api/buoy'+path,{method,body})).status,401)
  assert.equal((await call(path,method,body,{cookie:member})).status,403)
  assert.equal((await call(path,method,body,{token:agent.token})).status,403)
  if(method!=='GET')assert.equal((await call(path,method,body,{headers:{origin:'https://foreign.invalid'}})).status,403)
 }
 assert.equal((await read()).sources[0].freshness,'missing')
 let accepted=0,duplicates=0
 for(let offset=0;offset<100000;offset+=500){
  const receipt=await sdk.batch(Array.from({length:500},(_,j)=>{const n=(offset+j)%99000,i=n%50;return message('volume-'+n,n%3===0?'identify':n%3===1?'group':'track','user-'+i,n===98999?'unknown-volume-group':'group-'+i)}))
  accepted+=receipt.accepted;duplicates+=receipt.duplicates;assert.equal(receipt.stored,receipt.accepted)
 }
 assert.equal(accepted,99000);assert.equal(duplicates,1000)
 let state=await read(),review=state.review.filter(r=>r.sourceId===source.id)
 assert.equal(review.length,51);assert.equal(review.reduce((n,r)=>n+r.eventCount,0),99000)
 for(let i=0;i<50;i++)assert.equal(review.find(r=>r.userId==='user-'+i&&r.groupId==='group-'+i).eventCount,i===49?1979:1980)
 assert.ok(review.every(r=>!('accountId' in r)&&!('contactId' in r)&&!('personId' in r)),'USAGE-001 claims are not lighter identity anchors')
 let events=await json(await call(`/usage/events?sourceId=${source.id}&limit=2`));assert.equal(events.events.length,2);assert.ok(events.nextCursor)
 const next=await json(await call(`/usage/events?sourceId=${source.id}&limit=2&cursor=${encodeURIComponent(events.nextCursor)}`));assert.ok(!next.events.some(e=>events.events.some(old=>e.id===old.id)))
 for(const e of events.events){assert.equal(e.status,'review');assert.equal(e.sourceSystem,'segment');assert.equal(e.sourceReference,'Segment workspace Northstar / web');assert.equal(e.freshness,'current');assert.ok(Date.parse(e.observedAt));assert.ok(Date.parse(e.receivedAt))}
 await sdk.identify(message('staff-traits','identify','owner@example.test','unknown-group'))
 await sdk.group(message('conflicting','group','user-0','different-group'))
 await sdk.track(message('exact-space','track',' user-0 ','group-0'))
 review=(await read()).review.filter(r=>r.sourceId===source.id)
 for(const [user,group]of [['owner@example.test','unknown-group'],['user-0','different-group'],[' user-0 ','group-0']])assert.ok(review.some(r=>r.userId===user&&r.groupId===group),'USAGE-001 unknown/conflicting/exact IDs remain separate pending claims')
 const first=message('immutable');await sdk.track({...first,event:'Original event'});assert.equal((await sdk.track({...first,event:'Changed replay'})).duplicates,1)
 assert.equal((await json(await call(`/usage/events?sourceId=${source.id}&messageId=immutable`))).events[0].payload.event,'Original event')
 const intake=`/api/buoy/usage/intake/${source.id}`,raw=(body,headers={})=>dispatch(new Request(origin+intake,{method:'POST',headers:{authorization:'Bearer '+issued.secret,'content-type':'application/json',...headers},body:JSON.stringify(body)}))
 for(const options of [{method:'POST',body:message('session'),cookie},{method:'POST',body:message('browser'),token:issued.secret},{method:'POST',body:message('agent'),token:agent.token}])assert.ok((await request(intake,options)).status>=400)
 assert.equal((await dispatch(new Request(origin+intake,{method:'POST',headers:{authorization:'Bearer '+agent.token,'content-type':'application/json'},body:JSON.stringify(message('agent-no-origin'))}))).status,403)
 assert.ok((await json(await call('/audit?actor='+agent.id+'&action=agent.refused'))).entries.some(e=>e.subject==='POST '+intake))
 assert.equal((await raw(message('browser-metadata'),{'sec-fetch-site':'same-origin'})).status,403)
 const count=(await read()).sources.find(s=>s.id===source.id).eventCount
 for(const invalid of [{...message('bad-date'),timestamp:'2026-02-30T00:00:00Z'},{...message('bad-kind'),type:'merge'},{...message('bad-id'),messageId:''},{batch:[message('atomic-good'),{...message('atomic-bad'),type:'bad'}]}])assert.equal((await raw(invalid)).status,400)
 assert.equal((await read()).sources.find(s=>s.id===source.id).eventCount,count)
 const second=await post('/sources',{name:'Native backend',kind:'native',reference:'Customer app license meter',staleDays:30})
 const native=await post(`/sources/${second.id}/credentials`,{label:'Native event only',scope:['event']})
 const nativeSdk=new BuoyUsage({origin,sourceId:second.id,credential:native.secret,fetch:(url,options)=>dispatch(new Request(url,options))})
 const staleTime=new Date(Date.now()-45*86400000).toISOString()
 await nativeSdk.event({...message('volume-0','event'),timestamp:staleTime})
 assert.equal((await read()).sources.find(s=>s.id===second.id).eventCount,1,'USAGE-001 message IDs are source-namespaced')
 await assert.rejects(()=>nativeSdk.track(message('wrong-scope')),error=>error.status===403)
 assert.equal((await dispatch(new Request(origin+`/api/buoy/usage/intake/${second.id}`,{method:'POST',headers:{authorization:'Bearer '+issued.secret,'content-type':'application/json'},body:JSON.stringify(message('wrong-source','event'))}))).status,401)
 await json(await call(`/usage/sources/${second.id}`,'PUT',{name:'Native backend',kind:'native',reference:'Updated setup reference',staleDays:1}))
 state=await read();assert.equal(state.sources.find(s=>s.id===second.id).freshness,'stale')
 events=await json(await call(`/usage/events?sourceId=${second.id}`));assert.equal(events.events[0].sourceReference,'Customer app license meter');assert.equal(events.events[0].freshness,'stale')
 await json(await call(`/usage/sources/${second.id}`,'PUT',{name:'Native backend',kind:'native',reference:'Updated setup reference',staleDays:365}));assert.equal((await read()).sources.find(s=>s.id===second.id).freshness,'current')
 for(const staleDays of [0,366,1.5])assert.equal((await call(`/usage/sources/${second.id}`,'PUT',{name:'Native',kind:'native',reference:'Invalid',staleDays})).status,400)
 for(const scope of [[],['send'],['track','track']])assert.equal((await call(`/usage/sources/${source.id}/credentials`,'POST',{label:'Invalid',scope})).status,400)
 const metadata=(await read()).credentials.find(c=>c.id===issued.credential.id)
 assert.ok(metadata.creatorId);assert.ok(Date.parse(metadata.lastUsedAt));assert.deepEqual(metadata.scope,['track','identify','group'])
 assert.ok(!JSON.stringify(await read()).includes(issued.secret));assert.ok(!JSON.stringify(await json(await call('/audit'))).includes(issued.secret))
 assert.equal((await call('/state','GET',undefined,{token:issued.secret})).status,401)
 await json(await request('/auth/invite',{method:'POST',cookie,body:{email:'usage-admin@example.test',displayName:'Usage administrator',role:'admin'}}),202)
 const admin=await signIn('usage-admin@example.test');assert.equal((await call('/usage','GET',undefined,{cookie:admin})).status,200)
 await json(await call(`/usage/credentials/${native.credential.id}`,'DELETE',{}, {cookie:admin}))
 const stamp=Date.now();await assert.rejects(()=>nativeSdk.event(message('revoked','event')),error=>error.status===401);assert.ok(Date.now()-stamp<60000)
 await json(await call(`/usage/credentials/${issued.credential.id}`,'DELETE',{}));await json(await call('/agent-tokens/'+agent.id,'DELETE'))
 assert.deepEqual((await json(await call('/state'))).accounts,before,'USAGE-001 unmapped intake neither links staff nor changes account observations/revisions')
 // Complete the original 100,000-delivery/50-account acceptance through reviewed exact mappings.
 const people=[]
 const claim=(i)=>({sourceId:source.id,userId:'user-'+i,groupId:'group-'+i,accountId:'usage-account-'+i,personId:people[i].id})
 for(let i=0;i<50;i++){
  await json(await call('/accounts','POST',{id:'usage-account-'+i,name:'Usage customer '+i,renewalDate:'2027-10-01',noticeDays:30,renewalEvidence:'Reviewed license agreement '+i,billing:null,support:null}),201)
  people.push(await json(await call('/customer-people','POST',{kind:i%2?'contact':'user',name:'Product customer '+i,accountIds:['usage-account-'+i],source:'Reviewed product membership '+i}),201))
 }
 assert.equal((await call('/usage/mappings','POST',claim(0))).status,409,'USAGE-001 no mapping without the exact review fingerprint')
 const denied={...claim(0),personId:people[1].id}
 assert.equal((await call('/usage/mappings/preview','POST',denied)).status,409,'USAGE-001 mismatched membership never implicitly merged')
 let stale=await json(await call('/usage/mappings/preview','POST',claim(0)))
 // A reviewed target revision is fenced; use a real account source refresh with its supported payload.
 const current=(await json(await call('/state'))).accounts.find(a=>a.id==='usage-account-0')
 await json(await call('/accounts/usage-account-0','PUT',{id:current.id,name:current.name,renewalDate:current.renewalDate,noticeDays:current.noticeDays,renewalEvidence:current.renewalEvidence,billing:null,support:null,revision:current.revision}))
 assert.equal((await call('/usage/mappings','POST',{...claim(0),fingerprint:stale.fingerprint})).status,409)
 for(let i=0;i<50;i++){
  const preview=await json(await call('/usage/mappings/preview','POST',claim(i)))
  assert.equal(preview.claims.eventCount,i===0?1981:i===49?1979:1980)
  assert.equal((await read()).mappings.length,i,'USAGE-001 preview changes no mapping')
  await json(await call('/usage/mappings','POST',{...claim(i),fingerprint:preview.fingerprint}),201)
 }
 state=await read()
 assert.equal(state.attribution.filter(a=>a.sourceId===source.id).reduce((n,a)=>n+a.eventCount,0),99000)
 for(let i=0;i<50;i++){
  const attribution=state.attribution.find(a=>a.accountId==='usage-account-'+i&&a.personId===people[i].id)
  assert.equal(attribution.eventCount,i===0?1981:i===49?1979:1980)
  const page=await json(await call('/usage/events?accountId=usage-account-'+i+'&limit=2'))
  assert.ok(page.events.every(e=>e.status==='attributed'&&e.accountId==='usage-account-'+i&&e.personId===people[i].id&&e.userId==='user-'+i&&e.groupId==='group-'+i))
 }
 review=state.review.filter(r=>r.sourceId===source.id)
 assert.ok(review.some(r=>r.groupId==='unknown-volume-group'&&r.eventCount===1),'USAGE-001 the original 100000-delivery volume includes an unknown group retained for mapping');
 assert.ok(review.some(r=>r.groupId==='unknown-group'));assert.ok(review.some(r=>r.groupId==='different-group'))
 assert.ok(review.some(r=>r.userId===' user-0 '),'USAGE-001 exact IDs never inherit trimmed mapping')
 // Reissue a credential and check later events plus duplicate replay and conflicting claims.
 const live=await post(`/sources/${source.id}/credentials`,{label:'Mapped source',scope:['track','identify','group']})
 const mappedSdk=new BuoyUsage({origin,sourceId:source.id,credential:live.secret,fetch:(url,options)=>dispatch(new Request(url,options))})
 const beforeRevision=(await json(await call('/state'))).accounts.find(a=>a.id==='usage-account-1').revision
 await mappedSdk.track(message('after-mapping','track','user-1','group-1'))
 const afterRevision=(await json(await call('/state'))).accounts.find(a=>a.id==='usage-account-1').revision
 assert.notEqual(afterRevision,beforeRevision,'USAGE-001 connected observations advance the account revision')
 await mappedSdk.track(message('after-mapping','track','user-1','group-1'))
 assert.equal((await json(await call('/state'))).accounts.find(a=>a.id==='usage-account-1').revision,afterRevision,'USAGE-001 duplicate has no observation refresh')
 let mapped=await json(await call('/usage/events?sourceId='+source.id+'&messageId=after-mapping'))
 assert.equal(mapped.events[0].personId,people[1].id)
 await mappedSdk.track(message('unknown-after-mapping','track','user-1','unreviewed-group'))
 assert.equal((await json(await call('/usage/events?sourceId='+source.id+'&messageId=unknown-after-mapping'))).events[0].status,'review')
 const incompatible={...claim(2),groupId:'group-0'};
 assert.equal((await call('/usage/mappings/preview','POST',incompatible)).status,409,'USAGE-001 reviewed source groups cannot split across accounts');
 assert.ok((await json(await call('/audit?action=account.usage-refreshed'))).entries.some(e=>e.actor==='usage-source:'+source.id),'AUDIT-001 attributed source refresh records its source actor');
 const accountEvidence=await json(await call('/accounts/usage-account-1/usage'))
 assert.equal(accountEvidence.sources[0].eventCount,1981);assert.equal(accountEvidence.sources[0].sourceSystem,'segment');assert.equal(accountEvidence.sources[0].sourceReference,'Segment workspace Northstar / web')
 assert.equal(accountEvidence.sources[0].freshness,'current');assert.ok(Date.parse(accountEvidence.sources[0].receivedAt))
 assert.deepEqual(await json(await call('/accounts/usage-account-1/usage','GET',undefined,{cookie:member})),accountEvidence,'USAGE-001 staff see usage through the existing account read authority')
 const splitUser={...claim(1),userId:'user-0',groupId:'not-reviewed'}
 assert.equal((await call('/usage/mappings/preview','POST',splitUser)).status,409,'USAGE-001 one source user never splits into different customer people')
 const nativeMapping={sourceId:second.id,userId:'user-0',groupId:'group-0',accountId:'usage-account-49',personId:people[49].id}
 let nativeReview=await json(await call('/usage/mappings/preview','POST',nativeMapping))
 await json(await call('/usage/mappings','POST',{...nativeMapping,fingerprint:nativeReview.fingerprint}),201)
 assert.equal((await json(await call(`/usage/events?sourceId=${second.id}&personId=${people[49].id}`))).events[0].accountId,'usage-account-49','USAGE-001 source namespaces permit separate explicitly reviewed external identities')
 await json(await call(`/usage/sources/${second.id}`,'PUT',{name:'Native backend',kind:'native',reference:'Updated setup reference',staleDays:1}))
 assert.equal((await json(await call('/accounts/usage-account-49/usage'))).sources.find(s=>s.sourceId===second.id).freshness,'stale')
 await json(await call(`/usage/sources/${second.id}`,'PUT',{name:'Native backend',kind:'native',reference:'Updated setup reference',staleDays:365}))
 assert.equal((await json(await call('/accounts/usage-account-49/usage'))).sources.find(s=>s.sourceId===second.id).freshness,'current')
 await mappedSdk.track(message('group-only','track',null,'group-49'))
 const groupMapping={sourceId:source.id,userId:null,groupId:'group-49',accountId:'usage-account-49',personId:null}
 const groupReview=await json(await call('/usage/mappings/preview','POST',groupMapping))
 await json(await call('/usage/mappings','POST',{...groupMapping,fingerprint:groupReview.fingerprint}),201)
 const groupEvent=(await json(await call(`/usage/events?sourceId=${source.id}&messageId=group-only`))).events[0]
 assert.equal(groupEvent.accountId,'usage-account-49');assert.equal(groupEvent.personId,null,'USAGE-001 group-only claims need no invented customer person')
 let moved=(await json(await call('/customer-people'))).records.find(p=>p.id===people[49].id)
 await json(await call('/customer-people/'+moved.id,'PUT',{kind:moved.kind,name:moved.name,revision:moved.revision,accountIds:['usage-account-48'],source:'Explicit membership correction'}))
 assert.equal((await json(await call(`/usage/events?sourceId=${source.id}&userId=user-49&groupId=group-49&limit=1`))).events[0].status,'review','USAGE-001 a removed membership invalidates attribution rather than inferring a replacement')
 moved=(await json(await call('/customer-people'))).records.find(p=>p.id===people[49].id)
 await json(await call('/customer-people/'+moved.id,'PUT',{kind:moved.kind,name:moved.name,revision:moved.revision,accountIds:['usage-account-49'],source:'Explicit membership restored'}))
 assert.equal((await json(await call(`/usage/events?sourceId=${source.id}&userId=user-49&groupId=group-49&limit=1`))).events[0].status,'attributed')
 assert.equal((await request('/app/accounts/usage-account-1',{cookie})).status,200)
 for(const route of ['/usage/mappings/preview','/usage/mappings']){
  assert.equal((await request('/api/buoy'+route,{method:'POST',body:claim(0)})).status,401)
  assert.equal((await call(route,'POST',claim(0),{cookie:member})).status,403)
  assert.equal((await call(route,'POST',claim(0),{headers:{origin:'https://foreign.invalid'}})).status,403)
 }
 // Reviewed targets and their attributed raw payloads share the account's erasure custody.
 await json(await call('/accounts/usage-account-1','DELETE',{confirmation:'Usage customer 1'}))
 assert.equal((await json(await call('/usage/events?sourceId='+source.id+'&messageId=after-mapping'))).events.length,0)
 assert.ok(!(await read()).mappings.some(m=>m.accountId==='usage-account-1'))
 console.log('USAGE-001 100000 deliveries/99000 unique across 50 reviewed account/customer identities, retained/new attribution, exact unknown/conflicting review, revision/erasure custody and authenticated scope/revocation passed.')
}
