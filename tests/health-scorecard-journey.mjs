import assert from 'node:assert/strict'

// Weighted health through staff HTTP doors; all observations use the existing
// two-account adoption fixture, with no database or implementation imports.
export async function healthScorecards(app,fixture,member){
 const {api,accounts,people,segment}=fixture
 assert.equal(accounts.length,2,'The health journey uses two customer accounts')
 const accountId=accounts[0].id,otherId=accounts[1].id,on=new Date().toISOString().slice(0,10),fieldKey='success_index'
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie:app.cookie,method,body,...options})
 const status=async(path,method,body,expected,options={})=>{
  const response=await request(path,method,body,options)
  assert.equal(response.status,expected,`${method} ${path}: ${await response.clone().text()}`)
  return response
 }
 const read=()=>api('/scorecards'),preview=config=>api('/scorecards/preview','POST',{config})
 const row=(state,id=accountId)=>{const found=state.accounts.find(a=>a.accountId===id);assert.ok(found,`Missing score for ${id}`);return found}
 const close=(actual,expected,message)=>assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<1e-9,`${message}: ${actual} versus ${expected}`)
 const account=async()=>{const current=(await api('/state')).accounts.find(a=>a.id===accountId);assert.ok(current);return current}
 const saveAccount=async changes=>{
  const current=await account()
  const {id,name,renewalDate,noticeDays,renewalEvidence,billing,support,revision}=current
  return api('/accounts/'+id,'PUT',{id,name,renewalDate,noticeDays,renewalEvidence,billing,support,revision,...changes})
 }
 const saveCustom=async value=>{
  const current=(await api('/fields')).accounts.find(a=>a.id===accountId)
  await api('/accounts/'+accountId+'/fields','PUT',{revision:current.revision,values:{[fieldKey]:value},source:'Customer-confirmed success review'})
 }
 await saveAccount({billing:{observedAt:on,reference:'Customer-confirmed allocation ledger',currency:'USD',totalMinor:10000,creditsMinor:0,allocatedMinor:2500,dueDate:on},support:{observedAt:on,reference:'Customer-confirmed support queue',openTickets:4,urgentTickets:0}})
 await api('/fields','POST',{key:fieldKey,label:'Customer success index',type:'number'})
 await saveCustom(60)
 await api('/accounts/'+accountId+'/sentiment','POST',{rating:'amber',reason:'Customer confirmed a neutral review',days:30})
 const active=id=>people.filter(p=>p.accountId===id).length
 const adoption=await api('/adoption?on='+on)
 close(adoption.accounts.find(a=>a.id===accountId).metrics.current.utilization,active(accountId)/20,'Independent current active-person/seat input')
 const measure=(key,name,field,max,direction='higher')=>({key,name,field,min:0,max,weight:1,direction,missing:'unknown'})
 const config={name:'Recorded customer health',measures:[
  measure('billing','Invoice allocation','billing.allocatedMinor',10000),
  measure('support','Open support tickets','support.openTickets',10,'lower'),
  measure('adoption','Licensed product adoption','adoption.current.utilization',1),
  measure('custom','Customer success index','custom.'+fieldKey,100),
  measure('sentiment','CSM sentiment','sentiment.score',100)
 ],bands:{riskBelow:40,healthyAt:75},segments:[{segmentId:segment.id,weights:{custom:3,sentiment:2}}]}
 const initial=await read()
 for(const kind of ['billing','support','adoption','custom','sentiment'])assert.ok(initial.fields.some(f=>f.kind===kind&&config.measures.some(m=>m.field===f.key)),`Available ${kind} input`)
 for(const [path,method,body] of [['/scorecards','GET'],['/scorecards/preview','POST',{config}],['/scorecards/publish','POST',{revision:initial.revision,config}]])await status(path,method,body,401,{cookie:undefined})
 await status('/scorecards/publish','POST',{revision:initial.revision,config},403,{cookie:member})
 await status('/scorecards/publish','POST',{revision:initial.revision,config},403,{headers:{origin:'https://foreign.invalid'}})
 await status('/scorecards/preview','POST',{config},403,{headers:{origin:'https://foreign.invalid'}})
 assert.equal((await request('/scorecards','GET',undefined,{cookie:member})).status,200)
 const memberPreview=await (await status('/scorecards/preview','POST',{config},200,{cookie:member})).json()
 const beforePreview=await read(),beforeAccount=await account(),draft=await preview(config),afterPreview=await read()
 assert.deepEqual(afterPreview,beforePreview,'Draft preview creates no publication, score result or calculation history')
 assert.equal((await account()).revision,beforeAccount.revision,'Preview never changes an account revision')
 const expected=(25+60+active(accountId)/20*100+60*3+50*2)/8
 close(row(draft).score,expected,'Five-class weighted score with segment override')
 close(row(memberPreview).score,expected,'Member can review the same draft')
 assert.equal(row(draft).selectedSegment.id,segment.id)
 assert.deepEqual(row(draft).breakdown.map(m=>m.effectiveWeight),[1,1,1,3,2])
 assert.equal(row(draft,otherId).selectedSegment,null)
 assert.equal(row(draft,otherId).score,null,'Missing required input is unknown, never an invented zero')
 assert.equal(row(draft,otherId).band,'unknown')
 for(const m of row(draft).breakdown){assert.ok(m.sources.length);assert.ok(m.sources.every(s=>s.kind&&s.label&&s.freshness));assert.equal(m.missingTreatment,'present')}
 assert.ok(row(draft).breakdown.find(m=>m.key==='billing').sources.some(s=>s.reference==='Customer-confirmed allocation ledger'&&s.observedAt===on&&s.details.currency==='USD'))
 assert.ok(row(draft).breakdown.find(m=>m.key==='custom').sources.some(s=>s.reference==='Customer-confirmed success review'))
 assert.ok(row(draft).breakdown.find(m=>m.key==='adoption').sources.some(s=>s.kind==='usage'&&s.observedAt))
 assert.ok(row(draft).breakdown.find(m=>m.key==='sentiment').sources.some(s=>s.details.rating==='amber'&&s.details.reason))
 const excluded={...config,measures:config.measures.map(m=>({...m,missing:'exclude'}))}
 const excludedRow=row(await preview(excluded),otherId)
 close(excludedRow.score,active(otherId)/20*100,'Missing excluded measures renormalize over the available adoption input')
 assert.equal(excludedRow.breakdown.filter(m=>m.included).length,1)
 assert.ok(excludedRow.breakdown.filter(m=>!m.included).every(m=>m.missingTreatment==='exclude'))
 const allExcluded=row(await preview({...excluded,measures:[excluded.measures[0]],segments:[]}),otherId)
 assert.equal(allExcluded.score,null,'An entirely excluded account stays unknown')
 assert.equal(allExcluded.band,'unknown')
 for(const invalid of [
  {...config,measures:[{...config.measures[0],field:'health.score'}]},
  {...config,measures:[{...config.measures[0],weight:0}]},
  {...config,measures:[{...config.measures[0],min:100,max:0}]},
  {...config,bands:{riskBelow:80,healthyAt:20}}
 ])await status('/scorecards/preview','POST',{config:invalid},400)
 const published=await api('/scorecards/publish','POST',{revision:initial.revision,config})
 close(row(published).score,expected,'Publication calculates the reviewed inputs')
 const firstState=await read(),firstVersion=firstState.versions.find(v=>v.id===published.versionId)
 assert.deepEqual(firstVersion.config,config)
 assert.ok(Date.parse(firstVersion.publishedAt));assert.match(firstVersion.publishedBy,/^person:/)
 assert.deepEqual(firstVersion.dependencies.segments.map(s=>s.id),[segment.id])
 assert.equal(new Set(firstVersion.dependencies.fields.map(f=>f.kind)).size,5)
 const auditQuery=new URLSearchParams({action:'health.scorecard-published',subject:'scorecard:'+published.versionId,actor:firstVersion.publishedBy})
 const audit=(await api('/audit?'+auditQuery)).entries
 assert.equal(audit.length,1,'Publication has one filterable audit entry')
 assert.equal(audit[0].subject,'scorecard:'+published.versionId)
 assert.equal(audit[0].actor,firstVersion.publishedBy,'Audit uses the opaque staff identity')
 assert.ok(Date.parse(audit[0].occurredAt))
 await status('/audit?'+auditQuery,'GET',undefined,403,{cookie:member})
 const historyId=firstState.history.find(h=>h.accountId===accountId&&h.versionId===published.versionId).id
 const retained=await api('/scorecards/preview','POST',{historyId})
 assert.equal(retained.historical,true);assert.equal(retained.versionId,published.versionId)
 close(row(retained).score,expected,'Retained calculation starts with the published value')
 const health=(await api('/accounts/'+accountId+'/health')).health
 close(health.score,expected,'Public account health exposes the numeric score')
 assert.equal(health.scorecard.versionId,published.versionId)
 assert.ok(Date.parse(health.recalculatedAt))
 const segmentInput=(name,conditions,extras={})=>({name,mode:'dynamic',accountIds:[],rules:{match:'all',conditions},tier:null,stage:null,playbook:null,...extras})
 const thresholdInput=segmentInput('Numeric health threshold',[{field:'id',op:'eq',value:accountId},{field:'health.score',op:'gt',value:expected+.125}])
 const threshold=await api('/segments','POST',thresholdInput)
 const members=async id=>(await api('/segments/'+id+'/report')).accounts.map(a=>a.accountId)
 assert.deepEqual(await members(threshold.id),[])
 await status('/segments','POST',{...thresholdInput,rules:{match:'all',conditions:[{field:'health.score',op:'gte',value:String(expected)}]}},400)
 const feedback={...config,segments:[{segmentId:threshold.id,weights:{custom:3}}]}
 await status('/scorecards/preview','POST',{config:feedback},400)
 await status('/scorecards/publish','POST',{revision:firstState.revision,config:feedback},400)
 await status('/adoption/consumers','POST',{name:'Refuse score feedback into aggregate health',scope:'segment',segmentId:threshold.id,metric:'adoption.current.utilization',op:'lt',value:.5,health:true,alert:false,enabled:true},400)
 let previous=row(await read())
 const changed=async(action,field,value)=>{
  const started=Date.now();await action()
  const current=row(await read())
  assert.ok(Date.now()-started<300000,`${field} is recalculated within five minutes of the source change`)
  assert.equal(current.inputs.values[field],value,`${field} recalculates from its source mutation`)
  assert.ok(Date.parse(current.calculatedAt)>=started&&Date.parse(current.calculatedAt)>=Date.parse(previous.calculatedAt),'Source mutation has a current recalculation timestamp')
  assert.notEqual(current.score,previous.score,`${field} changes the published score`)
  assert.equal(current.versionId,published.versionId,'Source observations do not publish a new configuration')
  previous=current
 }
 await changed(()=>saveCustom(90),'custom.'+fieldKey,90)
 assert.deepEqual(await members(threshold.id),[accountId],'A fractional numeric health predicate enters after recalculation')
 await changed(async()=>{const current=await account();await saveAccount({billing:{...current.billing,allocatedMinor:10000}})},'billing.allocatedMinor',10000)
 await changed(async()=>{const current=await account();await saveAccount({support:{...current.support,openTickets:0}})},'support.openTickets',0)
 await changed(()=>api('/adoption/seats','PUT',{accountId,seats:10,reference:'Customer-confirmed ten-seat license',observedAt:on,staleDays:30}),'adoption.current.utilization',active(accountId)/10)
 await changed(()=>api('/accounts/'+accountId+'/sentiment','POST',{rating:'green',reason:'Customer confirmed the successful review',days:30}),'sentiment.score',100)
 close(previous.score,(100+100+active(accountId)/10*100+90*3+100*2)/8,'All five current source classes contribute after mutation')
 const beforeTick=await read(),tick=Date.parse(row(beforeTick).calculatedAt)+3600000
 await app.scheduled('0 * * * *',tick)
 const afterTick=await read()
 const refreshedAt=Date.parse(row(afterTick).calculatedAt)
 assert.ok(refreshedAt>Date.parse(row(beforeTick).calculatedAt)&&Math.abs(tick-refreshedAt)<=3600000,'The hourly scheduler refreshes the unchanged account within one hour')
 close(row(afterTick).score,previous.score,'An hourly refresh preserves the same weighted observations')
 const supportSnapshot=(await account()).support
 await saveAccount({support:null})
 const missingSupport=row(await read())
 assert.equal(missingSupport.score,null,'Removing a real support source makes the required score unknown')
 assert.equal(missingSupport.band,'unknown')
 assert.ok(missingSupport.breakdown.find(m=>m.key==='support').sources.every(s=>s.freshness==='missing'))
 assert.equal((await api('/accounts/'+accountId+'/health')).health.score,null)
 const supportExcluded={...config,measures:config.measures.map(m=>m.key==='support'?{...m,missing:'exclude'}:m)}
 const excludePublished=await api('/scorecards/publish','POST',{revision:(await read()).revision,config:supportExcluded})
 const withoutSupport=(100+active(accountId)/10*100+90*3+100*2)/7
 close(row(excludePublished).score,withoutSupport,'Published exclusion reweights the four remaining real sources')
 const omitted=row(excludePublished).breakdown.find(m=>m.key==='support')
 assert.equal(omitted.included,false);assert.equal(omitted.missingTreatment,'exclude')
 close((await api('/accounts/'+accountId+'/health')).health.score,withoutSupport,'Public health reflects the published exclusion policy')
 await saveAccount({support:supportSnapshot})
 close(row(await read()).score,previous.score,'Restoring the support snapshot rejoins the weighted calculation')
 await api('/scorecards/publish','POST',{revision:(await read()).revision,config})
 assert.deepEqual(await api('/scorecards/preview','POST',{historyId}),retained,'Retained preview preserves values, evidence, account revision and calculation timestamp after source changes')
 const liveOldVersion=await api('/scorecards/preview','POST',{versionId:published.versionId})
 assert.equal(liveOldVersion.historical,false)
 close(row(liveOldVersion).score,previous.score,'Selecting an old version alone uses current source inputs')
 const whatIf=await api('/scorecards/preview','POST',{historyId,config:{...config,segments:[]}})
 close(row(whatIf).score,(25+60+active(accountId)/20*100+60+50)/5,'A retained-input what-if changes weights without refreshing sources')
 assert.deepEqual(row(whatIf).inputs,row(retained).inputs)
 // A selected tier segment is valid until an upstream classification producer
 // tries to depend on final health, or closes a tier/stage dependency cycle.
 const producerInput=segmentInput('Source-driven tier',[{field:'id',op:'eq',value:accountId}],{tier:'high-touch'})
 const producer=await api('/segments','POST',producerInput)
 const classified=await api('/segments','POST',segmentInput('Tier-specific score weights',[{field:'tier',op:'eq',value:'high-touch'}],{stage:'adoption'}))
 const classifiedConfig={...config,segments:[{segmentId:classified.id,weights:{custom:3,sentiment:2}}]}
 const second=await api('/scorecards/publish','POST',{revision:(await read()).revision,config:classifiedConfig})
 assert.equal(row(second).selectedSegment.id,classified.id)
 const producerRow=(await api('/segments')).segments.find(s=>s.id===producer.id)
 const editProducer=conditions=>({...producerInput,id:producer.id,revision:producerRow.revision,rules:{match:'all',conditions}})
 await status('/segments','POST',editProducer([{field:'health.score',op:'gt',value:0}]),400)
 await status('/segments','POST',editProducer([{field:'health.status',op:'eq',value:'healthy'}]),400)
 await status('/segments','POST',editProducer([{field:'stage',op:'eq',value:'adoption'}]),400)
 const unmodified=(await api('/segments')).segments.find(s=>s.id===producer.id)
 assert.equal(unmodified.revision,producerRow.revision,'Transitive health and classification-cycle refusals are atomic')
 assert.deepEqual(unmodified.rules,producerRow.rules)
 const beforeFinal=await read()
 await status('/scorecards/publish','POST',{revision:initial.revision,config},409)
 assert.equal((await read()).versions.length,beforeFinal.versions.length,'Stale publication creates no version')
 const final=await api('/scorecards/publish','POST',{revision:beforeFinal.revision,config})
 await status('/scorecards/publish','POST',{revision:beforeFinal.revision,config},409)
 const end=await read()
 assert.equal(end.published.id,final.versionId)
 assert.deepEqual(end.published.config,config)
 assert.deepEqual(end.versions.find(v=>v.id===published.versionId),firstVersion,'Republishing retains the immutable version and dependency image')
 assert.ok(end.versions.some(v=>v.id===second.versionId))
 assert.ok(end.history.some(h=>h.id===historyId))
 assert.deepEqual(await api('/scorecards/preview','POST',{historyId}),retained,'Publication retains the earlier calculation snapshot')
 const todayHealth=(await api('/accounts/'+accountId+'/health')).health
 const expiry=todayHealth.sentiment.expiresOn,nextDay=new Date(Date.parse(expiry)+86400000).toISOString().slice(0,10)
 const throughExpiry=(await api('/accounts/'+accountId+'/health?on='+expiry)).health
 close(throughExpiry.score,todayHealth.score,'Sentiment contributes through its inclusive expiry date')
 assert.equal(throughExpiry.sentiment.expired,false)
 const expired=(await api('/accounts/'+accountId+'/health?on='+nextDay)).health
 assert.equal(expired.sentiment.expired,true)
 assert.equal(expired.score,null,'Future projection treats expired sentiment as a missing required measure')
 assert.equal(expired.status,'unknown')
 const expiredMeasure=expired.scorecard.breakdown.find(m=>m.key==='sentiment')
 assert.equal(expiredMeasure.value,null);assert.equal(expiredMeasure.included,false);assert.equal(expiredMeasure.missingTreatment,'unknown')
 assert.ok(expiredMeasure.sources.every(s=>s.freshness==='stale'))
 close(row(await read()).score,todayHealth.score,'A future projection never changes the current calculated score')
 const historyBefore=end.history
 await preview({...config,name:'Unpublished review'})
 const afterDraft=await read()
 assert.equal(afterDraft.revision,end.revision)
 assert.deepEqual(afterDraft.versions,end.versions)
 assert.deepEqual(afterDraft.history,historyBefore,'Preview on an already published card never appends calculation history')
 console.log('Weighted health: five input classes, segment weights, preview isolation, five-minute source recalculations, hourly refresh, missing/excluded sources, sentiment expiry, immutable versions/snapshots, numeric segments, authority, audit, stale publish and transitive dependency refusals passed.')
 return {config,segment,historyId,versionId:final.versionId,accountId,fieldKey,firstVersionId:published.versionId}
}
