import assert from 'node:assert/strict'

export async function relatedHealth(app,fixture,member,surveyResult){
 const {api,accounts}=fixture,accountId=accounts[0].id,otherId=accounts[1].id,on=new Date().toISOString().slice(0,10)
 const read=()=>api('/customer-people'),cards=()=>api('/scorecards')
 const row=(data,id=accountId)=>{const r=data.accounts.find(a=>a.accountId===id);assert.ok(r);return r}
 const close=(actual,expected,message)=>assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<1e-8,`${message}: ${actual} versus ${expected}`)
 const refused=async config=>{const r=await app.request('/api/buoy/scorecards/preview',{cookie:app.cookie,method:'POST',body:{config}});assert.equal(r.status,400,await r.clone().text())}
 const definitions=[{key:'related_index',label:'Customer person review index',type:'number'},
  {key:'related_category',label:'Customer person review category',type:'picklist',options:['Committed','Review']},
  {key:'related_double',label:'Calculated customer person index',type:'formula',formula:'custom.related_index * 2'},
  {key:'related_money',label:'Customer person commitment',type:'currency'},
  {key:'related_note',label:'Customer person review note',type:'text'},
  {key:'related_flag',label:'Customer person review flag',type:'boolean'},
  {key:'related_date',label:'Customer person review date',type:'date'},
  {key:'related_modules',label:'Customer person modules',type:'multi-select',options:['Reports','Exports']}]
 for(const d of definitions)await api('/customer-fields','POST',d)
 const records=(await read()).records,users=records.filter(p=>p.kind==='user'&&p.accountIds.includes(accountId)),contacts=records.filter(p=>p.kind==='contact'&&p.accountIds.includes(accountId))
 assert.ok(users.length>=2&&contacts.length>=1,'Independent aggregates use actual current customer people')
 const source='Customer-confirmed related-person review'
 const save=async(id,changes)=>{const data=await read(),p=data.records.find(p=>p.id===id),values=Object.fromEntries(data.definitions.filter(d=>d.type!=='formula').map(d=>[d.key,p.values[d.key]]));await api('/customer-people/'+id+'/fields','PUT',{revision:p.revision,values:{...values,...changes},source})}
 const indices=users.map((_,i)=>4*(i+1)),mean=indices.reduce((a,b)=>a+b,0)/indices.length
 for(const [i,p] of users.entries())await save(p.id,{related_index:indices[i],related_category:i%2?'Review':'Committed',related_money:{currency:'USD',amountMinor:(i+1)*1000},related_note:'Ready',related_flag:i%2===0,related_date:on,related_modules:['Reports','Exports']})
 for(const [i,p] of contacts.entries())await save(p.id,{related_index:(i+1)*100})
 const field=(key,kind='user')=>'people.'+kind+'.custom.'+key
 const measure=(key,path,aggregate='mean',mapping)=>({key,name:key,field:path,min:0,max:100,weight:1,direction:'higher',missing:'unknown',aggregate,...(mapping?{categoryValues:mapping}:{})})
 const card=measures=>({name:'Customer people and recorded review health',measures,bands:{riskBelow:40,healthyAt:75},segments:[]}),preview=config=>api('/scorecards/preview','POST',{config})
 const numeric=measure('users',field('related_index')),category=measure('categories',field('related_category'),'mean',{Committed:80,Review:40})
 const catalog=(await cards()).fields
 for(const kind of ['contact','user'])for(const key of ['related_index','related_category','related_double','related_money.amountMinor','related_money.currency','related_note','related_flag','related_date','related_modules'])assert.equal(catalog.find(f=>f.key===field(key,kind))?.related,true,`${kind} ${key} is explicitly related`)
 const {aggregate,...noAggregate}=numeric
 await refused(card([noAggregate]));await refused(card([{...numeric,aggregate:'first'}]))
 await refused(card([{...numeric,field:'custom.survey_double'}]))
 const {categoryValues,...unmappedCategory}=category
 await refused(card([unmappedCategory]))
 const totals={mean,min:Math.min(...indices),max:Math.max(...indices),sum:indices.reduce((a,b)=>a+b,0)}
 for(const aggregate of ['mean','min','max','sum']){
  const result=row(await preview(card([{...numeric,aggregate,max:1000}])))
  close(result.breakdown[0].value,totals[aggregate],`Independent user ${aggregate} before score bounds`)
  close(result.score,totals[aggregate]/10,`Normalized ${aggregate} contribution`)
 }
 close(row(await preview(card([measure('contacts',field('related_index','contact'),'mean')]))).breakdown[0].value,contacts.reduce((sum,_,i)=>sum+(i+1)*100,0)/contacts.length,'Contact aggregation stays separate from product users')
 const mappedMean=users.reduce((sum,_,i)=>sum+(i%2?40:80),0)/users.length
 const typed=[measure('formula',field('related_double')),category,measure('money',field('related_money.amountMinor')),measure('currency',field('related_money.currency'),'mean',{USD:80}),measure('note',field('related_note'),'mean',{Ready:70}),measure('flag',field('related_flag'),'mean',{true:100,false:0}),measure('date',field('related_date'),'mean',{[on]:60}),measure('modules',field('related_modules'),'mean',{'["Exports","Reports"]':50})]
 const typedResult=row(await preview(card(typed)))
 const moneyMean=users.reduce((sum,_,i)=>sum+(i+1)*1000,0)/users.length
 const expectedValues=[mean*2,mappedMean,moneyMean,80,70,users.filter((_,i)=>i%2===0).length/users.length*100,60,50]
 for(const [i,value] of expectedValues.entries())close(typedResult.breakdown[i].value,value,'Each person is mapped before its typed aggregate')
 const numericResult=row(await preview(card([numeric]))),retainedRows=numericResult.inputs.relatedValues[field('related_index')]
 assert.equal(retainedRows.length,users.length)
 assert.deepEqual(numericResult.breakdown[0].relatedValues,retainedRows)
 const currentPeople=(await read()).records
 for(const p of users){const input=retainedRows.find(r=>r.personId===p.id);assert.ok(input);assert.equal(input.revision,currentPeople.find(r=>r.id===p.id).revision);assert.equal(input.value,indices[users.indexOf(p)]);assert.ok(numericResult.breakdown[0].sources.some(s=>s.reference===source&&s.details.personId===p.id&&s.details.revision===input.revision))}
 assert.ok(typedResult.breakdown.some(m=>m.sources.some(s=>s.reference===source)),'The card retains actual related-person field provenance')
 await save(users[0].id,{related_index:null,related_note:'70'})
 assert.equal(row(await preview(card([numeric]))).score,null,'Any missing related numeric input makes the required aggregate unknown')
 close(row(await preview(card([{...numeric,missing:'exclude'}]))).breakdown[0].value,indices.slice(1).reduce((a,b)=>a+b,0)/(users.length-1),'Exclude removes only the missing person before aggregation')
 assert.equal(row(await preview(card([typed[4]]))).score,null,'Numeric-looking related text is not coerced')
 close(row(await preview(card([{...typed[4],missing:'exclude'}]))).breakdown[0].value,70,'Exclude removes an unmapped category before aggregation')
 assert.equal(row(await preview(card([{...numeric,missing:'exclude'}])),otherId).score,null,'All missing related values remain unknown')
 assert.equal(row(await preview(card([{...measure('empty',field('related_index','contact')),missing:'exclude'}])),otherId).score,null,'No related people is unknown even with exclusion')
 await save(users[0].id,{related_index:indices[0],related_note:'Ready'})
 const config=card([surveyResult.config.measures.find(m=>m.field==='survey.nps'),surveyResult.config.measures.find(m=>m.field==='custom.'+surveyResult.fieldKey),numeric,category,surveyResult.config.measures.find(m=>m.field==='custom.survey_double')])
 assert.ok(config.measures.every(Boolean))
 const published=await api('/scorecards/publish','POST',{revision:(await cards()).revision,config}),initial=row(published)
 assert.ok(Number.isFinite(initial.score));assert.equal(row(published,otherId).score,null)
 const historyId=(await cards()).history.find(h=>h.accountId===accountId&&h.versionId===published.versionId).id,retained=await api('/scorecards/preview','POST',{historyId})
 const started=Date.now(),changedIndex=indices[0]+40
 await save(users[0].id,{related_index:changedIndex})
 const changed=row(await cards()),changedMean=(indices.reduce((a,b)=>a+b,0)+40)/users.length
 close(changed.breakdown.find(m=>m.key==='users').value,changedMean,'An actual customer field update recalculates the published mean')
 close(changed.score,initial.score+(changedMean-mean)/5,'The changed person contributes exactly its new aggregate share')
 assert.ok(Date.now()-started<300000&&Date.parse(changed.calculatedAt)>=started,'Related source updates recalculate within five minutes')
 assert.deepEqual(await api('/scorecards/preview','POST',{historyId}),retained,'History retains the original person IDs, revisions, raw values and source evidence')
 const move=async ids=>{const p=(await read()).records.find(p=>p.id===users[0].id);await api('/customer-people/'+p.id,'PUT',{revision:p.revision,kind:p.kind,name:p.name,accountIds:ids,source:'Customer-confirmed related-person membership correction'})}
 await move([otherId])
 const removed=row(await cards()),remainingMean=indices.slice(1).reduce((a,b)=>a+b,0)/(users.length-1)
 close(removed.breakdown.find(m=>m.key==='users').value,remainingMean,'Explicit removal changes the current account denominator')
 assert.ok(!removed.inputs.relatedValues[field('related_index')].some(p=>p.personId===users[0].id))
 await move([accountId])
 const restored=row(await cards())
 close(restored.breakdown.find(m=>m.key==='users').value,changedMean,'Restoring explicit membership restores the changed person')
 assert.ok(restored.inputs.relatedValues[field('related_index')].some(p=>p.personId===users[0].id&&p.value===changedIndex))
 assert.deepEqual(await api('/scorecards/preview','POST',{historyId}),retained)
 assert.equal((await app.request('/api/buoy/scorecards',{cookie:member})).status,200)
 console.log('Related customer health: contact/user fields, explicit aggregates, typed per-person mappings and formulas, missing inputs, source evidence, current membership, retained raw history and source recalculation passed.')
 return {...surveyResult,config,historyId,versionId:published.versionId,relatedPersonId:users[0].id,relatedFieldKey:'related_index'}
}
