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
 const input=id=>({id,name:'Synthetic integration account',renewalDate:'2027-10-31',noticeDays:30,renewalEvidence:'Synthetic signed order',billing:null,support:null})
 const mint=async(overrides={})=>json(await call('/tokens','POST',{scopes:['accounts.read','accounts.write'],accountIds:[first,second],requestsPerMinute:600,expiresDays:1,...overrides}),201)
 try{
  const spec=await json(await call('/openapi.json'));assert.equal(spec.openapi,'3.1.0');assert.ok(spec.paths['/accounts'].post);assert.ok(spec.paths['/accounts/{id}'].put)
  assert.equal((await worker.request('/api/buoy/v1/tokens',{method:'POST',body:{}})).status,401)
  const invited=await worker.request('/auth/invite',{method:'POST',cookie,body:{email:'synthetic-buoy-914@example.test',displayName:'Integration member',role:'member'}});assert.equal(invited.status,202)
  const member=await worker.signIn('synthetic-buoy-914@example.test')
  assert.equal((await call('/tokens','POST',{}, {cookie:member})).status,403)
  assert.equal((await call('/tokens/synthetic-buoy-914','DELETE',undefined,{cookie:member})).status,403)
  assert.equal((await call('/tokens','POST',{scopes:['accounts.write'],accountIds:['*'],requestsPerMinute:10,expiresDays:1})).status,400)
  assert.equal((await call('/tokens','POST',{scopes:['all'],accountIds:[first],requestsPerMinute:10,expiresDays:1})).status,400)
  const grant=await mint()
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
  const update={...write,method:'PUT',body:{...input(first),name:'Updated synthetic account',revision:a.revision},headers:{'idempotency-key':'synthetic-buoy-914-update'}}
  const updated=await json(await server('/accounts/'+first,update));assert.notEqual(updated.revision,a.revision)
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
  if(!existing){instant+=60000;await json(await server('/accounts',{token:limited.token}));instant+=86400000;assert.equal((await server('/accounts',{token:limited.token})).status,401);instant-=86400000}
  const entries=await json(await worker.request('/api/buoy/audit?action=account.created',{cookie}))
  assert.equal(entries.entries.filter(e=>e.actor==='integration:'+grant.id).length,2,'Each create has exactly one opaque audit entry')
  assert.ok(entries.entries.filter(e=>e.actor==='integration:'+grant.id).every(e=>!e.detail&&e.subject!==first&&e.subject!==second))
  await json(await call('/tokens/'+reader.id,'DELETE'));assert.equal((await server('/accounts',{token:reader.token})).status,401)
  await json(await call('/tokens/'+reader.id,'DELETE'))
  assert.equal((await call('/tokens/'+grant.id,'DELETE',undefined,{headers:{origin:'https://other.invalid'}})).status,403)
  if(!existing){
   await json(await worker.request('/api/buoy/accounts/'+first,{cookie,method:'DELETE',body:{confirmation:'Updated synthetic account'}}))
   assert.equal((await server('/accounts',write)).status,401,'Erasure withdraws the credential that granted the removed account')
   const fresh=await mint({accountIds:[first]})
   assert.equal((await server('/accounts',{...write,token:fresh.token})).status,409,'A freshly authorized attempt still cannot resurrect an erased account')
   assert.equal((await server('/accounts/'+first,{token:fresh.token})).status,404)
   await json(await call('/tokens/'+fresh.id,'DELETE'))
  }
  for(const token of [grant,writer,limited])await json(await call('/tokens/'+token.id,'DELETE'))
  if(!existing){
   const versionGrant=await mint({accountIds:[second]})
   const ownerState=await json(await worker.request('/api/buoy/state',{cookie}))
   await json(await worker.request('/auth/step-up',{method:'POST',cookie,body:{action:'owner:transfer'}}),202)
   const proof=worker.mails.findLast(mail=>mail.to.includes('owner@example.test'))
   const proofUrl=new URL(proof.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'))
   assert.equal((await worker.request(proofUrl.pathname+proofUrl.search,{cookie})).status,200)
   assert.equal((await worker.request('/auth/confirm',{method:'POST',cookie,body:{token:proofUrl.searchParams.get('token')}})).status,303)
   await json(await worker.request('/auth/invite',{method:'POST',cookie,body:{email:'synthetic-buoy-914-owner@example.test',displayName:'Second integration owner',role:'owner'}}),202)
   const secondOwner=await worker.signIn('synthetic-buoy-914-owner@example.test')
   for(const status of ['inactive','active']){
    await json(await worker.request('/auth/operator/status',{method:'POST',cookie:secondOwner,body:{operatorId:ownerState.operator.id,status}}))
    assert.equal((await server('/accounts',{token:versionGrant.token})).status,401,'An issuing-owner change invalidates the grant even after reactivation')
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
  browser=await chromium.launch({headless:true,executablePath:process.env.BUOY_CHROMIUM??'/usr/bin/chromium',args:['--no-sandbox']})
  const directory=process.env.BUOY_API_EVIDENCE
  if(directory)await mkdir(directory,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   await context.addCookies(worker.cookie.split('; ').map(value=>{const at=value.indexOf('=');return {name:value.slice(0,at),value:value.slice(at+1),url:worker.origin}}))
   const page=await context.newPage()
   await page.goto(worker.origin+'/app/accounts/'+accountId)
   await page.getByRole('heading',{name:'Updated synthetic account',exact:true}).waitFor()
   assert.match(await page.locator('body').innerText(),/Synthetic signed order/)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Account screen fits the viewport after the integration write')
   if(directory)await page.screenshot({path:directory+'/account-'+width+'.png',fullPage:true})
   console.log('API-001 native account after scoped integration writes: '+width+' passed')
   await context.close()
  }
 }finally{if(browser)await browser.close();await worker.close()}
}
