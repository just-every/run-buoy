import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'

// Related record journeys use the same public verified-request and review doors.
export async function privacyCommand(api,person,action){
 const path='/customer-people/'+person.id+'/privacy/'
 const body={revision:person.revision,confirmation:person.name,request:{verificationMethod:'verified-offline',receivedDate:new Date().toISOString().slice(0,10),requesterReference:randomUUID()}}
 if(action==='erase'){
  const preview=await api(path+'preview','POST',{revision:person.revision,emails:[]})
  assert.equal(preview.matches.length,0,'The related-record fixture has no unlinked text to redact')
  Object.assign(body,{fingerprint:preview.fingerprint,emails:[],redactions:[]})
 }
 return api(path+action,'POST',body)
}

export async function eraseJourney({call,json,request,cookie,member,signIn,account,dispatch,origin}){
 const base='synthetic-buoy-260',ids=[base,base+'-other']
 for(const id of ids)await json(await call('/accounts','POST',{...account(id),name:id}),201)
 const other=await json(await call('/customer-people','POST',{kind:'user',name:'synthetic-buoy-261',accountIds:ids,source:'Reviewed customer directory'}),201)
 await json(await call('/customer-fields','POST',{key:'privacy_units',label:'Privacy test units',type:'number'}),201)
 await json(await call('/customer-fields','POST',{key:'privacy_total',label:'Current customer total',type:'formula',formula:'sum(custom.privacy_units)'}),201)
 const people=async()=>json(await call('/customer-people')),person=async id=>(await people()).records.find(p=>p.id===id)
 await json(await call('/customer-people/'+other.id+'/fields','PUT',{revision:(await person(other.id)).revision,values:{privacy_units:3},source:'Reviewed units'}))
 const accountRevision=async()=>(await json(await call('/state'))).accounts.find(a=>a.id===base).revision
 const source=await json(await call('/usage/sources','POST',{name:'synthetic-buoy-262',kind:'native',reference:'Reviewed customer product relay',staleDays:30}),201)
 const credential=await json(await call('/usage/sources/'+source.id+'/credentials','POST',{label:'synthetic-buoy-263'}),201)
 const inapp=await json(await call('/inapp/credentials','POST',{sourceId:source.id,label:'synthetic-buoy-264'}),201)
 const intake=async(events)=>dispatch(new Request(origin+'/api/buoy/usage/intake/'+source.id,{method:'POST',headers:{authorization:'Bearer '+credential.secret,'content-type':'application/json'},body:JSON.stringify({batch:events})}))
 const inappCall=(verb,body)=>dispatch(new Request(origin+'/api/buoy/inapp/'+verb+'/'+source.id,{method:'POST',headers:{authorization:'Bearer '+inapp.secret,'content-type':'application/json'},body:JSON.stringify(body)}))
 const segment=await json(await call('/segments','POST',{name:'Privacy fixture customers',mode:'static',accountIds:[base],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null}),201)
 const campaign=await json(await call('/inapp/campaigns','POST',{sourceId:source.id,segmentId:segment.id,kind:'announcement',title:'Customer product notice',body:'Reviewed customer product notice',steps:[],maxViews:5,windowHours:24,enabled:true}),201)
 // Refuse non-owner staff as well as agents and cross-origin writes.
 await json(await request('/auth/invite',{method:'POST',cookie,body:{email:'privacy-admin@example.test',displayName:'Privacy admin',role:'admin'}}),202)
 const admin=await signIn('privacy-admin@example.test'),agent=await json(await call('/agent-tokens','POST',{label:'Privacy refusal fixture'}),201)
 for(const [index,kind] of ['contact','user'].entries()){
  const name='synthetic-buoy-'+(265+index),target=await json(await call('/customer-people','POST',{kind,name,accountIds:ids,source:'Reviewed directory'}),201)
  await json(await call('/customer-people/'+target.id+'/fields','PUT',{revision:(await person(target.id)).revision,values:{privacy_units:7},source:'Customer-confirmed units'}))
  const userId='synthetic-buoy-'+(270+index),events=['one','unreviewed'].map((groupId,i)=>({type:'event',event:'Privacy product use',messageId:'synthetic-buoy-'+(280+index*10+i),userId,groupId,properties:{customerName:name,email:'synthetic-buoy-'+index+'@example.test',note:'Contact '+name+' now',longer:name+'son'}}))
  await json(await intake(events),202)
  await json(await intake([{...events[0],userId:'synthetic-buoy-299',messageId:'synthetic-buoy-'+(300+index)}]),202)
  const mapping={sourceId:source.id,userId,groupId:'one',accountId:base,personId:target.id}
  const preview=await json(await call('/usage/mappings/preview','POST',mapping))
  await json(await call('/usage/mappings','POST',{...mapping,fingerprint:preview.fingerprint}),201)
  const delivered=await json(await inappCall('deliver',{userId,groupId:'one'}))
  assert.equal(delivered.messages.length,1)
  await json(await inappCall('receipts',{userId,groupId:'one',campaignId:campaign.id,deliveryId:delivered.messages[0].deliveryId,kind:'view',messageId:'synthetic-buoy-'+(310+index)}),202)
  for(const [respondent,value] of [[target.id,0],[other.id,10]])await json(await call('/surveys/responses','POST',{accountId:base,personId:respondent,surveyName:'Privacy survey',kind:'nps',value,observedAt:new Date(Date.now()-1000).toISOString(),reference:'Received privacy fixture survey',sourceResponseId:'synthetic-buoy-'+(320+index)+'-'+respondent,accountRevision:await accountRevision()}),201)
  await json(await call('/adoption/person-licenses','PUT',{accountId:base,personId:target.id,licensed:true,reference:'Confirmed customer license',observedAt:new Date().toISOString().slice(0,10)}))
  const otherAccount=(await json(await call('/state'))).accounts.find(a=>a.id===ids[1])
  await json(await call('/surveys/responses','POST',{accountId:ids[1],personId:other.id,surveyName:'Separate account health',kind:'nps',value:0,observedAt:new Date(Date.now()-1000).toISOString(),reference:'Received separate account survey',sourceResponseId:'synthetic-buoy-native-'+index,accountRevision:otherAccount.revision}),201)
  const nativeSource={...account(ids[1]),name:ids[1],renewalEvidence:'Terms reviewed by '+name,billing:{...account(ids[1]).billing,reference:'Invoice reviewed by '+name},support:{...account(ids[1]).support,reference:'Case opened by '+name}}
  await json(await call('/accounts/'+ids[1],'PUT',{...nativeSource,revision:(await json(await call('/state'))).accounts.find(a=>a.id===ids[1]).revision}))
  // Create native narrative records through their ordinary public doors.
  const taskProposal=await json(await call('/proposals','POST',{accountId:ids[1],kind:'playbook',payload:{title:'Follow up with '+name,dueDate:'2027-03-01'}}),201)
  await json(await call('/proposals/'+taskProposal.id+'/approve','POST',{}))
  const nativeTask=(await json(await call('/state'))).tasks.find(t=>t.proposalId===taskProposal.id)
  await json(await call('/tasks/'+nativeTask.id+'/complete','POST',{outcome:'Resolved for '+name,evidence:'Confirmed by synthetic-buoy-'+index+'@example.test'}))
  const renewal=await json(await call('/proposals','POST',{accountId:ids[1],kind:'renewal',payload:{outcome:'renewed',reason:'Confirmed with '+name,evidence:'Letter from '+name}}),201)
  await json(await call('/proposals/'+renewal.id+'/approve','POST',{}))
  await json(await call('/accounts/'+ids[1]+'/sentiment','POST',{rating:'amber',reason:'Spoke with '+name,days:30}),201)
  const staff=(await json(await call('/state'))).people
  await json(await call('/accounts/'+ids[1]+'/owner','PUT',{ownerId:staff.find(p=>p.role===(index===0?'owner':'admin')).id,note:'Handover discussed with '+name}))
  const card=await json(await call('/scorecards'))
  await json(await call('/scorecards/publish','POST',{revision:card.revision,config:{name:'Privacy survey health',measures:[{key:'nps',name:'Received NPS',field:'survey.nps',min:-100,max:100,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]}}),201)
  const beforeCards=await json(await call('/scorecards')),oldHistory=[],unrelatedHistory=[]
  for(const h of beforeCards.history.filter(h=>h.accountId===base)){const retained=await json(await call('/scorecards/preview','POST',{historyId:h.id}));(retained.accounts[0].inputs.sourcePersonIds.includes(target.id)?oldHistory:unrelatedHistory).push(h.id)}
  let current=await person(target.id),url='/customer-people/'+target.id+'/privacy/',body={confirmation:name,revision:current.revision,request:{verificationMethod:'verified-offline',receivedDate:new Date().toISOString().slice(0,10),requesterReference:randomUUID()}}
  for(const options of [{cookie:undefined},{cookie:member},{cookie:admin},{cookie:undefined,token:agent.token},{headers:{origin:'https://foreign.invalid'}}]){
   for(const action of ['export','erase','preview','hold'])assert.equal((await call(url+action,'POST',body,options)).status,options.cookie===undefined&&!options.token&&!options.headers?401:403)
  }
  assert.equal((await call(url+'erase','POST',{...body,confirmation:'wrong'})).status,400)
  assert.equal((await call(url+'export','POST',{...body,revision:'stale'})).status,409)
  const holders={revision:current.revision,holders:[{system:'Salesforce',reference:'Owner-reviewed CRM inventory'},{system:'Zendesk',reference:'Owner-reviewed support inventory'}]}
  assert.equal((await call(url+'holders','PUT',holders,{cookie:admin})).status,403)
  await json(await call(url+'holders','PUT',holders))
  assert.equal((await call(url+'erase','POST',body)).status,409,'Holder change invalidates old confirmation revision')
  current=await person(target.id);body.revision=current.revision
  assert.equal((await json(await call(url.slice(0,-1)))).holders.length,2)
  assert.equal((await call(url+'export','POST',{...body,request:undefined})).status,400,'Name confirmation alone is not requester verification')
  assert.equal((await call(url+'export','POST',{...body,request:{...body.request,requesterReference:name}})).status,400,'The request reference cannot contain customer narrative')
  assert.equal((await call(url+'export','POST',{...body,request:{...body.request,receivedDate:'2999-01-01'}})).status,400)
  const exported=await json(await call(url+'export','POST',body))
  assert.equal(exported.format,'buoy-customer-export/v1');assert.equal(exported.records.person[0].name,name)
  assert.equal(exported.records.memberships.length,2);assert.equal(exported.records.usageEvents.length,3)
  assert.equal(exported.records.surveyResponses.length,1);assert.equal(exported.records.inappReceipts.length,1)
  assert.equal(exported.records.licenses.length,1);assert.ok(exported.records.licenseHistory.length)
  assert.ok(exported.records.fieldHistory.length);assert.equal(exported.records.declaredHolders.length,1)
  assert.deepEqual(await person(target.id),current,'Export retains the current customer record')
  const emails=['synthetic-buoy-'+index+'@example.test']
  const previewBody=()=>({revision:body.revision,emails})
  let discovery=await json(await call(url+'preview','POST',previewBody()))
  assert.equal(discovery.matches.filter(m=>m.recordKind==='usage').length,3,'Name, email and exact phrase in the surviving event are previewed; longer words are untouched')
  assert.equal(discovery.matches.length,22,'Ten native narrative fields and nine source references join the three surviving usage matches')
  assert.equal(discovery.matches.filter(m=>m.recordKind==='account-source').length,3)
  assert.equal(discovery.matches.filter(m=>m.recordKind==='proposal-source').length,6)
  assert.deepEqual([...new Set(discovery.matches.map(m=>m.recordKind))].sort(),['account-source','decision','handover','proposal','proposal-source','sentiment','task','usage'])
  assert.ok(exported.records.freeTextMatches.some(m=>m.recordKind==='task'&&m.before.includes(name)),'Customer export includes discovered native text without changing it')
  assert.ok(discovery.matches.some(m=>m.before===name&&m.after==='[redacted]'))
  assert.ok(discovery.matches.some(m=>m.before===emails[0]))
  assert.ok((await json(await call('/usage/events?sourceId='+source.id))).events.some(e=>JSON.stringify(e).includes(name)),'Preview changes nothing')
  assert.equal((await call(url+'erase','POST',{...body,emails,fingerprint:'stale',redactions:[]})).status,409)
  assert.equal((await call(url+'erase','POST',{...body,emails,fingerprint:discovery.fingerprint,redactions:['invented']})).status,400)
  if(index===0){
   const hold={revision:body.revision,confirmation:name,operation:'set',reason:'legal-obligation'}
   assert.equal((await call(url+'hold','POST',hold,{cookie:admin})).status,403)
   await json(await call(url+'hold','POST',hold))
   body.revision=(await person(target.id)).revision
   const heldDiscovery=await json(await call(url+'preview','POST',previewBody()))
   assert.equal(heldDiscovery.held,true)
   assert.ok(heldDiscovery.matches.filter(m=>m.recordKind!=='usage').every(m=>m.held),'Native notes on held accounts cannot be selected')
   const nativeMatch=heldDiscovery.matches.find(m=>m.recordKind==='task')
   assert.equal((await call(url+'erase','POST',{...body,emails,fingerprint:heldDiscovery.fingerprint,redactions:[nativeMatch.id]})).status,409)
   const held=await json(await call(url+'erase','POST',{...body,emails,fingerprint:heldDiscovery.fingerprint,redactions:[]}))
   assert.equal(held.receipt.outcome,'held');assert.equal(held.receipt.retained.person,1)
   assert.equal(held.receipt.retained.usageEvents,3);assert.ok(await person(target.id))
   assert.equal((await call('/accounts/'+base,'DELETE',{confirmation:base})).status,409,'Other deletion doors cannot discard held records')
   for(const units of [9,7]){
    await json(await call('/customer-people/'+target.id+'/fields','PUT',{revision:(await person(target.id)).revision,values:{privacy_units:units},source:'Updated evidence during hold'}))
   }
   for(const reference of ['Held intermediate invoice note',nativeSource.billing.reference]){
    await json(await call('/accounts/'+ids[1],'PUT',{...nativeSource,billing:{...nativeSource.billing,reference},revision:(await json(await call('/state'))).accounts.find(a=>a.id===ids[1]).revision}))
   }
   body.revision=(await person(target.id)).revision
   const heldExport=await json(await call(url+'export','POST',body));assert.equal(JSON.parse(heldExport.records.hold[0].snapshot).person[0].name,name)
   const versions=heldExport.records.heldVersions
   assert.ok(versions.some(v=>v.record_kind==='buoy_accounts'&&JSON.parse(JSON.parse(v.document).document).billing.reference==='Held intermediate invoice note'),'Hold custody retains intermediate account source evidence')
   assert.ok(versions.some(v=>v.record_kind==='buoy_customer_values'&&JSON.parse(JSON.parse(v.document).document).privacy_units===9),'Hold export retains the intermediate value after the live value changes back')
   assert.equal(heldExport.records.manualFields.map(v=>JSON.parse(v.document))[0].privacy_units,7)
   assert.ok(versions.every(v=>v.person_id===target.id&&Date.parse(v.captured_at)),'Retained versions identify the held subject and capture time')
   assert.equal((await call(url+'hold','POST',{...hold,revision:body.revision,operation:'release'},{cookie:admin})).status,403)
   await json(await call(url+'hold','POST',{...hold,revision:body.revision,operation:'release',reason:'review-completed'}))
   body.revision=(await person(target.id)).revision
   assert.equal((await json(await call(url+'export','POST',body))).records.heldVersions.length,0,'Explicit release clears the held versions before erasure')
   assert.equal((await call(url+'erase','POST',{...body,emails,fingerprint:heldDiscovery.fingerprint,redactions:[]})).status,409,'Hold release invalidates the old review')
   discovery=await json(await call(url+'preview','POST',previewBody()))
  }
  if(index===1){
   const otherHold={revision:(await person(other.id)).revision,confirmation:(await person(other.id)).name,operation:'set',reason:'legal-obligation'}
   await json(await call('/customer-people/'+other.id+'/privacy/hold','POST',otherHold))
   const otherHeldPreview=await json(await call(url+'preview','POST',previewBody()))
   assert.equal(otherHeldPreview.held,false,'Another customer hold does not implicitly hold the requested customer')
   const blocked=otherHeldPreview.matches.find(m=>m.recordKind==='task')
   assert.equal(blocked.held,true,'A different held customer protects the shared account narrative')
   assert.equal((await call(url+'erase','POST',{...body,emails,fingerprint:otherHeldPreview.fingerprint,redactions:[blocked.id]})).status,400,'A shared held narrative cannot be selected for redaction')
   await json(await call('/customer-people/'+other.id+'/privacy/hold','POST',{...otherHold,revision:(await person(other.id)).revision,operation:'release',reason:'review-completed'}))
   assert.equal((await call(url+'erase','POST',{...body,emails,fingerprint:otherHeldPreview.fingerprint,redactions:[]})).status,409,'Another customer hold release also invalidates the preview')
   discovery=await json(await call(url+'preview','POST',previewBody()))
  }
  const stalePreview=discovery
  await json(await call('/accounts/'+ids[1]+'/sentiment','POST',{rating:'amber',reason:'Later conversation with '+name,days:30}),201)
  assert.equal((await call(url+'erase','POST',{...body,emails,fingerprint:stalePreview.fingerprint,redactions:[]})).status,409,'A new native note invalidates the entire reviewed preview')
  discovery=await json(await call(url+'preview','POST',previewBody()))
  const pending=await json(await call('/proposals','POST',{accountId:ids[1],kind:'renewal',payload:{outcome:'deferred',reason:'Unrelated pending work',evidence:'Unrelated review'}}),201)
  discovery=await json(await call(url+'preview','POST',previewBody()))
  const erased=await json(await call(url+'erase','POST',{...body,emails,fingerprint:discovery.fingerprint,redactions:discovery.matches.filter(m=>!m.held).map(m=>m.id)}))
  assert.equal(erased.receipt.redacted,26);
  assert.equal((await call('/proposals/'+pending.id+'/approve','POST',{})).status,409,'Native redaction withdraws stale approval evidence')
  const activity=await json(await call('/accounts/'+ids[1]+'/activity?limit=200'))
  assert.ok(!JSON.stringify(activity).includes(name),'Native activity no longer exposes selected personal narratives')
  const nativeState=await json(await call('/state'))
  assert.equal(nativeState.tasks.find(t=>t.id===nativeTask.id).title,'Follow up with [redacted]')
  const nativeAfter=nativeState.accounts.find(a=>a.id===ids[1])
  assert.deepEqual(nativeAfter.billing,{...nativeSource.billing,reference:'Invoice reviewed by [redacted]'},'Money and observation dates survive narrative redaction unchanged')
  assert.deepEqual(nativeAfter.support,{...nativeSource.support,reference:'Case opened by [redacted]'},'Support quantities survive narrative redaction unchanged')
  assert.equal(nativeAfter.renewalEvidence,'Terms reviewed by [redacted]')
  assert.equal(nativeAfter.renewalDate,nativeSource.renewalDate)
  assert.ok(!JSON.stringify(nativeState.proposals.filter(p=>[taskProposal.id,renewal.id].includes(p.id))).includes(name))
  assert.equal(erased.receipt.unreviewedMatches,0)
  const requests=(await json(await call('/privacy/requests'))).requests
  assert.deepEqual(requests.find(r=>r.id===erased.receipt.id),{id:erased.receipt.id,subject:erased.receipt.subject,...body.request})
  assert.equal((await call('/privacy/requests','GET',undefined,{cookie:admin})).status,403)
  assert.ok(!JSON.stringify(erased.receipt).includes(body.request.requesterReference),'Verification reference is separate from the minimal receipt')
  assert.equal(erased.receipt.subject,exported.receipt.subject)
  for(const system of ['Salesforce','Zendesk'])assert.ok(erased.receipt.externalHolders.includes(system))
  assert.equal((await call(url+'erase','POST',body)).status,404)
  const remaining=await people();assert.ok(!remaining.records.some(p=>p.id===target.id));assert.ok(remaining.records.some(p=>p.id===other.id))
  assert.equal(remaining.records.find(p=>p.id===other.id).values.privacy_total,3,'Current portfolio aggregate uses surviving people once across memberships')
  const state=await json(await call('/state'));assert.ok(ids.every(id=>state.accounts.some(a=>a.id===id)),'Both accounts remain')
  const survey=(await json(await call('/surveys'))).accounts.find(a=>a.accountId===base)
  assert.equal(survey.nps,100);assert.equal(survey.npsResponses,1)
  const eventsAfter=await json(await call('/usage/events?sourceId='+source.id))
  const survivor=eventsAfter.events.find(e=>e.userId==='synthetic-buoy-299'&&e.messageId==='synthetic-buoy-'+(300+index))
  assert.ok(survivor);assert.ok(JSON.stringify(survivor).includes('[redacted]'));assert.ok(!JSON.stringify(survivor).includes(emails[0]));assert.ok(JSON.stringify(survivor).includes(name+'son'),'Longer word remains unchanged')
  assert.ok(!eventsAfter.events.some(e=>e.userId===userId));assert.ok(eventsAfter.events.some(e=>e.userId==='synthetic-buoy-299'))
  assert.equal((await intake([{...events[0],groupId:'new-group',messageId:'synthetic-buoy-'+(340+index)}])).status,409,'Erased source/user cannot return as another group')
  assert.equal((await inappCall('deliver',{userId,groupId:'one'})).status,409)
  assert.equal((await inappCall('receipts',{userId,groupId:'one',campaignId:campaign.id,kind:'view',messageId:'synthetic-buoy-'+(350+index)})).status,409)
  const cards=await json(await call('/scorecards'))
  assert.ok(oldHistory.length);assert.ok(!cards.history.some(h=>oldHistory.includes(h.id)),'Retained score inputs with this source person are erased')
  assert.ok(unrelatedHistory.every(id=>cards.history.some(h=>h.id===id)),'Unrelated historical score inputs remain')
  assert.ok(cards.accounts.find(a=>a.accountId===base).score>beforeCards.accounts.find(a=>a.accountId===base).score)
  const audit=(await json(await call('/audit?subject='+erased.receipt.subject))).entries
  for(const action of ['customer.exported','customer.erased','customer.holders-recorded','customer-person.saved'])assert.ok(audit.some(e=>e.action===action))
  assert.doesNotMatch(JSON.stringify(audit),new RegExp(name+'|'+userId))
  for(const path of ['/customer-people','/surveys','/usage','/scorecards','/privacy/receipts','/audit'])assert.ok(!(JSON.stringify(await json(await call(path))).includes(name)),path+' no longer names the erased person')
  const page=await (await request('/app/customer-people',{cookie})).text();assert.match(page,/Customer erased/);assert.match(page,/Salesforce/);assert.ok(!page.includes(name))
 }
 await json(await call('/agent-tokens/'+agent.id,'DELETE'))
 for(const id of ids)await json(await call('/accounts/'+id,'DELETE',{confirmation:id}))
}
