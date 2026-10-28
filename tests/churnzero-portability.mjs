import assert from 'node:assert/strict'
import {cp,mkdtemp,rm,symlink,readFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {startWorker} from './worker.mjs'
import {importClient} from './import-door-client.mjs'
import {structureBundle,structureDefinition,expectedStructure} from './churnzero-journey-fixture.mjs'

// Called by the archive Verify journey. A separate installation keeps unrelated
// native field edits from intentionally invalidating the reviewed import revision.
export async function churnzeroPortability(){
 const root=resolve('.'),parent=await mkdtemp(join(tmpdir(),'buoy-churnzero-archive-'))
 const excluded=new Set(['node_modules','.git','.wrangler','.rer','.seed','.cache','.tanstack','exports','test-results'])
 const copy=async name=>{const directory=join(parent,name);await cp(root,directory,{recursive:true,filter:path=>{const relative=path.slice(root.length+1);return !excluded.has(relative.split('/')[0])&&!relative.startsWith('.env')&&!relative.startsWith('.dev.vars')}});await symlink(join(root,'node_modules'),join(directory,'node_modules'),'dir');return directory}
 const command=async(cwd,args)=>{
  const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'};delete env.RER_LOCAL_OPERATION;delete env.RER_ONBOARDING_PROCESS_OWNER
  const child=spawn(process.execPath,[join(root,'node_modules/@runeditrun/rer/bin/rer.mjs'),...args],{cwd,env,stdio:['ignore','pipe','pipe']})
  let output='';for(const pipe of [child.stdout,child.stderr])pipe.on('data',chunk=>output+=chunk)
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)})
  assert.equal(code,0,output.replace(/RER_OPEN[^\n]*/g,'RER_OPEN [private]').replace(/token=[^\s"&<>]+/g,'token=[private]').slice(-3000))
 }
 let app
 try{
  console.log('MIGRATE-002 archive: prepare source')
  const source=await copy('source'),destination=await copy('destination'),archive=join(parent,'migration.rer')
  app=await startWorker({root:source,secure:true,persistenceDirectory:join(source,'.wrangler/state'),keepPersistence:true})
  const door=()=>importClient((path,options)=>app.request(path,{...options,headers:{...options.headers,'x-buoy-import-source':'churnzero'}}),app.cookie)
  const state=async()=>{const response=await app.request('/api/buoy/state',{cookie:app.cookie});assert.equal(response.status,200);return response.json()}
  const books=async()=>{const response=await app.request('/api/buoy/playbooks',{cookie:app.cookie});assert.equal(response.status,200);return response.json()}
  const csv=(await readFile('fixtures/move-in/churnzero/accounts.csv','utf8')).split('\r\n').slice(0,2).join('\r\n')+'\r\n'
  const input=structureBundle({format:'buoy-migration-v1',source:'churnzero',dateOrder:'iso',columns:{id:'Account External ID',name:'Account Name',renewalDate:'Renewal Date',noticeDays:'Notice Days',renewalEvidence:'Contract Reference'},csv})
  console.log('MIGRATE-002 archive: review and apply')
  const plan=await door().plan(input),job=await door().apply(plan),accountId='migration_'+createHash('sha256').update(JSON.stringify(['churnzero','synthetic-buoy-1'])).digest('hex').slice(0,40)
  const before=(await state()).accounts.find(row=>row.id===accountId).migrationJourneys
  assert.equal(before.length,1);assert.equal(before[0].state,'paused');assert.deepEqual(before[0].definition,structureDefinition);assert.deepEqual(before[0].structure,expectedStructure)
  assert.equal((await door().json('reconcile',{planId:plan.planId})).ok,true,'Source native draft reconciles before export')
  console.log('MIGRATE-002 archive: close source')
  await app.close();app=null
  console.log('MIGRATE-002 archive: export and restore')
  await command(source,['export','--output',archive]);await command(destination,['import','--input',archive,'--yes'])
  console.log('MIGRATE-002 archive: open restored installation')
  app=await startWorker({root:destination,secure:true,persistenceDirectory:join(destination,'.wrangler/state'),keepPersistence:true})
  assert.deepEqual((await state()).accounts.find(row=>row.id===accountId).migrationJourneys,before,'Real archive restores exact native paused drafts and every source element')
  console.log('MIGRATE-002 archive: reconcile restored journal')
  assert.equal((await door().json('reconcile',{planId:plan.planId})).ok,true,'Fresh owner reconciles the restored native draft and durable import journal')
  console.log('MIGRATE-002 archive: replay restored import')
  assert.equal((await door().apply(plan)).id,job.id,'Restored replay remains idempotent')
  assert.deepEqual((await state()).tasks,[]);assert.deepEqual((await books()).definitions,[]);assert.deepEqual((await books()).runs,[])
  const egress=app.outbound.length
  console.log('MIGRATE-002 archive: evaluate restored schedule')
  await app.scheduled('0 * * * *',Date.parse('2027-03-01T12:00:00Z'))
  assert.deepEqual((await state()).tasks,[],'Restored source task configuration creates no native task')
  assert.deepEqual((await books()).definitions,[]);assert.deepEqual((await books()).runs,[],'Restored source configuration grants no runnable enrollment')
  assert.equal(app.outbound.length,egress,'Restored source webhook configuration grants no outbound authority')
  assert.deepEqual((await state()).accounts.find(row=>row.id===accountId).migrationJourneys,before)
  console.log('MIGRATE-002 archive: undo restored import')
  await door().undo(plan);assert.deepEqual((await state()).accounts,[],'Fresh owner can strictly undo the unchanged restored draft import')
  console.log('MIGRATE-002 real archive: exact paused drafts, journal, replay, reconciliation, inert scheduled evaluation and strict undo PASS')
 }finally{if(app)await app.close();await rm(parent,{recursive:true,force:true})}
}
