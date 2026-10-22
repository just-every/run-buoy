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
  await api('/accounts/'+id+'/contract','POST',{revision:(await api('/state')).accounts.find(a=>a.id===id).revision,contract:{currency:'USD',contractStart:'2026-01-01',contractEnd:'2027-12-31',lines:[{id:'synthetic-buoy-2202',product:'Success workspace',quantity:1,amountMinor:12345678,frequency:'annual',entitlements:''}],source:{reference:'synthetic-buoy-private-contract',confirmedOn:on}}})
 }
 await api('/accounts/'+ids[0]+'/owner','PUT',{ownerId:person.id})
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true}),reader=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   await context.addCookies(cookies(app.cookie,app.origin));await reader.addCookies(cookies(member,app.origin))
   const page=await context.newPage(),read=await reader.newPage()
   const proof=async(p,name,selector)=>{await scan(p,'Role '+name+' '+width);await p.locator(selector).screenshot({path:join(evidence,'roles-'+name+'-'+width+'.png')})}
   await page.goto(app.origin+'/app/roles',{waitUntil:'networkidle'});await page.locator('#role-assignment-panel > summary').click()
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
   await read.goto(app.origin+'/app/workspace',{waitUntil:'networkidle'});assert.equal(await read.locator('#workspace-list li').count(),1);assert.match(await read.locator('#csm-home').innerText(),/Harbour Marine/);await proof(read,'own-home','#work')
   await page.goto(app.origin+'/app/roles',{waitUntil:'networkidle'});await page.locator('#role-definition-panel > summary').click();form=page.locator('#role-definition');await form.getByLabel('Custom profile name',{exact:true}).fill('Own book observer '+width);await form.getByLabel('Default record scope',{exact:true}).selectOption('own');await form.getByLabel('Read accounts',{exact:true}).selectOption('scope');await submit(page,form.getByRole('button',{name:'Create custom profile',exact:true}));assert.equal(await page.getByRole('alert').count(),0);await page.locator('#role-definitions > summary').click();assert.match(await page.locator('#role-definitions').innerText(),new RegExp('Own book observer '+width));await proof(page,'custom-created','#role-definitions')
  }finally{await context.close();await reader.close()}
 }
 assert.deepEqual(failures,[],'Role configuration and scoped account/search screens inherit accessibility')
 console.log('Native profile assignment, stale refusal/recovery, support ARR bands, scoped book/search, direct denial and custom profile creation pass at 1440/390 with axe, keyboard and 320 reflow.')
}finally{await browser.close();await app.close()}
