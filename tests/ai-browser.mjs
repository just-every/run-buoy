import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {aiFixture} from './ai-journey.mjs'
import {scan,submit,failures} from './a11y-checks.mjs'
const evidence=process.env.EVIDENCE_DIR??'../evidence/ai';await mkdir(evidence,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{
 for(const width of [1440,390]){
 const {app,api,configure,sent}=await aiFixture();const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
 try{
  await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
  const page=await context.newPage(),proof=async label=>{await scan(page,'AI '+label+' '+width);await page.screenshot({path:join(evidence,label+'-'+width+'.png'),fullPage:true})}
  await page.goto(app.origin+'/app/team',{waitUntil:'networkidle'});await proof('team-settings-link');await page.getByRole('link',{name:'AI model and data settings',exact:true}).click();assert.match(await page.locator('main').innerText(),/Provider no-training attestation: unverified/);await proof('disabled-settings')
  const settings=page.locator('#ai-settings');await settings.getByLabel('Enable AI assistance',{exact:true}).check();await settings.getByLabel('Total budget in USD cents',{exact:true}).fill('100');await settings.getByLabel('No-training terms reference',{exact:true}).fill('synthetic-buoy-8001');await settings.getByLabel('I confirm the configured provider terms prohibit training on this data',{exact:true}).check();await settings.getByLabel('transcripts',{exact:true}).check()
  await submit(page,settings.getByRole('button',{name:'Save AI settings',exact:true}));assert.equal(await page.getByRole('alert').count(),0);assert.match(await page.locator('main').innerText(),/Provider no-training attestation: unverified/);await proof('enabled-settings')
  await page.getByRole('link',{name:'Open AI assistance',exact:true}).click();let q=page.locator('#ai-question');await q.getByLabel('Question',{exact:true}).fill('Prepare a meeting brief');await q.getByLabel('Send the selected permitted evidence for this request',{exact:true}).check();await submit(page,q.getByRole('button',{name:'Ask with citations',exact:true}));assert.equal(await page.getByRole('alert').count(),0);assert.ok(await page.getByRole('link',{name:'Visible Harbour',exact:true}).count());await proof('cited-answer')
  let conversation=page.locator('#ai-conversation');await conversation.getByLabel('Account',{exact:true}).selectOption('synthetic-buoy-8002');await conversation.getByLabel('Transcript with one statement per line',{exact:true}).fill('I commit to send the implementation checklist.\nA competitor was mentioned.\nWe request an expansion.');await conversation.getByLabel('Send the selected permitted evidence for this request',{exact:true}).check();await submit(page,conversation.getByRole('button',{name:'Prepare proposals',exact:true}));assert.equal(await page.getByRole('alert').count(),0);await proof('cited-proposals')
  const task=page.locator('form[id^="ai-proposal-"]').filter({has:page.getByRole('button',{name:'Accept and create task',exact:true})});await task.getByLabel('Task due date',{exact:true}).fill('2027-01-01');await submit(page,task.getByRole('button',{name:'Accept and create task',exact:true}));assert.equal((await api('/state')).tasks.length,1);await proof('accepted-task')
  await submit(page,page.getByRole('button',{name:'Discard proposal',exact:true}).first());await proof('discarded-proposal')
  await configure({classes:[]});const before=sent.length;conversation=page.locator('#ai-conversation');await conversation.getByLabel('Account',{exact:true}).selectOption('synthetic-buoy-8002');await conversation.getByLabel('Transcript with one statement per line',{exact:true}).fill('synthetic-buoy-private-transcript');await conversation.getByLabel('Send the selected permitted evidence for this request',{exact:true}).check();await submit(page,conversation.getByRole('button',{name:'Prepare proposals',exact:true}));assert.equal(await page.getByRole('alert').count(),1);assert.equal(sent.length,before);assert.equal(await page.locator('#ai-conversation textarea').inputValue(),'synthetic-buoy-private-transcript');await proof('excluded-transcript')
  await configure({enabled:false});await page.goto(app.origin+'/app/ai',{waitUntil:'networkidle'});assert.equal(await page.locator('#ai-question,#ai-conversation').count(),0);await proof('disabled-assistance');console.log('AI browser proof passed',width)
  await configure()
  await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'synthetic-buoy-8009@example.test',displayName:'Scoped reader',role:'member'}})
  const scopedCookie=await app.signIn('synthetic-buoy-8009@example.test'),person=(await api('/state','GET',undefined,scopedCookie)).operator
  await api('/accounts/synthetic-buoy-8002/owner','PUT',{ownerId:person.id})
  for(const role of ['csm','support']){
   await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:role,scope:{kind:'own'}})
   await context.clearCookies();await context.addCookies(scopedCookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   await page.goto(app.origin+'/app/ai',{waitUntil:'networkidle'})
   assert.equal(await page.locator('#ai-conversation').count(),0)
   q=page.locator('#ai-question');await q.getByLabel('Question',{exact:true}).fill('Prepare a meeting brief');await q.getByLabel('Send the selected permitted evidence for this request',{exact:true}).check();await submit(page,q.getByRole('button',{name:'Ask with citations',exact:true}))
   assert.equal(await page.getByRole('alert').count(),0);assert.ok(await page.getByRole('link',{name:'Visible Harbour',exact:true}).count());assert.doesNotMatch(await page.locator('main').innerText(),/Outside Coastal/);assert.doesNotMatch(JSON.stringify(sent.at(-1)),/Outside Coastal|8003/);await proof(role+'-scoped-answer')
  }
  assert.equal(await page.locator('button').filter({hasText:/^[+−×]$/}).count(),0,'AI screens introduce no icon-only controls')
 }finally{await context.close();await app.close()}
 }
 assert.deepEqual(failures,[],'AI screens retain accessibility at both widths and 320 reflow')
}finally{await browser.close()}
