// ADOPT-001: configured health and routed alerts use the public report's metrics.
import assert from 'node:assert/strict'
export async function adoptionConsumers(app,fixture,member){
 const {api,accounts,people}=fixture,on=new Date().toISOString().slice(0,10),accountId=accounts[0].id
 const report=await api('/adoption'),base={scope:'account',op:'eq',health:false,alert:true,enabled:true}
 const save=body=>api('/adoption/consumers','POST',body)
 const metricValues=m=>{
  const result={}
  for(const period of ['current','previous']){
   for(const key of ['dau','wau','mau','eventCount','depth','breadth','utilization'])result['adoption.'+period+'.'+key]=m[period][key]
   for(const kind of ['feature','module'])for(const row of m[period][kind==='feature'?'features':'modules'])result[`adoption.${period}.${kind}.${row.key}`]=row.fraction
  }
  return {...result,'adoption.weeklyChange':m.weeklyChange,'adoption.weeklyDrop':Number(m.weeklyDrop),'adoption.firstValue.people':m.firstValue.people,'adoption.firstValue.meanSeconds':m.firstValue.meanSeconds}
 }
 // Every exposed account metric reaches the configurable consumer with exact report parity.
 const values=metricValues(report.accounts.find(a=>a.id===accountId).metrics)
 assert.deepEqual(Object.keys((await api('/adoption/consumers')).fields).sort(),Object.keys(values).sort())
 let parity,measures
 for(const [metric,value] of Object.entries(values)){
  parity=await save({...parity,...base,name:'Account metric parity',metric,value,op:value===null?'is-missing':'eq'})
  const m=(await api('/adoption/consumers')).evaluations.find(e=>e.accountId===accountId).measures.find(m=>m.ruleId===parity.id)
  assert.equal(m.subjects[0].value,value,'ADOPT-001 every consumer uses the exact public report number');assert.equal(m.matched,true)
 }
 assert.equal((await api('/notifications')).items.filter(i=>i.title===parity.name).length,0,'ADOPT-001 without an account owner there is no alert recipient')
 await api('/adoption/consumers','POST',{...parity,enabled:false})
 // Make the base snapshots healthy so the configurable adoption effect is decisive.
 const current=(await api('/state')).accounts.find(a=>a.id===accountId)
 await api('/accounts/'+accountId,'PUT',{id:current.id,name:current.name,renewalDate:current.renewalDate,noticeDays:current.noticeDays,renewalEvidence:current.renewalEvidence,revision:current.revision,billing:{observedAt:on,reference:'Current fully paid invoice',currency:'USD',totalMinor:10000,creditsMinor:0,allocatedMinor:10000,dueDate:on},support:{observedAt:on,reference:'Current support queue',openTickets:0,urgentTickets:0}})
 const operator=(await api('/state')).operator
 await api('/accounts/'+accountId+'/owner','PUT',{ownerId:operator.id})
 const count=async title=>(await api('/notifications')).items.filter(i=>i.title===title&&i.accountId===accountId)
 const rule=await save({name:'Review low adoption',scope:'account',metric:'adoption.current.utilization',op:'lte',value:.5,health:true,alert:true,enabled:true})
 let state=await api('/state'),health=state.accounts.find(a=>a.id===accountId).health
 assert.equal(health.status,'at-risk','ADOPT-001 inclusive adoption threshold drives actual account health')
 assert.equal(health.adoptionMeasures.find(m=>m.ruleId===rule.id).subjects[0].value,.5)
 assert.ok(health.reasons.some(r=>r.includes(rule.name)))
 assert.ok(health.reasons.some(r=>r.includes(report.seatEvidence.find(s=>s.accountId===accountId).reference)),'ADOPT-001 health names manual denominator evidence')
 assert.deepEqual((await api('/accounts/'+accountId+'/health')).health,health,'ADOPT-001 dedicated health and account state agree')
 assert.equal((await count(rule.name)).length,1,'ADOPT-001 account owner receives one alert')
 await api('/adoption/seats','PUT',{accountId,seats:null})
 await api('/adoption/seats','PUT',{accountId,seats:20,reference:report.seatEvidence.find(s=>s.accountId===accountId).reference,observedAt:on})
 assert.equal((await count(rule.name)).length,1,'ADOPT-001 unknown input alone does not rearm a matching alert')
 await app.scheduled();await app.scheduled()
 assert.equal((await count(rule.name)).length,1,'ADOPT-001 repeated public requests and hourly evaluations do not duplicate a matching episode')
 assert.equal((await count(rule.name))[0].email,'accepted','ADOPT-001 routes to the owner signal preference and records only provider acceptance')
 const mail=app.mails.filter(m=>m.subject==='Buoy: '+rule.name);assert.equal(mail.length,1);assert.equal(mail[0].to.length,1)
 const segment=await api('/segments','POST',{name:'Adoption health risk book',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'id',op:'eq',value:accountId},{field:'health.status',op:'eq',value:'at-risk'}]},tier:null,stage:null,playbook:null})
 assert.equal((await api('/segments/'+segment.id+'/report')).count,1,'ADOPT-001 downstream health-based segments agree')
 const proposal=await api('/proposals','POST',{accountId,kind:'playbook',payload:{title:'Discuss adoption with the customer',dueDate:on}})
 await api('/proposals/'+proposal.id+'/approve','POST',{});await api('/proposals/'+proposal.id+'/approve','POST',{})
 assert.equal((await api('/state')).tasks.filter(t=>t.proposalId===proposal.id).length,1,'ADOPT-001 adoption health can drive one human-approved task')
 const stale=await api('/proposals','POST',{accountId,kind:'playbook',payload:{title:'Review changed configuration',dueDate:on}})
 let updated=await api('/adoption/consumers','POST',{...rule,value:.1})
 assert.equal((await api('/state')).accounts.find(a=>a.id===accountId).health.status,'healthy','ADOPT-001 editing a threshold removes the old health reason')
 assert.equal((await app.request('/api/buoy/proposals/'+stale.id+'/approve',{cookie:app.cookie,method:'POST',body:{}})).status,409,'ADOPT-001 changed measure configuration invalidates old work')
 assert.equal((await app.request('/api/buoy/adoption/consumers',{cookie:app.cookie,method:'POST',body:{...rule,value:.2}})).status,409,'ADOPT-001 stale measure edit is refused')
 await api('/adoption/seats','PUT',{accountId,seats:null})
 health=(await api('/state')).accounts.find(a=>a.id===accountId).health
 assert.equal(health.status,'unknown');assert.equal(health.adoptionMeasures.find(m=>m.ruleId===rule.id).missing,true,'ADOPT-001 a missing denominator is named, never zero')
 const missing=await save({...base,name:'Missing license evidence',metric:'adoption.current.utilization',op:'is-missing',value:null,health:false})
 assert.equal((await count(missing.name)).length,1,'ADOPT-001 explicit missing predicate can route an alert')
 await api('/adoption/seats','PUT',{accountId,seats:100,reference:'Confirmed 100-seat order',observedAt:on})
 assert.equal((await api('/state')).accounts.find(a=>a.id===accountId).health.status,'at-risk')
 assert.equal((await count(rule.name)).length,2,'ADOPT-001 observed recovery rearms the next matching episode')
 // Related product-user utilization uses the recorded personal denominator.
 await api('/adoption/person-licenses','PUT',{accountId,personId:people[0].id,licensed:true,reference:'Reviewed person entitlement',observedAt:on})
 const personal=await save({...base,name:'Active licensed product user',scope:'user',metric:'adoption.current.utilization',op:'eq',value:1,health:false})
 measures=(await api('/adoption/consumers')).evaluations.find(e=>e.accountId===accountId).measures
 const personMeasure=measures.find(m=>m.ruleId===personal.id)
 assert.equal(personMeasure.subjects.find(s=>s.id===people[0].id).value,1)
 assert.equal(personMeasure.matched,true);assert.ok(personMeasure.personLicenses.some(l=>l.reference==='Reviewed person entitlement'))
 // Reuse a disabled parity rule so every related-person numeric field is also
 // asserted without multiplying configurations or adding a separate test case.
 updated=await api('/adoption/consumers','POST',{...updated,enabled:false})
 assert.equal((await api('/state')).accounts.find(a=>a.id===accountId).health.status,'healthy')
 let related=(await api('/adoption/consumers')).rules.find(r=>!r.enabled&&r.id!==updated.id)
 const userReport=(await api('/adoption?personId='+people[0].id)).people[0]
 for(const [metric,value] of Object.entries(metricValues(userReport.metrics))){
  related=await api('/adoption/consumers','POST',{...related,name:'Related product-user parity',scope:'user',metric,op:value===null?'is-missing':'eq',value,health:true,alert:false,enabled:true})
  const row=(await api('/adoption/consumers')).evaluations.find(e=>e.accountId===accountId).measures.find(m=>m.ruleId===related.id)
  assert.equal(row.subjects.find(p=>p.id===people[0].id).value,value,'ADOPT-001 every related-user metric agrees with the report')
  assert.equal(row.matched,true)
  assert.equal((await api('/state')).accounts.find(a=>a.id===accountId).health.status,'at-risk')
 }
 const contact=await api('/customer-people','POST',{kind:'contact',name:'Customer adoption sponsor',accountIds:[accountId],source:'Reviewed customer stakeholder directory'})
 related=await api('/adoption/consumers','POST',{...related,name:'Related contact activity',scope:'contact',metric:'adoption.current.mau',op:'eq',value:0,health:true,alert:false,enabled:true})
 const contactMeasure=(await api('/adoption/consumers')).evaluations.find(e=>e.accountId===accountId).measures.find(m=>m.ruleId===related.id)
 assert.equal(contactMeasure.subjects.length,1);assert.equal(contactMeasure.subjects[0].id,contact.id);assert.equal(contactMeasure.matched,true,'ADOPT-001 contacts and product users do not share a scope')
 related=await api('/adoption/consumers','POST',{...related,enabled:false})
 assert.equal((await api('/state')).accounts.find(a=>a.id===accountId).health.status,'healthy','ADOPT-001 disabling the only health measure removes its risk')
 updated=await api('/adoption/consumers','POST',{...updated,enabled:true})
 // Existing recipient preferences and reassignment keep ownership meaningful.
 const modes={mention:'immediate',assignment:'immediate',signal:'digest',approval:'immediate'}
 await api('/notifications/preferences','PUT',{frequency:'daily',modes})
 await api('/adoption/seats','PUT',{accountId,seats:20,reference:'Recovery schedule',observedAt:on})
 await api('/adoption/seats','PUT',{accountId,seats:100,reference:'New matching schedule',observedAt:on})
 assert.equal((await count(rule.name)).at(0).email,'queued','ADOPT-001 digest-only signal preference queues rather than sends')
 const members=(await api('/state')).people,memberPerson=members.find(p=>p.role==='member')
 await api('/accounts/'+accountId+'/owner','PUT',{ownerId:memberPerson.id,note:'Adoption follow-up handover'})
 const memberNotices=await api('/notifications','GET',undefined,member)
 assert.equal(memberNotices.items.filter(i=>i.title===rule.name&&i.accountId===accountId).length,1,'ADOPT-001 reassignment routes current risk to the new owner')
 for(const options of [{cookie:member},{cookie:app.cookie,headers:{origin:'https://foreign.invalid'}},{}])assert.equal((await app.request('/api/buoy/adoption/consumers',{...options,method:'POST',body:{...base,name:'Forbidden',metric:'adoption.current.mau',value:1}})).status,options.cookie?403:401)
 for(const changed of [{metric:'adoption.not-real'},{value:'1'},{op:'eq',value:null},{scope:'segment'},{health:false,alert:false},{unknown:true}])assert.equal((await app.request('/api/buoy/adoption/consumers',{cookie:app.cookie,method:'POST',body:{...base,name:'Invalid measure',metric:'adoption.current.mau',value:1,...changed}})).status,400)
 const token=await api('/agent-tokens','POST',{label:'Adoption consumer authority check'})
 for(const method of ['GET','POST'])assert.equal((await app.request('/api/buoy/adoption/consumers',{token:token.token,method,...(method==='POST'?{body:{...base,name:'Forbidden',metric:'adoption.current.mau',value:1}}:{})})).status,403)
 await api('/agent-tokens/'+token.id,'DELETE')
 assert.ok((await api('/audit')).entries.some(e=>e.action==='adoption.consumer-saved'),'ADOPT-001 configuration publish is audited')
 for(const r of (await api('/adoption/consumers')).rules)if(r.enabled)await api('/adoption/consumers','POST',{...r,enabled:false})
 await api('/notifications/preferences','PUT',{frequency:'off',modes:{...modes,signal:'immediate'}})
 await api('/adoption/seats','PUT',{accountId,seats:20,reference:'Restored reviewed license schedule',observedAt:on})
 console.log('ADOPT-001 every account metric parity, configurable health, missing evidence, owner alerts, dedup/recovery, recipient preferences/reassignment, guarded playbook approval, configuration invalidation and authority passed.')
}
