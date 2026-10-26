import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
import {seedReporting} from './reporting-journey.mjs'

export async function roleReportsJourney(){
 const app=await startWorker(),cookie=app.cookie
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie,method,body,...options})
 const json=async response=>{assert.ok(response.ok,await response.clone().text());return response.json()}
 const api=async(...args)=>json(await request(...args))
 const invite=async(n,role='member')=>{const email='synthetic-buoy-'+n+'@example.test';await json(await app.request('/auth/invite',{method:'POST',cookie,body:{email,displayName:'synthetic-buoy-'+n,role}}));const as=await app.signIn(email);return {id:(await api('/state','GET',undefined,{cookie:as})).operator.id,cookie:as}}
 const assign=async(person,roleId,extra={})=>api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId,...extra})
 const query='period=quarter&end=2026-06-30'
 const report=(person,extra='')=>api('/revenue/retention?'+query+extra,'GET',undefined,{cookie:person.cookie})
 const csv=async(person,extra='')=>{const response=await request('/revenue/retention.csv?'+query+extra,'GET',undefined,{cookie:person.cookie});assert.ok(response.ok,await response.clone().text());assert.match(response.headers.get('content-type'),/text\/csv/);return response.text()}
 const exportsFor=async person=>(await api('/audit?action=data.exported&actor='+person.id)).entries
 try{
  const {ids,segmentId}=await seedReporting(api)
  const csm=await invite(2610),reporter=await invite(2611),peer=await invite(2612),manager=await invite(2613),finance=await invite(2614),support=await invite(2615),native=await invite(2616),admin=await invite(2617,'admin')
  for(const [i,id]of ids.entries())await api('/accounts/'+id+'/owner','PUT',{ownerId:i<2?csm.id:i===2?reporter.id:peer.id})
  for(const person of [csm,reporter])await api('/people/'+person.id+'/manager','PUT',{managerId:manager.id})
  const outside='synthetic-buoy-2600',on=new Date().toISOString().slice(0,10)
  await api('/accounts','POST',{id:outside,name:'synthetic-buoy-2690 hidden invoice customer',renewalDate:'2027-12-31',noticeDays:30,renewalEvidence:'synthetic-buoy-2691',billing:{observedAt:on,reference:'synthetic-buoy-2692 hidden invoice source',currency:'USD',totalMinor:55667788,creditsMinor:0,allocatedMinor:0,dueDate:on},support:null})
  await api('/accounts/'+outside+'/owner','PUT',{ownerId:peer.id})
  const ownTier='synthetic-buoy-2630 permitted tier',hiddenTier='synthetic-buoy-2694 hidden tier'
  await api('/segments/tiers','PUT',{tiers:[...(await api('/segments')).tiers,ownTier,hiddenTier]})
  await api('/accounts/'+ids[0]+'/classification','PUT',{tier:ownTier,stage:null});await api('/accounts/'+outside+'/classification','PUT',{tier:hiddenTier,stage:null})
  await assign(csm,'csm',{sharedAccountIds:[ids[2],outside]});await assign(manager,'cs-manager');await assign(finance,'finance');await assign(support,'support')
  const own=await report(csm)
  assert.deepEqual(own.rows.map(row=>row.accountId),ids.slice(0,2));assert.deepEqual(own.exceptions,[])
  assert.deepEqual(own.filterOptions.owners.map(row=>row.id),[csm.id]);assert.equal(own.filterOptions.owners[0].name,'synthetic-buoy-2610')
  assert.ok(own.filterOptions.segments.some(row=>row.id===segmentId));assert.deepEqual(own.filterOptions.plans,['Reporting workspace']);assert.deepEqual(own.filterOptions.cohorts,['2025-01']);assert.deepEqual(own.filterOptions.tiers,[ownTier])
  assert.doesNotMatch(JSON.stringify(own.filterOptions),/synthetic-buoy-(261[12]|2690|2694)/,'Filter choices expose only permitted owners, segment memberships and tiers')
  // Independent arithmetic from the supplied annual terms and boundary rates:
  // USD 10000 + EUR 10000*1.10; ending EUR expands to 15000 at 1.10.
  assert.equal(own.usd.startMinor,21000);assert.equal(own.usd.endCohortMinor,26500);assert.equal(own.usd.expansionMinor,5500);assert.equal(own.usd.endPortfolioMinor,28000);assert.deepEqual(own.usd.nrr,{numeratorMinor:26500,denominatorMinor:21000})
  assert.doesNotMatch(JSON.stringify(own),/Reporting customer [2-5]|synthetic-buoy-end-[2-5]|synthetic-buoy-269[012]|55667788/,'Hidden accounts affect neither detail nor missing-source exceptions')
  const before=await exportsFor(csm),ownCsv=await csv(csm)
  assert.match(ownCsv,/Reporting customer 0/);assert.match(ownCsv,/Reporting customer 1/);assert.doesNotMatch(ownCsv,/Reporting customer [2-5]|synthetic-buoy-269[02]|55667788/)
  const after=await exportsFor(csm);assert.equal(after.length,before.length+1);assert.equal(after[0].actor,'person:'+csm.id);assert.match(after[0].subject,/^report:/);assert.doesNotMatch(JSON.stringify(after),/Reporting customer|synthetic-buoy-2690|55667788|example.test/,'One successful CSV records one opaque export receipt')
  const blank='&segmentId=&ownerId=&tier=&plan=&cohort=',blankReport=await report(csm,blank)
  for(const key of ['count','rows','exceptions','usd','native'])assert.deepEqual(blankReport[key],own[key],'Unselected form controls omit the optional filter')
  assert.equal(await csv(csm,blank),ownCsv,'Blank optional controls export the same permitted report')
  assert.equal((await exportsFor(csm)).length,before.length+2,'The normalized CSV still records exactly one success receipt')
  assert.equal((await request('/revenue/retention?'+query+'&ownerId=&ownerId=','GET',undefined,{cookie:csm.cookie})).status,400,'Normalization cannot hide a repeated filter')
  const team=await report(manager)
  assert.deepEqual(team.rows.map(row=>row.accountId),ids.slice(0,3));assert.equal(team.usd.startMinor,34000);assert.equal(team.usd.endCohortMinor,36900);assert.doesNotMatch(JSON.stringify(team),/Reporting customer [3-5]|synthetic-buoy-2690|55667788/)
  const all=await report(finance);assert.equal(all.count,6);assert.equal(all.usd.startMinor,41500);assert.equal(all.usd.endCohortMinor,36900);assert.ok(all.exceptions.some(row=>row.accountId===outside))
  const nativeRead=await report(native);assert.equal(nativeRead.count,all.count,'Existing native member GET authority is unchanged')
  for(const person of [finance,admin,{id:(await api('/state')).operator.id,cookie}]){const count=(await exportsFor(person)).length;await csv(person);assert.equal((await exportsFor(person)).length,count+1,'Each authorized CSV has one export audit')}
  for(const person of [support,native]){
   const count=(await exportsFor(person)).length
   assert.equal((await request('/revenue/retention.csv?'+query,'GET',undefined,{cookie:person.cookie})).status,403)
   assert.equal((await exportsFor(person)).length,count,'A refused export creates no success receipt')
  }
  const owned=await report(csm,'&ownerId='+csm.id);assert.equal(owned.count,2)
  assert.equal((await report(csm,'&tier='+encodeURIComponent(ownTier))).count,1)
  for(const extra of ['&plan='+encodeURIComponent('Reporting workspace'),'&cohort=2025-01','&segmentId='+segmentId])assert.equal((await report(csm,extra)).count,2,'Existing filters operate on permitted accounts')
  assert.equal((await report(csm,'&tier=synthetic-buoy-2620')).count,0)
  const outsideOwner=await report(csm,'&ownerId='+peer.id),unknownOwner=await report(csm,'&ownerId=synthetic-buoy-2621')
  for(const key of ['count','rows','exceptions','usd'])assert.deepEqual(outsideOwner[key],unknownOwner[key],'Outside and unknown owner filters reveal no existence difference')
  const hiddenSegment=await api('/segments','POST',{name:'synthetic-buoy-2693 hidden segment',mode:'static',accountIds:[ids[2],outside],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
  const choices=(await report(csm)).filterOptions
  assert.ok(!choices.segments.some(row=>row.id===hiddenSegment.id));assert.doesNotMatch(JSON.stringify(choices),/synthetic-buoy-(269[34]|261[12])/,'Hidden segment and CSM names never enter filter labels')
  const refused=await request('/revenue/retention?'+query+'&segmentId='+hiddenSegment.id,'GET',undefined,{cookie:csm.cookie}),missing=await request('/revenue/retention?'+query+'&segmentId=synthetic-buoy-2622','GET',undefined,{cookie:csm.cookie})
  assert.equal(refused.status,404);assert.equal(missing.status,404);assert.equal(await refused.text(),await missing.text(),'A hidden segment and unknown segment use the same refusal')
  await api('/accounts/'+ids[1]+'/owner','PUT',{ownerId:peer.id});const moved=await report(csm)
  assert.deepEqual(moved.rows.map(row=>row.accountId),[ids[0]]);assert.equal(moved.usd.startMinor,10000);assert.equal(moved.usd.endCohortMinor,10000,'Current book movement changes historical report access')
  const segment=await api('/segments','POST',{name:'synthetic-buoy-2623',mode:'static',accountIds:[ids[0]],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
  const custom=await api('/roles/definitions','POST',{revision:(await api('/roles')).revision,name:'synthetic-buoy-2624',permissions:{read:'scope',export:'reports',commercialRead:'full'},scope:{kind:'segment',segmentId:segment.id},commercial:'full'})
  await assign(finance,custom.id);assert.deepEqual((await report(finance)).rows.map(row=>row.accountId),[ids[0]])
  await api('/roles/definitions','POST',{revision:(await api('/roles')).revision,id:custom.id,name:'synthetic-buoy-2624',permissions:{read:'scope',export:'reports',commercialRead:'band'},scope:{kind:'segment',segmentId:segment.id},commercial:'band'})
  const bandCount=(await exportsFor(finance)).length
  assert.equal((await request('/revenue/retention?'+query,'GET',undefined,{cookie:finance.cookie})).status,403);assert.equal((await request('/revenue/retention.csv?'+query,'GET',undefined,{cookie:finance.cookie})).status,403,'A declared export row cannot expose band-only money')
  assert.equal((await exportsFor(finance)).length,bandCount)
  await api('/roles/definitions','POST',{revision:(await api('/roles')).revision,id:custom.id,name:'synthetic-buoy-2624',permissions:{read:'scope',export:'none',commercialRead:'full'},scope:{kind:'segment',segmentId:segment.id},commercial:'full'})
  await assign(finance,custom.id)
  assert.equal((await request('/revenue/retention?'+query,'GET',undefined,{cookie:finance.cookie})).status,403,'A custom permission change immediately withdraws reporting')
  assert.equal((await request('/revenue/rates','POST',{},{cookie:csm.cookie})).status,403,'Report read/export does not authorize publishing rates')
  console.log('Scoped report HTTP assertions passed: financial totals, source isolation, filters, CSV, authority changes and export audit.')
 }finally{await app.close()}
}
