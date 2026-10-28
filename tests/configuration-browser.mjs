import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {configurationFixture,description} from './configuration-journey.mjs'
import {scan,submit,failures} from './a11y-checks.mjs'
const evidence=process.env.EVIDENCE_DIR??'../evidence/configuration';await mkdir(evidence,{recursive:true})
const fixture=await configurationFixture(),{app,api}=fixture
const browser=await chromium.launch({headless:true,...(process.env.BUOY_CHROMIUM_PATH?{executablePath:process.env.BUOY_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true})
 try{
  await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return {name,value:rest.join('='),url:app.origin}}))
  const page=await context.newPage(),proof=async label=>{
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await scan(page,'Configuration '+label+' '+width);await page.screenshot({path:join(evidence,label+'-'+width+'.png'),fullPage:true})}
   await page.setViewportSize({width:1440,height:1000})
  }
  await page.goto(app.origin+'/app/ai',{waitUntil:'networkidle'});await page.getByRole('link',{name:'Describe and back-test a configuration',exact:true}).click()
  assert.equal(await page.getByRole('heading',{name:'Configuration drafts',level:1}).count(),1);await proof('empty-drafts')
  let prepare=page.locator('#configuration-prepare');await prepare.getByLabel('Configuration description',{exact:true}).fill(description)
  await prepare.getByLabel('Send this description to the configured model for this request',{exact:true}).check();await submit(page,prepare.getByRole('button',{name:'Prepare configuration draft',exact:true}))
  assert.equal(await page.getByRole('alert').count(),0)
  assert.equal(await page.locator('#configuration-fire-count').innerText(),'54');assert.equal(await page.locator('#configuration-churn-capture').innerText(),'1 of 2 churned accounts · 50.0%')
  assert.deepEqual((await api('/ai/configuration')).signals,[]);assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('buoy:draft:/app/ai/configuration:')).length),0)
  await proof('reviewed-backtest')
  await page.getByText('Weekly evidence',{exact:true}).click();assert.equal(await page.getByRole('table',{name:'Historical signal observations'}).count(),1);assert.match(await page.locator('#configuration-evidence').innerText(),/Prior weekly active baseline unavailable/);await proof('weekly-evidence')
  await page.reload({waitUntil:'networkidle'});const saved=(await api('/ai/configuration')).drafts[0]
  await page.goto(app.origin+'/app/ai/configuration?draft='+saved.id,{waitUntil:'networkidle'});assert.equal(await page.locator('#configuration-fire-count').innerText(),'54')
  const approve=page.locator('#configuration-approve');await approve.getByLabel('I approve this exact configuration and available back-test',{exact:true}).check();await submit(page,approve.getByRole('button',{name:'Approve and publish configuration',exact:true}))
  assert.equal(await page.getByRole('alert').count(),0);assert.equal((await api('/ai/configuration')).signals.length,1);assert.match(await page.locator('main').innerText(),/Published after explicit approval/);await proof('published-signal')
  await submit(page,page.getByRole('button',{name:'Pause signal',exact:true}));assert.equal((await api('/ai/configuration')).signals[0].enabled,0);await proof('paused-signal')
  const cases=[
   ['scorecard',{name:'Browser support health',measures:[{key:'urgent',name:'Urgent tickets',field:'support.urgentTickets',min:0,max:10,weight:1,direction:'lower',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]},'Score support health from urgent tickets'],
   ['segment',{name:'Browser urgent accounts',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'support.urgentTickets',op:'gte',value:1}]},tier:null,stage:null,playbook:null},'Find accounts with urgent tickets'],
   ['report',{name:'Browser account health count',object:'account',rules:{match:'all',conditions:[]},segmentId:null,groupBy:'health.status',measure:'count',operation:'count',formula:null,chart:'table',sharedRoles:[]},'Count accounts by health in a table'],
   ['playbook',{name:'Browser support review',enabled:false,reentryDays:30,failureThreshold:3,trigger:{kind:'manual'},entry:null,exit:null,steps:[{id:'review',kind:'task',title:'Review support evidence',dueDays:1,next:1}]},'Prepare a paused manual support review task']
  ]
  for(const [kind,config,description]of cases){
   fixture.setConfiguration(config);await page.goto(app.origin+'/app/ai/configuration',{waitUntil:'networkidle'})
   prepare=page.locator('#configuration-prepare');await prepare.getByLabel('Configuration kind',{exact:true}).selectOption(kind);await prepare.getByLabel('Configuration description',{exact:true}).fill(description);await prepare.getByLabel('Send this description to the configured model for this request',{exact:true}).check();await submit(page,prepare.getByRole('button',{name:'Prepare configuration draft',exact:true}))
   assert.equal(await page.getByRole('alert').count(),0);assert.match(await page.locator('main').innerText(),new RegExp(config.name));await proof(kind+'-draft')
   const approval=page.locator('#configuration-approve');await approval.getByLabel('I approve this exact configuration and available back-test',{exact:true}).check();await submit(page,approval.getByRole('button',{name:'Approve and publish configuration',exact:true}));assert.equal(await page.getByRole('alert').count(),0)
   assert.match(await page.locator('main').innerText(),/Published after explicit approval/)
   assert.equal(await page.locator('#configuration-approve').count(),0,'The reviewed draft reaches its published end state')
   const publishedDraft=(await api('/ai/configuration')).drafts.find(d=>d.config.name===config.name)
   assert.ok(publishedDraft.publishedId,'The browser approval records the native publication identifier')
   const native=kind==='scorecard'?(await api('/scorecards')).published:kind==='segment'?(await api('/segments')).segments.find(r=>r.id===publishedDraft.publishedId):kind==='report'?(await api('/reports')).reports.find(r=>r.id===publishedDraft.publishedId):(await api('/playbooks')).definitions.find(r=>r.id===publishedDraft.publishedId)
   assert.equal(native?.id,publishedDraft.publishedId)
   await proof(kind+'-published')
  }
  await fixture.configure({enabled:false});await page.goto(app.origin+'/app/ai/configuration',{waitUntil:'networkidle'});assert.equal(await page.locator('#configuration-prepare').count(),0);await proof('disabled-model')
  assert.equal(await page.locator('button').filter({hasText:/^[+−×]$/}).count(),0,'All controls on the changed screen have visible text labels')
  assert.deepEqual(failures,[])
  console.log('Configuration native approval, evidence, accessibility and 1440 and 390 proof passed')
 }finally{await context.close()}
}finally{await browser.close();await app.close()}
