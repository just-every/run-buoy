// Explicit held-key proof only. Never include the received capability or mailbox
// contents in output. Ordinary Verify retains its substituted provider edge.
import assert from 'node:assert/strict'
import {mailWorker} from './mail-runtime.mjs'

async function main(){
 const key=process.env.TWILIO_SENDGRID_API_KEY,from=process.env.TWILIO_SENDGRID_FROM_EMAIL,to=process.env.TEST_MAIL_TO,receiptToken=process.env.QA_INBOX_RECEIPT_TOKEN
 assert.ok(key&&from&&to&&receiptToken,'The four named held mail inputs are required')
 let accepted=false,providerStatus=null,providerAttempted=false,transportError=null,transportCode=null
 const app=await mailWorker({bindings:()=>({MAIL_PROVIDER:'sendgrid',MAIL_FROM:from,MAIL_API_KEY:key}),providerFetch:async request=>{
  assert.ok(request.url==='https://api.sendgrid.com/v3/mail/send','Only the selected mail provider is authorized')
  providerAttempted=true
  let response
  try{response=await fetch(request.url,{method:request.method,headers:{authorization:request.headers.get('authorization'),'content-type':request.headers.get('content-type')},body:await request.arrayBuffer(),redirect:'error'})}catch(error){transportError=error.name;transportCode=error.cause?.code??null;throw error}
  providerStatus=response.status
  accepted=response.status===202
  return response
 }})
 try{
  const started=Date.now(),invitation=await app.request('/api/buoy/portal-invitations',{cookie:app.cookie,method:'POST',body:{email:to,displayName:'Customer portal mail proof'}})
  if(invitation.status!==202||!accepted)console.log(JSON.stringify({invitationStatus:invitation.status,providerAttempted,providerStatus,transportError,transportCode,outboundCount:app.outbound.length}))
  assert.ok(invitation.status===202&&accepted,'The native customer invitation was accepted by SendGrid')
  const endpoint=new URL('https://rer-qa-inbox.runeditrun.workers.dev/receipts')
  endpoint.search=new URLSearchParams({to,since:String(started),subject:"You're invited",contains:app.origin,limit:'20'}).toString()
  const headers={authorization:'Bearer '+receiptToken},deadline=Date.now()+90000
  let receipt
  do{
   const response=await fetch(endpoint,{headers,redirect:'error'})
   assert.ok(response.ok,'The independent receipt endpoint is available')
   const data=await response.json()
   receipt=data.receipts?.find(r=>r.to.toLowerCase()===to.toLowerCase()&&Date.parse(r.receivedAt)>=started&&r.excerpt?.includes(app.origin))
   if(!receipt)await new Promise(resolve=>setTimeout(resolve,3000))
  }while(!receipt&&Date.now()<deadline)
  assert.ok(receipt,'The exact recipient independently received the invitation')
  const senderDomain=from.match(/@([^>\s]+)/)?.[1]?.toLowerCase()
  assert.ok(receipt.auth?.trusted&&(receipt.auth.dmarc==='pass'||receipt.auth.dkim==='pass'&&receipt.auth.dkimDomain?.toLowerCase()===senderDomain),'Receiver authentication establishes authentic sender mail')
  assert.ok(receipt.rawUrl,'The receiver retained the invitation body')
  const rawUrl=new URL(receipt.rawUrl,endpoint)
  assert.ok(rawUrl.origin===endpoint.origin&&rawUrl.pathname.startsWith('/receipts/'),'Read raw mail only at the authenticated inbox')
  const raw=await fetch(rawUrl,{headers,redirect:'error'})
  assert.ok(raw.ok,'The independent received body is readable')
  const decoded=(await raw.text()).replace(/=\r?\n/g,'').replace(/=([0-9A-F]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)))
  const links=decoded.match(/https?:[^\s<>"']+\/auth\/confirm\?token=[^\s<>"']+/g)??[]
  const link=links.map(value=>new URL(value.replaceAll('&amp;','&'))).find(value=>value.origin===app.origin)
  assert.ok(link,'The received invitation names this installation')
  assert.ok((await app.request(link.pathname+link.search)).status===200,'The received capability opens native confirmation')
  const confirmation=await app.request('/auth/confirm',{method:'POST',body:{token:link.searchParams.get('token')}})
  assert.ok(confirmation.status===303,'The received capability confirms the invited customer')
  const cookie=confirmation.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
  const home=await app.request('/api/buoy/portal/home',{cookie})
  assert.ok(home.status===200&&(await home.json()).plans.length===0,'The confirmed customer can open their empty portal')
  assert.ok((await app.request('/api/buoy/state',{cookie})).status===403,'The received invitation grants no internal access')
  console.log(JSON.stringify({providerAccepted:true,independentlyReceived:true,recipientMatched:true,receiptId:receipt.id,receivedAt:receipt.receivedAt,messageId:receipt.messageId,authentication:{spf:receipt.auth.spf,dkim:receipt.auth.dkim,dmarc:receipt.auth.dmarc,trusted:receipt.auth.trusted},receivedLinkConfirmed:true,portalHome:true,internalRefused:true}))
 }finally{await app.close()}
}
await main()
