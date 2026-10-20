// CONNECT-001 and inherited A11Y-001: native forms and observable end states.
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {startWorker} from './worker.mjs'
import {scan,failures,manual,submit} from './a11y-checks.mjs'
const live=process.env.BUOY_STRIPE_TEST_KEY
const fixtureKey=['rk','test','browserFixtureCustomerRead'].join('_')
let fail=false
const app=await startWorker({secure:false,providerFetch:async request=>{
 assert.equal(request.method,'GET');assert.equal(new URL(request.url).pathname,'/v1/customers')
 if(live)return fetch(request)
 if(fail)return Response.json({error:{message:'private provider error'}},{status:401})
 return Response.json({data:[{id:'cus_browserFixture',object:'customer',created:1700000000,livemode:false}],has_more:false})
}})
let browser
try{
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const read=async()=>{const response=await app.request('/api/buoy/connections',{cookie:app.cookie});assert.equal(response.status,200);return response.json()}
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}})
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage();await page.goto(app.origin+'/app/usage',{waitUntil:'networkidle'})
   await scan(page,`CONNECT-001 usage entry ${width}`)
   if(process.env.BUOY_PROOF_DIR){await mkdir(process.env.BUOY_PROOF_DIR,{recursive:true});await page.screenshot({path:process.env.BUOY_PROOF_DIR+`/usage-${width}-entry.png`,fullPage:true})}
   await page.getByRole('link',{name:'Provider connections',exact:true}).click();await page.waitForLoadState('networkidle')
   const snap=async label=>{if(process.env.BUOY_PROOF_DIR){await mkdir(process.env.BUOY_PROOF_DIR,{recursive:true});await page.screenshot({path:process.env.BUOY_PROOF_DIR+`/connections-${width}-${label}.png`,fullPage:true,mask:[page.locator('[data-secret]')]})}}
   const show=async id=>{const panel=page.locator('#'+id);if(!await panel.evaluate(e=>e.open))await panel.locator('summary').click()}
   await show('connection-add-panel');let form=page.locator('#connection-add')
   await form.getByLabel('Connection name',{exact:true}).fill('Harbour Stripe sandbox '+width)
   await form.getByLabel('Stripe test key',{exact:true}).fill(live??fixtureKey)
   // Password fields and credential-bearing forms have no local draft storage.
   assert.equal(await page.evaluate(()=>Object.values(localStorage).some(value=>value.includes('test_'))),false)
   await submit(page,form.getByRole('button',{name:'Add connection',exact:true}))
   const connection=(await read()).connections.find(c=>c.name==='Harbour Stripe sandbox '+width);assert.ok(connection)
   const row=page.locator('#connection-'+connection.id)
   assert.ok((await row.innerText()).includes('Never synced'));await scan(page,`CONNECT-001 configured ${width}`);await snap('configured')
   await submit(page,row.getByRole('button',{name:'Run sync for '+connection.name,exact:true}))
   let state=await read();let run=state.runs.find(r=>r.connection_id===connection.id)
   assert.equal(run.status,'succeeded',run.error);assert.ok(state.connections.find(c=>c.id===connection.id).last_success)
   if(live){
    await show('connection-key-panel-'+connection.id);form=page.locator('#connection-key-'+connection.id)
    await form.getByLabel('Stripe test key',{exact:true}).fill(fixtureKey)
    await submit(page,form.getByRole('button',{name:'Reconnect '+connection.name,exact:true}))
   }else fail=true
   await submit(page,page.locator('#connection-'+connection.id).getByRole('button',{name:'Run sync for '+connection.name,exact:true}))
   state=await read();assert.equal(state.connections.find(c=>c.id===connection.id).freshness,'Failed')
   assert.ok((await page.locator('#connection-'+connection.id).innerText()).includes('Stripe refused'))
   await scan(page,`CONNECT-001 failed ${width}`);await snap('failed')
   await show('connection-key-panel-'+connection.id);form=page.locator('#connection-key-'+connection.id)
   await form.getByLabel('Stripe test key',{exact:true}).fill(live??fixtureKey)
   await submit(page,form.getByRole('button',{name:'Reconnect '+connection.name,exact:true}));fail=false
   const previous=(await read()).connections.find(c=>c.id===connection.id).cursor
   await submit(page,page.locator('#connection-'+connection.id).getByRole('button',{name:'Run sync for '+connection.name,exact:true}))
   state=await read();run=state.runs.find(r=>r.connection_id===connection.id)
   assert.equal(run.status,'succeeded');assert.equal(run.cursor_before,previous)
   await scan(page,`CONNECT-001 reconnected ${width}`);await snap('reconnected')
   await submit(page,page.locator('#connection-'+connection.id).getByRole('button',{name:'Disconnect '+connection.name,exact:true}))
   assert.equal((await read()).connections.find(c=>c.id===connection.id).freshness,'Disconnected')
   const response=await app.request('/api/buoy/connections/'+connection.id+'/sync',{cookie:app.cookie,method:'POST',body:{}});assert.equal(response.status,409)
   await scan(page,`CONNECT-001 disconnected ${width}`);await snap('disconnected')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'CONNECT-001 no page overflow')
   const rendered=await page.content();assert.ok(!rendered.includes(live??fixtureKey),'CONNECT-001 no key survives native form response')
  }finally{await context.close()}
 }
 assert.deepEqual(failures,[],'CONNECT-001 inherited A11Y-001')
 for(const entry of manual)for(const rule of entry.rules)assert.equal(rule.id,'color-contrast')
 console.log('CONNECT-001 native add, sync, failed provider key, reconnect/cursor, disconnect and A11Y-001 at 1440/390 passed; provider='+(live?'Stripe test API':'network-edge fixture'))
}finally{if(browser)await browser.close();await app.close()}
