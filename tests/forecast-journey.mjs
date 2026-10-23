import assert from 'node:assert/strict'
import {join} from 'node:path'
import {startWorker} from './worker.mjs'
import {scan,submit,failures} from './a11y-checks.mjs'
export async function forecastJourney({browser,evidence}={}){
 const app=await startWorker(),cookie=app.cookie
 const request=(path,method='GET',body,options={})=>app.request('/api/buoy'+path,{cookie,method,body,...options})
 const api=async(path,method='GET',body,options={})=>{const r=await request(path,method,body,options);assert.ok(r.ok,await r.clone().text());return r.json()}
 const on=new Date().toISOString().slice(0,10),year=Number(on.slice(0,4)),month=Number(on.slice(5,7)),quarter=Math.floor((month-1)/3)*3+1,day=d=>d.toISOString().slice(0,10)
 const end=day(new Date(Date.UTC(year,month,0))),start=year+'-'+String(quarter).padStart(2,'0')+'-01',quarterEnd=day(new Date(Date.UTC(year,quarter+2,0))),closed=day(new Date(Date.parse(quarterEnd)+86400000)),nextStart=day(new Date(Date.UTC(year,quarter+2,1))),nextEnd=day(new Date(Date.UTC(year,quarter+5,0)))
 const query=new URLSearchParams({period:'quarter',start,on}),url='/renewals/forecast?'+query
 const invite=async n=>{const email='synthetic-buoy-'+n+'@example.test';await app.request('/auth/invite',{method:'POST',cookie,body:{email,displayName:'Forecast colleague '+n,role:'member'}});const as=await app.signIn(email);return {id:(await api('/state','GET',undefined,{cookie:as})).operator.id,cookie:as}}
 const assign=async(person,roleId)=>api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId})
 const forecast=(q=query,as=cookie)=>api('/renewals/forecast?'+q,'GET',undefined,{cookie:as})
 try{
  const csm=await invite(8100),peer=await invite(8101),manager=await invite(8102),reader=await invite(8103)
  await assign(manager,'cs-manager');await assign(csm,'csm');await assign(reader,'support')
  await api('/people/'+csm.id+'/manager','PUT',{managerId:manager.id})
  const settings=(await api('/renewals')).settings;await api('/renewals/settings','PUT',{revision:settings.revision,leadDays:730,stages:settings.stages})
  const values=[['USD',120000],['EUR',100000],['GBP',90000],['CAD',60000]],ids=[],renewals=[]
  for(const [i,[currency,amountMinor]]of values.entries()){
   const a=await api('/accounts','POST',{id:'synthetic-buoy-'+(8200+i),name:'Forecast account '+i,renewalDate:i===3?nextEnd:end,noticeDays:30,renewalEvidence:'Confirmed notice terms',billing:null,support:null});ids.push(a.id)
   await api('/accounts/'+a.id+'/owner','PUT',{ownerId:i<2?csm.id:peer.id})
   const current=(await api('/state')).accounts.find(r=>r.id===a.id)
   await api('/accounts/'+a.id+'/contract','POST',{revision:current.revision,contract:{currency,contractStart:day(new Date(Date.parse(on)-180*86400000)),contractEnd:i===3?nextEnd:end,lines:[{product:'Forecast seats',quantity:1,amountMinor,frequency:'annual',entitlements:'Named seats'}],source:{reference:'Confirmed forecast order '+i,confirmedOn:on}}})
   renewals.push((await api('/renewals')).records.find(r=>r.accountId===a.id))
  }
  const rates={name:'Forecast budget rates',mode:'corporate',rates:[{currency:'EUR',from:year+'-01-01',to:year+'-12-31',usdPerUnit:'1.1',source:'Treasury approved budget'},{currency:'GBP',from:year+'-01-01',to:year+'-12-31',usdPerUnit:'1.25',source:'Treasury approved budget'}]}
  await api('/revenue/rates','POST',{revision:null,table:rates})
  await api('/team/settings','PUT',{teams:[{id:'synthetic-buoy-8300',name:'Forecast CS team',pod:'Enterprise',personIds:[csm.id]}],capacities:[],rules:[]})
  const segment=await api('/segments','POST',{name:'Forecast reviewed segment',mode:'static',accountIds:ids.slice(0,2),rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
  const current=async i=>(await api('/renewals')).records.find(r=>r.id===renewals[i].id)
  const edit=async(i,forecast,stage='Negotiation')=>{const r=await current(i);return api('/renewals/'+r.id,'PUT',{revision:r.revision,stage,forecast,ownerId:r.ownerId,riskReasons:['Reviewed customer timing']})}
  await edit(0,'commit');await edit(1,'at-risk')
  const base=await forecast();assert.equal(base.summary.count,3);assert.equal(base.summary.expectedUsdMinor,342500);assert.equal(base.summary.commitUsdMinor,120000);assert.equal(base.summary.atRiskUsdMinor,110000);assert.equal(base.summary.bestUsdMinor,342500);assert.equal(base.summary.worstUsdMinor,120000);assert.equal(base.accuracy,null)
  assert.deepEqual(base.records.map(r=>[r.currency,r.nativeArrMinor,r.usdArrMinor]).sort(),[['EUR',100000,110000],['GBP',90000,112500],['USD',120000,120000]])
  for(const name of ['ownerId','teamId','segmentId']){
   const q=new URLSearchParams(query);q.set(name,name==='ownerId'?csm.id:name==='teamId'?'synthetic-buoy-8300':segment.id);const r=await forecast(q);assert.equal(r.summary.count,2);assert.equal(r.summary.expectedUsdMinor,230000);assert.deepEqual(r.records.map(r=>r.accountId).sort(),ids.slice(0,2))
  }
  assert.equal(base.groups.csms.length,2);assert.equal(base.groups.teams[0].expectedUsdMinor,230000);assert.equal(base.groups.segments[0].count,2)
  const unknown=await forecast(new URLSearchParams({period:'quarter',start:nextStart,on}));assert.equal(unknown.summary.expectedUsdMinor,null);assert.match(unknown.gaps.join(' '),/No CAD reporting rate/);assert.equal(unknown.records[0].nativeArrMinor,60000)
  assert.equal((await request('/renewals/forecast?period=week')).status,400);assert.equal((await request('/renewals/forecast?period=quarter&start='+year+'-02-01')).status,400)
  assert.equal((await request(url,'GET',undefined,{cookie:undefined})).status,401)
  const token=await api('/agent-tokens','POST',{label:'Forecast boundary proof'})
  for(const [door,method,body]of [[url,'GET',undefined],['/renewals/forecast/snapshots','POST',{}],['/renewals/'+renewals[0].id+'/forecast-override','POST',{revision:(await current(0)).revision,category:'commit',reason:'Untrusted forecast change'}]]){
   assert.equal((await request(door,method,body,{cookie:undefined,token:token.token})).status,403,'Agent scope never expands to forecasts or overrides')
   if(method==='POST')assert.equal((await request(door,method,body,{headers:{origin:'https://foreign.invalid'}})).status,403,'Forecast writes keep native same-origin authority')
  }
  await api('/agent-tokens/'+token.id,'DELETE',{})
  const snapshot=await api('/renewals/forecast/snapshots','POST',{});assert.equal(snapshot.created,true);assert.deepEqual(await api('/renewals/forecast/snapshots','POST',{}),{id:snapshot.id,created:false})
  const updatedRates={...rates,rates:rates.rates.map(r=>r.currency==='EUR'?{...r,usdPerUnit:'1.2'}:r)};await api('/revenue/rates','POST',{revision:(await api('/revenue/rates')).table.revision,table:updatedRates});assert.equal((await forecast()).summary.expectedUsdMinor,352500);assert.equal((await forecast()).previous.expectedUsdMinor,342500,'Rate edits restate current figures while preserving snapshot rates');await api('/revenue/rates','POST',{revision:(await api('/revenue/rates')).table.revision,table:rates})
  const retained=(await forecast()).baseline;assert.equal(retained.length,3);assert.equal((await forecast()).previous.expectedUsdMinor,342500)
  const r=await current(1),override='/renewals/'+r.id+'/forecast-override'
  assert.equal((await request(override,'POST',{revision:r.revision,category:'commit',reason:''},{cookie:manager.cookie})).status,400)
  assert.equal((await request(override,'POST',{revision:r.revision,category:'commit',reason:'Not granted'},{cookie:csm.cookie})).status,403)
  assert.equal((await request('/renewals/'+renewals[2].id+'/forecast-override','POST',{revision:(await current(2)).revision,category:'commit',reason:'Outside team'},{cookie:manager.cookie})).status,403)
  await api(override,'POST',{revision:r.revision,category:'commit',reason:'Manager reviewed procurement approval'},{cookie:manager.cookie})
  assert.equal((await request(override,'POST',{revision:r.revision,category:'likely',reason:'Stale review'},{cookie:manager.cookie})).status,409)
  await api('/people/'+csm.id+'/manager','PUT',{managerId:null});assert.equal((await request(override,'POST',{revision:(await current(1)).revision,category:'likely',reason:'Withdrawn team authority'},{cookie:manager.cookie})).status,403)
  await api('/people/'+csm.id+'/manager','PUT',{managerId:manager.id})
  const own=await forecast(query,csm.cookie);assert.deepEqual(own.records.map(r=>r.accountId).sort(),ids.slice(0,2));assert.ok(!JSON.stringify(own).includes(ids[2]));assert.ok(!JSON.stringify(own).includes('Forecast account 2'))
  const band=await forecast(query,reader.cookie);assert.equal(band.summary.count,0);assert.deepEqual(band.baseline,[]);assert.ok(!JSON.stringify(band).includes('342500'));assert.equal((await request(url+'&ownerId='+peer.id,'GET',undefined,{cookie:reader.cookie})).status,403)
  const scanPage=async(page,width,label)=>{await scan(page,'RENEW-004 '+label+' '+width);await page.screenshot({path:join(evidence,'forecast-'+label+'-'+width+'.png'),fullPage:true});await page.locator('#forecast-totals').screenshot({path:join(evidence,'forecast-'+label+'-totals-'+width+'.png')});assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&/^[+−×↗]$/.test(n.textContent.trim())).length),0,'All forecast controls have visible text')}
  if(browser)for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try{await context.addCookies(manager.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}));const page=await context.newPage();await page.goto(app.origin+'/app/forecast?'+query,{waitUntil:'networkidle'});assert.match(await page.locator('#forecast-totals').innerText(),/3 renewals/);assert.match(await page.locator('#forecast-filters').innerText(),/not guaranteed predictions or proof of causation/);assert.match(await page.locator('#forecast-inputs').innerText(),/Manager reviewed procurement approval/);const panel=page.locator('#forecast-override-panel-'+renewals[0].id);await panel.locator('summary').click();const form=panel.locator('form');await form.getByLabel('Override category',{exact:true}).selectOption(width===1440?'likely':'at-risk');await form.getByLabel('Override reason',{exact:true}).fill('Manager native review '+width);await submit(page,form.getByRole('button',{name:'Record forecast override',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0);assert.match(await page.locator('#forecast-inputs').innerText(),new RegExp('Manager native review '+width));await scanPage(page,width,'override');await page.getByLabel('Segment',{exact:true}).selectOption(segment.id);await submit(page,page.getByRole('button',{name:'Open forecast',exact:true}));assert.match(await page.locator('#forecast-totals').innerText(),/2 renewals/);await scanPage(page,width,'segment')}finally{await context.close()}
  }
  await edit(0,'commit','Decision');await edit(1,'commit','Decision');await edit(2,'at-risk','Decision')
  for(const [i,outcome,result]of [[0,'renewed',120000],[1,'renewed-with-contraction',50000],[2,'churned',0]]){
   const r=await current(i),p=await api('/proposals','POST',{accountId:r.accountId,kind:'renewal',payload:{renewalId:r.id,outcome,resultArrMinor:result,reason:'customer-confirmed',evidence:'Signed forecast outcome '+i}});await api('/proposals/'+p.id+'/approve','POST',{})
  }
  const closedQuery=new URLSearchParams({period:'quarter',start,on:closed,snapshotId:snapshot.id}),result=await forecast(closedQuery)
  assert.equal(result.window.closed,true);assert.equal(result.summary.expectedUsdMinor,175000);assert.equal(result.summary.actualUsdMinor,175000);assert.deepEqual(result.accuracy,{forecastUsdMinor:342500,actualUsdMinor:175000,errorUsdMinor:-167500,absoluteErrorUsdMinor:167500});assert.deepEqual(result.baseline,retained,'Movement never rewrites the captured source and rate image')
  assert.equal(result.movements.filter(r=>r.currentOutcome!==null).length,3);assert.ok(result.movements.every(r=>r.previousOutcome===null));assert.ok(result.records.every(r=>r.actualSource.startsWith('Human-approved outcome')))
  const monthly=await forecast(new URLSearchParams({period:'month',start:on.slice(0,7)+'-01',on:closed,snapshotId:snapshot.id}));assert.deepEqual(monthly.accuracy,result.accuracy)
  const cadClosed=await forecast(new URLSearchParams({period:'quarter',start:nextStart,on:day(new Date(Date.parse(nextEnd)+86400000)),snapshotId:snapshot.id}));assert.equal(cadClosed.accuracy,null);assert.equal(cadClosed.summary.actualUsdMinor,null);assert.match(cadClosed.gaps.join(' '),/actual coverage is incomplete/)
  if(browser)for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try{await context.addCookies(cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}));const page=await context.newPage();await page.goto(app.origin+'/app/forecast?'+closedQuery,{waitUntil:'networkidle'});assert.match(await page.locator('#forecast-accuracy').innerText(),/167,500|1,675/);assert.match(await page.locator('#forecast-inputs').innerText(),/Signed forecast outcome/);await scanPage(page,width,'closed-accuracy');await page.goto(app.origin+'/app/forecast?'+new URLSearchParams({period:'quarter',start:nextStart,on}),{waitUntil:'networkidle'});assert.match(await page.locator('#forecast-gaps').innerText(),/No CAD reporting rate/);assert.match(await page.locator('#forecast-totals').innerText(),/Unavailable/);await scanPage(page,width,'missing-rate')}finally{await context.close()}
  }
  const weeklyAt=Date.parse(on+'T12:00:00Z')+7*86400000;await app.scheduled('0 * * * *',weeklyAt);await app.scheduled('0 * * * *',weeklyAt+3600000)
  const weekly=await forecast();assert.equal(weekly.snapshots.length,2,'Hourly Cron creates exactly one retained image per UTC week');assert.deepEqual((await forecast(new URLSearchParams({...Object.fromEntries(query),snapshotId:snapshot.id}))).baseline,retained)
  const histories=(await api('/renewals')).fields.history;assert.ok(histories.some(h=>h.key==='forecast-override'&&h.newValue.forecastOverride.reason==='Manager reviewed procurement approval'))
  await api('/accounts/'+ids[3],'DELETE',{confirmation:'Forecast account 3'});const erased=await forecast(new URLSearchParams({period:'quarter',start:nextStart,on,snapshotId:snapshot.id}));assert.deepEqual(erased.records,[]);assert.deepEqual(erased.baseline,[]);assert.equal(erased.accuracy,null)
  if(browser)assert.deepEqual(failures,[])
  console.log('RENEW-004 current month/quarter, CSM/team/segment totals, exact USD/native/rate inputs, missing sources, once-weekly retained snapshots, scoped reasoned manager overrides, movement, closed complete-cohort accuracy, incomplete actual refusal, history and erasure passed'+(browser?' with native 1440/390, axe, keyboard, reflow and visibly named controls.':'.'))
 }finally{await app.close()}
}
