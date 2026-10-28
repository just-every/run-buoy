// Run with the four named held mail sources injected by the fleet environment shim.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {planFixture,planDependencies} from './plan-fixture.mjs'

const names=['TWILIO_SENDGRID_API_KEY','TWILIO_SENDGRID_FROM_EMAIL','QA_INBOX_RECEIPT_TOKEN','TEST_MAIL_TO']
for(const name of names)assert.ok(process.env[name],name+' is required')
const recipient=process.env.TEST_MAIL_TO,mailFrom=process.env.TWILIO_SENDGRID_FROM_EMAIL
let submissions=0,accepted=false,providerStatus=null
const f=await planFixture({bindings:()=>({MAIL_PROVIDER:'sendgrid',MAIL_FROM:mailFrom,MAIL_API_KEY:process.env.TWILIO_SENDGRID_API_KEY}),providerFetch:async request=>{
 assert.equal(request.url,'https://api.sendgrid.com/v3/mail/send')
 const body=await request.text(),message=JSON.parse(body)
 assert.ok(message.personalizations.every(item=>item.to.every(address=>address.email===recipient)),'Live proof sends only to the held receiving inbox')
 submissions++
 let response
 try{response=await fetch(request.url,{method:'POST',headers:{authorization:request.headers.get('authorization'),'content-type':'application/json'},body,redirect:'manual',signal:AbortSignal.timeout(30000)})}
 catch(error){console.error(JSON.stringify({transportError:error.name,code:error.cause?.code??error.code??null}));return new Response(null,{status:502})}
 providerStatus=response.status
 accepted=response.status===202
 return response
}})
try{
 await f.api('/notifications/preferences','PUT',{frequency:'off',modes:{mention:'none',assignment:'none',signal:'none',approval:'none'}})
 const dep=await planDependencies(f),plan=await f.save({name:'Champion collaboration',taskIds:[dep.taskId],milestones:dep.milestones})
 const since=Date.now()
 await f.api('/portal-invitations','POST',{email:recipient,displayName:'Customer champion'})
 assert.equal(submissions,1);assert.ok(accepted,'The real mail provider accepted the native invitation')
 const headers={authorization:'Bearer '+process.env.QA_INBOX_RECEIPT_TOKEN}
 const inbox=new URL('https://rer-qa-inbox.runeditrun.workers.dev/receipts')
 inbox.search=new URLSearchParams({to:recipient,from:mailFrom,subject:'invited to Buoy',since:String(since),limit:'20'})
 let receipt,link
 const deadline=Date.now()+120000
 while(Date.now()<deadline){
  const response=await fetch(inbox,{headers,signal:AbortSignal.timeout(15000)})
  assert.equal(response.status,200,'The authenticated inbox reader is available')
  for(const candidate of (await response.json()).receipts){
   const address=(candidate.excerpt.match(/https?:\/\/[^\s<>"']+/g)??[]).find(value=>value.startsWith(f.app.origin+'/auth/confirm?'))
   if(address){receipt=candidate;link=new URL(address.replaceAll('&amp;','&'));break}
  }
  if(receipt)break
  await new Promise(resolve=>setTimeout(resolve,3000))
 }
 assert.ok(receipt,'The receiving inbox contains this runtime invitation')
 assert.equal(receipt.to.toLowerCase(),recipient.toLowerCase())
 assert.equal(receipt.auth.dmarc,'pass','The receiver authenticates the invitation sender')
 assert.equal(link.origin,f.app.origin);assert.equal(link.pathname,'/auth/confirm')
 assert.equal((await f.app.request(link.pathname+link.search)).status,200,'Email preview leaves confirmation to the recipient')
 const confirm=await f.app.request('/auth/confirm',{method:'POST',body:{token:link.searchParams.get('token')}})
 assert.equal(confirm.status,303)
 const cookie=confirm.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
 assert.ok(cookie)
 assert.equal((await f.app.request('/auth/confirm',{method:'POST',body:{token:link.searchParams.get('token')}})).status,400,'A received invitation works once')
 assert.equal((await f.app.request('/api/buoy/state',{cookie})).status,403,'A confirmed invitation alone exposes no internal data')
 const shared=await f.api('/accounts/'+f.accountId+'/portal-sharing','POST',{planId:plan.id,planRevision:plan.revision,email:recipient,days:30,taskIds:[dep.taskId]})
 const read=await f.app.request('/api/buoy/portal/'+shared.id,{cookie});assert.equal(read.status,200)
 const view=await read.json();assert.equal(view.name,'Champion collaboration');assert.deepEqual(view.tasks.map(task=>task.id),[dep.taskId])
 for(const body of [{action:'complete-task',taskId:dep.taskId,evidence:'Champion completed setup.'},{action:'comment',comment:'The customer reviewed the shared plan.'},{action:'confirm',objectiveId:'statement',statement:'The agreed business result is confirmed.'}]){
  const response=await f.app.request('/api/buoy/portal/'+shared.id+'/action',{cookie,method:'POST',body:{revision:view.revision,...body}})
  assert.equal(response.status,201)
 }
 const timeline=await f.api('/accounts/'+f.accountId+'/activity?source=customer-portal')
 assert.deepEqual(timeline.records.map(record=>record.kind).sort(),['customer-comment','customer-confirmation','customer-task-completed'])
 assert.equal((await f.app.request('/api/buoy/portal/'+f.other,{cookie})).status,403)
 assert.equal((await f.app.request('/api/buoy/accounts/'+f.accountId+'/activity',{cookie})).status,403)
 assert.equal(submissions,1,'Sharing and customer actions send no further mail')
 console.log(JSON.stringify({journey:'portal received invitation and isolated collaboration',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),provider:'sendgrid',accepted,receiptId:receipt.id,receivedAt:receipt.receivedAt,dmarc:receipt.auth.dmarc,outcomes:['received invitation','single-use confirmation','customer task','comment','internal timeline','other account refused','internal note refused']}))
}catch(error){console.error(JSON.stringify({journey:'portal received invitation',submissions,providerStatus,accepted,error:error.name}));throw error}
finally{await f.app.close()}
