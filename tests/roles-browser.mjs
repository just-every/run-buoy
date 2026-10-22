import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {startWorker} from './worker.mjs'
import {scan,submit,failures} from './a11y-checks.mjs'

const app=await startWorker(),api=async(path,method='GET',body)=>{
 const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()
}
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
const evidence=process.env.EVIDENCE_DIR??'../evidence/roles';await mkdir(evidence,{recursive:true})
const cookies=(cookie,origin)=>cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:origin}})
try{
 await app.request('/auth/invite',{cookie:app.cookie,method:'POST',body:{email:'roles-browser@example.test',displayName:'Harbour success colleague',role:'member'}})
 const member=await app.signIn('roles-browser@example.test'),person=(await (await app.request('/api/buoy/state',{cookie:member})).json()).operator
 const on=new Date().toISOString().slice(0,10),ids=['synthetic-buoy-2200','synthetic-buoy-2201']
 for(const [i,id]of ids.entries()){
  await api('/accounts','POST',{id,name:['Harbour Marine','Coastal Analytics'][i],renewalDate:'2027-12-31',noticeDays:30,renewalEvidence:'synthetic-buoy-private-renewal',billing:null,support:null})
  await api('/accounts/'+id+'/contract','POST',{revision:(await api('/state')).accounts.find(a=>a.id===id).revision,contract:{currency:'USD',contractStart:'2026-01-01',contractEnd:'2027-12-31',lines:[{id:'synthetic-buoy-2202',product:'Success workspace',quantity:1,amountMinor:12345678,frequency:'annual',entitlements:''}],source:{reference:'synthetic-buoy-private-contract',confirmedOn:'2026-01-01'}}})
 }
 await api('/accounts/'+ids[0]+'/owner','PUT',{ownerId:person.id})
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true}),reader=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(cookies(app.cookie,app.origin));await reader.addCookies(cookies(member,app.origin))
   const page=await context.newPage(),read=await reader.newPage()
   const proof=async(p,name,selector)=>{await scan(p,'Role '+name+' '+width);await p.locator(selector).screenshot({path:join(evidence,'roles-'+name+'-'+width+'.png')})}
   await page.goto(app.origin+'/app/team',{waitUntil:'networkidle'});await submit(page,page.getByRole('link',{name:'Manage staff profiles and account scopes',exact:true}));await page.locator('#role-assignment-panel > summary').click()
   let form=page.locator('#role-assignment')
   await form.getByLabel('Staff person',{exact:true}).selectOption(person.id);await form.getByLabel('Profile',{exact:true}).selectOption('support');await form.getByLabel('Commercial visibility',{exact:true}).selectOption('full')
   // A saved revision is part of the public form; an intervening profile change
   // must refuse the stale form, keep entered choices, then recover on reload.
   await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:'csm'})
   await submit(page,form.getByRole('button',{name:'Save assigned profile',exact:true}));assert.equal(await page.getByRole('alert').count(),1);assert.equal(await page.locator('#role-assignment').getByLabel('Profile',{exact:true}).inputValue(),'support');await proof(page,'stale-refusal','#work')
   await submit(page,page.getByRole('link',{name:'Discard the assignment draft and reload current roles',exact:true}));await page.locator('#role-assignment-panel > summary').click();form=page.locator('#role-assignment');await form.getByLabel('Staff person',{exact:true}).selectOption(person.id);await form.getByLabel('Profile',{exact:true}).selectOption('support');await submit(page,form.getByRole('button',{name:'Save assigned profile',exact:true}));assert.equal(await page.getByRole('alert').count(),0);await proof(page,'assigned','#role-assignments')
   await read.goto(app.origin+'/app',{waitUntil:'networkidle'});assert.equal(await read.locator('#scoped-accounts li').count(),2);assert.match(await read.locator('#scoped-accounts').innerText(),/100,000 or more USD/);assert.doesNotMatch(await read.locator('#work').innerText(),/123,456|12345678|private-contract/);await proof(read,'support-band','#work')
   await submit(read,read.getByRole('link',{name:'Harbour Marine',exact:true}));assert.equal(await read.locator('#scoped-account').count(),1);await proof(read,'support-account','#work')
   await read.goto(app.origin+'/app/search?q=Harbour',{waitUntil:'networkidle'});assert.equal(await read.locator('#search-results li').count(),1);await proof(read,'scoped-search','#work')
   await read.goto(app.origin+'/app/search?q=12345678',{waitUntil:'networkidle'});assert.equal(await read.locator('#search-results li').count(),0)
   const denied=await read.goto(app.origin+'/app/revenue',{waitUntil:'networkidle'});assert.equal(denied.status(),403);await proof(read,'unported-refusal','#work')
   await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:'csm'})
   await read.goto(app.origin+'/app',{waitUntil:'networkidle'});assert.equal(await read.locator('#scoped-accounts li').count(),1);await proof(read,'own-book','#work')
   assert.equal((await read.goto(app.origin+'/app/accounts/'+ids[1],{waitUntil:'networkidle'})).status(),404)
   await read.goto(app.origin+'/app/workspace',{waitUntil:'networkidle'});assert.equal(await read.locator('#workspace-list li').count(),1);assert.match(await read.locator('#workspace-list').innerText(),/Harbour Marine/);await proof(read,'own-home','#work')
   await read.goto(app.origin+'/app/accounts/'+ids[0],{waitUntil:'networkidle'});await read.locator('#scoped-account-edit-panel > summary').click()
   let editor=read.locator('#scoped-account-edit');await editor.getByLabel('Account name',{exact:true}).fill('Harbour Marine updated');await editor.getByLabel('Notice period (days)',{exact:true}).fill('17');await editor.getByLabel('New renewal evidence',{exact:true}).fill('Customer-confirmed renewal review')
   const beforeEdit=(await api('/state')).accounts.find(a=>a.id===ids[0]),nativeEdit=Object.fromEntries(['id','name','renewalDate','noticeDays','renewalEvidence','billing','support','revision'].map(key=>[key,beforeEdit[key]]))
   await api('/accounts/'+ids[0],'PUT',{...nativeEdit,name:'Harbour Marine reviewed'})
   await submit(read,editor.getByRole('button',{name:'Save account details',exact:true}));assert.equal(await read.getByRole('alert').count(),1);assert.equal(await read.locator('#scoped-account-edit').getByLabel('Account name',{exact:true}).inputValue(),'Harbour Marine updated');await proof(read,'edit-stale-refusal','#work')
   await submit(read,read.getByRole('link',{name:'Discard the edit draft and reload the current account',exact:true}));editor=read.locator('#scoped-account-edit');await editor.getByLabel('Account name',{exact:true}).fill('Harbour Marine updated');await editor.getByLabel('Notice period (days)',{exact:true}).fill('17');await editor.getByLabel('New renewal evidence',{exact:true}).fill('Customer-confirmed renewal review')
   await submit(read,editor.getByRole('button',{name:'Save account details',exact:true}));assert.equal(await read.getByRole('alert').count(),0);assert.match(await read.locator('#scoped-account').innerText(),/Harbour Marine updated/);const afterEdit=(await api('/state')).accounts.find(a=>a.id===ids[0]);assert.equal(afterEdit.noticeDays,17);assert.deepEqual(afterEdit.billing,beforeEdit.billing);assert.deepEqual(afterEdit.support,beforeEdit.support);await proof(read,'account-edited','#work')
   await api('/accounts/'+ids[0],'PUT',{...nativeEdit,revision:afterEdit.revision})
   await read.goto(app.origin+'/app/revenue?period=quarter&end=2026-09-30',{waitUntil:'networkidle'});assert.equal(await read.locator('#retention-accounts li').count(),1);assert.match(await read.locator('#retention-accounts').innerText(),/Harbour Marine/);assert.doesNotMatch(await read.locator('#retention-accounts').innerText(),/Coastal Analytics/);await proof(read,'own-report','#work')
   const downloadLink=read.getByRole('link',{name:'Download permitted report CSV',exact:true}),csvResponse=await reader.request.get(app.origin+await downloadLink.getAttribute('href'));assert.equal(csvResponse.status(),200);const permittedCsv=await csvResponse.text();assert.match(permittedCsv,/Harbour Marine/);assert.doesNotMatch(permittedCsv,/Coastal Analytics/)
   await read.getByLabel('Product / plan',{exact:true}).selectOption('Success workspace');await submit(read,read.getByRole('button',{name:'Open retention report',exact:true}));assert.equal(await read.locator('#retention-accounts li').count(),1);await read.goto(app.origin+'/app/revenue?period=quarter&end=2026-09-30&plan=No%20matching%20product',{waitUntil:'networkidle'});assert.equal(await read.locator('#retention-accounts li').count(),0);await proof(read,'report-empty','#work')

   const renewalAccount='synthetic-buoy-'+(2800+width),renewalEnd=new Date(Date.parse(on)+60*86400000).toISOString().slice(0,10)
   await api('/accounts','POST',{id:renewalAccount,name:'Harbour Marine renewal review',renewalDate:renewalEnd,noticeDays:30,renewalEvidence:'Customer-confirmed annual review',billing:null,support:null})
   await api('/accounts/'+renewalAccount+'/owner','PUT',{ownerId:person.id})
   await api('/accounts/'+renewalAccount+'/contract','POST',{revision:(await api('/state')).accounts.find(a=>a.id===renewalAccount).revision,contract:{currency:'USD',contractStart:'2026-01-01',contractEnd:renewalEnd,lines:[{product:'Customer success workspace',quantity:1,amountMinor:120000,frequency:'annual',entitlements:''}],source:{reference:'Signed annual order',confirmedOn:on}}})
   const renewal=(await api('/renewals')).records.find(r=>r.accountId===renewalAccount);assert.ok(renewal)
   const proposal=await api('/proposals','POST',{accountId:renewalAccount,kind:'renewal',payload:{renewalId:renewal.id,outcome:'renewed',resultArrMinor:renewal.expectedArrMinor,reason:'Customer accepted the annual renewal',evidence:'Signed annual renewal order received'}})
   await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:'csm',grants:{concessionLimitMinor:null,renewalOutcome:true}})
   await read.goto(app.origin+'/app/approvals',{waitUntil:'networkidle'});assert.equal(await read.locator('#scoped-renewal-approvals li').count(),1);await proof(read,'renewal-review','#work')
   await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:'csm'})
   await submit(read,read.locator('#renewal-approve-'+proposal.id).getByRole('button',{name:'Approve renewal outcome',exact:true}));assert.equal(await read.getByRole('alert').count(),1);assert.equal((await api('/state')).decisions.filter(d=>d.proposalId===proposal.id).length,0);await proof(read,'renewal-refused','#work')
   await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:'csm',grants:{concessionLimitMinor:null,renewalOutcome:true}})
   await read.goto(app.origin+'/app/approvals',{waitUntil:'networkidle'});await submit(read,read.locator('#renewal-approve-'+proposal.id).getByRole('button',{name:'Approve renewal outcome',exact:true}));assert.equal(await read.getByRole('alert').count(),0);assert.equal(await read.locator('#scoped-renewal-approvals li').count(),0);assert.equal((await api('/state')).decisions.filter(d=>d.proposalId===proposal.id).length,1);await proof(read,'renewal-recorded','#work')
   await api('/accounts/'+renewalAccount,'DELETE',{confirmation:'Harbour Marine renewal review'})

   await page.goto(app.origin+'/app/roles',{waitUntil:'networkidle'});await page.locator('#role-definition-panel > summary').click();form=page.locator('#role-definition');await form.getByLabel('Custom profile name',{exact:true}).fill('Own book observer '+width);await form.getByLabel('Default record scope',{exact:true}).selectOption('own');await form.getByLabel('Read accounts',{exact:true}).selectOption('scope');await submit(page,form.getByRole('button',{name:'Create custom profile',exact:true}));assert.equal(await page.getByRole('alert').count(),0);await page.locator('#role-definitions > summary').click();assert.match(await page.locator('#role-definitions').innerText(),new RegExp('Own book observer '+width));await proof(page,'custom-created','#role-definitions')
  }finally{await context.close();await reader.close()}
 }
 assert.deepEqual(failures,[],'Role configuration and scoped account/search screens inherit accessibility')
 console.log('Native profile assignment, stale refusal/recovery, support ARR bands, scoped book/search, direct denial and custom profile creation pass at 1440/390 with axe, keyboard and 320 reflow.')
}finally{await browser.close();await app.close()}
