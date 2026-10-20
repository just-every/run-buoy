// USAGE-001 receiver and inherited A11Y-001 through native UI and actual buyer HTTP.
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {startWorker} from './worker.mjs'
import {BuoyUsage} from '../sdk/usage.mjs'
import {startUsageRelay} from './usage-relay.mjs'
import {scan,failures,manual,openForms,submit} from './a11y-checks.mjs'
const app=await startWorker({secure:false})
let browser
try{
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const call=async()=>{const response=await app.request('/api/buoy/usage',{cookie:app.cookie});assert.equal(response.status,200);return response.json()}
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}})
  let buyer
  try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=await context.newPage();await page.goto(app.origin+'/app/usage',{waitUntil:'networkidle'})
   const show=async id=>{const panel=page.locator('#'+id);if(!await panel.evaluate(e=>e.open))await panel.locator('summary').click()}
   await scan(page,`USAGE-001 source entry ${width}`)
   await show('usage-add-source');let form=page.locator('#usage-source')
   await form.getByLabel('Source name',{exact:true}).fill('Production product '+width)
   await form.getByLabel('Format',{exact:true}).selectOption('segment')
   await form.getByLabel('Source reference',{exact:true}).fill('Buyer product workspace '+width)
   await form.getByLabel('Stale after (UTC days)',{exact:true}).fill('30')
   await submit(page,form.getByRole('button',{name:'Add source',exact:true}))
   const source=(await call()).sources.find(s=>s.name==='Production product '+width);assert.ok(source)
   await show('usage-issue');form=page.locator('#usage-credential')
   await form.getByLabel('Source',{exact:true}).selectOption(source.id)
   await form.getByLabel('Credential label',{exact:true}).fill('Web collector '+width)
   for(const label of ['Allow track','Allow identify','Allow group','Allow event'])await form.getByLabel(label,{exact:true}).check()
   await submit(page,form.getByRole('button',{name:'Issue credential',exact:true}))
   const credential=await page.getByLabel('Ingestion credential',{exact:true}).inputValue();assert.ok(credential)
   await scan(page,`USAGE-001 credential issued ${width}`)
   const sdk=new BuoyUsage({origin:app.origin,sourceId:source.id,credential})
   const direct=await sdk.track({messageId:'direct-'+width,event:'Report downloaded',userId:' Raw/User '+width+' ',groupId:' Raw/Group '+width+' '})
   assert.equal(direct.accepted,1)
   await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByLabel('Ingestion credential',{exact:true}).count(),0)
   assert.ok((await page.locator('#usage-review').innerText()).includes('Raw/User '+width))
   buyer=await startUsageRelay(sdk,{userId:' Trusted/User '+width+' ',groupId:' Trusted/Group '+width+' '})
   const product=await context.newPage();await product.goto(buyer.origin)
   const unsafe=await product.evaluate(async()=>{const{BuoyUsage}=await import('/buoy-usage.js');return [{relay:'/usage-relay',credential:'not-a-secret'},{relay:'https://foreign.invalid/relay'},{relay:'/api/buoy/usage/intake/source'}].map(options=>{try{new BuoyUsage(options);return false}catch{return true}})})
   assert.deepEqual(unsafe,[true,true,true],'USAGE-001 browser SDK refuses secrets and raw/cross-origin intake')
   const send=()=>product.evaluate(async width=>{const{BuoyUsage}=await import('/buoy-usage.js');try{return{status:202,data:await new BuoyUsage({relay:'/usage-relay'}).track({messageId:'browser-'+width,event:'License settings opened',userId:'spoofed-user',groupId:'spoofed-group',anonymousId:'spoofed-anon',context:{userId:'spoofed-user',groupId:'spoofed-group'}})}}catch(error){return{status:error.status}}},width)
   assert.equal((await send()).status,401,'anonymous buyer session refused')
   await context.addCookies([buyer.cookie]);const receipt=await send();assert.equal(receipt.status,202);assert.equal(receipt.data.accepted,1)
   const foreign=await fetch(buyer.origin+'/usage-relay',{method:'POST',headers:{origin:'https://foreign.invalid','content-type':'application/json'},body:'{}'});assert.equal(foreign.status,403)
   const state=await call(),review=state.review.filter(row=>row.sourceId===source.id)
   assert.equal(review.length,2);assert.ok(review.some(row=>row.userId===buyer.userId&&row.groupId===buyer.groupId&&row.eventCount===1))
   assert.ok(review.some(row=>row.userId===' Raw/User '+width+' '&&row.groupId===' Raw/Group '+width+' '))
   assert.ok(!JSON.stringify(review).includes('spoofed'));assert.ok(review.every(row=>!('accountId'in row)&&!('contactId'in row)&&!('personId'in row)))
   assert.equal(state.sources.find(s=>s.id===source.id).eventCount,2)
   await product.close();await page.reload({waitUntil:'networkidle'});await openForms(page);await scan(page,`USAGE-001 pending raw identities ${width}`)
   form=page.locator('#usage-source-'+source.id);await form.getByLabel('Stale after (UTC days)',{exact:true}).fill('7')
   await submit(page,form.getByRole('button',{name:'Save source',exact:true}));assert.equal((await call()).sources.find(s=>s.id===source.id).staleDays,7)
   const issued=(await call()).credentials.find(c=>c.sourceId===source.id)
   await submit(page,page.locator('#usage-revoke-'+issued.id).getByRole('button',{name:'Revoke Web collector '+width,exact:true}))
   await assert.rejects(()=>sdk.track({event:'After revocation',userId:'raw'}),error=>error.status===401)
   assert.ok((await call()).credentials.find(c=>c.id===issued.id).revokedAt)
   await openForms(page);await scan(page,`USAGE-001 source edited and credential revoked ${width}`)
  }finally{if(buyer)await buyer.close();await context.close()}
 }
 assert.deepEqual(failures,[],'USAGE-001 inherited A11Y-001 checks')
 for(const entry of manual)for(const rule of entry.rules)assert.equal(rule.id,'color-contrast','Every other accessibility incomplete fails')
 console.log('USAGE-001 real native forms, authenticated buyer relay, pending exact source identities, revocation and A11Y-001 passed at 1440/390.')
}finally{if(browser)await browser.close();await app.close()}
