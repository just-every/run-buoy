import assert from 'node:assert/strict'
import {createInappClient} from '../sdk/inapp.mjs'
export async function inappFixture(app,{tag='inapp',campaigns=true}={}){
 const api=async(path,method='GET',body,cookie=app.cookie)=>{const response=await app.request('/api/buoy'+path,{cookie,method,body});assert.ok(response.ok,await response.clone().text());return response.json()}
 const source=await api('/usage/sources','POST',{name:'Northstar product '+tag,kind:'native',reference:'Authenticated customer workspace '+tag,staleDays:30})
 const accounts=[],people=[]
 for(const [i,name]of ['Harbour Software','Cedar Logistics'].entries()){
  const account=await api('/accounts','POST',{id:tag+'-'+i,name:name+' '+tag,renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Customer approved annual license',billing:null,support:null});accounts.push(account)
  const person=await api('/customer-people','POST',{kind:'user',name:(i?'Casey':'Morgan')+' customer '+tag,accountIds:[account.id],source:'Reviewed customer directory'});people.push(person)
  const mapping={sourceId:source.id,userId:' User '+i+' ',groupId:' Workspace '+i+' ',personId:person.id,accountId:account.id},review=await api('/usage/mappings/preview','POST',mapping)
  await api('/usage/mappings','POST',{...mapping,fingerprint:review.fingerprint})
 }
 const segment=await api('/segments','POST',{name:'Launch customers '+tag,mode:'static',accountIds:[accounts[0].id],rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
 const issued=await api('/inapp/credentials','POST',{sourceId:source.id,label:'Customer product server '+tag})
 const client=createInappClient({origin:app.origin,sourceId:source.id,credential:issued.secret,fetch:(url,init)=>app.dispatch(new Request(url,init))})
 const create=async(kind,overrides={})=>api('/inapp/campaigns','POST',{sourceId:source.id,segmentId:segment.id,kind,title:kind==='walkthrough'?'Explore reporting':kind==='banner'?'New reporting workspace':kind==='checklist'?'Reporting launch checklist':'Reporting available',body:'Your customer reporting workspace is ready.',steps:['Open the reporting workspace','Choose a saved report'],maxViews:1,windowHours:24,enabled:true,...overrides})
 const created={};if(campaigns)for(const kind of ['announcement','banner','checklist','walkthrough'])created[kind]=await create(kind)
 return {api,source,accounts,people,segment,issued,client,create,created,identity:{userId:' User 0 ',groupId:' Workspace 0 '},outside:{userId:' User 1 ',groupId:' Workspace 1 '}}
}
