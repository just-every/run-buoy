import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync,spawnSync} from 'node:child_process'
import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {structureDefinition,structureMapping,expectedStructure} from './churnzero-journey-fixture.mjs'

export async function churnzeroExportJourney({app,scratch,door,state,target}){
 const before=await state(app),people=await (await app.request('/api/buoy/customer-people',{cookie:app.cookie})).json()
 const egress=app.outbound.length,columns={id:'ExternalId',name:'Name',renewalDate:'Renewal',noticeDays:'Notice',renewalEvidence:'Contract',churnScore:'Score',churnScoreFactors:'Factors',journeyDefinitions:{...structureMapping,column:'Definitions'}}
 const accounts=Array.from({length:20},(_,i)=>({ExternalId:'synthetic-buoy-export-'+i,Name:'Synthetic export '+i,Renewal:'2027-03-31T22:30:00-04:00',Notice:i,Contract:'synthetic-buoy-contract-'+i,Score:i*4,Factors:{usage:i,engagement:20-i},Definitions:[structureDefinition]}))
 const collections={contacts:[{Id:501,FirstName:'Synthetic',LastName:'contact',AccountId:1}],churnScores:[{Id:601,Name:'Synthetic scorecard',GradingBottom:25,GradingTop:75}],churnScoreFactors:[{Id:602,ChurnScoreId:601,Name:'Synthetic factor'}],tasks:[{Id:701,Subject:'Synthetic follow-up'}],plays:[{Id:801,Name:'Synthetic play',Enabled:true}],successPlans:[{Id:901,Name:'Synthetic plan'}],events:[{Id:1001,EventName:'Synthetic event'}],nps:[{Id:1101,Score:9}]}
 const source='\uFEFF'+JSON.stringify({accounts,...collections},null,2).replaceAll('\n','\r\n')+'\r\n'
 const original=join(scratch,'churnzero-export.json'),output=join(scratch,'churnzero-export-bundle.json')
 await writeFile(original,source)
 const args=['src/buoy/migrate/cli.mjs','--source','churnzero','--source-format','json','--input',original,'--output',output,'--columns',JSON.stringify(columns)]
 execFileSync(process.execPath,args)
 const input=JSON.parse(await readFile(output,'utf8'))
 assert.equal(input.exportText,source);assert.equal(input.originalSha256,createHash('sha256').update(source).digest('hex'))
 const plan=await door.plan(input)
 assert.equal(plan.counts.mapped,20);assert.equal(plan.counts.rejected,0)
 for(const [name,records]of Object.entries(collections)){
  const diagnostic=plan.diagnostics.find(row=>row.field===name);assert.ok(diagnostic,name+' remains visible in review')
  assert.ok(diagnostic.message.includes(records.length+' source records:'))
 }
 assert.deepEqual(await state(app),before)
 const job=await door.apply(plan);assert.equal((await door.apply(plan)).id,job.id)
 const imported=await state(app)
 for(let i=0;i<20;i++){
  const row=imported.find(row=>row.id===target('churnzero','synthetic-buoy-export-'+i));assert.ok(row)
  assert.equal(row.name,'Synthetic export '+i);assert.equal(row.renewalDate,'2027-03-31');assert.equal(row.noticeDays,i);assert.equal(row.renewalEvidence,'synthetic-buoy-contract-'+i)
  assert.equal(row.migrationHealth.score,i*4);assert.deepEqual(row.migrationHealth.factors,{usage:i,engagement:20-i})
  assert.equal(row.migrationJourneys[0].state,'paused');assert.deepEqual(row.migrationJourneys[0].structure,expectedStructure)
 }
 const afterPeople=await (await app.request('/api/buoy/customer-people',{cookie:app.cookie})).json()
 assert.deepEqual(afterPeople.records,people.records,'Explicitly unmapped collections never masquerade as native contacts')
 assert.deepEqual(afterPeople.history,people.history)
 assert.ok(afterPeople.accounts.filter(row=>!before.some(account=>account.id===row.id)).every(row=>row.records.length===0))
 const work=await (await app.request('/api/buoy/state',{cookie:app.cookie})).json()
 assert.deepEqual(work.tasks,[]);assert.deepEqual(work.proposals,[]);assert.equal(app.outbound.length,egress)
 assert.equal((await door.json('reconcile',{planId:plan.planId})).ok,true)
 await door.undo(plan);assert.deepEqual(await state(app),before)
 const duplicate=source.replace('"Name": "Synthetic export 0"','"Name": "Synthetic export 0", "Name": "Discarded value"')
 assert.notEqual(duplicate,source);await writeFile(original,duplicate)
 const invalidOutput=join(scratch,'churnzero-duplicate.json')
 const refused=spawnSync(process.execPath,args.map(value=>value===output?invalidOutput:value),{encoding:'utf8'})
 assert.notEqual(refused.status,0);await assert.rejects(readFile(invalidOutput),{code:'ENOENT'})
 const damaged=await door.plan({...input,originalSha256:'0'.repeat(64)})
 assert.equal(damaged.counts.mapped,0);assert.equal(damaged.counts.rejected,1)
 await door.json('undo',{planId:damaged.planId})
}
