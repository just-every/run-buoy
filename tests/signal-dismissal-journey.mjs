import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {scan,submit,failures} from './a11y-checks.mjs'

export async function signalDismissal(app,fixture,member){
 const {api,accounts}=fixture,accountId=accounts[0].id,otherId=accounts[1].id,on=new Date().toISOString().slice(0,10)
 const owner=(await api('/state')).operator.id
 for(const id of [accountId,otherId]){await api('/accounts/'+id+'/owner','PUT',{ownerId:owner});await api('/adoption/seats','PUT',{accountId:id,seats:20,reference:'Customer-confirmed dismissal review seats',observedAt:on})}
 const preferences=(await api('/notifications')).preferences
 await api('/notifications/preferences','PUT',{frequency:'daily',modes:{...preferences.modes,signal:'digest'}})
 const rule=await api('/adoption/consumers','POST',{name:'Dismissed adoption review',scope:'account',metric:'adoption.current.utilization',op:'lte',value:.5,health:true,alert:true,enabled:true})
 const notices=async(id=accountId,token)=> (await api('/notifications','GET',undefined,token??app.cookie)).items.filter(n=>n.adoptionRuleId===rule.id&&n.accountId===id)
 const notice=(await notices())[0];assert.ok(notice)
 const until=new Date(Date.now()+86400000).toISOString(),body={reason:'Customer rollout is paused until the agreed review.',until}
 const request=(id,data,cookie=app.cookie,headers)=>app.request('/api/buoy/notifications/'+id+'/dismiss',{cookie,headers,method:'POST',body:data})
 for(const data of [{...body,reason:''},{...body,until:'not-an-instant'},{...body,until:'2020-01-01T00:00:00.000Z'},{...body,extra:true}])assert.equal((await request(notice.id,data)).status,400)
 assert.equal((await request(notice.id,body,member)).status,404)
 assert.equal((await request(notice.id,body,app.cookie,{origin:'https://foreign.invalid'})).status,403)
 const token=await api('/agent-tokens','POST',{label:'Signal dismissal authority'})
 assert.equal((await app.request('/api/buoy/notifications/'+notice.id+'/dismiss',{token:token.token,method:'POST',body})).status,403)
 await api('/agent-tokens/'+token.id,'DELETE')
 assert.equal((await request(notice.id,body)).status,200)
 assert.deepEqual((await notices())[0].dismissal.reason,body.reason)
 assert.equal((await notices())[0].email,'dismissed','Pending digest mail is withdrawn, inbox evidence remains')
 const count=(await notices()).length,otherCount=(await notices(otherId)).length
 const seats=async(id,n)=>api('/adoption/seats','PUT',{accountId:id,seats:n,reference:'Customer-approved signal review seats',observedAt:on})
 await seats(accountId,1);await seats(accountId,100)
 await seats(otherId,1);await seats(otherId,100)
 await app.scheduled();await app.scheduled()
 assert.equal((await notices()).length,count,'A dismissed rule stays suppressed through known recovery/re-entry and hourly evaluation')
 assert.equal((await notices(otherId)).length,otherCount+1,'Another account still receives its next episode')
 assert.equal((await api('/state')).accounts.find(a=>a.id===accountId).health.status,'at-risk','Dismissal does not alter health')
 const colleague=(await api('/state')).people.find(p=>p.role==='member')
 await api('/accounts/'+accountId+'/owner','PUT',{ownerId:colleague.id})
 assert.equal((await notices(accountId,member)).length,1,'Another recipient receives current risk despite the former owner dismissal')
 await api('/accounts/'+accountId+'/owner','PUT',{ownerId:owner})
 assert.equal((await notices()).length,count)
 // Exercise actual expiry with the real clock after proving the long window.
 const expires=new Date(Date.now()+1000).toISOString()
 assert.equal((await request(notice.id,{...body,until:expires})).status,200)
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(expires)-Date.now())+100))
 await app.scheduled()
 assert.equal((await notices()).length,count+1,'An expired dismissal permits the next matching episode')
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const evidence=process.env.BUOY_SCREENSHOTS
 if(evidence)await mkdir(evidence,{recursive:true})
 try{
  for(const width of [1440,390]){
   await seats(accountId,1);await seats(accountId,100)
   const current=(await notices())[0]
   const context=await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true})
   await context.addCookies(app.cookie.split('; ').map(pair=>{const [name,...value]=pair.split('=');return {name,value:value.join('='),url:app.origin}}))
   const page=await context.newPage();await page.goto(app.origin+'/app/notifications',{waitUntil:'networkidle'})
   const form=page.locator('#dismiss-'+current.id)
   await form.locator('..').locator('summary').click()
   await form.getByLabel('Dismissal reason',{exact:true}).fill('Implementation review agreed with the customer '+width)
   await form.getByLabel('Dismiss until (ISO UTC)',{exact:true}).fill('not-an-instant')
   await submit(page,form.getByRole('button',{name:'Dismiss signal',exact:true}))
   assert.equal(await page.locator('[role=alert]').count(),1)
   assert.equal(await form.getByLabel('Dismissal reason',{exact:true}).inputValue(),'Implementation review agreed with the customer '+width)
   await scan(page,'Signal dismissal refused '+width)
   if(evidence)await form.locator('..').screenshot({path:evidence+'/signal-refused-'+width+'.png'})
   await form.getByLabel('Dismiss until (ISO UTC)',{exact:true}).fill(until)
   await submit(page,form.getByRole('button',{name:'Dismiss signal',exact:true}))
   assert.equal(await page.locator('[role=alert]').count(),0)
   const row=page.locator('li.record').filter({has:page.locator('#dismiss-'+current.id)})
   assert.match(await row.innerText(),new RegExp('Implementation review agreed with the customer '+width))
   assert.match(await row.innerText(),/Dismissed/)
   await scan(page,'Signal dismissed '+width)
   if(evidence)await row.screenshot({path:evidence+'/signal-dismissed-'+width+'.png'})
   assert.equal((await notices())[0].dismissal.until,until)
   await context.close()
   // Expire the disposition before exercising the next viewport's fresh episode.
   const end=new Date(Date.now()+1000).toISOString();await request(current.id,{reason:body.reason,until:end})
   await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(end)-Date.now())+100))
  }
 }finally{await browser.close()}
 assert.deepEqual(failures,[])
 assert.ok((await api('/audit')).entries.some(e=>e.action==='signal.dismissed'))
 await api('/adoption/consumers','POST',{...rule,enabled:false})
 await api('/notifications/preferences','PUT',{frequency:preferences.frequency,modes:preferences.modes})
 console.log('Recipient signal dismissal: reason/window, recovery/hourly suppression, expiry, account/recipient isolation, pending mail, health independence and native refusal/recovery at 1440/390 passed.')
}
