import {playConfig} from './play-fixture.mjs'
import assert from 'node:assert/strict'
// Public-door fixtures and comparisons for the real rer archive journey.
export async function seedRecordPortability(call,fixture,personId){
 const parent='synthetic-buoy-1400',child='synthetic-buoy-1401',on=new Date().toISOString().slice(0,10)
 for(const [id,name]of [[parent,'Portable parent company'],[child,'Portable product relationship']])await call('/accounts','POST',{...fixture,id,name})
 const revision=async id=>(await call('/state')).accounts.find(a=>a.id===id).revision
 const p=(await call('/customer-people')).records.find(p=>p.id===personId)
 await call('/customer-people/'+personId,'PUT',{kind:p.kind,name:p.name,revision:p.revision,accountIds:[...p.accountIds,child],source:'Confirmed portable product membership'})
 const operator=(await call('/state')).operator.id
 await call('/accounts/'+child+'/hierarchy','PUT',{revision:await revision(child),parentId:parent,kind:'relationship',accountExecutiveId:operator,executiveSponsorId:operator,supportOwnerId:operator,stakeholders:[{personId,roles:['champion','end-user']}],source:'Reviewed portable organization directory'})
 await call('/fields','POST',{key:'portable_used',label:'Portable product seats used',type:'number'})
 await call('/fields','POST',{key:'portable_tree',label:'Portable descendant seats',type:'formula',formula:'descendantsSum(custom.portable_used)'})
 for(const id of [parent,child])await call('/accounts/'+id+'/fields','PUT',{revision:await revision(id),values:{portable_used:id===child?12:0},source:'Reviewed portable product register'})
 const settings=(await call('/renewals')).settings;await call('/renewals/settings','PUT',{revision:settings.revision,leadDays:730,stages:settings.stages})
 await call('/accounts/'+child+'/contract','POST',{revision:await revision(child),contract:{currency:'USD',contractStart:'2026-01-01',contractEnd:'2027-03-31',lines:[{product:'Portable product',quantity:20,amountMinor:120000,frequency:'annual',entitlements:'20 named users'}],source:{reference:'Confirmed portable product contract',confirmedOn:on}}})
 const renewal=(await call('/renewals')).records.find(r=>r.accountId===child)
 await call('/renewal-fields','POST',{key:'portable_risk',label:'Portable review confirmed',type:'boolean'})
 await call('/renewals/'+renewal.id+'/fields','PUT',{revision:renewal.revision,values:{portable_risk:true},source:'Confirmed portable renewal review'})
 let r=(await call('/renewals')).records.find(r=>r.id===renewal.id)
 await call('/renewals/'+r.id,'PUT',{revision:r.revision,stage:'Negotiation',forecast:'commit',ownerId:operator,riskReasons:['Customer procurement review']})
 const proposal=await call('/proposals','POST',{accountId:child,kind:'renewal',payload:{renewalId:renewal.id,outcome:'renewed-with-expansion',resultArrMinor:180000,reason:'customer-confirmed',evidence:'Signed portable expansion'}})
 await call('/proposals/'+proposal.id+'/approve','POST',{})
 const view=await call('/workspace/views','POST',{view:{name:'Portable shared product view',kind:'account',shared:true,rules:{match:'all',conditions:[{field:'hierarchy.kind',op:'eq',value:'relationship'}]},columns:['name','hierarchy.parentId','custom.portable_tree'],sort:{field:'name',direction:'asc'}}})
 const input={kind:'account',recordIds:[child],action:'assign',ownerId:operator,note:'Explicit portable reviewed book handover',operationKey:'synthetic-buoy-1402'},review=await call('/workspace/bulk/preview','POST',input)
 const bulk={...input,fingerprint:review.fingerprint};await call('/workspace/bulk/apply','POST',bulk)
 const card=await call('/scorecards/publish','POST',{revision:null,config:{name:'Portable independent product scorecard',measures:[{key:'seats',name:'Product seats',field:'custom.portable_used',min:0,max:20,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]}})
 await call('/accounts/'+child+'/scorecard','PUT',{revision:await revision(child),versionId:card.versionId})
 const playbook=await call('/playbooks','POST',{config:playConfig(operator,{name:'Portable versioned follow-up'})}),playRun=await call('/playbooks/'+playbook.id+'/enroll','POST',{accountId:child,operationKey:'synthetic-buoy-1403'});
 const pending=(await call('/playbooks?accountId='+child)).runs.find(r=>r.id===playRun.id);await call('/proposals/'+pending.proposalId+'/approve','POST',{});
 await call('/playbook-runs/'+playRun.id+'/action','POST',{revision:(await call('/playbooks?accountId='+child)).runs.find(r=>r.id===playRun.id).revision,action:'receipt',outcome:'failed',reference:'synthetic-buoy-1404'});
 await call('/playbook-runs/'+playRun.id+'/action','POST',{revision:(await call('/playbooks?accountId='+child)).runs.find(r=>r.id===playRun.id).revision,action:'retry'});
 return {playbook,playRun,parent,child,viewId:view.id,bulk,card,personId}
}
export async function recordPortabilityImage(call,ids){
 const hierarchy=await call('/accounts/'+ids.parent+'/hierarchy'),relationship=await call('/accounts/'+ids.child+'/hierarchy'),workspace=await call('/workspace?view='+ids.viewId),cards=await call('/scorecards')
 assert.equal(hierarchy.rollup['hierarchy.userCount'],1);assert.equal(hierarchy.rollup.arrByCurrency.USD,120000)
 assert.equal(relationship.link.kind,'relationship');assert.ok(relationship.stakeholders.find(p=>p.id===ids.personId).roles.includes('champion'))
 const renewals=await call('/renewals');assert.equal(renewals.records.find(r=>r.accountId===ids.child).outcome,'renewed-with-expansion')
 return {plays:await call('/playbooks?accountId='+ids.child),hierarchy,relationship,view:workspace.selected,records:workspace.records,renewals,fields:await call('/fields'),assignments:cards.assignments}
}
export async function assertRecordPortability(call,request,ids,before){
 assert.deepEqual(await recordPortabilityImage(call,ids),before,'ACCOUNT-001 RENEW-001 ACCOUNT-003 full native records, sources, fields/formulas/history, independent card, shared view and expanded outcome restore exactly')
 const replay=await request('/api/buoy/workspace/bulk/apply',{method:'POST',body:ids.bulk})
 assert.equal(replay.status,409,'Restored bulk receipts do not grant the fresh owner the former actor’s replay authority')
 const shared=await call('/workspace?view='+ids.viewId)
 assert.notEqual(shared.selected.ownerId,(await call('/state')).operator.id,'A fresh owner can read a shared view without becoming its creator')
}
