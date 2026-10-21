import {importClient} from './import-door-client.mjs'
import assert from 'node:assert/strict'
export async function scorecardCustody(app,{api}){
 const prior=(await api('/scorecards')).published.config,on=new Date().toISOString().slice(0,10)
 const make=async(id,name)=>api('/accounts','POST',{id,name,renewalDate:'2027-12-31',noticeDays:30,renewalEvidence:'Confirmed customer schedule',billing:null,support:null})
 const existing=(await api('/state')).accounts
 const a=await make('synthetic-buoy-custody-1','Retained calculation customer'),b=await make('synthetic-buoy-custody-2','Private source customer')
 await api('/fields','POST',{key:'custody_value',label:'Customer private input',type:'number'})
 const save=async(id,value,source)=>{const record=(await api('/fields')).accounts.find(a=>a.id===id);await api('/accounts/'+id+'/fields','PUT',{revision:record.revision,values:{custody_value:value},source})}
 for(const account of existing)await save(account.id,20,'Current customer observation')
 await save(a.id,20,'Retained customer observation');await save(b.id,80,'Private source customer observation')
 await api('/fields','POST',{key:'custody_average',label:'Recorded portfolio average',type:'formula',formula:'avg(custom.custody_value)'})
 const card=field=>({name:'Recorded source custody',measures:[{key:'source',name:'Recorded source',field,min:0,max:100,weight:1,direction:'higher',missing:'unknown',...(field.startsWith('people.')?{aggregate:'mean'}:{})}],bands:{riskBelow:40,healthyAt:75},segments:[]})
 const publish=async config=>api('/scorecards/publish','POST',{revision:(await api('/scorecards')).revision,config})
 await publish(card('custom.custody_average'))
 let data=await api('/scorecards'),historyId=data.history.find(h=>h.accountId===a.id&&h.versionId===data.published.id).id
 const retained=await api('/scorecards/preview','POST',{historyId})
 assert.ok(Math.abs(retained.accounts[0].score-(20*(existing.length+1)+80)/(existing.length+2))<1e-9)
 await api('/accounts/'+b.id,'DELETE',{confirmation:b.name})
 assert.equal((await app.request('/api/buoy/scorecards/preview',{cookie:app.cookie,method:'POST',body:{historyId}})).status,404,'Erasing a portfolio source withdraws its retained calculation copies from other accounts')
 data=await api('/scorecards');assert.equal(data.accounts.find(r=>r.accountId===a.id).score,20)
 assert.ok(!JSON.stringify(data).includes('Private source customer observation'),'The current and retained scorecard doors no longer expose the erased source reference')
 // Stop the portfolio dependency before isolating a customer-person source.
 await api('/fields','POST',{key:'custody_average',label:'Recorded local value',type:'formula',formula:'custom.custody_value'})
 const c=await make('synthetic-buoy-custody-3','Departed respondent customer')
 const person=await api('/customer-people','POST',{kind:'user',name:'Private departing respondent',accountIds:[a.id],source:'Confirmed customer directory'})
 await api('/customer-fields','POST',{key:'custody_person_value',label:'Recorded customer observation',type:'number'})
 let p=(await api('/customer-people')).records.find(p=>p.id===person.id)
 await api('/customer-people/'+person.id+'/fields','PUT',{revision:p.revision,values:{custody_person_value:70},source:'Private departing respondent observation'})
 await publish(card('people.user.custom.custody_person_value'))
 data=await api('/scorecards');historyId=data.history.find(h=>h.accountId===a.id&&h.versionId===data.published.id).id
 assert.equal((await api('/scorecards/preview','POST',{historyId})).accounts[0].score,70)
 p=(await api('/customer-people')).records.find(p=>p.id===person.id)
 await api('/customer-people/'+person.id,'PUT',{revision:p.revision,kind:p.kind,name:p.name,accountIds:[c.id],source:'Confirmed respondent departure'})
 await api('/accounts/'+c.id,'DELETE',{confirmation:c.name})
 assert.equal((await app.request('/api/buoy/scorecards/preview',{cookie:app.cookie,method:'POST',body:{historyId}})).status,404,'Erasing the departed respondent removes retained person-backed score copies')
 assert.ok(!JSON.stringify(await api('/scorecards')).includes('Private departing respondent observation'))
 await api('/accounts/'+a.id,'DELETE',{confirmation:a.name})
 await publish(card('billing.allocatedMinor'))
 const imported={id:'synthetic-buoy-import-health',name:'Reviewed imported customer',renewalDate:'2027-12-31',noticeDays:30,renewalEvidence:'Confirmed imported order',billing:{observedAt:on,reference:'Customer invoice allocation',currency:'USD',totalMinor:100,creditsMinor:0,allocatedMinor:50,dueDate:on},support:null}
 const door=importClient(app.request,app.cookie),plan=await door.plan({accounts:[imported]});await door.apply(plan);const appliedAt=Date.now()
 const importedCard=(await api('/scorecards')).accounts.find(r=>r.accountId===imported.id)
 assert.equal(importedCard.score,50);assert.ok(Date.parse(importedCard.calculatedAt)<=appliedAt,'The Business import source recalculates its score before its successful response, not on the next read')
 await api('/accounts/'+imported.id,'DELETE',{confirmation:imported.name})
 await publish(prior)
 console.log('Scorecard erasure: portfolio-source and departed-person snapshots withdraw atomically, current scores recalculate, and private source references disappear.')
}
