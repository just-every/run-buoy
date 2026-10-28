import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'

// The integration doors run against the actual emitted Worker and D1. The clock
// is fixed so neither rate windows nor credential expiry depend on wall time.
export async function integrationJourney(existing){
 let instant=Date.parse('2026-10-26T12:00:10Z')
 const worker=existing??await startWorker({clock:()=>instant}),{cookie}=worker
 const call=(path,method='GET',body,options={})=>worker.request('/api/buoy/v1'+path,{cookie,method,body,...options})
 const server=(path,{method='GET',body,token,headers={}}={})=>worker.dispatch(new Request(worker.origin+'/api/buoy/v1'+path,{method,headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{}),...(!existing?{'x-buoy-test-time':String(instant)}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}))
 const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()}
 const first='synthetic-buoy-9140',second='synthetic-buoy-9141',outside='synthetic-buoy-9142'
 const mailbox=id=>id+'@'+'example.test'
 const input=id=>({id,name:'Synthetic integration account',renewalDate:'2027-10-31',noticeDays:30,renewalEvidence:'Synthetic signed order',billing:null,support:null})
 const mint=async(overrides={})=>json(await call('/tokens','POST',{label:'Synthetic integration',scopes:['accounts.read','accounts.write'],accountIds:[first,second],requestsPerMinute:600,expiresDays:1,...overrides}),201)
 try{
  const spec=await json(await call('/openapi.json'));assert.equal(spec.openapi,'3.1.0');assert.ok(spec.paths['/accounts'].post);assert.ok(spec.paths['/accounts/{id}'].put)
  assert.equal((await worker.request('/api/buoy/v1/tokens',{method:'POST',body:{}})).status,401)
  assert.equal((await worker.request('/api/buoy/v1/tokens')).status,401)
  const invited=await worker.request('/auth/invite',{method:'POST',cookie,body:{email:mailbox('synthetic-buoy-914'),displayName:'Integration member',role:'member'}});assert.equal(invited.status,202)
  const member=await worker.signIn(mailbox('synthetic-buoy-914'))
  assert.equal((await call('/tokens','POST',{}, {cookie:member})).status,403)
  assert.equal((await call('/tokens','GET',undefined,{cookie:member})).status,403)
  assert.equal((await call('/tokens/synthetic-buoy-914','DELETE',undefined,{cookie:member})).status,403)
  assert.equal((await call('/tokens','POST',{scopes:['accounts.write'],accountIds:['*'],requestsPerMinute:10,expiresDays:1})).status,400)
  assert.equal((await call('/tokens','POST',{scopes:['all'],accountIds:[first],requestsPerMinute:10,expiresDays:1})).status,400)
  for(const setting of [{accountScope:'wildcard'},{accountScope:'all'},{expiresDays:0},{expiresDays:366},{requestsPerMinute:0},{requestsPerMinute:601},{label:''},{label:'x'.repeat(101)}]){
   assert.equal((await call('/tokens','POST',{scopes:['accounts.read'],accountIds:[first],requestsPerMinute:10,expiresDays:1,...setting})).status,400)
  }
  const all=await mint({label:'Synthetic all accounts',accountScope:'all',accountIds:[],expiresDays:30})
  const future='synthetic-buoy-9240'
  await json(await server('/accounts',{method:'POST',body:input(future),token:all.token,headers:{'idempotency-key':'synthetic-buoy-924-create'}}),201)
  assert.equal((await json(await server('/accounts/'+future,{token:all.token}))).id,future,'An explicit all-accounts grant reaches an account created after issuance')
  const allIds=[];let cursor=''
  do{
   const page=await json(await server('/accounts?limit=100&after='+encodeURIComponent(cursor),{token:all.token}))
   allIds.push(...page.items.map(a=>a.id));assert.ok(page.next===null||page.next>cursor,'Pagination advances toward completion');cursor=page.next
  }while(cursor!==null)
  assert.ok(allIds.includes(future),'All-accounts pagination includes the new account across the full installation')
  const allReader=await mint({accountScope:'all',accountIds:undefined,scopes:['accounts.read']})
  assert.equal((await server('/accounts',{method:'POST',body:input('synthetic-buoy-9241'),token:allReader.token,headers:{'idempotency-key':'synthetic-buoy-924-refused'}})).status,403,'All accounts never grants a missing write scope')
  await json(await call('/tokens/'+allReader.id,'DELETE'))
  const grant=await mint()
  const inventory=await json(await call('/tokens'))
  const listed=inventory.items.find(t=>t.id===all.id)
  assert.equal(listed.label,'Synthetic all accounts');assert.equal(listed.accountScope,'all')
  assert.deepEqual(listed.scopes,['accounts.read','accounts.write']);assert.deepEqual(listed.accountIds,[])
  assert.equal(listed.requestsPerMinute,600);assert.equal(listed.expiresAt,all.expiresAt)
  assert.ok(listed.createdAt&&listed.lastUsedAt);assert.equal(listed.expiringSoon,false);assert.equal(listed.stoppedReason,null)
  assert.equal(listed.issuer.id,(await json(await worker.request('/api/buoy/state',{cookie}))).operator.id)
  assert.equal(inventory.items.find(t=>t.id===allReader.id).stoppedReason,'revocation')
  assert.equal(inventory.items.find(t=>t.id===grant.id).lastUsedAt,null)
  assert.equal(inventory.items.find(t=>t.id===grant.id).expiringSoon,true)
  assert.equal(inventory.items.find(t=>t.id===allReader.id).expiringSoon,false)
  assert.ok(inventory.items.every(t=>!Object.hasOwn(t,'token')&&!Object.hasOwn(t,'token_hash')))
  for(const secret of [all.token,allReader.token,grant.token]){
   assert.ok(!JSON.stringify(inventory).includes(secret),'The inventory never returns an issued secret')
   const hash=await import('node:crypto').then(({createHash})=>createHash('sha256').update(secret).digest('hex'))
   assert.ok(!JSON.stringify(inventory).includes(hash),'The inventory never returns a stored credential hash')
  }

  assert.equal((await server('/accounts')).status,401)
  assert.equal((await server('/accounts',{token:'synthetic-buoy-914-invalid',headers:{cookie}})).status,401,'A session cookie cannot rescue an invalid bearer credential')
  await json(await server('/accounts',{token:grant.token,headers:{cookie}}))
  assert.equal((await server('/accounts',{token:grant.token,headers:{origin:worker.origin}})).status,403)
  assert.equal((await server('/accounts',{token:grant.token,headers:{'sec-fetch-site':'same-origin'}})).status,403)
  assert.equal((await worker.request('/api/buoy/state',{token:grant.token})).status,401,'Integration token cannot enter native owner or agent doors')
  const write={method:'POST',body:input(first),token:grant.token,headers:{'idempotency-key':'synthetic-buoy-914-create'}}
  const concurrent=await Promise.all(Array.from({length:4},()=>server('/accounts',write).then(r=>json(r,201))))
  assert.ok(concurrent.every(value=>value.id===first&&value.revision===concurrent[0].revision),'Concurrent replays commit one revision')
  const a=await json(await server('/accounts/'+first,{token:grant.token}));assert.deepEqual(Object.fromEntries(Object.keys(input(first)).map(key=>[key,a[key]])),input(first),'Native consumers may advance the revision; the created snapshot must still match')
  assert.equal((await server('/accounts',{...write,body:input(outside)})).status,403)
  assert.equal((await server('/accounts',{...write,body:{...input(first),name:'Changed replay'}})).status,409)
  assert.equal((await server('/accounts',{...write,headers:{}})).status,400)
  assert.equal((await server('/accounts',{...write,body:{...input(second),renewalDate:'2027-02-30'},headers:{'idempotency-key':'synthetic-buoy-914-invalid'}})).status,400)
  await json(await server('/accounts',{...write,body:input(second),headers:{'idempotency-key':'synthetic-buoy-914-second'}}),201)
  const page=await json(await server('/accounts?limit=1',{token:grant.token}));assert.deepEqual(page.items.map(a=>a.id),[first]);assert.equal(page.next,first)
  const page2=await json(await server('/accounts?limit=1&after='+page.next,{token:grant.token}));assert.deepEqual(page2.items.map(a=>a.id),[second]);assert.equal(page2.next,null)
  assert.equal((await server('/accounts?limit=0',{token:grant.token})).status,400)
  assert.equal((await server('/accounts/'+outside,{token:grant.token})).status,403)
  const current=await json(await server('/accounts/'+first,{token:grant.token}))
  const update={...write,method:'PUT',body:{...input(first),name:'Updated synthetic account',revision:current.revision},headers:{'idempotency-key':'synthetic-buoy-914-update'}}
  const updated=await json(await server('/accounts/'+first,update));assert.notEqual(updated.revision,current.revision)
  assert.deepEqual(await json(await server('/accounts/'+first,update)),updated)
  assert.equal((await server('/accounts/'+first,{...update,headers:{'idempotency-key':'synthetic-buoy-914-stale'}})).status,409)
  assert.deepEqual(await json(await server('/accounts',write),201),concurrent[0],'Original create replay does not overwrite a later edit')
  assert.equal((await json(await server('/accounts/'+first,{token:grant.token}))).name,'Updated synthetic account')
  const reader=await mint({scopes:['accounts.read'],accountIds:[first]})
  assert.equal((await server('/accounts',{...write,token:reader.token})).status,403)
  assert.deepEqual((await json(await server('/accounts',{token:reader.token}))).items.map(a=>a.id),[first])
  const writer=await mint({scopes:['accounts.write']});assert.equal((await server('/accounts',{token:writer.token})).status,403)
  const limited=await mint({scopes:['accounts.read'],requestsPerMinute:2})
  const requests=await Promise.all(Array.from({length:5},()=>server('/accounts',{token:limited.token})))
  assert.equal(requests.filter(r=>r.status===200).length,2);assert.equal(requests.filter(r=>r.status===429).length,3)
  for(const response of requests.filter(r=>r.status===429)){assert.match(response.headers.get('retry-after'),/^[1-9]\d*$/);assert.ok(Number(response.headers.get('retry-after'))<=60);assert.equal(response.headers.get('ratelimit-limit'),'2')}
  if(!existing){instant+=60000;await json(await server('/accounts',{token:limited.token}));instant+=86400000;assert.equal((await server('/accounts',{token:limited.token})).status,401);assert.equal((await json(await call('/tokens'))).items.find(t=>t.id===limited.id).stoppedReason,'expiry');instant-=86400000}
  const entries=await json(await worker.request('/api/buoy/audit?action=account.created',{cookie}))
  assert.equal(entries.entries.filter(e=>e.actor==='integration:'+grant.id).length,2,'Each create has exactly one opaque audit entry')
  assert.ok(entries.entries.filter(e=>e.actor==='integration:'+grant.id).every(e=>!e.detail&&e.subject!==first&&e.subject!==second))
  await json(await call('/tokens/'+reader.id,'DELETE'));assert.equal((await server('/accounts',{token:reader.token})).status,401)
  await json(await call('/tokens/'+reader.id,'DELETE'))
  const credentialAudit=await json(await worker.request('/api/buoy/audit?subject=integration:'+reader.id,{cookie}))
  assert.deepEqual(credentialAudit.entries.map(e=>e.action).sort(),['integration.credential-issued','integration.credential-revoked'],'Issuance and the first revocation each record one audit; repeated revocation records none')
  assert.ok(credentialAudit.entries.every(e=>e.actor.startsWith('person:')&&!JSON.stringify(e).includes(reader.token)))
  assert.equal((await call('/tokens/'+grant.id,'DELETE',undefined,{headers:{origin:'https://other.invalid'}})).status,403)
  if(!existing){
   await json(await worker.request('/api/buoy/accounts/'+first,{cookie,method:'DELETE',body:{confirmation:'Updated synthetic account'}}))
   assert.equal((await server('/accounts',write)).status,401,'Erasure withdraws the credential that granted the removed account')
   const withdrawn=(await json(await call('/tokens'))).items.find(t=>t.id===grant.id)
   assert.equal(withdrawn.stoppedReason,'account_erasure');assert.ok(!withdrawn.accountIds.includes(first))
   assert.equal((await server('/accounts/'+first,{token:all.token})).status,404,'All-accounts authority cannot read an erased account')
   assert.equal((await server('/accounts',{...write,token:all.token})).status,409,'All-accounts authority cannot recreate an erased account')
   const fresh=await mint({accountIds:[first]})
   assert.equal((await server('/accounts',{...write,token:fresh.token})).status,409,'A freshly authorized attempt still cannot resurrect an erased account')
   assert.equal((await server('/accounts/'+first,{token:fresh.token})).status,404)
   await json(await call('/tokens/'+fresh.id,'DELETE'))
  }
  for(const token of [grant,writer,limited,all])await json(await call('/tokens/'+token.id,'DELETE'))
  if(!existing){
   const versionGrant=await mint({accountIds:[second]})
   const ownerState=await json(await worker.request('/api/buoy/state',{cookie}))
   await json(await worker.request('/auth/step-up',{method:'POST',cookie,body:{action:'owner:transfer'}}),202)
   const proof=worker.mails.findLast(mail=>mail.to.includes(mailbox('owner')))
   const proofUrl=new URL(proof.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'))
   assert.equal((await worker.request(proofUrl.pathname+proofUrl.search,{cookie})).status,200)
   assert.equal((await worker.request('/auth/confirm',{method:'POST',cookie,body:{token:proofUrl.searchParams.get('token')}})).status,303)
   await json(await worker.request('/auth/invite',{method:'POST',cookie,body:{email:mailbox('synthetic-buoy-914-owner'),displayName:'Second integration owner',role:'owner'}}),202)
   const secondOwner=await worker.signIn(mailbox('synthetic-buoy-914-owner'))
   for(const status of ['inactive','active']){
    await json(await worker.request('/auth/operator/status',{method:'POST',cookie:secondOwner,body:{operatorId:ownerState.operator.id,status}}))
    assert.equal((await server('/accounts',{token:versionGrant.token})).status,401,'An issuing-owner change invalidates the grant even after reactivation')
    const stopped=await json(await call('/tokens','GET',undefined,{cookie:secondOwner}))
    assert.equal(stopped.items.find(t=>t.id===versionGrant.id).stoppedReason,'issuer_change')
   }
  }
  return {accountId:first}
 }finally{if(!existing)await worker.close()}
}

if(process.argv.includes('--browser')){
 const {chromium}=await import('@playwright/test')
 const {mkdir}=await import('node:fs/promises')
 const worker=await startWorker({clock:()=>Date.parse('2026-10-26T12:00:10Z')})
 let browser
 try{
  const {accountId}=await integrationJourney(worker)
  browser=await chromium.launch({headless:true,...(process.env.BUOY_CHROMIUM?{executablePath:process.env.BUOY_CHROMIUM}:{}),args:['--no-sandbox']})
  const directory=process.env.BUOY_API_EVIDENCE
  if(directory)await mkdir(directory,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   await context.addCookies(worker.cookie.split('; ').map(value=>{const at=value.indexOf('=');return {name:value.slice(0,at),value:value.slice(at+1),url:worker.origin}}))
   const page=await context.newPage()
   await page.goto(worker.origin+'/app/accounts/'+accountId)
   await page.getByRole('heading',{name:'Updated synthetic account',exact:true}).waitFor()
   assert.match(await page.locator('body').innerText(),/Synthetic signed order/)
   if(width===1440)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Account screen fits the viewport after the integration write')
   if(directory)await page.screenshot({path:directory+'/account-'+width+'.png',fullPage:true})
   console.log('API-001 native account after scoped integration writes: '+width+' passed')
   await context.close()
  }
  await inventoryBrowser(browser,directory)
 }finally{if(browser)await browser.close();await worker.close()}
}

// Legacy storage is arranged as a migration fixture; every observation and
// authority transition then goes through the emitted Worker's public doors.
async function inventoryBrowser(browser,directory){
 const {mkdtemp,mkdir,symlink,readdir,writeFile,rm}=await import('node:fs/promises')
 const {tmpdir}=await import('node:os')
 const {join}=await import('node:path')
 const {createHash}=await import('node:crypto')
 const root=await mkdtemp(join(tmpdir(),'buoy-inventory-'))
 const base=Date.parse('2026-10-26T12:00:10Z'),day=86400000
 let instant=base,worker
 const legacyId='synthetic-buoy-legacy',legacyHash='synthetic-buoy-legacy-hash'
 const expectations=[],secrets=[]
 const mailbox=id=>id+'@'+'example.test'
 try{
  await mkdir(join(root,'migrations','core'),{recursive:true})
  for(const path of ['dist','node_modules'])await symlink(join(process.cwd(),path),join(root,path),'dir')
  for(const file of await readdir('./migrations/core'))await symlink(join(process.cwd(),'migrations','core',file),join(root,'migrations','core',file))
  await writeFile(join(root,'migrations','core','9999_inventory_fixture.sql'),"INSERT INTO buoy_integration_tokens(id,token_hash,owner_id,owner_version,scopes,account_ids,requests_per_minute,expires_at,revoked_at,label,revoked_reason) VALUES('"+legacyId+"','"+legacyHash+"','synthetic-buoy-former-owner',1,'[\"accounts.read\"]','[]',11,"+(base+30*day)+","+base+",'Legacy credential','revocation');")
  worker=await startWorker({root,clock:()=>instant})
  const {cookie}=worker
  const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()}
  const native=(path,method='GET',body,as=cookie)=>worker.request(path,{method,body,cookie:as})
  const tokens=(path='',method='GET',body,as=cookie)=>native('/api/buoy/v1/tokens'+path,method,body,as)
  const operator=(await json(await native('/api/buoy/state'))).operator
  const keeper='synthetic-buoy-9400',erased='synthetic-buoy-9401'
  const account=id=>({id,name:id===keeper?'Kept account':'Erased account',renewalDate:'2027-10-31',noticeDays:30,renewalEvidence:'Synthetic order',billing:null,support:null})
  for(const id of [keeper,erased])await json(await native('/api/buoy/accounts','POST',account(id)),201)
  const mint=async(label,settings={},as=cookie,issuer=operator)=>{
   const body={label,scopes:['accounts.read'],accountIds:[keeper],requestsPerMinute:17,expiresDays:30,...settings}
   const issued=await json(await tokens('','POST',body,as),201)
   secrets.push(issued.token,createHash('sha256').update(issued.token).digest('hex'))
   const expected={id:issued.id,label,scopes:body.scopes,accountIds:body.accountScope==='all'?[]:body.accountIds,accountScope:body.accountScope??'explicit',requestsPerMinute:body.requestsPerMinute,expiresAt:base+body.expiresDays*day,createdAt:new Date(base).toISOString(),lastUsedAt:null,issuer:{id:issuer.id,displayName:issuer.displayName},stoppedReason:null,expiringSoon:false}
   expectations.push(expected)
   return {issued,expected}
  }
  expectations.push({id:legacyId,label:'Legacy credential',scopes:['accounts.read'],accountIds:[],accountScope:'explicit',requestsPerMinute:11,expiresAt:base+30*day,createdAt:null,lastUsedAt:null,issuer:{id:'synthetic-buoy-former-owner',displayName:null},stoppedReason:'revocation',expiringSoon:false})
  const active=await mint('Current account service',{scopes:['accounts.read','accounts.write'],accountIds:[keeper,erased],requestsPerMinute:23})
  // Revoked grants also shed erased account identifiers without changing their stop reason.
  active.expected.accountIds=[keeper]
  await json(await tokens('/'+active.issued.id,'DELETE'))
  active.expected.stoppedReason='revocation'
  const live=await mint('Active account reader')
  const used=await worker.dispatch(new Request(worker.origin+'/api/buoy/v1/accounts/'+keeper,{headers:{authorization:'Bearer '+live.issued.token,'x-buoy-test-time':String(instant)}}))
  await json(used);live.expected.lastUsedAt=new Date(base).toISOString()
  const soon=await mint('All accounts reporting',{accountScope:'all',accountIds:[],requestsPerMinute:29,expiresDays:14})
  soon.expected.expiringSoon=true
  const expired=await mint('Short-lived credential',{expiresDays:1})
  expired.expected.stoppedReason='expiry'
  const withdrawn=await mint('Withdrawn before erasure',{accountIds:[erased],requestsPerMinute:31})
  await json(await tokens('/'+withdrawn.issued.id,'DELETE'))
  withdrawn.expected.stoppedReason='revocation';withdrawn.expected.accountIds=[]
  const erasureGrant=await mint('Account erasure withdrawal',{accountIds:[keeper,erased],requestsPerMinute:37})
  await json(await native('/api/buoy/accounts/'+erased,'DELETE',{confirmation:'Erased account'}))
  erasureGrant.expected.stoppedReason='account_erasure';erasureGrant.expected.accountIds=[keeper]
  const denied=await worker.dispatch(new Request(worker.origin+'/api/buoy/v1/accounts/'+keeper,{headers:{authorization:'Bearer '+erasureGrant.issued.token}}))
  assert.equal(denied.status,401,'Withdrawing a named account stops the entire credential')
  for(const [id,role,name] of [['synthetic-buoy-9402','admin','Inventory administrator'],['synthetic-buoy-9403','member','Inventory member']]){
   await json(await native('/auth/invite','POST',{email:mailbox(id),displayName:name,role}),202)
   const as=await worker.signIn(mailbox(id))
   assert.equal((await tokens('','GET',undefined,as)).status,403)
   const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true})
   await context.addCookies(as.split('; ').map(value=>{const at=value.indexOf('=');return {name:value.slice(0,at),value:value.slice(at+1),url:worker.origin}}))
   const page=await context.newPage()
   const response=await page.goto(worker.origin+'/app/audit')
   assert.equal(response.status(),role==='admin'?200:403)
   assert.equal(await page.locator('#integration-inventory').count(),0,'Non-owners never receive inventory markup')
   assert.ok(!(await page.content()).includes('Withdrawn before erasure'),'Non-owner documents expose no credential labels')
   await context.close()
  }
  await json(await native('/auth/step-up','POST',{action:'owner:transfer'}),202)
  const proof=worker.mails.findLast(mail=>mail.to.includes(mailbox('owner')))
  const proofUrl=new URL(proof.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'))
  assert.equal((await worker.request(proofUrl.pathname+proofUrl.search,{cookie})).status,200)
  assert.equal((await native('/auth/confirm','POST',{token:proofUrl.searchParams.get('token')})).status,303)
  await json(await native('/auth/invite','POST',{email:mailbox('synthetic-buoy-9404'),displayName:'Former integration issuer',role:'owner'}),202)
  const issuerCookie=await worker.signIn(mailbox('synthetic-buoy-9404'))
  const issuer=(await json(await native('/api/buoy/state','GET',undefined,issuerCookie))).operator
  const changed=await mint('Changed issuing owner',{},issuerCookie,issuer)
  await json(await native('/auth/operator/status','POST',{operatorId:issuer.id,status:'inactive'}))
  changed.expected.stoppedReason='issuer_change'
  instant+=2*day
  const expiredResponse=await worker.dispatch(new Request(worker.origin+'/api/buoy/v1/accounts/'+keeper,{headers:{authorization:'Bearer '+expired.issued.token,'x-buoy-test-time':String(instant)}}))
  assert.equal(expiredResponse.status,401)
  const inventory=await json(await tokens())
  const byId=(a,b)=>a.id.localeCompare(b.id)
  assert.deepEqual([...inventory.items].sort(byId),expectations.sort(byId),'Every inventory field reconciles with independently issued credentials and state transitions')
  const forbidden=[...secrets,legacyHash]
  for(const value of forbidden)assert.ok(!JSON.stringify(inventory).includes(value),'Inventory API exposes neither secrets nor hashes')
  const labels={'accounts.read':'Read accounts','accounts.write':'Write accounts'}
  const reasons={revocation:'Revoked by owner',expiry:'Expired',issuer_change:'Issuing owner changed',account_erasure:'Account erased; named grant withdrawn'}
  const time=value=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(new Date(value))+' UTC'
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   await context.addCookies(cookie.split('; ').map(value=>{const at=value.indexOf('=');return {name:value.slice(0,at),value:value.slice(at+1),url:worker.origin}}))
   const page=await context.newPage()
   assert.equal((await page.goto(worker.origin+'/app/audit')).status(),200)
   const panel=page.locator('#integration-inventory')
   await panel.scrollIntoViewIfNeeded()
   if(width===1440){
    const rendered=await panel.locator('article').evaluateAll(rows=>rows.map(row=>({id:row.dataset.integrationId,label:row.querySelector('h3').textContent,values:Object.fromEntries([...row.querySelectorAll('dt')].map(dt=>[dt.textContent,{text:dt.nextElementSibling.textContent,datetime:dt.nextElementSibling.querySelector('time')?.dateTime??null}]))})))
    assert.deepEqual(rendered.map(row=>row.id).sort(),expectations.map(row=>row.id).sort(),'No missing, extra or duplicate native credentials')
    for(const expected of expectations){
     const row=rendered.find(row=>row.id===expected.id)
     assert.equal(row.label,expected.label)
     const text=value=>({text:value,datetime:null}),stamp=(value,fallback)=>value===null?text(fallback):{text:time(value),datetime:new Date(value).toISOString()}
     assert.deepEqual(row.values,{
      Operations:text(expected.scopes.map(scope=>labels[scope]).join(' · ')),
      'Account scope':text(expected.accountScope==='all'?'All current and future accounts':expected.accountIds.length?'Kept account ('+keeper+')':'No remaining accounts'),
      'Rate limit':text(expected.requestsPerMinute+' requests per UTC minute'),
      Issuer:text((expected.issuer.displayName??'Former owner')+' ('+expected.issuer.id+')'),
      'Created (UTC)':stamp(expected.createdAt,'Unknown'),
      'Last used (UTC)':stamp(expected.lastUsedAt,'Never used'),
      'Expires (UTC)':stamp(expected.expiresAt,'Unknown'),
      'Expiry warning':text(expected.expiringSoon?'Expires within 14 days':'None'),
      'Stop reason':text(expected.stoppedReason?reasons[expected.stoppedReason]:'Active')
     },'Native values reconcile independently for '+expected.label)
    }
    const html=await page.content()
    for(const value of forbidden)assert.ok(!html.includes(value),'Native Audit document exposes neither secrets nor hashes')
    assert.ok(!html.includes(erased),'The erased account identifier is absent from the owner document')
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Inventory fits the viewport')
    assert.ok(await panel.locator('h2,h3,p,dt,dd,time').evaluateAll(nodes=>nodes.every(node=>parseFloat(getComputedStyle(node).fontSize)>=13)),'Inventory text is at least 13 pixels')
   }
   if(directory)await panel.screenshot({path:directory+'/inventory-'+width+'.png'})
   console.log('API-001 owner credential inventory: '+width+' inspected')
   await context.close()
  }
 }finally{if(worker)await worker.close();await rm(root,{recursive:true,force:true})}
}
