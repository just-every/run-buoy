// ADOPT-001 / SEGMENT-001: metrics drive real membership and entry approvals.
import {currentAdoption} from './adoption-current-fixture.mjs'
import assert from 'node:assert/strict'
export async function adoptionSegments(app,fixture){
 const {api,accounts,people}=fixture
 await currentAdoption(fixture,'http')
 const on=new Date().toISOString().slice(0,10)
 const report=await api('/adoption?on='+on),account=report.accounts.find(a=>a.id===accounts[0].id)
 const condition=(field,value)=>value===null?{field,op:'is-missing'}:{field,op:'eq',value}
 const conditions=[{field:'id',op:'eq',value:account.id}]
 for(const period of ['current','previous']){
  for(const key of ['dau','wau','mau','eventCount','depth','breadth','utilization'])conditions.push(condition(`adoption.${period}.${key}`,account.metrics[period][key]))
  for(const kind of ['feature','module'])for(const value of account.metrics[period][kind==='feature'?'features':'modules'])conditions.push(condition(`adoption.${period}.${kind}.${value.key}`,value.fraction))
 }
 for(const key of ['weeklyChange','weeklyDrop'])conditions.push(condition('adoption.'+key,Number.isFinite(account.metrics[key])?account.metrics[key]:typeof account.metrics[key]==='boolean'?Number(account.metrics[key]):null))
 for(const key of ['people','meanSeconds'])conditions.push(condition('adoption.firstValue.'+key,account.metrics.firstValue[key]))
 const create=(name,conditions,playbook=null)=>api('/segments','POST',{name,mode:'dynamic',accountIds:[],rules:{match:'all',conditions},tier:null,stage:null,playbook})
 const parity=await create('ADOPT-001 all account metric parity',conditions)
 const segment=async id=>(await api('/segments')).segments.find(s=>s.id===id)
 assert.equal((await segment(parity.id)).members.length,1,'ADOPT-001 every current/previous metric has report parity, including fractions and missing values')
 const person=await create('ADOPT-001 same-person conjunction',[{field:'id',op:'eq',value:account.id},{field:'people.user.name',op:'eq',value:report.people.find(p=>p.id===people[1].id).name},{field:'people.user.adoption.current.feature.reports',op:'eq',value:1}])
 assert.equal((await segment(person.id)).members.length,0,'ADOPT-001 two people cannot jointly satisfy one related-person rule')
 const prior=await segment(person.id)
 await api('/segments','POST',{id:prior.id,revision:prior.revision,name:prior.name,mode:prior.mode,accountIds:prior.accountIds,tier:prior.tier,stage:prior.stage,playbook:prior.playbook,rules:{match:'all',conditions:[{field:'id',op:'eq',value:account.id},{field:'people.user.name',op:'eq',value:report.people.find(p=>p.id===people[0].id).name},{field:'people.user.adoption.current.feature.reports',op:'eq',value:1}]}})
 assert.equal((await segment(person.id)).members.length,1,'ADOPT-001 the same matching person is admitted')
 const entered=await create('ADOPT-001 license review',[{field:'id',op:'eq',value:account.id},{field:'adoption.current.utilization',op:'lt',value:account.metrics.current.utilization+.1}],{title:'Review recorded license adoption',dueDays:2})
 let state=await segment(entered.id);assert.equal(state.members.length,1);assert.equal(state.history.length,1)
 const first=state.history[0].proposalId;assert.ok(first)
 assert.equal((await segment(entered.id)).history.length,1,'ADOPT-001 repeated reconciliation does not duplicate entry proposals')
 await api('/adoption/seats','PUT',{accountId:account.id,seats:10,reference:'Reviewed ten-seat order',observedAt:on,staleDays:30})
 state=await segment(entered.id);assert.equal(state.members.length,0);assert.ok(state.history[0].exitedAt)
 assert.equal((await app.request('/api/buoy/proposals/'+first+'/approve',{cookie:app.cookie,method:'POST',body:{}})).status,409,'ADOPT-001 old evidence/exit refuses approval')
 await api('/adoption/seats','PUT',{accountId:account.id,seats:20,reference:'Reviewed twenty-seat order',observedAt:on,staleDays:30})
 state=await segment(entered.id);assert.equal(state.history.length,2);assert.equal(state.members.length,1)
 const next=state.history.find(h=>!h.exitedAt).proposalId
 await api('/proposals/'+next+'/approve','POST',{});await api('/proposals/'+next+'/approve','POST',{})
 assert.equal((await api('/state')).tasks.filter(t=>t.proposalId===next).length,1,'ADOPT-001 a metric-triggered playbook approval creates one task')
 const csv=await app.request('/api/buoy/segments/'+entered.id+'/report.csv',{cookie:app.cookie});assert.match(await csv.text(),new RegExp(account.name))
 const prepared=await api('/proposals','POST',{accountId:account.id,kind:'renewal',payload:{outcome:'deferred',reason:'Review adoption definition',evidence:'Current event sets'}})
 await api('/adoption/definitions','POST',{kind:'feature',key:'reports',name:'Reports',events:['New report event']})
 assert.equal((await app.request('/api/buoy/proposals/'+prepared.id+'/approve',{cookie:app.cookie,method:'POST',body:{}})).status,409,'ADOPT-001 event-set changes invalidate existing preparations')
 assert.equal((await segment(person.id)).members.length,0,'ADOPT-001 definition edits re-evaluate related-person adoption')
 const invalid={name:'Invalid metric',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'adoption.current.utilization',op:'gte',value:'0.5'}]},tier:null,stage:null,playbook:null}
 assert.equal((await app.request('/api/buoy/segments',{cookie:app.cookie,method:'POST',body:invalid})).status,400,'ADOPT-001 numeric metric predicates refuse strings')
 await api('/adoption/definitions','POST',{kind:'feature',key:'reports',name:'Reports',events:['Report generated']})
 const key='customer_success_workspace_adoption_dashboard_weekly_reporting_automation'
 await api('/adoption/definitions','POST',{kind:'feature',key,name:'Workspace reporting adoption',events:['Report generated']})
 const long=await create('ADOPT-001 descriptive feature key',[{field:'id',op:'eq',value:account.id},{field:`people.user.adoption.current.feature.${key}`,op:'gte',value:.5}])
 assert.equal((await segment(long.id)).members.length,1,'ADOPT-001 valid descriptive event-set keys work in related-person rules')
 console.log('ADOPT-001 typed metric/report parity, fractional rules, same-person conjunction, entry/exit/reentry, approval once and definition revision passed.')
}
