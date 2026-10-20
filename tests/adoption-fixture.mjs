// Test data enters through the same account, customer, reviewed-mapping and intake doors as a buyer.
import assert from 'node:assert/strict'
import {BuoyUsage} from '../sdk/usage.mjs'
export const adoptionOn='2026-10-01'
export const shift=(n,hour=12)=>new Date(Date.parse(adoptionOn+'T00:00:00Z')+n*86400000+hour*3600000).toISOString()
export async function adoptionFixture(app,{count=30,users=10,days=90}={}){
 const api=async(path,method='GET',body,cookie=app.cookie)=>{const r=await app.request('/api/buoy'+path,{cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()}
 const source=await api('/usage/sources','POST',{name:'Customer product telemetry',kind:'native',reference:'Reviewed production workspace export',staleDays:30})
 const issued=await api('/usage/sources/'+source.id+'/credentials','POST',{label:'Product server',scope:['track','identify','group','event']})
 const sdk=new BuoyUsage({origin:app.origin,sourceId:source.id,credential:issued.secret,fetch:(url,init)=>app.dispatch(new Request(url,init))})
 const accounts=[],people=[],events=[]
 const names=['Harbour Software','Cedar Logistics','Coastline Analytics','Juniper Health','Northstar Labs','Brightwater Group','Summit Design','Riverbank Systems','Golden Gate Studio','Maple Services']
 for(let a=0;a<count;a++){
  const account=await api('/accounts','POST',{id:'adoption-'+a,name:names[a%names.length]+(a>=10?' '+(Math.floor(a/10)+1):''),renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Customer-approved license schedule',billing:null,support:null});accounts.push(account)
  await api('/adoption/seats','PUT',{accountId:account.id,seats:20,reference:'Customer-approved license schedule',observedAt:'2026-10-01',staleDays:30})
  for(let u=0;u<users;u++){
   const person=await api('/customer-people','POST',{kind:'user',name:['Avery','Morgan','Casey','Jordan','Riley','Quinn','Alex','Sam','Taylor','Robin'][u]+' · '+account.name,accountIds:[account.id],source:'Reviewed customer product directory'});people.push({...person,accountId:account.id,u})
   const mapping={sourceId:source.id,userId:'user-'+a+'-'+u,groupId:'group-'+a,accountId:account.id,personId:person.id}
   const preview=await api('/usage/mappings/preview','POST',mapping)
   await api('/usage/mappings','POST',{...mapping,fingerprint:preview.fingerprint})
   if(u!==9)events.push({type:'identify',messageId:`identify-${a}-${u}`,userId:mapping.userId,groupId:mapping.groupId,timestamp:shift(-(days-1),0)})
   for(let d=-(days-1);d<=0;d++){
    if(d>=-6&&u>=7||d===0&&u>=4)continue
    events.push({type:'track',messageId:`use-${a}-${u}-${d}`,userId:mapping.userId,groupId:mapping.groupId,timestamp:shift(d,d===-(days-1)?1:12),event:u%2?'File exported':'Report generated'})
   }
  }
 }
 for(let i=0;i<events.length;i+=500)await sdk.batch(events.slice(i,i+500))
 // Replay really traverses intake; the calculator must never count duplicates.
 await sdk.batch(events.slice(0,Math.min(500,events.length)))
 const segment=await api('/segments','POST',{name:'First half of the portfolio',mode:'static',accountIds:accounts.slice(0,Math.ceil(count/2)).map(a=>a.id),rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
 return {api,sdk,source,accounts,people,events,segment}
}
export async function defineAdoption(api){
 for(const d of [{kind:'feature',key:'reports',name:'Reports',events:['Report generated']},{kind:'feature',key:'exports',name:'Exports',events:['File exported']},{kind:'module',key:'analytics',name:'Analytics module',events:['Report generated','File exported']}])await api('/adoption/definitions','POST',d)
}
// Independent event-set calculation over delivered fixture inputs, without implementation imports.
export function expectedAdoption(events,{accounts,people},on=adoptionOn){
 const end=Date.parse(on)+86400000,claimed=new Map(people.map(p=>['user-'+p.accountId.replace('adoption-','')+'-'+p.u,p.id]))
 const allowedGroups=new Set(accounts.map(a=>'group-'+a.id.replace('adoption-','')))
 const unique=[...new Map(events.map(e=>[e.messageId,e])).values()].filter(e=>claimed.has(e.userId)&&allowedGroups.has(e.groupId))
 const active=(length,previous=false)=>new Set(unique.filter(e=>['track','event'].includes(e.type)&&Date.parse(e.timestamp)>=end-(previous?2:1)*length*86400000&&Date.parse(e.timestamp)<end-(previous?1:0)*length*86400000).map(e=>claimed.get(e.userId))).size
 const monthly=unique.filter(e=>['track','event'].includes(e.type)&&Date.parse(e.timestamp)>=end-30*86400000&&Date.parse(e.timestamp)<end)
 return {dau:active(1),wau:active(7),mau:active(30),priorDau:active(1,true),priorWau:active(7,true),priorMau:active(30,true),eventCount:monthly.length,features:Object.fromEntries(['Report generated','File exported'].map(name=>[name,new Set(monthly.filter(e=>e.event===name).map(e=>claimed.get(e.userId))).size]))}
}
