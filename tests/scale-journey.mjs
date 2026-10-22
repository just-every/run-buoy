// SCALE-001: actual persisted D1, emitted Worker, native HTTP and rer archive doors.
// Deliberately separate from push Verify. No smaller-volume success mode.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtemp,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {startWorker} from './worker.mjs'
import {importClient} from './import-door-client.mjs'
import {rer,query} from '../src/buoy/scale/commands.mjs'
import {volume,synthetic,accountInput,seedDirectory,seedEvents,inventory} from '../src/buoy/scale/fixture.mjs'
import {copyInstallation,databaseBytes,requireSpace,archiveCounts} from '../src/buoy/scale/archive.mjs'
import {measure,json,accountPages} from '../src/buoy/scale/measure.mjs'

const root=resolve('.'),sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
if(process.env.SCALE_SHA)assert.equal(sha,process.env.SCALE_SHA,'Scale journey runs the exact requested commit')
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8'}).trim(),'','Commit all tracked changes before the scale journey')
console.log(JSON.stringify({scale:'start',sha,required:volume}))
const parent=await mkdtemp(join(tmpdir(),'buoy-scale-')),on=new Date().toISOString().slice(0,10)
let worker
try {
 await requireSpace(parent,5_000_000_000)
 const source=await copyInstallation(root,parent,'source'),destination=await copyInstallation(root,parent,'destination')
 worker=await startWorker({root:source,directory:join(source,'.wrangler/state'),keep:true,testScheduled:true})
 const call=(path,method='GET',body)=>worker.request('/api/buoy'+path,{method,body,cookie:worker.cookie})
 const door=importClient(worker.request,worker.cookie),plan=await door.plan({accounts:[accountInput(0,on)]})
 assert.equal(plan.summary.sourceRecords,1);assert.equal(plan.rejected.length,0)
 assert.equal((await door.apply(plan)).state,'completed')
 const reconciliation=await door.json('reconcile',{planId:plan.planId})
 assert.equal(reconciliation.ok,true);assert.equal(reconciliation.counts.sourceRecords,1)
 assert.equal(reconciliation.counts.present,1);assert.equal(reconciliation.counts.nativeTargets,1)
 assert.deepEqual(reconciliation.sourceIds.map(row=>({sourceId:row.sourceId,status:row.status})),[{sourceId:synthetic(0),status:'present'}])
 const baseline=await json(await call('/state')),owner=baseline.operator.id,baselineAccountId=baseline.accounts.find(row=>row.name===synthetic(0))?.id
 assert.ok(baselineAccountId,'Native import created the reconciled baseline account')
 const usage=await json(await call('/usage/sources','POST',{name:synthetic(90_000_006),kind:'native',reference:synthetic(90_000_005),staleDays:30}),201)
 const credential=await json(await call('/usage/sources/'+usage.id+'/credentials','POST',{label:synthetic(90_000_007),scope:['event']}),201)
 // Publish through the real door before loading; the hourly Cron must refresh
 // this existing configuration for every actual account, not an empty no-op.
 const current=await json(await call('/scorecards'))
 await json(await call('/scorecards/publish','POST',{revision:current.revision,config:{name:synthetic(90_000_008),measures:[{key:'billing',name:synthetic(90_000_009),field:'billing.allocatedMinor',min:0,max:10000,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]}}),201)
 await measure('load account/user directory',null,()=>seedDirectory(source,on,usage.id,owner,baselineAccountId))
 const baseBytes=await databaseBytes(source),pilot=100_000
 await measure('load 100000 real usage rows for storage projection',null,()=>seedEvents(source,usage.id,on,0,pilot))
 const pilotBytes=await databaseBytes(source),bytesPerEvent=(pilotBytes-baseBytes)/pilot,projectedBytes=baseBytes+Math.ceil(bytesPerEvent*volume.events)
 console.log(JSON.stringify({scale:'storage-projection',baseBytes,pilotBytes,bytesPerEvent,projectedBytes,d1LimitBytes:10_000_000_000}))
 assert.ok(Number.isFinite(bytesPerEvent)&&bytesPerEvent>0,'The pilot must produce measurable positive persisted event growth before projecting capacity')
 // This source has one DB binding. Local SQLite may accept a database that the
 // installed D1 service cannot: reject it explicitly rather than claiming scale.
 assert.ok(projectedBytes<=10_000_000_000,`SCALE-001 projected single-D1 footprint ${Math.ceil(projectedBytes/1e9)} GB exceeds its 10 GB limit. Full 50-million-row load was not attempted; this is a failed scale journey.`)
 await requireSpace(parent,projectedBytes*5)
 await measure('load remaining monthly usage rows',null,()=>seedEvents(source,usage.id,on,pilot,volume.events))
 const loaded=await inventory(source)
 assert.deepEqual({accounts:loaded.accounts,people:loaded.people,events:loaded.events},volume)
 assert.equal(loaded.memberships,volume.people);assert.equal(loaded.mappings,volume.people)
 assert.ok(await databaseBytes(source)<=10_000_000_000,'Actual persisted database fits the installed D1 limit')
 await accountPages(worker,[baselineAccountId,synthetic(4999),synthetic(9999)])
 // Wrangler's public Cron middleware supplies real Date.now(), not a custom
 // time query parameter. Age the stored fixture to make an actual hour due.
 const stale=new Date(Date.now()-3_600_001).toISOString()
 await query(source,`UPDATE buoy_scorecard_results SET calculated_at='${stale}',document=json_set(document,'$.calculatedAt','${stale}')`)
 const scheduledAt=Date.now()
 await measure('hourly native Cron health recalculation',3_600_000,async()=>{
  const response=await worker.scheduled('0 * * * *')
  assert.equal(response.status,200);await response.text()
 })
 const health=await query(source,"SELECT count(*) AS accounts,min(calculated_at) AS oldest FROM buoy_scorecard_results")
 assert.equal(health[0].accounts,volume.accounts)
 assert.ok(Date.parse(health[0].oldest)>=scheduledAt,'Hourly trigger refreshed every due account at the real scheduled time')
 await measure('portfolio adoption report',10_000,async()=>{
  const report=await json(await call('/adoption?on='+on))
  assert.equal(report.accounts.length,volume.accounts);assert.equal(report.people.length,volume.people)
  assert.equal(report.sources.length,1);assert.equal(report.sources[0].id,usage.id)
  assert.equal(report.sources[0].kind,'native');assert.equal(report.sources[0].eventCount,volume.events)
  assert.equal(report.sources[0].attributedEventCount,volume.events)
  assert.equal(report.summary.metrics.current.eventCount,volume.events)
  assert.equal(report.summary.metrics.current.mau,volume.people)
 })
 // Native report includes shell/data loading, not just the JSON calculation.
 await measure('native adoption report',10_000,async()=>{
  const response=await worker.request('/app/adoption?on='+on,{cookie:worker.cookie})
  assert.equal(response.status,200);assert.ok((await response.text()).includes(synthetic(9999)))
 })
 // Real new intake at the loaded monthly volume, then replay without truncation.
 const batch=Array.from({length:500},(_,i)=>({messageId:synthetic(60_000_000+i),type:'event',event:synthetic(90_000_004),userId:synthetic(1_000_000+i),groupId:synthetic(i%volume.accounts),timestamp:new Date().toISOString(),properties:{value:i%100}}))
 const intake=()=>fetch(worker.origin+'/api/buoy/usage/intake/'+usage.id,{method:'POST',headers:{authorization:'Bearer '+credential.secret,'content-type':'application/json'},body:JSON.stringify({batch})})
 const accepted=await measure('500-event public intake at volume',null,async()=>json(await intake(),202))
 assert.equal(accepted.accepted,500);assert.equal(accepted.stored,500)
 assert.equal((await json(await intake(),202)).duplicates,500)
 await worker.close();worker=null
 const before=await inventory(source),archive=join(parent,'scale.rer')
 await measure('rer archive export',null,()=>rer(source,['export','--output',archive]))
 const rows=await archiveCounts(archive)
 assert.equal(rows.buoy_accounts,volume.accounts);assert.equal(rows.buoy_customer_people,volume.people)
 assert.equal(rows.buoy_customer_memberships,volume.people);assert.equal(rows.buoy_usage_events,volume.events+500)
 assert.equal(rows.buoy_usage_mappings,volume.people)
 console.log(JSON.stringify({scale:'archive',bytes:(await stat(archive)).size,accounts:rows.buoy_accounts,people:rows.buoy_customer_people,events:rows.buoy_usage_events}))
 await measure('rer archive restore',null,()=>rer(destination,['import','--input',archive,'--yes']))
 assert.deepEqual(await inventory(destination),before,'Every retained usage row/count/payload byte/identity aggregate restores')
 worker=await startWorker({root:destination,directory:join(destination,'.wrangler/state'),keep:true,testScheduled:true})
 await accountPages(worker,[baselineAccountId,synthetic(9999)])
 const restored=await json(await worker.request('/api/buoy/usage/events?messageId='+synthetic(60_000_499),{cookie:worker.cookie}))
 assert.equal(restored.events.length,1);assert.equal(restored.nextCursor,null)
 assert.equal(restored.events[0].sourceId,usage.id);assert.equal(restored.events[0].sourceSystem,'native')
 assert.equal(restored.events[0].type,'event');assert.equal(restored.events[0].status,'attributed')
 assert.equal(restored.events[0].accountId,synthetic(499));assert.equal(restored.events[0].personId,synthetic(1_000_499))
 assert.deepEqual(restored.events[0].payload,batch[499])
 console.log(JSON.stringify({scale:'passed',sha,accounts:volume.accounts,people:volume.people,events:volume.events+500}))
} finally {
 if(worker)await worker.close()
 await rm(parent,{recursive:true,force:true})
}
