import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import axe from 'axe-core'
import {trustFixture} from './trust-journey.mjs'
import {submit} from './a11y-checks.mjs'

const evidence=process.env.EVIDENCE_DIR??'../evidence/data-trust';await mkdir(evidence,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.BUOY_CHROMIUM_PATH?{executablePath:process.env.BUOY_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
const f=await trustFixture(),context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true})
try{
 await context.addCookies(f.app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:f.app.origin}}))
 const page=await context.newPage(),proof=async name=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:join(evidence,name+'-'+width+'.png'),fullPage:true})}await page.setViewportSize({width:1440,height:1000})}
 await page.goto(f.app.origin+'/app/audit',{waitUntil:'networkidle'});await page.locator('#data-trust > summary').click()
 await submit(page,page.locator('#trust-scan').getByRole('button',{name:'Prepare trust review',exact:true}))
 await page.locator('#data-trust').evaluate(node=>node.open=true)
 assert.equal(await page.locator('#trust-proposals article').count(),3)
 assert.match(await page.locator('#trust-proposals').innerText(),/Possible duplicate company/);assert.match(await page.locator('#trust-proposals').innerText(),/Contract and Stripe ARR disagree/)
 await page.locator('#trust-mapping-panel > summary').click()
 let form=page.locator('#trust-mapping');await form.getByLabel('Segment source ID',{exact:true}).fill(f.claim.sourceId);await form.getByLabel('Exact group ID',{exact:true}).fill(f.claim.groupId);await form.getByLabel('Correct account',{exact:true}).selectOption(f.target);await form.getByLabel('Exact user ID (optional)',{exact:true}).fill(f.claim.userId);await form.getByLabel('Customer person ID (for user claims)',{exact:true}).fill(f.claim.personId)
 // Native validation preserves the source reference when a server refusal occurs.
 await form.getByLabel('Source reference and correction evidence',{exact:true}).fill(f.correction.reason);await form.getByLabel('Exact group ID',{exact:true}).fill('synthetic-buoy-unknown')
 await submit(page,form.getByRole('button',{name:'Propose group correction',exact:true}));assert.equal(await page.getByRole('alert').count(),1);assert.equal(await page.locator('#trust-mapping').getByLabel('Source reference and correction evidence',{exact:true}).inputValue(),f.correction.reason)
 await page.locator('#trust-mapping').getByLabel('Exact group ID',{exact:true}).fill(f.claim.groupId);await submit(page,page.locator('#trust-mapping').getByRole('button',{name:'Propose group correction',exact:true}))
 await page.locator('#data-trust').evaluate(node=>node.open=true)
 await f.sdk.group({messageId:'synthetic-buoy-7520',userId:f.claim.userId,groupId:f.claim.groupId,timestamp:'2026-10-27T11:30:00Z',traits:{buoyAccountId:f.target}});await submit(page,page.locator('#trust-scan').getByRole('button',{name:'Prepare trust review',exact:true}));await page.locator('#data-trust').evaluate(node=>node.open=true)
 const proposal=(await f.api('/trust')).proposals.find(row=>row.evidence.sourceClaim?.messageId==='synthetic-buoy-7520'),article=page.locator('#trust-'+proposal.id)
 await article.locator('details > summary').click();assert.match(await article.innerText(),/Unverified Segment claim/);assert.equal(await article.getByRole('link',{name:'Open source observation',exact:true}).count(),1);await page.evaluate(axe.source);const access=await page.evaluate(async()=>{const result=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations});assert.deepEqual(access,[],'Native trust review has no accessibility violations');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Review fits the tested desktop width');await proof('trust-review')
 form=page.locator('#trust-review-'+proposal.id);await form.getByLabel('Review reason',{exact:true}).fill('Source owner approved the exact correction');await submit(page,form.getByRole('button',{name:'Record trust decision',exact:true}));await page.locator('#data-trust').evaluate(node=>node.open=true)
 assert.match(await page.locator('#trust-'+proposal.id).innerText(),/approved/);await proof('trust-approved')
 await page.goto(f.app.origin+'/app/accounts/'+f.target,{waitUntil:'networkidle'});assert.match(await page.locator('main').innerText(),/Data trust correction/);assert.match(await page.locator('main').innerText(),/100/)
 const symbolic=await page.locator('a[href],button').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).filter(node=>{const copy=node.cloneNode(true);copy.querySelectorAll('.sr-only,[aria-hidden=true]').forEach(el=>el.remove());return !/[A-Za-z0-9]{2}/.test(copy.textContent.trim())}).map(node=>node.className))
 assert.deepEqual(symbolic,['rw-open'],'The inherited runway toggle is the only icon-only control')
 const toggle=page.locator('.rw-open'),hint=property=>toggle.evaluate((el,key)=>getComputedStyle(el,'::after')[key],property)
 await toggle.hover();await page.waitForTimeout(350);assert.equal(await hint('visibility'),'visible');await page.mouse.move(0,0);await toggle.focus();assert.equal(await hint('visibility'),'visible');assert.equal(await hint('transitionDelay'),'0s');await proof('trust-health')
 console.log('Data trust native review, refusal retention, approved correction and health screens at 1440 and 390 passed')
}finally{await context.close();await f.app.close();await browser.close()}
