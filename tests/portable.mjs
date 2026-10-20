import { importClient } from './import-door-client.mjs'
// A real D1 installation, public HTTP writes, and public rer export/import.
// Source and destination run sequentially; no provider calls or data fakes.
import assert from 'node:assert/strict'
import { cp, mkdtemp, rm, symlink, mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { startWorker } from './worker.mjs'

const root=resolve('.'), parent=await mkdtemp(join(tmpdir(),'buoy-portable-'))
const excluded=new Set(['node_modules','.git','.wrangler','.rer','.seed','.cache','.tanstack','exports','test-results'])
async function copy(name){
 const target=join(parent,name)
 await cp(root,target,{recursive:true,filter:path=>{const relative=path.slice(root.length+1);return !excluded.has(relative.split('/')[0])&&!relative.startsWith('.env')&&!relative.startsWith('.dev.vars')}})
 await symlink(join(root,'node_modules'),join(target,'node_modules'),'dir')
 return target
}
async function command(cwd,args,expected=0){
 const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}
 delete env.RER_LOCAL_OPERATION;delete env.RER_ONBOARDING_PROCESS_OWNER
 const child=spawn(process.execPath,[join(root,'node_modules/@runeditrun/rer/bin/rer.mjs'),...args],{cwd,env,stdio:['ignore','pipe','pipe']})
 let output='';for(const pipe of [child.stdout,child.stderr])pipe.on('data',chunk=>output+=chunk)
 const code=await new Promise((r,j)=>{child.once('error',j);child.once('close',r)})
 const safe=output.replace(/RER_OPEN[^\n]*/g,'RER_OPEN [private]').replace(/token=[^\s"&<>]+/g,'token=[private]')
 if(expected===0)assert.equal(code,0,safe.slice(-3000));else assert.notEqual(code,0,'Restore should refuse this destination or archive')
}
let running
try{
 const source=await copy('source'),destination=await copy('destination'),broken=await copy('damaged'), archive=join(parent,'buoy.rer')
 running=await startWorker({root:source,directory:join(source,'.wrangler/state'),keep:true})
 const call=async(path,method='GET',body)=>{const response=await running.request('/api/buoy'+path,{method,body,cookie:running.cookie});assert.ok(response.ok,await response.clone().text());return response.json()}
 const fixture=JSON.parse(await readFile(join(root,'fixtures/move-in/accounts-synthetic.json'),'utf8'))
 const door=importClient(running.request,running.cookie), plan=await door.plan(fixture)
 const job=await door.apply(plan)
 assert.equal(job.state,'completed')
 const accountId=fixture.accounts[0].id
 const proposal=await call('/proposals','POST',{accountId,kind:'renewal',payload:{outcome:'renewed',reason:'Annual renewal accepted',evidence:'Signed renewal R-17'}})
 await call(`/proposals/${proposal.id}/approve`,'POST',{})
 const token=await call('/agent-tokens','POST',{label:'Portable preparation assistant'})
 assert.equal((await running.request('/api/buoy/accounts/'+accountId,{method:'PUT',body:{},token:token.token})).status,403)
 assert.equal((await running.request('/api/buoy/commands',{method:'POST',body:{command:'renewals.list'},token:token.token})).status,200)
 const erased={...fixture.accounts[0],id:'erase-before-backup',name:'Retired account'}
 await call('/accounts','POST',erased)
 await call('/accounts/erase-before-backup','DELETE',{confirmation:'Retired account'})
 assert.equal((await running.request('/auth/invite',{method:'POST',cookie:running.cookie,body:{email:'analyst@example.test',displayName:'Ana Lyst',role:'member'}})).status,202)
 const analyst=(await (await running.request('/auth/operators',{cookie:running.cookie})).json()).find(p=>p.email==='analyst@example.test')
 assert.equal((await running.request('/auth/operator/role',{method:'POST',cookie:running.cookie,body:{operatorId:analyst.id,role:'admin'}})).status,200)
 // USAGE-001: source/queued observations are portable; ingestion authority is not.
 const usageSource=await call('/usage/sources','POST',{name:'Portable product source',kind:'native',reference:'Buyer license meter'})
 const usageCredential=await call('/usage/sources/'+usageSource.id+'/credentials','POST',{label:'Portable source key',scope:['event']})
 const usageIntake=()=>fetch(running.origin+'/api/buoy/usage/intake/'+usageSource.id,{method:'POST',headers:{authorization:'Bearer '+usageCredential.secret,'content-type':'application/json'},body:JSON.stringify({type:'event',messageId:'portable-usage',event:'License opened',userId:'product-user',groupId:'product-company'})})
 assert.equal((await usageIntake()).status,202)
 const usagePerson=await call('/customer-people','POST',{kind:'user',name:'Portable customer user',accountIds:[accountId],source:'Reviewed license directory'});
 await call('/customer-fields','POST',{key:'portable_seats',label:'Portable seats',type:'number'});
 let personState=await call('/customer-people');
 await call('/customer-people/'+usagePerson.id+'/fields','PUT',{revision:personState.records.find(p=>p.id===usagePerson.id).revision,values:{portable_seats:12},source:'Confirmed license schedule'});
 await call('/customer-fields','POST',{key:'portable_ratio',label:'Portable ratio',type:'formula',formula:'custom.portable_seats / 20'});
 const mapping={sourceId:usageSource.id,userId:'product-user',groupId:'product-company',accountId,personId:usagePerson.id};
 const review=await call('/usage/mappings/preview','POST',mapping);await call('/usage/mappings','POST',{...mapping,fingerprint:review.fingerprint});
 personState=await call('/customer-people');
 const usageEvents=await call('/usage/events')
 await call('/adoption/definitions','POST',{kind:'feature',key:'license',name:'License opened',events:['License opened']});
 await call('/adoption/seats','PUT',{accountId,seats:20,reference:'Customer-approved license schedule',observedAt:'2026-10-01',staleDays:30});
 const adoptionBefore=await call('/adoption');
 personState=await call('/customer-people'); // Include the intended account revision from the new seat observation.
 // CONNECT-001: provider credential ciphertext is excluded; source metadata survives.
 const connection=await call('/connections','POST',{name:'Portable Stripe source',key:['rk','test','portableFixtureOnly'].join('_')});
 const before=await call('/state'), beforeAudit=(await call('/audit')).entries
 for(const kind of ['auth.signed-in','auth.invited','auth.role-changed','account.created','account.erased','renewal.prepared','renewal.approved','agent.requested','agent.refused'])assert.ok(beforeAudit.some(entry=>entry.action===kind),`AUDIT-001 archive source records ${kind}`)
 assert.doesNotMatch(JSON.stringify(beforeAudit),/Retired account|erase-before-backup|example\.test|Ana Lyst|Harbour CS owner/,'AUDIT-001 erased account and people stay unnamed')
 const screen=await (await running.request('/app/audit',{cookie:running.cookie})).text()
 assert.equal((screen.match(/<article class="record">/g)??[]).length,beforeAudit.length,'AUDIT-001 screen lists the exported entries')
 for(const entry of beforeAudit){assert.ok(screen.includes(entry.action));assert.ok(screen.includes(entry.subject));assert.ok(screen.includes(entry.occurredAt))}
 await running.close();running=null
 // The first export's own record is taken with its snapshot; the next export carries it.
 await command(source,['export','--output',join(parent,'first.rer')])
 await command(source,['export','--output',archive])
 await command(destination,['import','--input',archive,'--yes'])
 await command(destination,['import','--input',archive,'--yes'],1)
 const bytes=await readFile(archive);bytes[Math.floor(bytes.length/2)]^=1
 const damaged=join(parent,'damaged.rer');await writeFile(damaged,bytes)
 await command(broken,['import','--input',damaged,'--yes'],1)
 running=await startWorker({root:destination,directory:join(destination,'.wrangler/state'),keep:true})
 const after=await call('/state')
 assert.deepEqual(await call('/adoption'),adoptionBefore,'ADOPT-001 definitions, seats, current identities, metrics and gaps survive the real installation archive');
 assert.deepEqual(await call('/customer-people'),personState,'USAGE-001 ACCOUNT-004 customer records, memberships, typed fields, calculations and source history restore exactly');
 assert.equal((await call('/usage')).mappings[0].personId,usagePerson.id,'USAGE-001 reviewed mapping survives restore without an intake credential');
 const restoredConnection=(await call('/connections')).connections.find(row=>row.id===connection.id)
 assert.equal(restoredConnection.name,'Portable Stripe source')
 assert.equal(restoredConnection.freshness,'Reconnect required','CONNECT-001 restores retain metadata without credential authority')
 assert.equal((await running.request('/api/buoy/connections/'+connection.id+'/sync',{cookie:running.cookie,method:'POST',body:{}})).status,409)
 const restored=(await call('/audit')).entries, added=restored.filter(entry=>!beforeAudit.some(prior=>prior.id===entry.id))
 assert.deepEqual(restored.filter(entry=>!added.includes(entry)),beforeAudit,'AUDIT-001 archive preserves exactly the audit entries shown before export')
 assert.deepEqual(added.map(entry=>[entry.action,entry.actor.replace(/[0-9a-f-]{36}$/,'id'),entry.detail]),[['auth.signed-in','person:id','native session issued'],['data.exported','portability:direct','Installation archive snapshot taken; delivery of the file is not recorded.']],'AUDIT-001 the export is recorded, and the destination records its own bootstrap sign-in')
 assert.match(added[1].subject,/^archive:[0-9a-f-]+$/)
 assert.match(await (await running.request('/app/audit?action=data.exported',{cookie:running.cookie})).text(),/portability:direct/)
 assert.deepEqual(after.accounts,before.accounts)
 assert.deepEqual(after.proposals,before.proposals)
 assert.deepEqual(after.decisions,before.decisions)
 assert.equal((await running.request('/api/buoy/commands',{method:'POST',body:{command:'renewals.list'},token:token.token})).status,401,'agent secrets are not restored')
 assert.equal((await usageIntake()).status,401,'USAGE-001 archived ingestion credentials cannot authorize restored intake')
 assert.deepEqual(await call('/usage/events'),usageEvents,'USAGE-001 queued payload/provenance survives the real archive')
 const usageAfter=await call('/usage');assert.equal(usageAfter.sources[0].id,usageSource.id);assert.equal(usageAfter.sources[0].eventCount,1);assert.equal(usageAfter.credentials.length,0)
 assert.equal((await running.request('/api/buoy/accounts',{method:'POST',body:erased,cookie:running.cookie})).status,409,'restored erasure tombstone prevents recreation')
 const history=await (await running.request('/api/operator/import-history',{cookie:running.cookie})).json();assert.ok(history.history.some(item=>item.jobId===job.id))
 const followup=await call('/proposals','POST',{accountId,kind:'renewal',payload:{outcome:'deferred',reason:'Review next year',evidence:'Account review note CS-18'}})
 await call(`/proposals/${followup.id}/approve`,'POST',{})
 assert.equal((await call('/state')).decisions.length,before.decisions.length+1)
 console.log('AUDIT-001 archive journey passed: audit entries match the screen and restore exactly; HTTP data, approvals and import custody survive; credentials excluded; populated and damaged restores refused; fresh owner can continue.')
}finally{if(running)await running.close();await rm(parent,{recursive:true,force:true})}
