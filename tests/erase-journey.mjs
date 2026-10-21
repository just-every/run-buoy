import assert from 'node:assert/strict'

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
  const userId='synthetic-buoy-'+(270+index),events=['one','unreviewed'].map((groupId,i)=>({type:'event',event:'Privacy product use',messageId:'synthetic-buoy-'+(280+index*10+i),userId,groupId,properties:{customerName:name}}))
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
  const card=await json(await call('/scorecards'))
  await json(await call('/scorecards/publish','POST',{revision:card.revision,config:{name:'Privacy survey health',measures:[{key:'nps',name:'Received NPS',field:'survey.nps',min:-100,max:100,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]}}),201)
  const beforeCards=await json(await call('/scorecards')),oldHistory=[],unrelatedHistory=[]
  for(const h of beforeCards.history.filter(h=>h.accountId===base)){const retained=await json(await call('/scorecards/preview','POST',{historyId:h.id}));(retained.accounts[0].inputs.sourcePersonIds.includes(target.id)?oldHistory:unrelatedHistory).push(h.id)}
  let current=await person(target.id),url='/customer-people/'+target.id+'/privacy/',body={confirmation:name,revision:current.revision}
  for(const options of [{cookie:undefined},{cookie:member},{cookie:admin},{cookie:undefined,token:agent.token},{headers:{origin:'https://foreign.invalid'}}]){
   for(const action of ['export','erase'])assert.equal((await call(url+action,'POST',body,options)).status,options.cookie===undefined&&!options.token&&!options.headers?401:403)
  }
  assert.equal((await call(url+'erase','POST',{...body,confirmation:'wrong'})).status,400)
  assert.equal((await call(url+'export','POST',{...body,revision:'stale'})).status,409)
  const holders={revision:current.revision,holders:[{system:'Salesforce',reference:'Owner-reviewed CRM inventory'},{system:'Zendesk',reference:'Owner-reviewed support inventory'}]}
  assert.equal((await call(url+'holders','PUT',holders,{cookie:admin})).status,403)
  await json(await call(url+'holders','PUT',holders))
  assert.equal((await call(url+'erase','POST',body)).status,409,'Holder change invalidates old confirmation revision')
  current=await person(target.id);body.revision=current.revision
  assert.equal((await json(await call(url.slice(0,-1)))).holders.length,2)
  const exported=await json(await call(url+'export','POST',body))
  assert.equal(exported.format,'buoy-customer-export/v1');assert.equal(exported.records.person[0].name,name)
  assert.equal(exported.records.memberships.length,2);assert.equal(exported.records.usageEvents.length,3)
  assert.equal(exported.records.surveyResponses.length,1);assert.equal(exported.records.inappReceipts.length,1)
  assert.equal(exported.records.licenses.length,1);assert.ok(exported.records.licenseHistory.length)
  assert.ok(exported.records.fieldHistory.length);assert.equal(exported.records.declaredHolders.length,1)
  assert.deepEqual(await person(target.id),current,'Export retains the current customer record')
  const erased=await json(await call(url+'erase','POST',body))
  assert.equal(erased.receipt.subject,exported.receipt.subject)
  for(const system of ['Salesforce','Zendesk'])assert.ok(erased.receipt.externalHolders.includes(system))
  assert.equal((await call(url+'erase','POST',body)).status,404)
  const remaining=await people();assert.ok(!remaining.records.some(p=>p.id===target.id));assert.ok(remaining.records.some(p=>p.id===other.id))
  assert.equal(remaining.records.find(p=>p.id===other.id).values.privacy_total,3,'Current portfolio aggregate uses surviving people once across memberships')
  const state=await json(await call('/state'));assert.ok(ids.every(id=>state.accounts.some(a=>a.id===id)),'Both accounts remain')
  const survey=(await json(await call('/surveys'))).accounts.find(a=>a.accountId===base)
  assert.equal(survey.nps,100);assert.equal(survey.npsResponses,1)
  const eventsAfter=await json(await call('/usage/events?sourceId='+source.id))
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
