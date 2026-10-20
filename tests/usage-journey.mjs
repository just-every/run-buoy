import assert from 'node:assert/strict'
import {BuoyUsage} from '../sdk/usage.mjs'
// USAGE-001 partial: public Worker transport. No contact/user carriers or attribution.
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
  const receipt=await sdk.batch(Array.from({length:500},(_,j)=>{const n=(offset+j)%99000,i=n%50;return message('volume-'+n,n%3===0?'identify':n%3===1?'group':'track','user-'+i,'group-'+i)}))
  accepted+=receipt.accepted;duplicates+=receipt.duplicates;assert.equal(receipt.review,receipt.accepted)
 }
 assert.equal(accepted,99000);assert.equal(duplicates,1000)
 let state=await read(),review=state.review.filter(r=>r.sourceId===source.id)
 assert.equal(review.length,50);assert.equal(review.reduce((n,r)=>n+r.eventCount,0),99000)
 for(let i=0;i<50;i++)assert.equal(review.find(r=>r.userId==='user-'+i&&r.groupId==='group-'+i).eventCount,1980)
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
 for(const path of ['/usage/contacts',`/usage/sources/${source.id}/groups`,`/usage/sources/${source.id}/users`])assert.equal((await call(path,'POST',{})).status,404,'USAGE-001 record creation and mappings do not ship')
 assert.deepEqual((await json(await call('/state'))).accounts,before,'USAGE-001 intake neither links staff nor changes account observations/revisions')
 console.log('USAGE-001 partial: 100000 deliveries/99000 unique, 50 source claim pairs; all pending, exact IDs, atomic validation, provenance, credentials/scopes/revocation passed.')
}
