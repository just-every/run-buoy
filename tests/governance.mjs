// GOVERN-001: real Worker HTTP authority, limits, redaction, accounting and kill switch.
import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
const app=await startWorker()
try {
 const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()}
 const owner=(path,method='GET',body,extra={})=>app.request('/api/buoy'+path,{method,body,cookie:app.cookie,...extra})
 const command=(token,command,input)=>app.request('/api/buoy/commands',{method:'POST',token,body:{command,...(input?{input}:{})}})
 const mint=async body=>json(await owner('/agent-tokens','POST',body),201)
 const today=new Date().toISOString().slice(0,10)
 const account={id:'harbour',name:'Harbour Software',renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Signed customer renewal order',billing:{observedAt:today,reference:'Confidential invoice INV-1042',currency:'USD',totalMinor:4800000,creditsMinor:0,allocatedMinor:4800000,dueDate:today},support:{observedAt:today,reference:'Confidential support incident CASE-42',openTickets:2,urgentTickets:1}}
 await json(await owner('/accounts','POST',account),201)
 await json(await owner('/accounts/harbour/sentiment','POST',{rating:'red',reason:'Customer executive requested recovery review',days:30}),201)
 const snapshot=(await json(await owner('/state'))).accounts[0]
 const all=['account','billing','support','sentiment']
 for(const invalid of [{scopes:[]},{scopes:['email.send']},{dataClasses:[]},{dataClasses:['transcripts']},{expiresDays:0},{expiresDays:366},{requestsPerMinute:0},{requestsPerMinute:10001},{budgetMinor:-1},{budgetMinor:1.5},{budgetMinor:Number.MAX_SAFE_INTEGER+1}])assert.equal((await owner('/agent-tokens','POST',{label:'Refused policy',...invalid})).status,400,'GOVERN-001 invalid policy is refused')
 const beforeMint=Date.now(), legacy=await mint({label:'Legacy renewal assistant'}), afterMint=Date.now()
 assert.ok(legacy.expiresAt>=beforeMint+7*86400000&&legacy.expiresAt<=afterMint+7*86400000,'GOVERN-001 default expiry is seven days from issue')
 assert.deepEqual((await json(await command(legacy.token,'renewals.list'))).accounts,[snapshot],'GOVERN-001 legacy grants preserve the current account representation')
 for(const expiresDays of [1,365]) {const before=Date.now(),credential=await mint({label:'Bounded expiry',expiresDays});assert.ok(credential.expiresAt>=before+expiresDays*86400000&&credential.expiresAt<=Date.now()+expiresDays*86400000,'GOVERN-001 owner-selected expiry is bounded from issuance');await json(await owner('/agent-tokens/'+credential.id,'DELETE'))}
 const reader=await mint({label:'Account terms only',scopes:['renewals.list'],dataClasses:['account'],budgetMinor:0,requestsPerMinute:60})
 const listed=(await json(await command(reader.token,'renewals.list'))).accounts
 assert.equal(listed[0].name,account.name);assert.equal(listed[0].id,account.id)
 assert.doesNotMatch(JSON.stringify(listed),/INV-1042|CASE-42|recovery review|totalMinor|urgentTickets|outlook|health|segments|sentiment/,'GOVERN-001 omitted sources cannot leak through derived fields')
 const preparation={accountId:account.id,payload:{title:'Customer recovery review',dueDate:'2027-01-10'}}
 assert.equal((await command(reader.token,'playbook.prepare',preparation)).status,403,'GOVERN-001 read scope cannot prepare')
 const noSources=await mint({label:'Preparation with insufficient data',scopes:['playbook.prepare'],dataClasses:['account']})
 assert.equal((await command(noSources.token,'playbook.prepare',preparation)).status,403,'GOVERN-001 preparation cannot snapshot forbidden data classes')
 const preparer=await mint({label:'Playbook preparation only',scopes:['playbook.prepare'],dataClasses:all,budgetMinor:2500})
 assert.equal((await command(preparer.token,'renewals.list')).status,403)
 const proposal=await json(await command(preparer.token,'playbook.prepare',preparation),201)
 assert.equal(proposal.status,'prepared')
 assert.equal((await app.request('/api/buoy/proposals/'+proposal.id+'/approve',{method:'POST',token:preparer.token,body:{}})).status,403)
 assert.equal((await app.request('/api/buoy/accounts/harbour',{method:'PUT',token:preparer.token,body:{...account,revision:snapshot.revision}})).status,403)
 assert.equal((await command(preparer.token,'renewal.prepare',{accountId:account.id,payload:{outcome:'renewed',reason:'Accepted',evidence:'Signed order'}})).status,403)
 assert.equal((await command(preparer.token,'playbook.prepare',{...preparation,payload:{...preparation.payload,discount:10}})).status,403)
 assert.equal((await command(preparer.token,'commercial.discount')).status,400)
 assert.equal((await command(preparer.token,'email.send')).status,400,'GOVERN-001 no send scope exists or claims a send')
 assert.equal((await app.request('/api/buoy/commands',{method:'POST',token:preparer.token,headers:{'content-type':'text/plain'}})).status,415,'GOVERN-001 malformed input is an attempted request')
 // Keep the three simultaneous requests inside one real UTC minute without a fake clock.
 if(Date.now()%60000>55000)await new Promise(resolve=>setTimeout(resolve,60050-Date.now()%60000))
 const limited=await mint({label:'Rate limited reader',scopes:['renewals.list'],requestsPerMinute:2})
 const rates=await Promise.all([1,2,3].map(()=>command(limited.token,'renewals.list')))
 assert.deepEqual(rates.map(r=>r.status).sort(),[200,200,429],'GOVERN-001 concurrent reservations enforce the configured cap')
 const retry=Number(rates.find(r=>r.status===429).headers.get('retry-after'));assert.ok(retry>=1&&retry<=60,'GOVERN-001 retry timing reaches the next UTC minute')
 const stateBefore=await json(await owner('/state'))
 await json(await owner('/agents/settings','PUT',{disabled:true}))
 for(const token of [reader.token,preparer.token])assert.equal((await command(token,token===reader.token?'renewals.list':'playbook.prepare',preparation)).status,403,'GOVERN-001 the owner switch stops both agents mid-run')
 assert.deepEqual((await json(await owner('/state'))).proposals,stateBefore.proposals,'GOVERN-001 paused preparations create no work')
 await json(await owner('/agents/settings','PUT',{disabled:false}))
 assert.equal((await command(reader.token,'renewals.list')).status,200,'GOVERN-001 resumption retains original authority')
 await json(await owner('/agent-tokens/'+reader.id,'DELETE'))
 assert.equal((await command(reader.token,'renewals.list')).status,401,'GOVERN-001 revoked credentials stop immediately')
 const policy=await json(await owner('/agents'))
 for(const agent of policy.agents){assert.equal(agent.spentMinor,0);assert.ok(!('token' in agent)&&!('token_hash' in agent))}
 assert.equal(policy.agents.find(agent=>agent.id===preparer.id).budgetMinor,2500)
 const entries=policy.entries.filter(entry=>entry.tokenId===preparer.id)
 for(const status of ['attempt','succeeded','refused'])assert.ok(entries.some(entry=>entry.status===status),'GOVERN-001 ledger distinguishes '+status)
 for(const entry of policy.entries){assert.equal(entry.spentMinor,0);assert.ok(Date.parse(entry.occurredAt))}
 assert.doesNotMatch(JSON.stringify(policy),new RegExp([legacy.token,reader.token,preparer.token,'Customer recovery review','Confidential invoice','Confidential support'].join('|')),'GOVERN-001 ledger contains no credentials or request payloads')
 assert.ok(app.mails.length>0,'GOVERN-001 preparation retains its existing internal approval notification')
 for(const mail of app.mails){assert.deepEqual(mail.to,['owner@example.test']);assert.match(mail.text,/Review playbook proposal/);assert.match(mail.text,/\/app\/accounts\/harbour/)}
 assert.ok(app.outbound.every(url=>url==='https://api.resend.com/emails'),'GOVERN-001 no customer-send, billing or model provider operation occurs')
 await json(await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'member@example.test',displayName:'CS colleague',role:'member'}}),202)
 const member=await app.signIn('member@example.test')
 for(const [path,method,body]of [['/agents','GET'],['/agents/settings','PUT',{disabled:true}],['/agent-tokens','POST',{label:'Denied'}]])assert.equal((await owner(path,method,body,{cookie:member})).status,403,'GOVERN-001 policy administration is owner-only')
 assert.equal((await app.request('/api/buoy/agents')).status,401)
 assert.equal((await owner('/agents/settings','PUT',{disabled:true},{headers:{origin:'https://other.invalid'}})).status,403)
 // A second real owner changes the issuing owner's status; reactivation cannot revive old grants.
 await json(await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'second-owner@example.test',displayName:'Second owner',role:'owner'}}),202)
 const second=await app.signIn('second-owner@example.test'), ownerId=stateBefore.operator.id
 await json(await app.request('/auth/operator/status',{method:'POST',cookie:second,body:{operatorId:ownerId,status:'inactive'}}))
 assert.equal((await command(legacy.token,'renewals.list')).status,401,'GOVERN-001 issuing-owner authority is current')
 await json(await app.request('/auth/operator/status',{method:'POST',cookie:second,body:{operatorId:ownerId,status:'active'}}))
 assert.equal((await command(legacy.token,'renewals.list')).status,401,'GOVERN-001 an old owner-version grant stays invalid after reactivation')
 console.log('GOVERN-001 public HTTP journey passed: scopes, expiry policy, data classes, minute cap/retry timing, USD budget/actual cost, durable ledger, switch/revocation and owner authority.')
}finally{await app.close()}
