import assert from 'node:assert/strict'

// Staff-recorded evidence only: these doors do not send or deliver surveys.
export async function surveyScorecards(app,fixture,member,healthResult,revenueResult){
 const {api,accounts}=fixture,accountId=accounts[0].id,otherId=accounts[1].id,on=new Date().toISOString().slice(0,10)
 const base=Date.now()-3600000,instant=seconds=>new Date(base+seconds*1000).toISOString()
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie:app.cookie,method,body,...options})
 const status=async(path,method,body,expected,options={})=>{const r=await request(path,method,body,options);assert.equal(r.status,expected,`${method} ${path}: ${await r.clone().text()}`);return r}
 const read=()=>api('/surveys'),cards=()=>api('/scorecards'),row=(data,id=accountId)=>{const r=data.accounts.find(a=>a.accountId===id);assert.ok(r);return r}
 const close=(actual,expected,message)=>assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<1e-8,`${message}: ${actual} versus ${expected}`)
 const revision=async()=>(await api('/state')).accounts.find(a=>a.id===accountId).revision
 const people=[]
 for(const name of ['Survey respondent Avery','Survey respondent Morgan','Survey respondent Casey'])people.push(await api('/customer-people','POST',{kind:'contact',name,accountIds:[accountId],source:'Customer-confirmed survey directory'}))
 let sequence=0
 const input=async(personId,kind,value,seconds=++sequence,extras={})=>({accountId,personId,surveyName:'Customer relationship review',kind,value,observedAt:instant(seconds),reference:'Customer-supplied survey response',sourceResponseId:'synthetic-buoy-'+(++sequence),accountRevision:await revision(),...extras})
 const record=async(personId,kind,value,seconds,extras={})=>api('/surveys/responses','POST',await input(personId,kind,value,seconds,extras))
 const empty=row(await read());assert.equal(empty.nps,null);assert.equal(empty.csat,null);assert.equal(empty.npsResponses,0);assert.equal(empty.csatResponses,0)
 const authBody=await input(people[0].id,'nps',0)
 await status('/surveys','GET',undefined,401,{cookie:undefined})
 for(const options of [{cookie:undefined},{cookie:member},{headers:{origin:'https://foreign.invalid'}}])await status('/surveys/responses','POST',authBody,options.cookie===undefined&&!options.headers?401:403,options)
 const agent=await api('/agent-tokens','POST',{label:'Survey response authority probe'})
 try{for(const [path,method,body] of [['/surveys','GET'],['/surveys/responses','POST',authBody]])await status(path,method,body,403,{cookie:undefined,token:agent.token})}finally{await api('/agent-tokens/'+agent.id,'DELETE')}
 for(const change of [{kind:'nps',value:-1},{kind:'nps',value:11},{kind:'csat',value:0},{kind:'csat',value:6},{value:1.5},{value:'8'},{observedAt:new Date(Date.now()+86400000).toISOString()},{observedAt:'2026-02-30T12:00:00Z'}])await status('/surveys/responses','POST',{...authBody,...change},400)
 await status('/surveys/responses','POST',{...authBody,personId:fixture.people.find(p=>p.accountId===otherId).id},409)
 const old=await record(people[2].id,'nps',9,-91*86400)
 assert.equal(row(await read()).nps,null,'An old response is retained without inventing a current score')
 assert.equal(row(await read()).responses.find(r=>r.id===old.response.id).exclusion,'outside-window')
 const firstBody=await input(people[0].id,'nps',0,10),first=await api('/surveys/responses','POST',firstBody)
 const replay=await api('/surveys/responses','POST',firstBody)
 assert.equal(replay.replayed,true);assert.deepEqual(replay.response,first.response,'An exact replay returns the immutable original even after account revision changes')
 await status('/surveys/responses','POST',{...firstBody,value:1},409)
 await status('/surveys/responses','POST',{...firstBody,sourceResponseId:'synthetic-buoy-9000'},409)
 await record(people[1].id,'nps',7,20);await record(people[2].id,'nps',10,30)
 let survey=row(await read());assert.equal(survey.nps,100*(1-1)/3);assert.equal(survey.npsResponses,3,'Passives remain in the NPS denominator')
 for(const [i,value] of [1,4,5].entries())await record(people[i].id,'csat',value,40+i)
 close(row(await read()).csat,(1+4+5)/3,'Independent CSAT arithmetic mean')
 const superseding=await record(people[0].id,'nps',10,100,{surveyName:'Later relationship review'})
 await record(people[0].id,'csat',2,110,{surveyName:'Later satisfaction review'})
 survey=row(await read());close(survey.nps,200/3,'Newest response per person crosses survey names');close(survey.csat,11/3,'Newest satisfaction response replaces the earlier datum')
 assert.equal(survey.responses.find(r=>r.id===first.response.id).exclusion,'superseded');assert.equal(survey.responses.find(r=>r.id===superseding.response.id).window,'current')
 assert.equal(survey.responses.filter(r=>r.kind==='nps'&&r.window==='current').length,3)
 assert.ok((await read()).people.some(p=>p.personId===people[0].id))
 assert.ok((await read()).responses.some(r=>r.id===first.response.id&&r.sourceKind==='staff-recorded'&&r.reference===firstBody.reference),'The account/person timeline retains response provenance')
 const memberData=await (await status('/surveys','GET',undefined,200,{cookie:member})).json()
 assert.deepEqual(row(memberData).responses,survey.responses)
 const audit=(await api('/audit?'+new URLSearchParams({action:'survey.response-recorded',actor:first.response.recordedBy}))).entries
 assert.ok(audit.length>0&&audit.every(a=>a.actor===first.response.recordedBy&&a.subject!==accountId&&Date.parse(a.occurredAt)),'Survey audit retains opaque actor and account aliases')
 const fieldKey='survey_signal',definitions=[
  {key:'survey_points',label:'Survey review points',type:'number'},
  {key:'survey_double',label:'Calculated review points',type:'formula',formula:'custom.survey_points * 2'},
  {key:fieldKey,label:'Customer review signal',type:'text'},
  {key:'survey_plan',label:'Reviewed plan',type:'picklist',options:['Growth','Scale']},
  {key:'survey_modules',label:'Reviewed modules',type:'multi-select',options:['Reports','Exports']},
  {key:'survey_date',label:'Customer review date',type:'date'},
  {key:'survey_flag',label:'Customer review flag',type:'boolean'},
  {key:'survey_money',label:'Customer reviewed commitment',type:'currency'}]
 for(const d of definitions)await api('/fields','POST',d)
 const values={survey_points:24,[fieldKey]:'Committed',survey_plan:'Growth',survey_modules:['Reports','Exports'],survey_date:on,survey_flag:false,survey_money:{currency:'USD',amountMinor:120000}}
 const saveValues=async changes=>{const data=await api('/fields'),a=data.accounts.find(a=>a.id===accountId),manual=Object.fromEntries(data.definitions.filter(d=>d.type!=='formula').map(d=>[d.key,a.values[d.key]]));await api('/accounts/'+accountId+'/fields','PUT',{revision:a.revision,values:{...manual,...values,...changes},source:'Customer-confirmed review field evidence'})}
 await saveValues({})
 const catalog=(await cards()).fields
 for(const [field,type] of [['survey.nps',undefined],['survey.csat',undefined],['custom.survey_points','number'],['custom.survey_double','number'],['custom.'+fieldKey,'text'],['custom.survey_plan','text'],['custom.survey_modules','multi-select'],['custom.survey_date','date'],['custom.survey_flag','boolean'],['custom.survey_money.amountMinor','number'],['custom.survey_money.currency','text']]){const f=catalog.find(f=>f.key===field);assert.ok(f,field);if(type)assert.equal(f.valueType,type)}
 assert.equal(catalog.find(f=>f.key==='custom.survey_double').kind,'calculated')
 const measure=(key,field,min=0,max=100,categoryValues)=>({key,name:key,field,min,max,weight:1,direction:'higher',missing:'unknown',...(categoryValues?{categoryValues}:{})})
 const card=measures=>({name:'Customer survey and review health',measures,bands:{riskBelow:40,healthyAt:75},segments:[]}),preview=config=>api('/scorecards/preview','POST',{config})
 const categorical=[measure('number','custom.survey_points'),measure('calculated','custom.survey_double'),measure('text','custom.'+fieldKey,0,100,{Committed:80,Review:40}),measure('picklist','custom.survey_plan',0,100,{Growth:70}),measure('multi','custom.survey_modules',0,100,{'["Exports","Reports"]':60}),measure('date','custom.survey_date',0,100,{[on]:40}),measure('boolean','custom.survey_flag',0,100,{false:30}),measure('amount','custom.survey_money.amountMinor',0,240000),measure('currency','custom.survey_money.currency',0,100,{USD:20})]
 const allTypes=row(await preview(card(categorical)))
 close(allTypes.score,(24+48+80+70+60+40+30+50+20)/9,'Numeric, calculated and explicitly mapped custom types all contribute independently')
 assert.equal(allTypes.breakdown.find(m=>m.key==='boolean').rawValue,false)
 assert.deepEqual(allTypes.breakdown.find(m=>m.key==='multi').rawValue,['Reports','Exports'])
 for(const m of categorical.filter(m=>m.categoryValues)){const {categoryValues,...unmapped}=m;await status('/scorecards/preview','POST',{config:card([unmapped])},400)}
 await status('/scorecards/preview','POST',{config:card([{...categorical[2],categoryValues:{Committed:'80'}}])},400)
 assert.equal(row(await preview(card([{...categorical[4],categoryValues:{'["Reports","Exports"]':60}}]))).score,null,'Multi-select mappings use the sorted JSON combination exactly')
 const surveySegment={name:'Fractional recorded survey results',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'survey.nps',op:'gt',value:66.6},{field:'survey.csat',op:'gt',value:3.6}]},tier:null,stage:null,playbook:null}
 const segment=await api('/segments','POST',surveySegment)
 assert.deepEqual((await api('/segments/'+segment.id+'/report')).accounts.map(a=>a.accountId),[accountId])
 await status('/segments','POST',{...surveySegment,rules:{match:'all',conditions:[{field:'survey.csat',op:'gte',value:'3.6'}]}},400)
 await api('/accounts/'+accountId+'/sentiment','POST',{rating:'green',reason:'Customer confirmed the review',days:30})
 const config=card([measure('nps','survey.nps',-100,100),measure('csat','survey.csat',1,5),categorical[2],categorical[1],measure('sentiment','sentiment.score')])
 const published=await api('/scorecards/publish','POST',{revision:(await cards()).revision,config})
 const expected=((200/3+100)/2+(11/3-1)/4*100+80+48+100)/5
 close(row(published).score,expected,'Published survey and mapped/calculated review card')
 assert.equal(row(published,otherId).score,null,'No response is unknown rather than zero')
 const existingField=healthResult.fieldKey,otherValue=(await api('/fields')).accounts.find(a=>a.id===otherId).values[existingField]
 const missingCard=card([measure('nps','survey.nps',-100,100),measure('known','custom.'+existingField)])
 assert.equal(row(await preview(missingCard),otherId).score,null)
 close(row(await preview({...missingCard,measures:missingCard.measures.map(m=>m.key==='nps'?{...m,missing:'exclude'}:m)}),otherId).score,otherValue,'Excluded absent survey leaves the independently recorded custom contribution')
 const initialCards=await cards(),historyId=initialCards.history.find(h=>h.accountId===accountId&&h.versionId===published.versionId).id
 const retained=await api('/scorecards/preview','POST',{historyId})
 await saveValues({[fieldKey]:'80'})
 const unknown=row(await cards()),unmapped=unknown.breakdown.find(m=>m.key==='text')
 assert.equal(unknown.score,null);assert.equal(unmapped.rawValue,'80');assert.equal(unmapped.value,null,'Numeric-looking text is never silently coerced')
 const excludingText={...config,measures:config.measures.map(m=>m.key==='text'?{...m,missing:'exclude'}:m)}
 close(row(await preview(excludingText)).score,((200/3+100)/2+(11/3-1)/4*100+48+100)/4,'Unmapped excluded text reweights the remaining real contributions')
 assert.deepEqual(await api('/scorecards/preview','POST',{historyId}),retained,'A historical preview preserves the exact raw string, mapping and source snapshot')
 await saveValues({})
 const started=Date.now(),changed=await record(people[2].id,'nps',0,200,{surveyName:'Current relationship review',reference:'Customer confirmed changed recommendation'})
 const rescored=row(await cards()),changedExpected=(50+(11/3-1)/4*100+80+48+100)/5
 close(rescored.score,changedExpected,'A new actual response recalculates the published score')
 assert.ok(Date.now()-started<300000&&Date.parse(rescored.calculatedAt)>=started,'Survey source changes recalculate within five minutes')
 assert.ok(rescored.breakdown.find(m=>m.key==='nps').sources.some(s=>s.reference===changed.response.reference&&s.details.responses.some(r=>r.id===changed.response.id)))
 const move=async ids=>{const person=(await api('/customer-people')).records.find(p=>p.id===people[2].id);await api('/customer-people/'+person.id,'PUT',{revision:person.revision,kind:person.kind,name:person.name,accountIds:ids,source:'Customer-confirmed respondent membership correction'})}
 await move([otherId]);survey=row(await read())
 close(survey.nps,50,'Removed membership excludes its response from the current NPS denominator');assert.equal(survey.csat,3)
 assert.ok(survey.responses.filter(r=>r.personId===people[2].id).every(r=>r.exclusion==='not-current-member'))
 close(row(await cards()).score,(75+50+80+48+100)/5,'Membership removal recalculates the weighted card')
 await move([accountId]);close(row(await cards()).score,changedExpected,'Restoring explicit membership restores its retained observations')
 assert.equal(row(await read(),otherId).nps,null,'Moving a respondent never moves account-specific response custody')
 assert.deepEqual(await api('/scorecards/preview','POST',{historyId}),retained)
 console.log('Staff-recorded surveys: independent NPS/CSAT, replay/history/window/membership, authority, opaque audit, fractional rules, all custom input types and explicit mappings, retained raw snapshots and source-driven score recalculation passed.')
 return {accountId,otherId,personId:people[2].id,people,config,fieldKey,formulaFieldKey:'survey_double',historyId,versionId:published.versionId,segmentId:segment.id,values,revenueSegmentId:revenueResult.segmentId}
}
