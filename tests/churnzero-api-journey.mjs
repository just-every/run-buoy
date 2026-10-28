import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync,spawnSync} from 'node:child_process'
import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'

export async function churnzeroApiJourney({app,scratch,door,state,target}){
 const before=await state(app),egress=app.outbound.length
 const custom=name=>['Cf',name].join('/')
 const query={tenant:'https://synthetic-buoy.us1app.churnzero.net',select:['Id','ExternalId','Name','NextRenewalDate','PrimaryChurnScoreValue',...['NoticeDays','ContractReference','UsageFactor','EngagementFactor'].map(custom)],filter:'IsActive eq true',pageSize:10}
 const accounts=Array.from({length:20},(_,i)=>({Id:15100+i,ExternalId:'synthetic-buoy-api-'+(i+1),Name:'Synthetic API customer '+(i+1),NextRenewalDate:'2027-03-31T00:00:00Z',PrimaryChurnScoreValue:i*4,Cf:{NoticeDays:i+1,ContractReference:'synthetic-buoy-contract-'+i,UsageFactor:i,EngagementFactor:20-i}}))
 const columns={id:'ExternalId',name:'Name',renewalDate:'NextRenewalDate',noticeDays:custom('NoticeDays'),renewalEvidence:custom('ContractReference'),churnScore:'PrimaryChurnScoreValue',churnScoreFactors:{usage:custom('UsageFactor'),engagement:custom('EngagementFactor')}}
 const queryFile=join(scratch,'churnzero-query.json'),edgeFile=join(scratch,'churnzero-edge.json'),output=join(scratch,'churnzero-api.json')
 const fixture={query,accounts}
 await writeFile(queryFile,JSON.stringify(query));await writeFile(edgeFile,JSON.stringify(fixture))
 const args=['--import','./tests/churnzero-api-edge.mjs','src/buoy/migrate/cli.mjs','--source','churnzero','--api-query',queryFile,'--columns',JSON.stringify(columns),'--output',output]
 const env={...process.env,BUOY_CHURNZERO_USERNAME:'synthetic-buoy-credentials',BUOY_CHURNZERO_API_KEY:'synthetic-buoy-8501',BUOY_CHURNZERO_EDGE_FILE:edgeFile}
 const message=execFileSync(process.execPath,args,{env,encoding:'utf8'})
 assert.doesNotMatch(message,/synthetic-buoy-8501|synthetic-buoy-credentials/)
 const input=JSON.parse(await readFile(output,'utf8'))
 assert.equal(input.api.pages.length,2);assert.deepEqual(input.api.query,query)
 assert.ok(!JSON.stringify(input).includes(env.BUOY_CHURNZERO_API_KEY));assert.ok(!JSON.stringify(input).includes(env.BUOY_CHURNZERO_USERNAME))
 for(const [i,page]of input.api.pages.entries()){
  const source=JSON.parse(page.text)
  assert.deepEqual(source.value,accounts.slice(i*10,i*10+10))
  assert.equal(page.sha256,createHash('sha256').update(page.text).digest('hex'))
 }
 const plan=await door.plan(input)
 assert.equal(plan.counts.mapped,20);assert.equal(plan.counts.rejected,0)
 assert.deepEqual(await state(app),before,'Acquisition and planning create no native records')
 assert.equal((await door.send('apply',{planId:plan.planId,reviewedFingerprint:'0'.repeat(64)})).status,403)
 const job=await door.apply(plan);assert.equal((await door.apply(plan)).id,job.id)
 const imported=await state(app)
 for(let i=0;i<20;i++){
  const row=imported.find(row=>row.id===target('churnzero','synthetic-buoy-api-'+(i+1)));assert.ok(row)
  assert.equal(row.name,'Synthetic API customer '+(i+1));assert.equal(row.renewalDate,'2027-03-31');assert.equal(row.noticeDays,i+1)
  assert.equal(row.renewalEvidence,'synthetic-buoy-contract-'+i)
  assert.equal(row.migrationHealth.score,i*4);assert.deepEqual(row.migrationHealth.factors,{usage:i,engagement:20-i})
 }
 assert.equal((await door.json('reconcile',{planId:plan.planId})).ok,true)
 assert.equal(app.outbound.length,egress,'Reviewed API data grants no sending or provider authority')
 await door.undo(plan);assert.deepEqual(await state(app),before)
 for(const mode of ['denied','redirect','short','changed','reflected','duplicate']){
  await writeFile(edgeFile,JSON.stringify({...fixture,mode}))
  const destination=join(scratch,'churnzero-'+mode+'.json')
  const refused=spawnSync(process.execPath,args.map(value=>value===output?destination:value),{env,encoding:'utf8'})
  assert.notEqual(refused.status,0,mode+' must refuse the incomplete or unsafe snapshot')
  assert.doesNotMatch(refused.stdout+refused.stderr,/synthetic-buoy-8501|synthetic-buoy-credentials/)
  await assert.rejects(readFile(destination),{code:'ENOENT'})
 }
 await writeFile(queryFile,JSON.stringify({...query,filter:"ExternalId eq 'synthetic-buoy-8501'"}))
 const privateQueryOutput=join(scratch,'churnzero-private-query.json')
 const privateQuery=spawnSync(process.execPath,args.map(value=>value===output?privateQueryOutput:value),{env,encoding:'utf8'})
 assert.notEqual(privateQuery.status,0)
 assert.doesNotMatch(privateQuery.stdout+privateQuery.stderr,/synthetic-buoy-8501|synthetic-buoy-credentials/)
 await assert.rejects(readFile(privateQueryOutput),{code:'ENOENT'})
 for(const alter of [api=>{api.pages[0].text+=' '},api=>{api.pages.pop()},api=>{api.pages[1].offset=0}]){
  const changed=structuredClone(input);alter(changed.api)
  const refused=await door.plan(changed);assert.equal(refused.counts.mapped,0);assert.equal(refused.counts.rejected,1)
  await door.json('undo',{planId:refused.planId})
 }
 const mixed=await door.plan({...input,csv:'second representation'})
 assert.equal(mixed.counts.mapped,0);assert.match(mixed.rejected[0].reason,/second export representation/)
 await door.json('undo',{planId:mixed.planId})
 assert.deepEqual(await state(app),before)
}
