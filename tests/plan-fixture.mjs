import assert from 'node:assert/strict'
import {playFixture} from './play-fixture.mjs'
export async function planFixture(){
 const f=await playFixture(),{api,create,ownerId}=f,accountId=await create('synthetic-buoy-1900'),other=await create('synthetic-buoy-1901')
 const champion=await api('/customer-people','POST',{kind:'contact',name:'synthetic-buoy-1902',accountIds:[accountId],source:'synthetic-buoy-1903'})
 const objectives=[{id:'usage',title:'Use the agreed feature',kind:'metric',field:'adoption.current.eventCount',target:1,direction:'at-least',dueOn:'2027-03-01'},{id:'statement',title:'Customer confirms the business result',kind:'customer-statement',dueOn:'2027-03-01'}]
 const body=async(extra={})=>({accountRevision:(await api('/state')).accounts.find(a=>a.id===accountId).revision,name:'Customer success draft',staffOwnerId:ownerId,customerOwnerId:champion.id,objectives,...extra})
 const plans=()=>api('/accounts/'+accountId+'/plans'),save=async(extra={})=>api('/accounts/'+accountId+'/plans','POST',await body(extra))
 const post=(body,options={})=>f.app.request('/api/buoy/accounts/'+accountId+'/plans',{cookie:f.app.cookie,method:'POST',body,...options})
 const invited=async(email,name)=>{const response=await f.app.request('/auth/invite',{method:'POST',cookie:f.app.cookie,body:{email,displayName:name,role:'member'}});assert.equal(response.status,202);const cookie=await f.app.signIn(email),person=(await api('/state')).people.find(p=>p.displayName===name);return{...person,cookie}}
 return {...f,accountId,other,champion,objectives,body,save,plans,post,invited}
}
