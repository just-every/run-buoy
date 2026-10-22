import {privacyCommand} from './erase-journey.mjs'
import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
export async function workspaceJourney(){
 const app=await startWorker(),cookie=app.cookie
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie,method,body,...options})
 const api=async(path,method='GET',body,options={})=>{const r=await request(path,method,body,options);assert.ok(r.ok,`${method} ${path}: ${await r.clone().text()}`);return r.json()}
 try{
  const people={}
  for(const [key,role]of [['a','admin'],['b','member'],['manager','member']]){const email='workspace-'+key+'@example.test';await app.request('/auth/invite',{method:'POST',cookie,body:{email,displayName:'Workspace '+key,role}});people[key]={cookie:await app.signIn(email)};people[key].id=(await api('/state','GET',undefined,{cookie:people[key].cookie})).operator.id}
  await api('/people/'+people.a.id+'/manager','PUT',{managerId:people.manager.id})
  assert.equal((await request('/workspace/home?person='+people.a.id,'GET',undefined,{cookie:people.manager.cookie})).status,403,'A named manager outside the CSM’s teams cannot read the home')
  await api('/team/settings','PUT',{teams:[{id:'workspace-team',name:'Customer success',pod:'',personIds:[people.a.id,people.manager.id]}],capacities:[],rules:[],territories:[]})
  const on=new Date().toISOString().slice(0,10),end=new Date(Date.now()+60*86400000).toISOString().slice(0,10),ids=[]
  for(let i=0;i<4;i++){
   const id='synthetic-buoy-'+(600+i),account={id,name:'Workspace customer '+i,renewalDate:i===3?'2028-01-01':end,noticeDays:30,renewalEvidence:'Confirmed customer contract',billing:{observedAt:on,reference:'Confirmed billing register',currency:'USD',totalMinor:100,creditsMinor:0,allocatedMinor:100,dueDate:on},support:{observedAt:on,reference:'Support register',openTickets:i===3?0:1,urgentTickets:i===3?0:1}}
   await api('/accounts','POST',account);await api('/accounts/'+id+'/owner','PUT',{ownerId:i===3?people.b.id:people.a.id});ids.push(id)
   if(i<3){const p=await api('/proposals','POST',{accountId:id,kind:'playbook',payload:{title:'Due customer review '+i,dueDate:on,ownerId:people.a.id}});await api('/proposals/'+p.id+'/approve','POST',{})}
  }
  const firstHome=await api('/workspace/home','GET',undefined,{cookie:people.a.cookie})
  await app.scheduled()
  const homeA=await api('/workspace/home','GET',undefined,{cookie:people.a.cookie}),managed=await api('/workspace/home?person='+people.a.id,'GET',undefined,{cookie:people.manager.cookie}),homeB=await api('/workspace/home','GET',undefined,{cookie:people.b.cookie})
  for(const key of ['book','tasks','alerts','renewals'])assert.deepEqual(managed[key],homeA[key],'Manager sees the same '+key)
  assert.deepEqual(homeA.book.map(a=>a.id),ids.slice(0,3));assert.equal(homeA.tasks.length,3);assert.equal(homeA.alerts.length,3);assert.equal(homeA.renewals.length,3);assert.equal(homeA.meetings.status,'unavailable');assert.equal(homeB.tasks.length,0);assert.equal(homeB.renewals.length,0)
  assert.equal((await request('/workspace/home?person='+people.a.id,'GET',undefined,{cookie:people.b.cookie})).status,403)
  assert.equal((await request('/workspace/home?person='+people.b.id,'GET',undefined,{cookie:people.manager.cookie})).status,403)
  const view={name:'At risk renewing in 90 days',kind:'account',shared:false,rules:{match:'all',conditions:[{field:'health.status',op:'eq',value:'at-risk'},{field:'daysToRenewal',op:'gte',value:0},{field:'daysToRenewal',op:'lte',value:90}]},columns:['name','health.status','renewalDate','ownerId'],sort:{field:'name',direction:'desc'}}
  const before=(await api('/workspace')).views.length,preview=await api('/workspace/lists/preview','POST',view,{cookie:people.a.cookie});assert.deepEqual(preview.records.map(r=>r.id),ids.slice(0,3).reverse());assert.equal((await api('/workspace')).views.length,before)
  const saved=await api('/workspace/views','POST',{view},{cookie:people.a.cookie});assert.equal((await request('/workspace?view='+saved.id,'GET',undefined,{cookie:people.b.cookie})).status,404)
  let data=await api('/workspace?view='+saved.id,'GET',undefined,{cookie:people.a.cookie});await api('/workspace/views','POST',{id:saved.id,revision:data.selected.revision,view:{...view,shared:true}},{cookie:people.a.cookie})
  assert.equal((await api('/workspace?view='+saved.id,'GET',undefined,{cookie:people.b.cookie})).records.length,3)
  assert.equal((await request('/workspace/views','POST',{id:saved.id,revision:data.selected.revision,view:{...view,shared:true}},{cookie:people.b.cookie})).status,403)
  assert.equal((await request('/workspace/views','POST',{id:saved.id,revision:data.selected.revision,view},{cookie:people.a.cookie})).status,409)
  // Bulk operations are reviewed once, applied atomically and replayed without effects.
  const assign={operationKey:'synthetic-buoy-610',kind:'account',recordIds:ids.slice(0,3),action:'assign',ownerId:people.b.id,note:'Customer handover reviewed by both CSMs'}
  assert.equal((await request('/workspace/bulk/preview','POST',assign,{cookie:people.b.cookie})).status,403)
  await api('/team/settings','PUT',{teams:[],capacities:[{personId:people.b.id,capacity:3}],rules:[],territories:[]})
  assert.equal((await request('/workspace/bulk/preview','POST',assign,{cookie:people.a.cookie})).status,409,'Full selection capacity, including the existing book, is checked')
  await api('/team/settings','PUT',{teams:[],capacities:[{personId:people.b.id,capacity:10}],rules:[],territories:[]})
  let reviewed=await api('/workspace/bulk/preview','POST',assign,{cookie:people.a.cookie})
  await api('/accounts/'+ids[0]+'/sentiment','POST',{rating:'red',reason:'New customer risk evidence',days:30})
  assert.equal((await request('/workspace/bulk/apply','POST',{...assign,fingerprint:reviewed.fingerprint},{cookie:people.a.cookie})).status,409,'New evidence refuses stale bulk approval')
  reviewed=await api('/workspace/bulk/preview','POST',assign,{cookie:people.a.cookie});const receipt=await api('/workspace/bulk/apply','POST',{...assign,fingerprint:reviewed.fingerprint},{cookie:people.a.cookie});assert.equal(receipt.replayed,false)
  assert.equal((await api('/workspace/bulk/apply','POST',{...assign,fingerprint:reviewed.fingerprint},{cookie:people.a.cookie})).replayed,true)
  assert.equal((await request('/workspace/bulk/apply','POST',{...assign,note:'Different request',fingerprint:reviewed.fingerprint},{cookie:people.a.cookie})).status,409)
  let state=await api('/state');for(const id of ids.slice(0,3)){const a=state.accounts.find(a=>a.id===id);assert.equal(a.ownerId,people.b.id);assert.equal(a.handovers.filter(h=>h.note===assign.note).length,1)}assert.ok(state.tasks.every(t=>t.ownerId===people.b.id),'The outgoing CSM’s open tasks moved exactly once')
  const enroll={operationKey:'synthetic-buoy-611',kind:'account',recordIds:ids.slice(0,3),action:'enroll',title:'Bulk customer risk review',dueDate:on}
  reviewed=await api('/workspace/bulk/preview','POST',enroll,{cookie:people.a.cookie});await api('/workspace/bulk/apply','POST',{...enroll,fingerprint:reviewed.fingerprint},{cookie:people.a.cookie});await api('/workspace/bulk/apply','POST',{...enroll,fingerprint:reviewed.fingerprint},{cookie:people.a.cookie});state=await api('/state');assert.equal(state.tasks.filter(t=>t.title===enroll.title).length,3);assert.equal(state.proposals.filter(p=>p.payload.title===enroll.title&&p.status==='approved').length,3)
  const segment=await api('/segments','POST',{name:'Workspace reviewed customers',mode:'static',accountIds:[],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null}),segmentInput={operationKey:'synthetic-buoy-612',kind:'account',recordIds:ids.slice(0,3),action:'segment',segmentId:segment.id};reviewed=await api('/workspace/bulk/preview','POST',segmentInput);await api('/workspace/bulk/apply','POST',{...segmentInput,fingerprint:reviewed.fingerprint});assert.deepEqual((await api('/segments/'+segment.id+'/report')).accounts.map(a=>a.accountId).sort(),ids.slice(0,3))
  await api('/customer-fields','POST',{key:'workspace_active',label:'Active customer user',type:'boolean'})
  const user=await api('/customer-people','POST',{kind:'user',name:'synthetic-buoy-613',accountIds:ids.slice(0,2),source:'Reviewed product customer directory'})
  let person=(await api('/customer-people')).records.find(p=>p.id===user.id);await api('/customer-people/'+user.id+'/fields','PUT',{revision:person.revision,values:{workspace_active:true},source:'Customer-confirmed product access'})
  const userView={name:'Active customer users',kind:'user',shared:false,rules:{match:'all',conditions:[{field:'custom.workspace_active',op:'eq',value:1}]},columns:['name','accountCount','custom.workspace_active'],sort:{field:'name',direction:'asc'}}
  const users=await api('/workspace/lists/preview','POST',userView);assert.deepEqual(users.records.map(r=>r.id),[user.id]);assert.equal(users.records[0].values.accountCount,2)
  const expanded=await api('/workspace/bulk/preview','POST',{operationKey:'synthetic-buoy-614',kind:'user',recordIds:[user.id],action:'segment',segmentId:segment.id});assert.deepEqual(expanded.accounts.map(a=>a.id),ids.slice(0,2),'User selection expands every explicit membership and requires review')
  const identityView=await api('/workspace/views','POST',{view:{...userView,name:'One explicitly linked user',rules:{match:'all',conditions:[{field:'id',op:'eq',value:user.id}]}}})
  person=(await api('/customer-people')).records.find(p=>p.id===user.id);const privacy=await privacyCommand(api,person,'export');assert.equal(privacy.records.savedViews.length,1)
  await privacyCommand(api,person,'erase');assert.equal((await request('/workspace?view='+identityView.id)).status,404,'Explicitly person-dependent view definitions leave with privacy erasure')
  data=await api('/workspace?view='+saved.id,'GET',undefined,{cookie:people.a.cookie});assert.equal((await request('/workspace/views/'+saved.id,'DELETE',{revision:data.selected.revision},{cookie:people.b.cookie})).status,409);await api('/workspace/views/'+saved.id,'DELETE',{revision:data.selected.revision},{cookie:people.a.cookie});assert.equal((await request('/workspace?view='+saved.id,'GET',undefined,{cookie:people.a.cookie})).status,404)
  assert.equal((await request('/workspace','GET',undefined,{cookie:undefined})).status,401)
  assert.equal((await request('/workspace/views','POST',{view},{headers:{origin:'https://foreign.invalid'}})).status,403)
  const agent=await api('/agent-tokens','POST',{label:'Workspace authority probe'});assert.equal((await request('/workspace','GET',undefined,{cookie:undefined,token:agent.token})).status,403);await api('/agent-tokens/'+agent.id,'DELETE')
  console.log('ACCOUNT-003 live account/user filters, columns and sorting, private/shared definitions, target CSM/manager home, reviewed atomic/replayed assignment/enrollment/segment operations and scoped privacy custody passed; calendar meetings remain unavailable.')
 }finally{await app.close()}
}
