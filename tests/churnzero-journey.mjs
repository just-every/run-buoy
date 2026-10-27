import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

export async function churnzeroJourney({app,scratch,client,state,target}){
 const before=await state(app),door=client(app,'churnzero'),output=join(scratch,'churnzero.json')
 const columns={id:'Account External Id',name:'Account Name',renewalDate:'Next Renewal Date',noticeDays:'Contract Notice Days',renewalEvidence:'Contract Reference'}
 execFileSync(process.execPath,['src/buoy/migrate/cli.mjs','--source','churnzero','--input','fixtures/move-in/churnzero/selected-columns.csv','--output',output,'--columns',JSON.stringify(columns)])
 const input=JSON.parse(await readFile(output,'utf8')),original=await readFile('fixtures/move-in/churnzero/selected-columns.csv')
 assert.equal(input.csv,original.toString('utf8'));assert.equal(input.originalSha256,createHash('sha256').update(original).digest('hex'))
 const plan=await door.plan(input);assert.equal(plan.counts.mapped,20);assert.equal(plan.counts.rejected,0)
 assert.deepEqual(plan.diagnostics.map(d=>d.field),Array.from({length:20},()=>['ChurnScore','Health Factor']).flat())
 assert.deepEqual(await state(app),before)
 assert.equal((await door.send('apply',{planId:plan.planId,reviewedFingerprint:'0'.repeat(64)})).status,403)
 assert.equal((await client(app,'totango').send('status',{planId:plan.planId})).status,404)
 const job=await door.apply(plan);assert.equal((await door.apply(plan)).id,job.id)
 const native=await state(app);assert.equal(native.length,before.length+20)
 for(let n=1;n<=20;n++){
  const account=native.find(row=>row.id===target('churnzero','synthetic-buoy-'+n));assert.ok(account)
  assert.equal(account.name,'Synthetic ChurnZero '+n);assert.equal(account.renewalDate,'2027-03-31');assert.equal(account.noticeDays,n);assert.equal(account.renewalEvidence,'synthetic-buoy-'+n)
  assert.equal(account.billing,null);assert.equal(account.support,null);assert.equal(account.health.status,'unknown','An exported score cannot become native health without its configuration')
 }
 assert.equal((await door.json('reconcile',{planId:plan.planId})).ok,true)
 const history=(await (await app.request('/api/operator/import-history',{cookie:app.cookie})).json()).history
 assert.equal(history.find(row=>row.planId===plan.planId).namespace,'buoy-migrate-churnzero-v1')
 await door.undo(plan);assert.deepEqual(await state(app),before)
 const editedPlan=await door.plan(input);await door.apply(editedPlan)
 const current=(await state(app)).find(row=>row.id===target('churnzero','synthetic-buoy-1'))
 assert.equal((await app.request('/api/buoy/accounts/'+current.id,{method:'PUT',cookie:app.cookie,body:{id:current.id,name:'Synthetic edited account',renewalDate:current.renewalDate,noticeDays:current.noticeDays,renewalEvidence:current.renewalEvidence,billing:null,support:null,revision:current.revision}})).status,200)
 assert.equal((await door.send('undo',{planId:editedPlan.planId})).status,409,'ChurnZero undo protects later native edits')
 assert.equal((await app.request('/api/buoy/accounts/'+current.id,{method:'DELETE',cookie:app.cookie,body:{confirmation:'Synthetic edited account'}})).status,200)
 assert.equal((await door.send('reconcile',{planId:editedPlan.planId})).status,410)
 const damaged=await door.plan({...input,originalSha256:'0'.repeat(64)});assert.equal(damaged.counts.mapped,0);assert.match(damaged.rejected[0].reason,/digest/);await door.json('undo',{planId:damaged.planId})
}
