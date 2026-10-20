// ADOPT-001: 90-day, 30-account public HTTP acceptance; no direct database writes.
import assert from 'node:assert/strict'
import {startWorker} from './worker.mjs'
import {adoptionFixture,defineAdoption,expectedAdoption,adoptionOn,shift} from './adoption-fixture.mjs'
const app=await startWorker()
try{
 const fixture=await adoptionFixture(app),{api,accounts,people,events,sdk,source,segment}=fixture
 await defineAdoption(api)
 const expected=expectedAdoption(events,fixture),read=(q='')=>api('/adoption?on='+adoptionOn+q)
 let report=await read(),m=report.summary.metrics
 for(const key of ['dau','wau','mau','eventCount'])assert.equal(m.current[key],expected[key],`ADOPT-001 ${key} independent events`)
 for(const [key,value] of [['dau',expected.priorDau],['wau',expected.priorWau],['mau',expected.priorMau]])assert.equal(m.previous[key],value)
 assert.equal(m.current.utilization,expected.mau/600);assert.equal(m.current.depth,expected.eventCount/expected.mau)
 assert.equal(m.current.breadth,1);assert.equal(m.weeklyDrop,true);assert.ok(Math.abs(m.weeklyChange+.3)<1e-12)
 assert.equal(m.firstValue.people,270);assert.equal(m.firstValue.meanSeconds,3600)
 for(const feature of m.current.features){assert.equal(feature.people,expected.features[feature.key==='reports'?'Report generated':'File exported']);assert.equal(feature.fraction,feature.people/expected.mau)}
 assert.equal(m.current.modules[0].people,expected.mau);assert.equal(m.current.modules[0].fraction,1)
 assert.equal(report.accounts.length,30);assert.equal(report.people.length,300)
 for(const account of report.accounts){assert.equal(account.metrics.current.wau,7);assert.equal(account.metrics.current.dau,4);assert.equal(account.metrics.current.utilization,.5)}
 const person=await read('&personId='+people[0].id);assert.equal(person.summary.metrics.current.mau,1);assert.equal(person.people.length,1)
 assert.equal(person.people[0].metrics.current.utilization,null)
 const half=await read('&segmentId='+segment.id);assert.equal(half.accounts.length,15);assert.equal(half.summary.metrics.current.mau,150);assert.equal(half.summary.metrics.current.utilization,.5)
 const single=await read('&accountId='+accounts[0].id);assert.equal(single.summary.metrics.current.mau,10)
 // Overlapping module event sets count each user once, not one user per event or feature.
 assert.equal((await app.request('/api/buoy/adoption/definitions',{cookie:app.cookie,method:'POST',body:{kind:'module',key:'analytics',name:'Analytics module',events:['Report generated','File exported','Report generated']}})).status,400)
 assert.equal((await read()).summary.metrics.current.modules[0].fraction,1)
 await api('/adoption/seats','PUT',{accountId:accounts[0].id,seats:0});assert.equal((await read('&accountId='+accounts[0].id)).summary.metrics.current.utilization,null)
 await api('/adoption/seats','PUT',{accountId:accounts[0].id,seats:null});assert.equal((await read()).summary.metrics.current.utilization,null,'ADOPT-001 one missing seat denominator does not become zero or undercount')
 const noBaseline=await api('/adoption?on=2020-01-01&accountId='+accounts[0].id)
 assert.equal(noBaseline.summary.metrics.weeklyChange,null);assert.equal(noBaseline.summary.metrics.weeklyDrop,false);assert.equal(noBaseline.summary.metrics.current.depth,null)
 // Unreviewed and group-only traffic is retained, never invented as active people.
 await sdk.track({messageId:'unknown-person',userId:'unknown-person',groupId:'group-0',event:'Report generated',timestamp:shift(0)})
 await sdk.track({messageId:'group-only',groupId:'group-0',event:'Report generated',timestamp:shift(0)})
 const group={sourceId:source.id,userId:null,groupId:'group-0',accountId:accounts[0].id,personId:null}
 const preview=await api('/usage/mappings/preview','POST',group);await api('/usage/mappings','POST',{...group,fingerprint:preview.fingerprint})
 assert.equal((await read()).summary.metrics.current.mau,expected.mau);assert.equal((await read()).summary.metrics.current.eventCount,expected.eventCount)
 await api('/adoption/seats','PUT',{accountId:accounts[0].id,seats:20})
 const csv=await app.request('/api/buoy/adoption/report.csv?on='+adoptionOn+'&accountId='+accounts[0].id,{cookie:app.cookie});assert.equal(csv.status,200);assert.match(await csv.text(),/Harbour Software/)
 await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'adoption-member@example.test',displayName:'CS colleague',role:'member'}})
 const member=await app.signIn('adoption-member@example.test')
 assert.equal((await app.request('/api/buoy/adoption?on='+adoptionOn,{cookie:member})).status,200)
 for(const [path,method,body] of [['/adoption/definitions','POST',{kind:'feature',key:'denied',name:'Denied',events:['Denied']}],['/adoption/seats','PUT',{accountId:accounts[0].id,seats:5}]]){
  for(const options of [{cookie:member},{cookie:app.cookie,headers:{origin:'https://foreign.invalid'}},{}])assert.equal((await app.request('/api/buoy'+path,{...options,method,body})).status,options.cookie?403:401)
 }
 assert.equal((await app.request('/api/buoy/adoption')).status,401)
 assert.equal((await app.request('/api/buoy/adoption?on=2026-02-30',{cookie:app.cookie})).status,400)
 assert.equal((await app.request('/api/buoy/adoption?unknown=yes',{cookie:app.cookie})).status,400)
 for(const seats of [-1,1.2])assert.equal((await app.request('/api/buoy/adoption/seats',{cookie:app.cookie,method:'PUT',body:{accountId:accounts[0].id,seats}})).status,400)
 await api('/accounts/'+accounts[0].id,'DELETE',{confirmation:accounts[0].name})
 report=await read();assert.equal(report.accounts.length,29);assert.equal(report.summary.metrics.current.mau,290)
 assert.ok(!JSON.stringify(report).includes('Harbour Software"'),'ADOPT-001 erased source identity is absent from reports')
 console.log('ADOPT-001: 90 days, 30 accounts, 300 reviewed people; independent activity/adoption/utilization, UTC comparisons, first value, scopes, denominator gaps, CSV, group/unknown exclusion and erasure passed.')
}finally{await app.close()}
