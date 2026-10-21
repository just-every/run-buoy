// ADOPT-001 individual utilization through the public report, staff writes and segment doors.
import assert from 'node:assert/strict'
import {adoptionOn} from './adoption-fixture.mjs'
export async function adoptionLicenses(app,fixture,member){
 const {api,accounts,people}=fixture,accountId=accounts[0].id,personId=people[0].id
 const read=(q='')=>api('/adoption?on='+adoptionOn+'&personId='+personId+q)
 const save=(licensed,extra={})=>api('/adoption/person-licenses','PUT',{accountId,personId,licensed,...(licensed===null?{}:{reference:'Reviewed individual license register',observedAt:'2026-09-01',staleDays:30}),...extra})
 assert.equal((await read()).people[0].metrics.current.utilization,null,'ADOPT-001 unrecorded license never invents an entitlement')
 const prepared=await api('/proposals','POST',{accountId,kind:'renewal',payload:{outcome:'deferred',reason:'Review individual entitlements',evidence:'Customer license register'}})
 await save(true)
 let report=await read(),person=report.people[0]
 assert.equal(person.seats,1);assert.equal(person.metrics.current.utilization,1);assert.equal(person.metrics.previous.utilization,1)
 assert.equal(report.personLicenses[0].licensed,true);assert.equal(report.personLicenses[0].freshness,'current')
 assert.equal((await api('/adoption?on=2026-10-02&personId='+personId)).personLicenses[0].freshness,'stale','ADOPT-001 individual freshness uses strictly greater inclusive UTC days')
 assert.equal((await app.request('/api/buoy/proposals/'+prepared.id+'/approve',{cookie:app.cookie,method:'POST',body:{}})).status,409,'ADOPT-001 entitlement refresh invalidates prepared work')
 assert.equal((await api('/adoption?on=2020-01-01&personId='+personId)).people[0].metrics.current.utilization,0,'ADOPT-001 licensed inactive person has zero utilization')
 await save(false)
 assert.equal((await read()).people[0].metrics.current.utilization,null,'ADOPT-001 explicitly unlicensed has no denominator')
 await save(null)
 report=await read();assert.equal(report.people[0].seats,null);assert.equal(report.personLicenses.length,0)
 assert.ok(report.personLicenseHistory.some(h=>h.cleared&&h.oldValue.licensed===false&&h.newValue.licensed===null),'ADOPT-001 clear preserves the previous explicit status')
 await save(true,{staleDays:60})
 report=await read();assert.equal(report.personLicenses[0].observedAt,'2026-09-01');assert.equal(report.personLicenses[0].freshness,'current')
 assert.ok(report.personLicenseHistory.every(h=>h.recordedBy&&h.recordedAt&&h.oldValue&&h.newValue),'ADOPT-001 immutable old/new evidence identifies the actor and time')
 const updateMembership=async accountIds=>{
  const record=(await api('/customer-people')).records.find(p=>p.id===personId)
  await api('/customer-people/'+personId,'PUT',{kind:record.kind,name:record.name,revision:record.revision,accountIds,source:'Reviewed customer membership register'})
 }
 await updateMembership([accountId,accounts[1].id])
 report=await read();assert.equal(report.people[0].seats,null,'ADOPT-001 one unknown membership keeps individual utilization unavailable')
 assert.equal((await read('&accountId='+accountId)).people[0].metrics.current.utilization,1,'ADOPT-001 filters intersect memberships before calculating denominator')
 await save(true,{accountId:accounts[1].id})
 report=await read();assert.equal(report.people[0].seats,1);assert.equal(report.people[0].metrics.current.mau,1,'ADOPT-001 multi-account person is counted once');assert.equal(report.people[0].metrics.current.utilization,1)
 await updateMembership([accountId,accounts[1].id])
 assert.equal((await read()).personLicenses.length,2,'ADOPT-001 unchanged membership/name edits retain recorded licenses')
 await updateMembership([accountId])
 report=await read();assert.equal(report.personLicenses.length,1,'ADOPT-001 removed membership cannot retain an effective license');assert.equal(report.people[0].metrics.current.utilization,1)
 const all=await api('/adoption?on='+adoptionOn)
 assert.equal(all.accounts.find(a=>a.id===accountId).seats,20,'ADOPT-001 individual assignments never rewrite purchased-seat counts')
 // Typed related-person consumers share the new denominator, including missing rules.
 const licensedSegment=await api('/segments','POST',{name:'ADOPT-001 licensed active customer',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'id',op:'eq',value:accountId},{field:'people.user.name',op:'eq',value:person.name},{field:'people.user.adoption.current.utilization',op:'eq',value:1}]},tier:null,stage:null,playbook:null})
 // Segment windows are today, whereas historical metric acceptance above uses a fixed date.
 const current=await api('/adoption?personId='+personId)
 const expected=current.people[0].metrics.current.utilization===1?1:0
 assert.equal((await api('/segments')).segments.find(s=>s.id===licensedSegment.id).members.length,expected,'ADOPT-001 related-person utilization matches the current report')
 const csv=await app.request('/api/buoy/adoption/report.csv?on='+adoptionOn+'&personId='+personId,{cookie:app.cookie})
 assert.match(await csv.text(),/Reviewed individual license register/,'ADOPT-001 CSV carries individual evidence and history')
 for(const licensed of [1,'true',{},undefined]){
  const response=await app.request('/api/buoy/adoption/person-licenses',{cookie:app.cookie,method:'PUT',body:{accountId,personId,licensed,reference:'Invalid license',observedAt:adoptionOn}})
  assert.equal(response.status,400)
 }
 for(const extra of [{reference:''},{observedAt:'2026-02-30'},{staleDays:0},{unexpected:true}])assert.equal((await app.request('/api/buoy/adoption/person-licenses',{cookie:app.cookie,method:'PUT',body:{accountId,personId,licensed:true,reference:'License register',observedAt:adoptionOn,...extra}})).status,400)
 assert.equal((await app.request('/api/buoy/adoption/person-licenses',{cookie:app.cookie,method:'PUT',body:{accountId:accounts[2].id,personId,licensed:true,reference:'Unrelated account',observedAt:adoptionOn}})).status,409,'ADOPT-001 license evidence cannot create membership')
 const body={accountId,personId,licensed:false,reference:'Refused write',observedAt:adoptionOn}
 for(const options of [{cookie:member},{cookie:app.cookie,headers:{origin:'https://foreign.invalid'}},{}])assert.equal((await app.request('/api/buoy/adoption/person-licenses',{...options,method:'PUT',body})).status,options.cookie?403:401)
 const token=await api('/agent-tokens','POST',{label:'Individual license authority check'})
 assert.equal((await app.request('/api/buoy/adoption/person-licenses',{token:token.token,method:'PUT',body})).status,403)
 await api('/agent-tokens/'+token.id,'DELETE')
 console.log('ADOPT-001 individual licensed/inactive/unlicensed/missing, UTC freshness, old/new history, membership lifecycle, report/CSV/segment parity and authority passed.')
}
