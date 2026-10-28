import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {importClient} from './import-door-client.mjs'
import {structureBundle,structureDefinition,expectedStructure} from './churnzero-journey-fixture.mjs'

const door=app=>importClient((path,options)=>app.request(path,{...options,headers:{...options.headers,'x-buoy-import-source':'churnzero'}}),app.cookie)
const state=async app=>{const response=await app.request('/api/buoy/state',{cookie:app.cookie});assert.equal(response.status,200);return response.json()}
const books=async app=>{const response=await app.request('/api/buoy/playbooks',{cookie:app.cookie});assert.equal(response.status,200);return response.json()}

// Shares the clean migration archive with Totango; both sources keep their own
// original artifact, approval, job, native reconciliation and strict undo.
export async function seedChurnzeroArchive(app){
 const csv=(await readFile('fixtures/move-in/churnzero/accounts.csv','utf8')).split('\r\n').slice(0,2).join('\r\n')+'\r\n'
 const bundle=structureBundle({format:'buoy-migration-v1',source:'churnzero',dateOrder:'iso',columns:{id:'Account External ID',name:'Account Name',renewalDate:'Renewal Date',noticeDays:'Notice Days',renewalEvidence:'Contract Reference'},csv})
 const plan=await door(app).plan(bundle),job=await door(app).apply(plan),accountId='migration_'+createHash('sha256').update(JSON.stringify(['churnzero','synthetic-buoy-1'])).digest('hex').slice(0,40)
 const before=(await state(app)).accounts.find(row=>row.id===accountId).migrationJourneys
 assert.equal(before.length,1);assert.equal(before[0].state,'paused');assert.deepEqual(before[0].definition,structureDefinition);assert.deepEqual(before[0].structure,expectedStructure)
 assert.equal((await door(app).json('reconcile',{planId:plan.planId})).ok,true,'Source native draft reconciles before export')
 return {bundle,plan,job,accountId,before}
}

export async function assertChurnzeroRestored(app,{plan,job,accountId,before}){
 assert.deepEqual((await state(app)).accounts.find(row=>row.id===accountId).migrationJourneys,before,'Real archive restores exact native paused drafts and every source element')
 assert.equal((await door(app).json('reconcile',{planId:plan.planId})).ok,true,'Fresh owner reconciles the restored native draft and durable import journal')
 assert.equal((await door(app).apply(plan)).id,job.id,'Restored replay remains idempotent')
 assert.deepEqual((await state(app)).tasks,[]);assert.deepEqual((await books(app)).definitions,[]);assert.deepEqual((await books(app)).runs,[])
 const egress=app.outbound.length
 await app.scheduled('0 * * * *',Date.parse('2027-03-01T12:00:00Z'))
 assert.deepEqual((await state(app)).tasks,[],'Restored source task configuration creates no native task')
 assert.deepEqual((await books(app)).definitions,[]);assert.deepEqual((await books(app)).runs,[],'Restored source configuration grants no runnable enrollment')
 assert.equal(app.outbound.length,egress,'Restored source webhook configuration grants no outbound authority')
 assert.deepEqual((await state(app)).accounts.find(row=>row.id===accountId).migrationJourneys,before)
 await door(app).undo(plan);assert.deepEqual((await state(app)).accounts,[],'Fresh owner can strictly undo the unchanged restored draft import after the other migration is undone')
 console.log('MIGRATE-002 real archive: exact paused drafts, journal, replay, reconciliation, inert scheduled evaluation and strict undo PASS')
}
