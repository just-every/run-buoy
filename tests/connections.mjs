// CONNECT-001 real public Worker doors; fake only at Stripe's network edge.
import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
const fixtureKey='synthetic-buoy-9001'
let fail=false,invalid=false, hold, started
const calls=[]
const app=await startWorker({providerFetch:async request=>{
 const url=new URL(request.url);calls.push({method:request.method,path:url.pathname,cursor:url.searchParams.get('starting_after')})
 assert.equal(request.method,'GET','BOUNDARY-001 Stripe transport is read-only');assert.equal(url.pathname,'/v1/customers','BOUNDARY-001 fixed customer-list endpoint')
 if(hold){started();await hold}
 if(fail)return Response.json({error:{message:'private provider response '+fixtureKey}},{status:401})
 const row=(id)=>({id,object:'customer',created:1700000000,livemode:false})
 return Response.json({data:invalid?[{...row('cus_invalid'),created:-1}]:url.searchParams.has('starting_after')?[row('cus_second')]:[row('cus_first')],has_more:!url.searchParams.has('starting_after')})
}})
try{
 const call=(path,method='GET',body,extra={})=>app.request('/api/buoy'+path,{cookie:app.cookie,method,body,...extra})
 const json=async(response,status=200)=>{assert.equal(response.status,status);return response.json()}
 assert.equal((await app.request('/api/buoy/connections')).status,401)
 await app.request('/auth/invite',{cookie:app.cookie,method:'POST',body:{email:'member@example.test',displayName:'CS colleague',role:'member'}})
 const member=await app.signIn('member@example.test')
 assert.equal((await call('/connections','GET',undefined,{cookie:member})).status,403)
 assert.equal((await call('/connections','POST',{name:'Denied',key:fixtureKey},{headers:{origin:'https://foreign.invalid'}})).status,403)
 assert.equal((await call('/connections','POST',{name:'Live refused',key:['rk','live','fixture'].join('_')})).status,400)
 const connection=await json(await call('/connections','POST',{name:'Stripe sandbox',key:fixtureKey}),201)
 const path='/connections/'+connection.id, sync=()=>call(path+'/sync','POST',{})
 let run=await json(await sync());assert.equal(run.status,'succeeded',run.error);assert.equal(run.read_count,1);assert.equal(run.added_count,1);assert.equal(run.cursor_after,'cus_first')
 const success=(await json(await call('/connections'))).connections[0].last_success
 fail=true;run=await json(await sync());assert.equal(run.status,'failed');assert.equal(run.cursor_before,'cus_first');assert.match(run.error,/reconnect/i)
 let state=await json(await call('/connections'));assert.equal(state.connections[0].last_success,success);assert.equal(state.connections[0].cursor,'cus_first');assert.equal(state.connections[0].freshness,'Failed')
 const notices=await json(await call('/notifications'));assert.equal(notices.sourceNotices.length,1);assert.equal(notices.sourceNotices[0].connectionId,connection.id);assert.equal((await json(await call('/notifications','GET',undefined,{cookie:member}))).sourceNotices.length,0);await json(await call('/notifications/'+notices.sourceNotices[0].id+'/read','POST',{}));assert.ok((await json(await call('/notifications'))).sourceNotices[0].readAt)
 await json(await call(path+'/credential','PUT',{key:fixtureKey}));fail=false
 run=await json(await sync());assert.equal(run.status,'succeeded',run.error);assert.equal(run.cursor_before,'cus_first');assert.equal(run.cursor_after,null);assert.equal(run.added_count,1)
 run=await json(await sync());assert.equal(run.added_count,0,'CONNECT-001 reconciliation does not duplicate source IDs')
 const records=(await json(await call(path+'/records'))).records;assert.equal(records.length,2);assert.ok(records.every(row=>Date.parse(row.observed_at)>=Date.parse(success)&&Date.parse(row.observed_at)<=Date.now()),'Inventory observations record actual read instants, not customer creation')
 invalid=true;run=await json(await sync());assert.equal(run.status,'failed');assert.equal((await json(await call(path+'/records'))).records.length,2);invalid=false
 // Credential change during a live provider response invalidates the local commit.
 let release;hold=new Promise(r=>release=r);const ready=new Promise(r=>started=r)
 const inFlight=sync();await ready
 await json(await call(path,'DELETE',{}));release();hold=null
 assert.equal((await json(await inFlight)).status,'failed')
 assert.ok((await json(await call('/notifications'))).sourceNotices.length>=2,'Explicit disconnection creates a reconnection notice')
 const count=calls.length;assert.equal((await sync()).status,409);await app.scheduled();assert.equal(calls.length,count,'CONNECT-001 disconnected connector makes no next-run request')
 await json(await call(path+'/credential','PUT',{key:fixtureKey}));await app.scheduled()
 state=await json(await call('/connections'));assert.equal(state.connections[0].last_error,null);assert.equal(state.connections[0].record_count,2)
 const audit=await json(await call('/audit'));for(const kind of ['connector.connected','connector.reconnected','connector.disconnected'])assert.ok(audit.entries.some(e=>e.action===kind))
 const token=await json(await call('/agent-tokens','POST',{label:'No connector authority'}),201)
 assert.equal((await call('/connections','GET',undefined,{cookie:undefined,token:token.token})).status,403)
 const page=await app.request('/app/connections',{cookie:app.cookie});assert.equal(page.status,200)
 for(const text of [JSON.stringify(state),JSON.stringify(audit),await page.text()])assert.ok(!text.includes(fixtureKey),'CONNECT-001 secrets never appear in status, audit, errors or page')
 console.log('CONNECT-001 public HTTP: cursor resume/dedup, failure/last success, reconnect/disconnect, concurrent revocation, scheduled reconciliation, source references, authorization and secret redaction passed.')
}finally{await app.close()}
