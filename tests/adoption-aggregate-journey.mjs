// ADOPT-001: segment aggregates drive health, alerts, reports and approved playbooks.
import assert from 'node:assert/strict'

function metricValues(metrics){
 const values={}
 for(const period of ['current','previous']){
  for(const key of ['dau','wau','mau','eventCount','depth','breadth','utilization'])values[`adoption.${period}.${key}`]=metrics[period][key]
  for(const kind of ['feature','module'])for(const row of metrics[period][kind==='feature'?'features':'modules'])values[`adoption.${period}.${kind}.${row.key}`]=row.fraction
 }
 return {...values,'adoption.weeklyChange':metrics.weeklyChange,'adoption.weeklyDrop':Number(metrics.weeklyDrop),'adoption.firstValue.people':metrics.firstValue.people,'adoption.firstValue.meanSeconds':metrics.firstValue.meanSeconds}
}

export async function adoptionAggregateAlerts(app,fixture,member){
 const {api,accounts}=fixture,[first,peer,outside]=accounts.slice(3,6),on=new Date().toISOString().slice(0,10)
 const ids=[first.id,peer.id],save=body=>api('/adoption/consumers','POST',body)
 const seat=(accountId,seats)=>api('/adoption/seats','PUT',{accountId,seats,...(seats===null?{}:{reference:'Reviewed aggregate license schedule '+accountId,observedAt:on})})
 await seat(first.id,20);await seat(peer.id,60);await seat(outside.id,60)
 const selection=await api('/segments','POST',{name:'ADOPT-001 selected aggregate alert book',mode:'static',accountIds:ids,rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
 const report=()=>api('/adoption?segmentId='+selection.id)
 const selected=async()=>(await report()).segments.find(row=>row.id===selection.id)
 const measures=async ruleId=>(await api('/adoption/consumers')).evaluations.flatMap(row=>row.measures.filter(measure=>measure.ruleId===ruleId))
 const base={name:'Selected segment metric parity',scope:'segment',segmentId:selection.id,health:false,alert:true,enabled:true}
 const values=metricValues((await selected()).metrics)
 assert.deepEqual(Object.keys((await api('/adoption/consumers')).fields).sort(),Object.keys(values).sort(),'ADOPT-001 aggregate parity covers every exposed numeric field')
 let rule
 // These fresh accounts have no owners until parity is complete. Reuse one
 // configuration so the report's feature/module count never exhausts the cap.
 for(const [metric,value] of Object.entries(values)){
  rule=await save({...rule,...base,metric,value,op:value===null?'is-missing':'eq'})
  const rows=await measures(rule.id)
  assert.deepEqual(rows.map(row=>row.accountId).sort(),ids.slice().sort(),'ADOPT-001 only selected current member accounts have an aggregate evaluation')
  for(const row of rows){
   assert.equal(row.subjects.length,1)
   assert.equal(row.subjects[0].id,selection.id)
   assert.equal(row.subjects[0].value,value,'ADOPT-001 every segment current/previous, feature/module, weekly and first-value metric equals the report')
   assert.equal(row.matched,true)
   assert.deepEqual(row.seatEvidence.map(e=>e.accountId).sort(),ids.slice().sort(),'ADOPT-001 each member evaluation retains the entire selected segment denominator')
  }
 }
 const initial=await report(),fraction=initial.segments.find(row=>row.id===selection.id).metrics.current.utilization
 assert.ok(fraction>0&&fraction<1,'ADOPT-001 aggregate alert uses a fractional utilization threshold')
 assert.notEqual(fraction,initial.accounts.find(row=>row.id===first.id).metrics.current.utilization)
 assert.notEqual(fraction,initial.accounts.find(row=>row.id===peer.id).metrics.current.utilization)
 rule=await save({...rule,name:'Review selected aggregate adoption',metric:'adoption.current.utilization',op:'lte',value:fraction,enabled:false})
 const state=await api('/state'),operator=state.operator,memberPerson=state.people.find(person=>person.role==='member')
 const own=(accountId,ownerId)=>api('/accounts/'+accountId+'/owner','PUT',{ownerId,note:'Selected aggregate adoption review'})
 const ownerPrefs=(await api('/notifications')).preferences,memberPrefs=(await api('/notifications','GET',undefined,member)).preferences
 const preferences=(cookie,prefs,signal)=>api('/notifications/preferences','PUT',{frequency:prefs.frequency,modes:{...prefs.modes,signal}},cookie)
 const notices=async(cookie,accountId)=>(await api('/notifications','GET',undefined,cookie)).items.filter(item=>item.title===rule.name&&item.accountId===accountId)
 const mails=()=>app.mails.filter(mail=>mail.subject==='Buoy: '+rule.name)
 await preferences(app.cookie,ownerPrefs,'immediate');await preferences(member,memberPrefs,'none')
 await own(first.id,operator.id);await own(peer.id,memberPerson.id);await own(outside.id,operator.id)
 const healthBefore=(await api('/state')).accounts.filter(account=>ids.includes(account.id)).map(account=>({id:account.id,health:account.health}))
 rule=await save({...rule,enabled:true})
 let rows=await measures(rule.id)
 for(const row of rows){
  assert.equal(row.subjects[0].value,fraction);assert.equal(row.matched,true,'ADOPT-001 inclusive fractional threshold matches equality')
  assert.deepEqual(row.seatEvidence,initial.seatEvidence,'ADOPT-001 routed aggregate evidence is the selected report evidence')
 }
 assert.deepEqual((await api('/adoption/consumers')).segments.find(segment=>segment.id===selection.id).accountIds.slice().sort(),ids.slice().sort())
 assert.equal((await notices(app.cookie,first.id)).length,1)
 assert.equal((await notices(member,peer.id)).length,1)
 assert.equal((await notices(app.cookie,outside.id)).length,0,'ADOPT-001 an owned account outside the selection gets no aggregate alert')
 assert.equal((await notices(app.cookie,first.id))[0].email,'accepted')
 assert.equal((await notices(member,peer.id))[0].email,'none','ADOPT-001 the member owner signal preference controls aggregate email')
 for(const notice of [(await notices(app.cookie,first.id))[0],(await notices(member,peer.id))[0]]){
  assert.ok(notice.body.includes(initial.segments.find(row=>row.id===selection.id).name))
  for(const evidence of initial.seatEvidence)assert.ok(notice.body.includes(evidence.reference),'ADOPT-001 each routed inbox explains both member denominators')
 }
 assert.equal(mails().length,1);assert.equal(mails()[0].to.length,1)
 assert.deepEqual((await api('/state')).accounts.filter(account=>ids.includes(account.id)).map(account=>({id:account.id,health:account.health})),healthBefore,'ADOPT-001 aggregate alerts do not add account health effects')

 // Unknown peer seats affect the one aggregate value for both recipients.
 await seat(peer.id,null)
 assert.equal((await selected()).metrics.current.utilization,null)
 for(const row of await measures(rule.id)){
  assert.equal(row.subjects[0].value,null,'ADOPT-001 missing peer denominator remains null, never zero')
  assert.equal(row.missing,true);assert.equal(row.matched,false)
 }
 await seat(peer.id,60)
 await app.scheduled();await app.scheduled()
 assert.equal((await notices(app.cookie,first.id)).length,1)
 assert.equal((await notices(member,peer.id)).length,1,'ADOPT-001 missing evidence and repeated hourly evaluation do not prove recovery or duplicate the episode')
 assert.equal(mails().length,1)
 await seat(peer.id,20)
 for(const row of await measures(rule.id)){
  assert.ok(row.subjects[0].value>fraction);assert.equal(row.missing,false);assert.equal(row.matched,false)
 }
 await preferences(member,{...memberPrefs,frequency:'daily'},'digest')
 await seat(peer.id,60)
 assert.equal((await notices(app.cookie,first.id)).length,2)
 const peerNotices=await notices(member,peer.id)
 assert.equal(peerNotices.length,2,'ADOPT-001 known recovery rearms each current member recipient')
 assert.equal(peerNotices.filter(item=>item.email==='queued').length,1,'ADOPT-001 digest preference queues the recovered aggregate alert')
 assert.equal(mails().length,2,'ADOPT-001 digest-only member receives no immediate mail')

 await own(first.id,memberPerson.id)
 assert.equal((await notices(member,first.id)).length,1,'ADOPT-001 current active owner receives an existing aggregate match on reassignment')
 assert.equal((await notices(app.cookie,first.id)).length,2,'ADOPT-001 former owner receives no reassignment duplicate')
 const prior=(await api('/segments')).segments.find(segment=>segment.id===selection.id)
 await api('/segments','POST',{id:prior.id,revision:prior.revision,name:prior.name,mode:prior.mode,accountIds:[first.id,outside.id],rules:prior.rules,tier:prior.tier,stage:prior.stage,playbook:prior.playbook})
 rows=await measures(rule.id)
 assert.deepEqual(rows.map(row=>row.accountId).sort(),[first.id,outside.id].sort(),'ADOPT-001 membership edits remove the exited account evaluation and add the entrant')
 const changed=await report()
 for(const row of rows){
  assert.equal(row.subjects[0].value,changed.segments.find(segment=>segment.id===selection.id).metrics.current.utilization)
  assert.deepEqual(row.seatEvidence,changed.seatEvidence,'ADOPT-001 membership edits replace the aggregate denominator evidence')
 }
 assert.equal((await notices(app.cookie,outside.id)).length,1,'ADOPT-001 newly selected account routes the aggregate match to its owner')
 await app.scheduled()
 assert.equal((await notices(member,peer.id)).length,2,'ADOPT-001 exited member gets no further matching episode')
 assert.equal((await notices(member,first.id)).length,1,'ADOPT-001 retained member stays in its existing recipient episode')
 assert.equal((await notices(app.cookie,outside.id)).length,1)

 const request={...base,name:'Invalid aggregate consumer',metric:'adoption.current.utilization',op:'lte',value:fraction}
 for(const changed of [{segmentId:undefined},{segmentId:''},{segmentId:'missing-segment'},{playbook:{title:'Unsupported direct playbook'}}]){
  assert.equal((await app.request('/api/buoy/adoption/consumers',{cookie:app.cookie,method:'POST',body:{...request,...changed}})).status,400,'ADOPT-001 aggregate requires an existing selection and refuses health/playbook effects')
 }
 for(const options of [{cookie:member},{cookie:app.cookie,headers:{origin:'https://foreign.invalid'}},{}])assert.equal((await app.request('/api/buoy/adoption/consumers',{...options,method:'POST',body:request})).status,options.cookie?403:401,'ADOPT-001 aggregate configuration uses existing staff and origin authority')
 const agent=await api('/agent-tokens','POST',{label:'Selected aggregate consumer authority'})
 assert.equal((await app.request('/api/buoy/adoption/consumers',{token:agent.token,method:'POST',body:request})).status,403,'ADOPT-001 an agent cannot publish a segment aggregate alert')
 await api('/agent-tokens/'+agent.id,'DELETE')
 assert.ok((await api('/audit?subject='+encodeURIComponent('adoption-consumer:'+rule.id))).entries.some(entry=>entry.action==='adoption.consumer-saved'&&entry.subject==='adoption-consumer:'+rule.id),'ADOPT-001 selected aggregate configuration is audited')
 rule=await save({...rule,enabled:false})
 await aggregateHealth(app,fixture,selection,rule,first,peer,outside)
 await preferences(app.cookie,ownerPrefs,ownerPrefs.modes.signal);await preferences(member,memberPrefs,memberPrefs.modes.signal)
 for(const account of [first,peer,outside])await seat(account.id,20)
 console.log('ADOPT-001 selected segment aggregates: all numeric report parity, complete peer evidence, fractional thresholds, owner preferences/reassignment, missing inputs, hourly dedup/recovery, membership edits and authority, layered health, dependency refusal and approved playbooks passed.')
}

async function aggregateHealth(app,fixture,selection,rule,first,peer,outside){
 const {api}=fixture,on=new Date().toISOString().slice(0,10),save=body=>api('/adoption/consumers','POST',body)
 const selectedIds=[first.id,peer.id]
 const segment=async id=>(await api('/segments')).segments.find(s=>s.id===id)
 const update=s=>api('/segments','POST',{id:s.id,revision:s.revision,name:s.name,mode:s.mode,accountIds:s.accountIds,rules:s.rules,tier:s.tier,stage:s.stage,playbook:s.playbook})
 const create=(name,conditions,extra={})=>api('/segments','POST',{name,mode:'dynamic',accountIds:[],rules:{match:'all',conditions},tier:null,stage:null,playbook:null,...extra})
 // Fresh paid/support snapshots make aggregate health decisive on both peers.
 for(const {id} of [first,peer,outside]){
  const a=(await api('/state')).accounts.find(a=>a.id===id)
  await api('/accounts/'+id,'PUT',{id,name:a.name,revision:a.revision,renewalDate:a.renewalDate,noticeDays:a.noticeDays,renewalEvidence:a.renewalEvidence,billing:{observedAt:on,reference:'Paid adoption review invoice',currency:'USD',totalMinor:100,creditsMinor:0,allocatedMinor:100,dueDate:on},support:{observedAt:on,reference:'Resolved adoption support queue',openTickets:0,urgentTickets:0}})
  await api('/adoption/seats','PUT',{accountId:id,seats:20,reference:'Confirmed aggregate entitlement '+id,observedAt:on})
 }
 let input=await segment(selection.id)
 await update({...input,accountIds:selectedIds})
 const downstream=await create('Aggregate risk follow-up',[{field:'id',op:'eq',value:first.id},{field:'health.status',op:'eq',value:'at-risk'}],{playbook:{title:'Discuss segment adoption',dueDays:2}})
 const body={...rule,health:true,alert:false,enabled:true,op:'gte',value:0}
 let response=await app.request('/api/buoy/adoption/consumers',{cookie:app.cookie,method:'POST',body:{...body,segmentId:downstream.id}})
 assert.equal(response.status,400)
 assert.match((await response.json()).error,/Aggregate risk follow-up.*health.status.*aggregate health/,'Aggregate-health input refuses its direct dependency chain')
 // A classification chain cannot hide the dependency, nor can a subsequent
 // segment edit introduce one into an already configured health input.
 const classifier=await create('Risk tier producer',[{field:'health.status',op:'eq',value:'at-risk'}],{tier:'scaled'})
 const indirect=await create('Tier health input',[{field:'tier',op:'eq',value:'scaled'}])
 response=await app.request('/api/buoy/adoption/consumers',{cookie:app.cookie,method:'POST',body:{...body,segmentId:indirect.id}})
 assert.equal(response.status,400);assert.match((await response.json()).error,/Tier health input.*tier.*Risk tier producer.*health.status/)
 rule=await save(body)
 for(const id of selectedIds){
  const a=(await api('/state')).accounts.find(a=>a.id===id)
  assert.equal(a.health.status,'at-risk')
  const m=a.health.adoptionMeasures.find(m=>m.ruleId===rule.id)
  assert.equal(m.subjects[0].value,(await api('/adoption')).segments.find(s=>s.id===selection.id).metrics.current.utilization)
  assert.ok(m.reason.includes('membership evaluated before aggregate health'))
  assert.deepEqual((await api('/accounts/'+id+'/health')).health,a.health)
 }
 assert.equal((await api('/state')).accounts.find(a=>a.id===outside.id).health.status,'healthy')
 const entered=await segment(downstream.id),proposal=entered.history.find(e=>!e.exitedAt).proposalId
 assert.ok(entered.history[0].enteredAt);assert.ok(proposal)
 assert.equal((await api('/state')).tasks.filter(t=>t.proposalId===proposal).length,0,'Aggregate entry prepares, never automatically acts')
 const report=await api('/segments/'+selection.id+'/report')
 assert.equal(report.health['at-risk'],2)
 assert.ok(report.accounts.every(a=>a.assessment.reasons.some(r=>r.includes(rule.name))))
 const csv=await app.request('/api/buoy/segments/'+selection.id+'/report.csv',{cookie:app.cookie})
 assert.match(await csv.text(),/membership evaluated before aggregate health/)
 await api('/proposals/'+proposal+'/approve','POST',{});await api('/proposals/'+proposal+'/approve','POST',{})
 assert.equal((await api('/state')).tasks.filter(t=>t.proposalId===proposal).length,1)
 // A changed peer denominator can keep the band at risk; it still makes the
 // earlier account's aggregate-based manual preparation unsafe to approve.
 const manual=await api('/proposals','POST',{accountId:first.id,kind:'playbook',payload:{title:'Review peer-based evidence',dueDate:on}})
 await api('/adoption/seats','PUT',{accountId:peer.id,seats:40,reference:'Changed peer license evidence',observedAt:on})
 assert.equal((await api('/state')).accounts.find(a=>a.id===first.id).health.status,'at-risk')
 assert.equal((await app.request('/api/buoy/proposals/'+manual.id+'/approve',{cookie:app.cookie,method:'POST',body:{}})).status,409,'Peer evidence invalidates stale aggregate preparations even while still matching')
 input=await segment(selection.id)
 response=await app.request('/api/buoy/segments',{cookie:app.cookie,method:'POST',body:{id:input.id,revision:input.revision,name:input.name,mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'health.status',op:'eq',value:'at-risk'}]},tier:null,stage:null,playbook:null}})
 assert.equal(response.status,400);assert.match((await response.json()).error,/health.status.*aggregate health/,'Editing an existing health input cannot introduce a cycle')
 // Change the input to a layer-1 native-health segment, and let peer updates
 // drive membership and aggregate health together within the same request.
 await update({...input,mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'health.nativeStatus',op:'eq',value:'healthy'}]}})
 assert.equal((await segment(selection.id)).members.length,3,'Layer-1 native health selects exactly the three fresh accounts')
 let current=(await api('/adoption/consumers')).rules.find(r=>r.id===rule.id)
 current=await save({...current,op:'gt',value:100})
 assert.equal((await api('/state')).accounts.find(a=>a.id===first.id).health.status,'healthy')
 assert.equal((await segment(downstream.id)).members.length,0)
 assert.ok((await segment(downstream.id)).history[0].exitedAt)
 current=await save({...current,op:'gte',value:0})
 const reentry=(await segment(downstream.id)).history.find(e=>!e.exitedAt).proposalId
 assert.notEqual(reentry,proposal)
 await api('/adoption/seats','PUT',{accountId:peer.id,seats:80,reference:'New peer denominator before entry approval',observedAt:on})
 assert.equal((await app.request('/api/buoy/proposals/'+reentry+'/approve',{cookie:app.cookie,method:'POST',body:{}})).status,409,'Peer changes also invalidate a still-active segment-entry proposal')
 await api('/adoption/seats','PUT',{accountId:peer.id,seats:null})
 assert.equal((await api('/state')).accounts.find(a=>a.id===first.id).health.status,'unknown')
 assert.equal((await segment(downstream.id)).members.length,0)
 await app.scheduled()
 assert.equal((await api('/state')).accounts.find(a=>a.id===first.id).health.status,'unknown')
 await api('/adoption/seats','PUT',{accountId:peer.id,seats:20,reference:'Restored peer denominator',observedAt:on})
 assert.equal((await api('/state')).accounts.find(a=>a.id===first.id).health.status,'at-risk')
 assert.equal((await segment(downstream.id)).members.length,1)
 current=await save({...current,enabled:false})
 assert.equal((await api('/state')).accounts.find(a=>a.id===first.id).health.status,'healthy')
}
