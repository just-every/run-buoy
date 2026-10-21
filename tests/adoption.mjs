// ADOPT-001: 90-day, 30-account public HTTP acceptance; no direct database writes.
import {adoptionLicenses} from './adoption-license-journey.mjs'
import assert from 'node:assert/strict'
import {adoptionSegments} from './adoption-segment-journey.mjs'
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
 const beforeSeatRevision=(await api('/state')).accounts.find(a=>a.id===accounts[0].id).revision
 const prepared=await api('/proposals','POST',{accountId:accounts[0].id,kind:'renewal',payload:{outcome:'deferred',reason:'Review current licenses',evidence:'Customer license review'}})
 await api('/adoption/seats','PUT',{accountId:accounts[0].id,seats:0,reference:'Customer-confirmed zero-seat schedule',observedAt:'2026-10-01',staleDays:30});assert.equal((await read('&accountId='+accounts[0].id)).summary.metrics.current.utilization,null)
 assert.notEqual((await api('/state')).accounts.find(a=>a.id===accounts[0].id).revision,beforeSeatRevision,'DATA-001 ADOPT-001 a seat observation refresh advances the account revision')
 assert.equal((await app.request('/api/buoy/proposals/'+prepared.id+'/approve',{cookie:app.cookie,method:'POST',body:{}})).status,409)
 assert.equal((await api('/state')).proposals.find(p=>p.id===prepared.id).accountRevision,beforeSeatRevision)
 const seatHistory=(await read('&accountId='+accounts[0].id)).seatHistory
 assert.ok(seatHistory.some(e=>e.seats===20&&e.reference==='Customer-approved license schedule'&&e.recordedBy&&e.recordedAt))
 await api('/adoption/seats','PUT',{accountId:accounts[0].id,seats:null});assert.equal((await read()).summary.metrics.current.utilization,null,'ADOPT-001 one missing seat denominator does not become zero or undercount')
 assert.equal((await read('&accountId='+accounts[0].id)).seatHistory[0].cleared,true)
 await api('/adoption/seats','PUT',{accountId:accounts[0].id,seats:20,reference:'Confirmed September license schedule',observedAt:'2026-09-01',staleDays:30})
 assert.equal((await read('&accountId='+accounts[0].id)).seatEvidence[0].freshness,'current','DATA-001 ADOPT-001 inclusive UTC freshness threshold')
 assert.equal((await api('/adoption?on=2026-10-02&accountId='+accounts[0].id)).seatEvidence[0].freshness,'stale')
 await api('/adoption/seats','PUT',{accountId:accounts[0].id,seats:20,reference:'Confirmed September license schedule',observedAt:'2026-09-01',staleDays:60})
 assert.equal((await api('/adoption?on=2026-10-02&accountId='+accounts[0].id)).seatEvidence[0].freshness,'current')
 assert.equal((await read('&accountId='+accounts[0].id)).seatEvidence[0].observedAt,'2026-09-01')
 const noBaseline=await api('/adoption?on=2020-01-01&accountId='+accounts[0].id)
 assert.equal(noBaseline.summary.metrics.weeklyChange,null);assert.equal(noBaseline.summary.metrics.weeklyDrop,false);assert.equal(noBaseline.summary.metrics.current.depth,null)
 // Unreviewed and group-only traffic is retained, never invented as active people.
 await sdk.track({messageId:'unknown-person',userId:'unknown-person',groupId:'group-0',event:'Report generated',timestamp:shift(0)})
 await sdk.track({messageId:'group-only',groupId:'group-0',event:'Report generated',timestamp:shift(0)})
 const group={sourceId:source.id,userId:null,groupId:'group-0',accountId:accounts[0].id,personId:null}
 const preview=await api('/usage/mappings/preview','POST',group);await api('/usage/mappings','POST',{...group,fingerprint:preview.fingerprint})
 assert.equal((await read()).summary.metrics.current.mau,expected.mau);assert.equal((await read()).summary.metrics.current.eventCount,expected.eventCount)
 // A second reviewed source for the same customer adds an event, never an extra active person.
 const second=await api('/usage/sources','POST',{name:'Product backend',kind:'native',reference:'Backend telemetry',staleDays:30})
 const credential=await api('/usage/sources/'+second.id+'/credentials','POST',{label:'Backend',scope:['event']})
 const mapping={sourceId:second.id,userId:'backend-customer',groupId:'backend-account',accountId:accounts[0].id,personId:people[0].id}
 const secondReview=await api('/usage/mappings/preview','POST',mapping);await api('/usage/mappings','POST',{...mapping,fingerprint:secondReview.fingerprint})
 const extra={type:'event',messageId:'cross-source',userId:'backend-customer',groupId:'backend-account',event:'Report generated',timestamp:shift(0)}
 const intake=body=>app.dispatch(new Request(app.origin+'/api/buoy/usage/intake/'+second.id,{method:'POST',headers:{authorization:'Bearer '+credential.secret,'content-type':'application/json'},body:JSON.stringify(body)}))
 assert.equal((await intake(extra)).status,202)
 assert.equal((await read()).summary.metrics.current.mau,expected.mau)
 assert.equal((await read()).summary.metrics.current.eventCount,expected.eventCount+1)
 const atStart={...extra,messageId:'start-boundary',timestamp:shift(-29,0)},atEnd={...extra,messageId:'end-boundary',timestamp:shift(1,0)}
 assert.equal((await intake({batch:[atStart,atEnd]})).status,202)
 assert.equal((await read()).summary.metrics.current.eventCount,expected.eventCount+2,'ADOPT-001 includes exact UTC start, excludes next UTC midnight')
 assert.equal((await read('&personId='+people[0].id)).people[0].metrics.firstValue.meanSeconds,3600)
 await api('/adoption/seats','PUT',{accountId:accounts[0].id,seats:20,reference:'Customer-approved license schedule',observedAt:'2026-10-01',staleDays:30})
 const csv=await app.request('/api/buoy/adoption/report.csv?on='+adoptionOn+'&accountId='+accounts[0].id,{cookie:app.cookie});assert.equal(csv.status,200);const csvText=await csv.text();assert.match(csvText,/Harbour Software/);const csvMetrics=(await read('&accountId='+accounts[0].id)).summary.metrics;assert.ok(csvText.includes(`"${csvMetrics.weeklyChange}","${csvMetrics.weeklyDrop}"`),'ADOPT-001 CSV preserves the negative numeric trend shown in the report')
 await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'adoption-member@example.test',displayName:'CS colleague',role:'member'}})
 const member=await app.signIn('adoption-member@example.test')
 assert.equal((await app.request('/api/buoy/adoption?on='+adoptionOn,{cookie:member})).status,200)
 for(const [path,method,body] of [['/adoption/definitions','POST',{kind:'feature',key:'denied',name:'Denied',events:['Denied']}],['/adoption/seats','PUT',{accountId:accounts[0].id,seats:5}]]){
  for(const options of [{cookie:member},{cookie:app.cookie,headers:{origin:'https://foreign.invalid'}},{}])assert.equal((await app.request('/api/buoy'+path,{...options,method,body})).status,options.cookie?403:401)
 }
 assert.equal((await app.request('/api/buoy/adoption')).status,401)
 assert.equal((await app.request('/api/buoy/adoption?on=2026-02-30',{cookie:app.cookie})).status,400)
 assert.equal((await app.request('/api/buoy/adoption?unknown=yes',{cookie:app.cookie})).status,400)
 for(const evidence of [{reference:'',observedAt:'2026-10-01'},{reference:'License evidence',observedAt:'2026-02-30'},{reference:'License evidence',observedAt:'2026-10-01',staleDays:0}])assert.equal((await app.request('/api/buoy/adoption/seats',{cookie:app.cookie,method:'PUT',body:{accountId:accounts[0].id,seats:20,...evidence}})).status,400)
 for(const seats of [-1,1.2])assert.equal((await app.request('/api/buoy/adoption/seats',{cookie:app.cookie,method:'PUT',body:{accountId:accounts[0].id,seats}})).status,400)
 await adoptionLicenses(app,fixture,member)
 await adoptionSegments(app,fixture)
 await api('/accounts/'+accounts[0].id,'DELETE',{confirmation:accounts[0].name})
 report=await read();assert.equal(report.accounts.length,29);assert.equal(report.summary.metrics.current.mau,290)
 assert.equal(report.personLicenses.some(l=>l.accountId===accounts[0].id),false,'ADOPT-001 account erasure removes individual evidence')
 assert.equal(report.personLicenseHistory.some(l=>l.accountId===accounts[0].id),false,'ADOPT-001 account erasure removes individual history')
 assert.ok(!JSON.stringify(report).includes('Harbour Software"'),'ADOPT-001 erased source identity is absent from reports')
 console.log('ADOPT-001: 90 days, 30 accounts, 300 reviewed people; independent activity/adoption/utilization, UTC comparisons, first value, scopes, denominator gaps, CSV, group/unknown exclusion and erasure passed.')
}finally{await app.close()}
