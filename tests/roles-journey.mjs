import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'

async function fixture(){
 const app=await startWorker(),cookie=app.cookie
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie,method,body,...options})
 const json=async response=>{assert.ok(response.ok,await response.clone().text());return response.json()}
 const api=async(...args)=>json(await request(...args))
 const access=async(path,body,as=cookie)=>json(await app.request(path,{method:'POST',cookie:as,body}))
 const invite=async(key,role='member')=>{const email='roles-'+key+'@example.test';await access('/auth/invite',{email,displayName:'Role colleague '+key,role});const session=await app.signIn(email);return {cookie:session,email,id:(await api('/state','GET',undefined,{cookie:session})).operator.id}}
 const assign=async(person,roleId,extra={})=>api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId,...extra})
 const on=new Date().toISOString().slice(0,10),year=Number(on.slice(0,4))
 const account=async(id,name)=>api('/accounts','POST',{id,name,renewalDate:(year+1)+'-12-31',noticeDays:30,renewalEvidence:'synthetic-buoy-private-renewal-evidence',billing:{observedAt:on,reference:'synthetic-buoy-private-invoice-reference',currency:'USD',totalMinor:98765432,creditsMinor:0,allocatedMinor:0,dueDate:on},support:{observedAt:on,reference:'synthetic-buoy-private-support-source',openTickets:2,urgentTickets:1}})
 return {app,cookie,request,json,api,access,invite,assign,account,on,year,read:person=>api('/state','GET',undefined,{cookie:person.cookie})}
}

export async function roleConfigurationJourney(){
 const f=await fixture(),{app,api,request,invite,assign,json}=f
 try{
  const member=await invite('configuration'),admin=await invite('administrator','admin'),owner=(await api('/state')).operator
  await f.account('synthetic-buoy-2100','Role configuration account')
  assert.ok((await f.read(member)).accounts[0].billing,'Unassigned native members retain their current read behavior')
  const original=await api('/roles')
  const custom=await api('/roles/definitions','POST',{revision:original.revision,name:'Reviewed account reader',permissions:{read:'scope',commercialRead:'none',users:'except-owner'},scope:{kind:'own'},commercial:'none'})
  assert.equal((await request('/roles/assignments','PUT',{revision:original.revision,personId:member.id,roleId:custom.id})).status,409,'Stale configuration cannot grant a profile')
  await assign(member,custom.id,{grants:{concessionLimitMinor:25000,renewalOutcome:true}})
  assert.equal((await f.read(member)).roleAccess.grants.concessionLimitMinor,25000)
  assert.equal((await request('/roles','GET',undefined,{cookie:member.cookie})).status,403,'A declared invite row does not create native administrator authority')
  for(const person of [owner,admin])assert.equal((await request('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:'support'})).status,403,'Owner/admin identities cannot be replaced by overlays')
  assert.equal((await request('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:member.id,roleId:'owner'})).status,403,'A product overlay cannot elevate native identity')
  assert.equal((await request('/roles/definitions','POST',{revision:(await api('/roles')).revision,id:'support',name:'Overwritten support',permissions:{read:'all'},scope:{kind:'all'},commercial:'full'})).status,403,'Default declarations cannot be overwritten')
  const bad={revision:(await api('/roles')).revision,personId:member.id,roleId:custom.id,grants:{concessionLimitMinor:-1,renewalOutcome:true}}
  assert.equal((await request('/roles/assignments','PUT',bad)).status,400)
  // Native admins can configure non-owner staff; they do not gain owner erasure.
  await json(await request('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:member.id,roleId:'support'},{cookie:admin.cookie}))
  const audit=(await api('/audit?action=role.')).entries
  assert.ok(audit.some(row=>row.action==='role.definition-saved'&&row.subject==='role:'+custom.id))
  assert.ok(audit.some(row=>row.action==='role.assigned'&&row.subject==='person:'+member.id))
  assert.doesNotMatch(JSON.stringify(audit),/roles-configuration@example|Role colleague/,'Role audits retain opaque identities')
  await api('/roles/assignments/'+member.id,'DELETE',{revision:(await api('/roles')).revision})
  assert.ok((await f.read(member)).accounts[0].billing,'An explicit removal returns to the documented native member policy')
 }finally{await app.close()}
}

export async function roleReadJourney(){
 const f=await fixture(),{app,api,invite,assign}=f
 try{
  const a=await invite('book-a'),b=await invite('book-b'),first='synthetic-buoy-2110',second='synthetic-buoy-2111'
  await f.account(first,'Visible scope customer');await f.account(second,'Outside scope customer')
  await api('/accounts/'+first+'/owner','PUT',{ownerId:a.id});await api('/accounts/'+second+'/owner','PUT',{ownerId:b.id})
  await assign(a,'csm');let state=await f.read(a)
  assert.deepEqual(state.accounts.map(row=>row.id),[first]);assert.equal(state.accounts[0].commercialAccess,'full')
  assert.equal((await api('/search?q=Outside','GET',undefined,{cookie:a.cookie})).results.length,0)
  await assign(a,'csm',{sharedAccountIds:[second]});state=await f.read(a)
  assert.deepEqual(state.accounts.map(row=>row.id).sort(),[first,second]);assert.equal(state.accounts.find(row=>row.id===second).commercialAccess,'none','Sharing reads does not grant own-book commercial fields')
  for(const [role,count,commercial]of [['cs-manager',2,'full'],['sales',0,null],['support',2,'band'],['finance',2,'full']]){
   await assign(a,role);state=await f.read(a);assert.equal(state.accounts.length,count)
   if(commercial)assert.ok(state.accounts.every(row=>row.commercialAccess===commercial))
  }
  const custom=await api('/roles/definitions','POST',{revision:(await api('/roles')).revision,name:'Assigned account reader',permissions:{read:'scope',commercialRead:'full'},scope:{kind:'all'},commercial:'full'})
  await assign(a,custom.id);assert.equal((await f.read(a)).accounts.length,2)
  await api('/roles/definitions','POST',{revision:(await api('/roles')).revision,id:custom.id,name:'Assigned own-book reader',permissions:{read:'scope',commercialRead:'band'},scope:{kind:'own'},commercial:'band'})
  state=await f.read(a);assert.deepEqual(state.accounts.map(row=>row.id),[first]);assert.equal(state.accounts[0].commercialAccess,'band','A changed definition immediately constrains an existing grant')
 }finally{await app.close()}
}

export async function roleScopeJourney(){
 const f=await fixture(),{app,api,request,invite,assign,access}=f
 try{
  const manager=await invite('manager'),report=await invite('report'),peer=await invite('peer'),one='synthetic-buoy-2120',two='synthetic-buoy-2121'
  await f.account(one,'First live scope customer');await f.account(two,'Second live scope customer')
  await api('/accounts/'+one+'/owner','PUT',{ownerId:report.id});await api('/accounts/'+two+'/owner','PUT',{ownerId:peer.id});await api('/people/'+report.id+'/manager','PUT',{managerId:manager.id})
  await assign(manager,'cs-manager',{scope:{kind:'team'}})
  assert.deepEqual((await f.read(manager)).accounts.map(row=>row.id),[one])
  await api('/people/'+report.id+'/manager','PUT',{managerId:null});assert.deepEqual((await f.read(manager)).accounts,[],'Team scope consumes current named managers')
  await assign(report,'csm');assert.deepEqual((await f.read(report)).accounts.map(row=>row.id),[one])
  await api('/accounts/'+one+'/owner','PUT',{ownerId:peer.id});assert.deepEqual((await f.read(report)).accounts,[],'Book reassignment withdraws scope before the next read')
  const segment=await api('/segments','POST',{name:'Current role access segment',mode:'static',accountIds:[one],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
  const custom=await api('/roles/definitions','POST',{revision:(await api('/roles')).revision,name:'Current segment reader',permissions:{read:'scope'},scope:{kind:'segment',segmentId:segment.id},commercial:'none'})
  await assign(report,custom.id);assert.deepEqual((await f.read(report)).accounts.map(row=>row.id),[one])
  const definition=(await api('/segments')).segments.find(row=>row.id===segment.id)
  await api('/segments','POST',{id:segment.id,revision:definition.revision,name:'Current role access segment',mode:'static',accountIds:[two],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
  assert.deepEqual((await f.read(report)).accounts.map(row=>row.id),[two],'Segment entry and exit immediately change readable records')
  await access('/auth/operator/status',{operatorId:report.id,status:'inactive'});await access('/auth/operator/status',{operatorId:report.id,status:'active'})
  assert.equal((await request('/state','GET',undefined,{cookie:report.cookie})).status,401,'Native version changes still revoke sessions')
  report.cookie=await app.signIn(report.email)
  assert.equal((await request('/state','GET',undefined,{cookie:report.cookie})).status,403,'Reactivation cannot revive an old profile grant')
  await assign(report,custom.id);assert.deepEqual((await f.read(report)).accounts.map(row=>row.id),[two])
 }finally{await app.close()}
}

export async function roleIsolationJourney(){
 const f=await fixture(),{app,api,request,invite,assign}=f
 try{
  const support=await invite('support'),id='synthetic-buoy-2130'
  await f.account(id,'Band-only customer')
  await api('/accounts/'+id+'/contract','POST',{revision:(await api('/state')).accounts.find(row=>row.id===id).revision,contract:{currency:'USD',contractStart:f.year+'-01-01',contractEnd:(f.year+1)+'-12-31',lines:[{id:'synthetic-buoy-2131',product:'Customer-confirmed recurring product',quantity:1,amountMinor:12345678,frequency:'annual',entitlements:''}],source:{reference:'synthetic-buoy-private-contract-source',confirmedOn:f.on}}})
  await assign(support,'support');const state=await f.read(support),account=state.accounts.find(row=>row.id===id)
  assert.ok(account.arrBand.label);assert.equal(account.arrBand.currency,'USD');assert.equal(account.commercial,undefined)
  assert.doesNotMatch(JSON.stringify(state),/12345678|98765432|private-invoice|private-renewal|private-contract|private-support|amountMinor|totalMinor/,'Band-only state omits exact values and source text')
  assert.deepEqual(state.proposals,[]);assert.deepEqual(state.decisions,[])
  for(const q of ['12345678','98765432','synthetic-buoy-private-invoice-reference','synthetic-buoy-private-contract-source','synthetic-buoy-private-renewal-evidence'])assert.equal((await api('/search?'+new URLSearchParams({q}),'GET',undefined,{cookie:support.cookie})).results.length,0,'Forbidden values do not participate in matching')
  const found=await api('/search?q=Band-only','GET',undefined,{cookie:support.cookie});assert.equal(found.results.length,1);assert.equal(found.results[0].id,id);assert.doesNotMatch(JSON.stringify(found),/12345678|98765432|private-/)
  const recipientMail=()=>app.mails.filter(mail=>mail.to.includes(support.email))
  const prepareTask=async title=>{const proposal=await api('/proposals','POST',{accountId:id,kind:'playbook',payload:{title,dueDate:f.on,ownerId:support.id}});await api('/proposals/'+proposal.id+'/approve','POST',{})}
  const beforeMail=recipientMail().length
  await prepareTask('synthetic-buoy-private-task 12345678')
  assert.equal(recipientMail().length,beforeMail+1,'An approved task produces one scoped assignment email')
  await app.scheduled('0 * * * *',Date.parse(f.on+'T12:00:00Z'))
  assert.equal(recipientMail().length,beforeMail+2,'A scoped due task also produces its reminder')
  for(const mail of recipientMail().slice(beforeMail)){
   const contents=JSON.stringify({subject:mail.subject,text:mail.text,html:mail.html})
   assert.match(contents,/Band-only customer/);assert.ok(contents.includes('/app/accounts/'+id))
   assert.doesNotMatch(contents,/12345678|98765432|private-task|private-invoice|private-contract|private-support|private-renewal/,'External notices include no source, task text or exact commercial values')
  }
  await assign(support,'support',{scope:{kind:'own'}})
  const beforeOutside=recipientMail().length
  await prepareTask('synthetic-buoy-private-outside-task 12345678')
  await app.scheduled('0 * * * *',Date.parse(f.on+'T12:00:00Z'))
  assert.equal(recipientMail().length,beforeOutside,'Assignment and reminder mail is suppressed outside current account scope')
  for(const [path,method,body]of [['/tasks','GET'],['/fields','GET'],['/segments','GET'],['/revenue','GET'],['/revenue/retention','GET'],['/outcomes','GET'],['/workspace','GET'],['/customer-people','GET'],['/accounts/'+id+'/health','GET'],['/accounts/'+id+'/activity','GET'],['/accounts/'+id+'/hierarchy','GET'],['/audit','GET'],['/agents','GET'],['/connections','GET'],['/accounts','POST',{}],['/proposals','POST',{}]])assert.equal((await request(path,method,body,{cookie:support.cookie})).status,403,'Unported assigned-profile door is refused: '+path)
 }finally{await app.close()}
}

export async function roleDigestJourney(){
 const f=await fixture(),{app,api,invite,assign}=f
 try{
  const people=[await invite('digest-first'),await invite('digest-second')],id='synthetic-buoy-2140',note='synthetic-buoy-private-digest-note'
  await f.account(id,'Digest scope customer')
  for(const person of people)await api('/notifications/preferences','PUT',{frequency:'daily',modes:{mention:'digest',assignment:'digest',signal:'digest',approval:'digest'}},{cookie:person.cookie})
  // The provider answers the run's first digest only after the other person's profile changes.
  const held=app.holdMail(mail=>mail.subject==='Buoy daily digest'),run=app.scheduled('0 * * * *',Date.parse(f.on+'T12:00:00Z'))
  const first=await Promise.race([held.arrived,run.then(()=>assert.fail('Each person without a profile receives a daily digest'))]),later=people.find(person=>!first.to.includes(person.email))
  await assign(later,'csm')
  await api('/accounts/'+id+'/mentions','POST',{personId:later.id,note})
  held.release();await run
  assert.deepEqual(app.mails.filter(mail=>mail.subject==='Buoy daily digest').map(mail=>mail.to),[first.to],'Aggregate digests reach only people without an assigned profile')
  assert.doesNotMatch(JSON.stringify(app.mails),new RegExp(note),'No mail carries a notice outside its recipient’s current scope')
 }finally{await app.close()}
}
