import assert from 'node:assert/strict'

export async function importErasure({request,cookie,door,businessClient,value,authority}) {
 const account={...value('synthetic-buoy-9601'),name:'synthetic-buoy-9602',renewalEvidence:'synthetic-buoy-9603',billing:{observedAt:'2026-10-01',reference:'synthetic-buoy-9604',currency:'USD',totalMinor:10000,creditsMinor:0,allocatedMinor:0,dueDate:'2026-10-01'},support:{observedAt:'2026-10-01',reference:'synthetic-buoy-9605',openTickets:2,urgentTickets:1}}
 const input={accounts:[account]}, markers=[account.id,account.name,account.renewalEvidence,account.billing.reference,account.support.reference]
 const api=async(path,method='GET',body,status=200)=>{
  const response=await request('/api/buoy'+path,{method,body,cookie})
  assert.equal(response.status,status,await response.clone().text())
  return response.json()
 }
 const survivor={...value('synthetic-buoy-9606'),name:'synthetic-buoy-9607'}
 await api('/accounts','POST',survivor,201)
 const originalUpload=await door.upload(input), first=await door.planUpload(originalUpload), firstJob=await door.apply(first)
 const proposal=await api('/proposals','POST',{accountId:account.id,kind:'playbook',payload:{title:'synthetic-buoy-9609',dueDate:'2027-01-31'}},201)
 assert.equal((await door.send('undo',{planId:first.planId})).status,409,'Dependent work prevents undo of the native import')
 assert.ok((await api('/state')).proposals.some(row=>row.id===proposal.id),'Refused undo preserves dependent work')
 const unchanged=await door.plan(input,true)
 assert.equal(unchanged.differences.unchanged.length,1,'An unchanged catch-up retains the source without writing it again')
 const unchangedJob=await door.apply(unchanged)
 const pending=await door.plan({accounts:[{...account,renewalEvidence:'synthetic-buoy-9608'}]},true)
 const heldUpload=await businessClient.upload(input), archiveBody={uploadId:heldUpload,tool:'buoy',takenAt:new Date().toISOString()}
 const archive=await businessClient.json('archive',archiveBody)
 assert.equal((await businessClient.json('restore-check',{archiveId:archive.archiveId})).counts.mapped,1)
 await api('/accounts/'+account.id,'DELETE',{confirmation:account.name})
 const state=await api('/state')
 assert.ok(!state.accounts.some(row=>row.id===account.id))
 assert.ok(!state.proposals.some(row=>row.id===proposal.id))
 assert.equal(state.accounts.find(row=>row.id===survivor.id).name,survivor.name,'Erasure preserves unrelated native records')
 const reads=[state,await api('/imports'),await (await request('/api/operator/import-history',{cookie})).json()]
 for(const [plan,job] of [[first,firstJob],[unchanged,unchangedJob]]) {
  reads.push(await api('/imports/'+job.id),await door.json('status',{planId:plan.planId}))
  const withdrawn=await door.send('reconcile',{planId:plan.planId})
  assert.equal(withdrawn.status,410)
  assert.equal((await withdrawn.json()).error,'snapshot_withdrawn')
  const before=await authority.snapshot(plan,job)
  const replay=await door.send('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint})
  assert.equal(replay.status,plan===first?410:200,'Withdrawn older plans refuse replay; the completed head can return only its sanitized receipt')
  const result=await replay.json()
  if(plan===first)assert.equal(result.error,'snapshot_withdrawn')
  else {assert.equal(result.job.id,job.id);reads.push(result)}
  assert.deepEqual(await authority.snapshot(plan,job),before)
 }
 for(const read of reads)for(const marker of [...markers,'synthetic-buoy-9608','synthetic-buoy-9609'])assert.ok(!JSON.stringify(read).includes(marker),`Public retained custody omits erased marker ${marker}`)
 const journal=await api('/imports'), stores=journal.erasures.flatMap(row=>row.stores.map(store=>store.store))
 for(const store of ['ik_door_chunks','ik_door_plan_chunks','ik_door_archive_chunks'])assert.ok(stores.includes(store),`Erasure journal inventories ${store}`)
 const before=await authority.snapshot(first,firstJob)
 for(const client of [door,businessClient]) {
  for(const uploadId of [originalUpload,heldUpload])assert.equal((await client.send('plan',{uploadId})).status,404,'Erasure withdraws held original uploads')
  assert.equal((await client.send('apply',{planId:pending.planId,reviewedFingerprint:pending.fingerprint})).status,410,'A reviewed pending snapshot cannot replay erased native data')
  for(const catchup of [false,true]) {
   const uploadId=await client.upload(input), response=await client.send('plan',{uploadId,...(catchup?{catchup:true}:{})})
   assert.equal(response.status,409,await response.clone().text())
   assert.equal((await response.json()).error,'source_erased','Fresh and catch-up intake refuse the erased native identity')
   assert.equal((await client.send('uploads',{uploadId})).status,404,'Refused erased-source bytes are withdrawn')
  }
 }
 const withdrawn=await businessClient.send('restore-check',{archiveId:archive.archiveId})
 assert.equal(withdrawn.status,410);assert.equal((await withdrawn.json()).error,'archive_withdrawn')
 const fresh=await businessClient.upload(input), refusedArchive=await businessClient.send('archive',{...archiveBody,uploadId:fresh})
 assert.equal(refusedArchive.status,409);assert.equal((await refusedArchive.json()).error,'source_erased')
 assert.equal((await businessClient.send('uploads',{uploadId:fresh})).status,404)
 assert.equal((await request('/api/buoy/accounts',{method:'POST',cookie,body:account})).status,409,'Direct native creation cannot bypass the import tombstone')
 assert.deepEqual(await authority.snapshot(first,firstJob),before,'Every replay refusal preserves native state, retained jobs, journal, history and reconciliation')
}
