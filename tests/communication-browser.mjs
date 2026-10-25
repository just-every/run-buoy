import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {communicationFixture} from './communication-journey.mjs'
import {scan,submit,failures} from './a11y-checks.mjs'
const directory=process.env.EVIDENCE_DIR??'./evidence/communications';await mkdir(directory,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
try{for(const width of [1440,390]){
 const f=await communicationFixture(),{app,account,api}=f,context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
 try{
  await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
  const page=await context.newPage(),proof=async label=>{await scan(page,'Communication '+label+' '+width);await page.screenshot({path:join(directory,label+'-'+width+'.png'),fullPage:true})}
  await page.goto(app.origin+'/app/settings/ai',{waitUntil:'networkidle'});assert.equal(await page.getByLabel('Enable communication sentiment',{exact:true}).isChecked(),false);await proof('settings-off')
  await f.configure();await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByLabel('Enable communication sentiment',{exact:true}).isChecked(),true);await proof('settings-enabled')
  await page.goto(app.origin+'/app/ai',{waitUntil:'networkidle'});const message=page.locator('#ai-message');await message.getByLabel('Account',{exact:true}).selectOption(account.id);await message.getByLabel('Message date',{exact:true}).fill('2026-09-02');await message.getByLabel('Customer message',{exact:true}).fill(account.messages[0].text);await message.getByLabel('Linked customer person ID',{exact:true}).fill('synthetic-buoy-unavailable');await submit(page,message.getByRole('button',{name:'Record message',exact:true}));assert.equal(await page.getByRole('alert').count(),1);assert.equal(await page.locator('#ai-message').getByLabel('Customer message',{exact:true}).inputValue(),account.messages[0].text);await proof('message-refused');await page.locator('#ai-message').getByLabel('Linked customer person ID',{exact:true}).fill('');await submit(page,page.locator('#ai-message').getByRole('button',{name:'Record message',exact:true}));assert.equal(await page.getByRole('alert').count(),0);assert.match(await page.locator('main').innerText(),/Source message recorded/);await proof('message-recorded')
  const form=page.locator('#ai-sentiment');await form.getByLabel('Account',{exact:true}).selectOption(account.id);await form.getByLabel('Communication month',{exact:true}).fill('2026-09');await form.getByLabel('Send permitted messages for this month',{exact:true}).check();await submit(page,form.getByRole('button',{name:'Score communication sentiment',exact:true}));assert.equal(await page.getByRole('alert').count(),0);assert.match(await page.locator('main').innerText(),/20 of 100.*at-risk/);assert.match(await page.locator('main').innerText(),/frustration/);await proof('cited-score')
  await page.getByRole('link',{name:'Source message',exact:true}).first().click();assert.equal(await page.getByRole('heading',{name:'Source message',level:1}).count(),1);assert.ok((await page.locator('blockquote').innerText()).includes(account.messages[0].text));await proof('source-message')
  await page.goto(app.origin+'/app/accounts/'+account.id,{waitUntil:'networkidle'});assert.match(await page.locator('main').innerText(),/Communication sentiment 20 of 100/);assert.equal(await page.getByRole('link',{name:'Source message',exact:true}).count(),1);await proof('account-health')
  await f.configure({classes:[]});await page.reload({waitUntil:'networkidle'});assert.match(await page.locator('main').innerText(),/excluded; communication sentiment removed from health/);assert.equal(await page.getByRole('link',{name:'Source message',exact:true}).count(),0);await proof('classes-excluded')
  await f.configure({communicationsEnabled:false});await page.reload({waitUntil:'networkidle'});assert.match(await page.locator('main').innerText(),/disabled; removed from health/);await proof('health-disabled')
  await page.goto(app.origin+'/app/ai',{waitUntil:'networkidle'});assert.equal(await page.locator('#ai-sentiment').count(),0);assert.match(await page.locator('main').innerText(),/Communication sentiment disabled/);await proof('measure-disabled')
  assert.equal(await page.locator('button').filter({hasText:/^[+−×]$/}).count(),0,'Communication controls use text labels')
  console.log('Communication browser passed',width)
 }finally{await context.close();await app.close()}
}assert.deepEqual(failures,[])}finally{await browser.close()}
