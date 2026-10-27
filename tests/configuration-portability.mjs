import assert from 'node:assert/strict'

export const portableConfigurationCard={name:'Portable retained allocation test',measures:[{key:'billing',name:'Recorded allocation',field:'billing.allocatedMinor',min:0,max:100000,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]}
const accountId='synthetic-buoy-8520',missingAccountId='synthetic-buoy-8521'
const account=(id,on,score)=>({id,name:id,renewalDate:'2027-12-31',noticeDays:30,renewalEvidence:'synthetic-buoy-8522',support:null,billing:{observedAt:on,reference:'synthetic-buoy-8523',currency:'USD',totalMinor:100000,creditsMinor:0,allocatedMinor:score*1000,dueDate:on}})

export async function seedConfigurationPortability(call,setClock,now){
 const instant=Date.parse(new Date(now).toISOString().slice(0,10))-86400000+43200000,on=new Date(instant).toISOString().slice(0,10)
 let selected,largest,score=0
 setClock(instant)
 try{
  await call('/accounts','POST',account(accountId,on,score))
  let history=(await call('/scorecards')).history.filter(r=>r.accountId===accountId)
  assert.equal(history.length,1)
  largest=history[0]
  // Construct a conflict where sorting UUIDs chooses the wrong result. Public
  // writes assign random IDs, so keep adding the opposite of that UUID winner
  // until the chronological winner has a lower ID. No database writes are used.
  for(let n=0;n<32;n++){
   score=largest.score===0?100:0
   const current=(await call('/state')).accounts.find(a=>a.id===accountId)
   await call('/accounts/'+accountId,'PUT',{...account(accountId,on,score),revision:current.revision})
   const next=(await call('/scorecards')).history.filter(r=>r.accountId===accountId)
   const added=next.filter(r=>!history.some(prior=>prior.id===r.id))
   assert.equal(added.length,1,'Each conflicting public write retains a new calculation')
   const latest=added[0]
   assert.equal(latest.score,score)
   assert.equal(latest.calculatedAt,new Date(instant).toISOString(),'Conflicting calculations have exactly equal timestamps')
   if(latest.id<largest.id){selected={...latest,score};break}
   largest=latest;history=next
  }
  assert.ok(selected,'Fixture chronology must disagree with UUID ordering')
 }finally{setClock(undefined)}
 // A usable current snapshot deliberately disagrees with retained history.
 const today=new Date(now).toISOString().slice(0,10),current=(await call('/state')).accounts.find(a=>a.id===accountId)
 await call('/accounts/'+accountId,'PUT',{...account(accountId,today,100-selected.score),revision:current.revision})
 await call('/accounts','POST',account(missingAccountId,today,100))
 return {accountId,missingAccountId,on,selected,uuidWinner:largest}
}

export async function assertConfigurationBacktest(call,image){
 const current=await call('/scorecards/preview','POST',{config:portableConfigurationCard})
 assert.equal(current.accounts.find(a=>a.accountId===image.accountId).score,100-image.selected.score,'Current inputs disagree with the expected retained calculation')
 assert.equal(current.accounts.find(a=>a.accountId===image.missingAccountId).score,100,'The account without historical observations has usable current inputs')
 const draft=await call('/ai/configuration','POST',{kind:'scorecard',description:'Score recorded allocation from zero to 100000 with risk below 40 and healthy at 75',consent:true})
 const observations=draft.backtest.observations.filter(r=>r.accountId===image.accountId)
 assert.deepEqual(observations.map(({on,score,matched,missing})=>({on,score,matched,missing})),[{on:image.on,score:image.selected.score,matched:image.selected.score===0,missing:[]}],'The latest retained equal-timestamp calculation supplies the only historical account week')
 assert.equal(draft.backtest.observations.filter(r=>r.accountId===image.missingAccountId).length,0,'Usable current inputs never reconstruct absent retained scorecard history')
 assert.equal(draft.backtest.matchedAccountIds.includes(image.accountId),image.selected.score===0,'Only the selected historical result contributes a matching account')
 assert.equal(draft.backtest.matchedAccountIds.includes(image.missingAccountId),false)
 const weeks=Math.ceil((Date.parse(draft.backtest.end)-Date.parse(draft.backtest.start))/604800000),accounts=(await call('/state')).accounts.length
 assert.equal(draft.backtest.missingWeeks,accounts*weeks-draft.backtest.observations.filter(r=>r.missing.length===0).length,'Every absent account week remains counted as missing despite usable current inputs')
 return {observations,missingWeeks:draft.backtest.missingWeeks}
}

export function assertConfigurationArchive(rows,image){
 const retained=rows.filter(r=>r.table==='buoy_scorecard_history'&&r.row.account_id===image.accountId).map(r=>r.row)
 const selected=retained.find(r=>r.id===image.selected.id),uuidWinner=retained.find(r=>r.id===image.uuidWinner.id)
 assert.ok(selected&&uuidWinner,'The real archive contains both competing retained calculations')
 assert.equal(selected.calculated_at,uuidWinner.calculated_at)
 assert.notEqual(JSON.parse(selected.document).score,JSON.parse(uuidWinner.document).score)
 assert.ok(selected.observed_seq>uuidWinner.observed_seq,'The selected calculation is durably later despite its lower UUID')
}
