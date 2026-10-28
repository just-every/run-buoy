import assert from 'node:assert/strict'
import {join} from 'node:path'
import {startWorker} from './worker.mjs'
import {scan,failures} from './a11y-checks.mjs'
import {reportBuilderKeyboard,dashboardKeyboard} from './report-builder-keyboard.mjs'
export async function dashboardJourney({browser,evidence}={}){
 const app=await startWorker(),cookie=app.cookie,on=new Date().toISOString().slice(0,10),end=on.slice(0,4)+'-12-31'
 const request=(path,method='GET',body,as=cookie,headers={})=>app.request('/api/buoy'+path,{cookie:as,method,body,headers})
 const api=async(path,method='GET',body,as=cookie)=>{const r=await request(path,method,body,as);assert.ok(r.ok,await r.clone().text());return r.json()}
 const invite=async(n,role)=>{const email='synthetic-buoy-'+n+'@example.test';await app.request('/auth/invite',{cookie,method:'POST',body:{email,displayName:'Report colleague '+n,role:'member'}});const as=await app.signIn(email),id=(await api('/state','GET',undefined,as)).operator.id;await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:id,roleId:role});return {id,cookie:as}}
 const spec={name:'At-risk ARR by CSM',object:'account',rules:{match:'all',conditions:[{field:'health.status',op:'eq',value:'at-risk'}]},segmentId:null,groupBy:'ownerId',measure:'revenue.arrMinor',operation:'sum',formula:null,chart:'bar',sharedRoles:['finance','csm']}
 try{
  const finance=await invite(9100,'finance'),csm=await invite(9101,'csm'),peer=await invite(9102,'csm'),ids=[]
  for(const [i,[currency,amount]]of [['USD',120000],['USD',60000],['EUR',75000],['USD',null]].entries()){
   const id='synthetic-buoy-'+(9200+i);ids.push(id);await api('/accounts','POST',{id,name:'Report customer '+i,renewalDate:end,noticeDays:30,renewalEvidence:'Reviewed terms',billing:null,support:{observedAt:on,reference:'Support register '+i,openTickets:2,urgentTickets:1}})
   await api('/accounts/'+id+'/owner','PUT',{ownerId:i<2?csm.id:peer.id})
   if(amount!==null)await api('/accounts/'+id+'/contract','POST',{revision:(await api('/state')).accounts.find(a=>a.id===id).revision,contract:{currency,contractStart:on.slice(0,4)+'-01-01',contractEnd:end,lines:[{product:'Annual seats',quantity:1,amountMinor:amount,frequency:'annual',entitlements:'Licensed seats'}],source:{reference:'Signed report order '+i,confirmedOn:on}}})
  }
  const report=await api('/reports','POST',{spec}),run=()=>api('/reports/'+report.id)
  let result=await run();assert.equal(result.result.count,4);assert.deepEqual(result.result.groups.map(g=>[g.currency,g.count,g.missing,g.value]).sort(),[['EUR',1,0,75000],['USD',2,0,180000],[null,1,1,null]].sort());assert.match(result.interpretation,/not a historical reconstruction/)
  const preview=await(await request('/reports/'+report.id+'/delivery-preview.txt')).text();assert.ok(preview.includes('180000'));assert.match(preview,/Current account evidence/);
  const csv=await(await request('/reports/'+report.id+'/export.csv')).text();for(const g of result.result.groups)assert.ok(csv.includes('"'+(g.value??'Unavailable')+'"'));assert.ok(csv.includes('"native minor units"'))
  assert.equal((await request('/reports','POST',{spec},finance.cookie)).status,403);assert.equal((await request('/dashboards','POST',{},finance.cookie)).status,403);assert.equal((await request('/reports','POST',{spec},cookie,{origin:'https://foreign.invalid'})).status,403);assert.equal((await request('/reports')).status,200);assert.equal((await request('/reports','GET',undefined,null)).status,401)
  const segment=await api('/segments','POST',{name:'Report reviewed cohort',mode:'static',accountIds:ids.slice(0,2),rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
  const narrowed=await api('/reports','POST',{spec:{...spec,name:'Selected at-risk ARR',segmentId:segment.id}}),filtered=await api('/reports/'+narrowed.id);assert.equal(filtered.result.count,2);assert.equal(filtered.result.groups[0].value,180000)
  const calculated=await api('/reports','POST',{spec:{...spec,name:'Half native ARR',segmentId:segment.id,formula:'revenue.arrMinor / 2'}});assert.equal((await api('/reports/'+calculated.id)).result.groups[0].value,90000);assert.match((await api('/reports/'+calculated.id)).result.inputs[0].explanation,/revenue.arrMinor/)
  assert.equal((await request('/reports','POST',{spec:{...spec,formula:'unknown.field / 2'}})).status,400)
  assert.equal((await request('/reports','POST',{spec:{...spec,formula:'process.exit()'}})).status,400)
  const currencyFormula=await api('/reports','POST',{spec:{...spec,name:'Same-currency portfolio input',formula:'sum(revenue.arrMinor)'}});const currencyResult=await api('/reports/'+currencyFormula.id);assert.ok(currencyResult.result.inputs.filter(i=>ids.slice(0,2).includes(i.id)).every(i=>i.value===180000));assert.equal(currencyResult.result.inputs.find(i=>i.id===ids[2]).value,75000)
  const zero=await api('/reports','POST',{spec:{...spec,formula:'revenue.arrMinor / 0'}});assert.ok((await api('/reports/'+zero.id)).result.groups.every(g=>g.value===null))
  const dashboard=await api('/dashboards','POST',{name:'Renewal review dashboard',sharedRoles:['finance','csm'],reportIds:[report.id,narrowed.id]})
  const view=await api('/reports','GET',undefined,finance.cookie);assert.equal(view.canManage,false);assert.ok(view.dashboards.some(d=>d.id===dashboard.id));assert.deepEqual((await api('/reports/'+report.id,'GET',undefined,finance.cookie)).result.groups,result.result.groups)
  const own=await api('/reports/'+report.id,'GET',undefined,csm.cookie);assert.equal(own.result.count,2);assert.equal(own.result.groups[0].value,180000);assert.ok(!JSON.stringify(own).includes(ids[2]));assert.ok(!JSON.stringify(own).includes('Report customer 2'))
  assert.equal((await request('/reports/'+report.id+'/export.csv','GET',undefined,csm.cookie)).status,200)
  const privateReport=await api('/reports','POST',{spec:{...spec,name:'Administrator source report',sharedRoles:[],groupBy:'support.reference'}});assert.equal((await request('/reports/'+privateReport.id,'GET',undefined,finance.cookie)).status,403)
  const stale=await run();await api('/reports','POST',{id:report.id,revision:stale.revision,spec:{...spec,name:'At-risk ARR by CSM revised'}});assert.equal((await request('/reports','POST',{id:report.id,revision:stale.revision,spec})).status,409)
  if(browser)for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try{
    await context.addCookies(cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
    const page=await context.newPage(),expected=[['Report colleague 9101','USD',2,0,180000],['Report colleague 9102','EUR',1,0,75000],['Report colleague 9102','—',1,1,'Unavailable']]
    await reportBuilderKeyboard({page,app,width,evidence,spec,expected,actor:'owner'})
    await dashboardKeyboard({page,app,width,evidence,dashboard,narrowed})
    const mailbox='synthetic-buoy-9103'+'@'+'example.test'
    if(width===1440)assert.equal((await app.request('/auth/invite',{cookie,method:'POST',body:{email:mailbox,displayName:'Report administrator',role:'admin'}})).status,202)
    const admin=await app.signIn(mailbox)
    await context.clearCookies()
    await context.addCookies(admin.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
    await reportBuilderKeyboard({page,app,width,evidence,spec,expected,actor:'admin'})
   }finally{await context.close()}
   const viewer=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});try{await viewer.addCookies(finance.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}));const page=await viewer.newPage();await page.goto(app.origin+'/app/reports?dashboard='+dashboard.id,{waitUntil:'networkidle'});assert.equal(await page.locator('form').count(),0);assert.match(await page.locator('[id^=report-result-]').first().innerText(),/180000/);await scan(page,'REPORT-002 read-only '+width);await page.screenshot({path:join(evidence,'reports-viewer-'+width+'.png'),fullPage:true})}finally{await viewer.close()}
  }
  const fresh=await run();await api('/reports','POST',{id:report.id,revision:fresh.revision,spec:{...spec,sharedRoles:[]}});assert.equal((await request('/reports/'+report.id,'GET',undefined,finance.cookie)).status,403)
  await api('/accounts/'+ids[0]+'/owner','PUT',{ownerId:peer.id});assert.equal((await api('/reports/'+narrowed.id,'GET',undefined,csm.cookie)).result.count,1)
  const personal=await api('/reports','POST',{spec:{...spec,name:'Identity-specific report',rules:{match:'all',conditions:[{field:'id',op:'eq',value:ids[0]}]}}});await api('/accounts/'+ids[0],'DELETE',{confirmation:'Report customer 0'});assert.equal((await request('/reports/'+personal.id)).status,404);assert.equal((await api('/reports/'+narrowed.id)).result.count,1)
  for(const n of [0,1]){const a=await api('/accounts','POST',{id:'synthetic-buoy-'+(9300+n),name:'Precision customer '+n,renewalDate:end,noticeDays:30,renewalEvidence:'Precision terms',billing:null,support:null});await api('/accounts/'+a.id+'/contract','POST',{revision:(await api('/state')).accounts.find(r=>r.id===a.id).revision,contract:{currency:'USD',contractStart:on.slice(0,4)+'-01-01',contractEnd:end,lines:[{product:'Exact precision contract',quantity:1,amountMinor:Number.MAX_SAFE_INTEGER,frequency:'annual',entitlements:'One seat'}],source:{reference:'Precision signed order '+n,confirmedOn:on}}})}
  const precision=await api('/reports','POST',{spec:{...spec,name:'Exact report range',rules:{match:'all',conditions:[{field:'name',op:'contains',value:'Precision customer'}]},groupBy:'revenue.currency'}}),range=await api('/reports/'+precision.id);assert.equal(range.result.count,2);assert.equal(range.result.groups[0].value,null);assert.match(range.result.groups[0].reason,/exact native minor-unit range/)
  if(browser)assert.deepEqual(failures,[])
  console.log('REPORT-002 saved at-risk native ARR reports, live segment and current book scopes, missing and currency groups, formulas, dashboard role sharing, independent CSV parity, explicit readonly authority, stale edit/origin/privacy fences passed'+(browser?' at native 1440 and 390 with keyboard-only owner and admin authoring, refusal recovery, edited chart and table values, parsed browser CSV, axe and 320 reflow.':'.'))
 }finally{await app.close()}
}
