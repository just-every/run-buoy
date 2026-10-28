import assert from 'node:assert/strict'
import {join} from 'node:path'
import {readFile} from 'node:fs/promises'
import {startWorker} from './worker.mjs'
import {scan,submit,failures,openForms} from './a11y-checks.mjs'
export async function dashboardJourney({browser,evidence}={}){
 const on='2026-10-15',app=await startWorker({clock:Date.parse(on+'T12:00:00Z')}),cookie=app.cookie,end=on.slice(0,4)+'-12-31'
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
   try{await context.addCookies(cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}));const page=await context.newPage();await page.goto(app.origin+'/app/reports',{waitUntil:'networkidle'});await page.locator('#report-create-panel > summary').click();const form=page.locator('#report-create');await form.getByLabel('Report name',{exact:true}).fill('Native report '+width);await form.locator('textarea[name=rules]').fill('{ invalid JSON');await submit(page,form.getByRole('button',{name:'Save report',exact:true}));assert.match(await page.locator('[role=alert]').innerText(),/valid report JSON/);assert.equal(await page.getByLabel('Report name',{exact:true}).inputValue(),'Native report '+width);await page.locator('#report-create textarea[name=rules]').fill(JSON.stringify(spec.rules));await page.getByLabel('Viewer role IDs, comma separated (optional)',{exact:true}).fill('finance');await submit(page,page.locator('#report-create').getByRole('button',{name:'Save report',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0);assert.match(await page.locator('[id^=report-result-]').innerText(),/180000/);await openForms(page);await scan(page,'REPORT-002 author '+width);await page.screenshot({path:join(evidence,'reports-author-'+width+'.png'),fullPage:true});const download=page.waitForEvent('download');await page.getByRole('link',{name:'Export Native report '+width+' to CSV',exact:true}).focus();await page.keyboard.press('Enter');const artifact=await download;assert.equal(await artifact.failure(),null);for(const chart of ['table','bar']){const editedId=new URL(page.url()).searchParams.get('report'),panel=page.locator('#report-edit-panel-'+editedId);if(!await panel.evaluate(el=>el.open))await panel.locator('summary').click();const editForm=page.locator('#report-edit-'+editedId),editor=editForm.locator('textarea[name=spec]'),definition=JSON.parse(await editor.inputValue());await editor.fill(JSON.stringify({...definition,chart}));await submit(page,editForm.getByRole('button',{name:'Save report changes',exact:true}));assert.equal(await page.getByRole('alert').count(),0,await page.getByRole('alert').allTextContents().then(v=>v.join(' ')))}await page.goto(app.origin+'/app/reports?dashboard='+dashboard.id,{waitUntil:'networkidle'});await page.locator('#dashboard-create-panel > summary').click();const dform=page.locator('#dashboard-create');await dform.getByLabel('Dashboard name',{exact:true}).fill('Native dashboard '+width);await dform.locator('textarea[name=reportIds]').fill(narrowed.id);await dform.getByLabel('Dashboard viewer role IDs, comma separated (optional)',{exact:true}).fill('finance');await submit(page,dform.getByRole('button',{name:'Save dashboard',exact:true}));assert.match(await page.locator('[id^=report-result-]').innerText(),/2 matching accounts/);await scan(page,'REPORT-002 dashboard '+width);await page.screenshot({path:join(evidence,'reports-dashboard-'+width+'.png'),fullPage:true})}finally{await context.close()}
   const viewer=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});try{await viewer.addCookies(finance.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}));const page=await viewer.newPage();await page.goto(app.origin+'/app/reports?dashboard='+dashboard.id,{waitUntil:'networkidle'});assert.equal(await page.locator('form').count(),0);assert.match(await page.locator('[id^=report-result-]').first().innerText(),/180000/);await scan(page,'REPORT-002 read-only '+width);await page.screenshot({path:join(evidence,'reports-viewer-'+width+'.png'),fullPage:true})}finally{await viewer.close()}
  }
  const fresh=await run();await api('/reports','POST',{id:report.id,revision:fresh.revision,spec:{...spec,sharedRoles:[]}});assert.equal((await request('/reports/'+report.id,'GET',undefined,finance.cookie)).status,403)
  await api('/accounts/'+ids[0]+'/owner','PUT',{ownerId:peer.id});assert.equal((await api('/reports/'+narrowed.id,'GET',undefined,csm.cookie)).result.count,1)
  const personal=await api('/reports','POST',{spec:{...spec,name:'Identity-specific report',rules:{match:'all',conditions:[{field:'id',op:'eq',value:ids[0]}]}}});await api('/accounts/'+ids[0],'DELETE',{confirmation:'Report customer 0'});assert.equal((await request('/reports/'+personal.id)).status,404);assert.equal((await api('/reports/'+narrowed.id)).result.count,1)
  for(const n of [0,1]){const a=await api('/accounts','POST',{id:'synthetic-buoy-'+(9300+n),name:'Precision customer '+n,renewalDate:end,noticeDays:30,renewalEvidence:'Precision terms',billing:null,support:null});await api('/accounts/'+a.id+'/contract','POST',{revision:(await api('/state')).accounts.find(r=>r.id===a.id).revision,contract:{currency:'USD',contractStart:on.slice(0,4)+'-01-01',contractEnd:end,lines:[{product:'Exact precision contract',quantity:1,amountMinor:Number.MAX_SAFE_INTEGER,frequency:'annual',entitlements:'One seat'}],source:{reference:'Precision signed order '+n,confirmedOn:on}}})}
  const precision=await api('/reports','POST',{spec:{...spec,name:'Exact report range',rules:{match:'all',conditions:[{field:'name',op:'contains',value:'Precision customer'}]},groupBy:'revenue.currency'}}),range=await api('/reports/'+precision.id);assert.equal(range.result.count,2);assert.equal(range.result.groups[0].value,null);assert.match(range.result.groups[0].reason,/exact native minor-unit range/)
  await starterDashboards({app,api,request,browser,evidence,csm,peer,finance,on,end})
  if(browser)assert.deepEqual(failures,[])
  console.log('REPORT-002 saved at-risk native ARR reports, live segment and current book scopes, missing and currency groups, formulas, dashboard role sharing, independent CSV parity, explicit readonly authority, stale edit/origin/privacy fences passed'+(browser?' at native 1440/390 with keyboard export, refusal recovery, axe and 320 reflow.':'.'))
 }finally{await app.close()}
}

// Independent cohort and totals exercise the built Worker, native forms and
// actual downloaded bytes. No expected count comes from another report.
async function starterDashboards({app,api,request,browser,evidence,csm,peer,finance,on,end}){
 const people=[csm,peer],ids=Array.from({length:6},(_,i)=>'synthetic-buoy-'+(9400+i))
 const values=[10,55,90,null,90,55].map((report_health,i)=>({report_health,report_selected:i===5?0:1}))
 const revision=async id=>(await api('/state')).accounts.find(a=>a.id===id).revision
 for(const [key,label]of [['report_health','Starter health input'],['report_selected','Starter membership input']])await api('/fields','POST',{key,label,type:'number'})
 for(const [i,score]of [10,55,90,null,90,55].entries()){
  await api('/accounts','POST',{id:ids[i],name:'Starter customer '+i,renewalDate:end,noticeDays:30,renewalEvidence:'Reviewed starter terms',billing:null,support:null})
  if(i!==4)await api('/accounts/'+ids[i]+'/owner','PUT',{ownerId:people[[0,1,0,1,0,1][i]].id})
  await api('/accounts/'+ids[i]+'/fields','PUT',{revision:await revision(ids[i]),values:{report_health:score,report_selected:i===5?0:1},source:'Reviewed independent starter register'})
 }
 await api('/scorecards/publish','POST',{revision:null,config:{name:'Starter health register',measures:[{key:'health',name:'Reviewed starter health',field:'custom.report_health',min:0,max:100,weight:1,direction:'higher',missing:'unknown'}],bands:{riskBelow:40,healthyAt:75},segments:[]}})
 const segment=await api('/segments','POST',{name:'Starter current membership',mode:'dynamic',accountIds:[],rules:{match:'all',conditions:[{field:'custom.report_selected',op:'eq',value:1}]},tier:null,stage:null,playbook:null})
 const names=['Current portfolio health distribution','Current CSM book size'],presets=['portfolio-health','csm-book-size'],created=[]
 const expectedHealth=[['at-risk','at-risk',1],['healthy','healthy',2],['unknown','unknown',1],['watch','watch',1]],expectedBooks=[[csm.id,'Report colleague 9101',2],[peer.id,'Report colleague 9102',2],[null,'Unassigned',1]]
 const order=rows=>rows.toSorted((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 const verifyCsv=(text,name,groups)=>assert.deepEqual(order(csvCells(text)),order([['Report','Grouping','Currency','Accounts','Missing inputs','Value','Unit','Formula'],...groups.map(([,label,count])=>[name,label,'',String(count),'0',String(count),'accounts','count'])]),'Every parsed CSV field and group matches the independent cohort, without missing, extra or duplicate rows')
 async function verifyRun(item,groups,members,as){
  const run=await api('/reports/'+item.reportId,'GET',undefined,as)
  assert.equal(run.result.count,members.length)
  assert.deepEqual(order(run.result.groups.map(g=>[g.group,g.label,g.count,g.currency,g.missing,g.value,g.reason])),order(groups.map(([group,label,count])=>[group,label,count,null,0,count,null])))
  assert.deepEqual(order(run.result.inputs.map(i=>[i.id,i.value])),order(members.map(id=>[id,1])),'Current membership is applied before grouping and counting')
  verifyCsv(await(await request('/reports/'+item.reportId+'/export.csv','GET',undefined,as)).text(),names[item.kind],groups)
 }
 async function verifyPage(page,item,groups){
  const result=page.locator('#report-result-'+item.reportId)
  assert.deepEqual(order(await result.locator('tbody tr').evaluateAll(rows=>rows.map(row=>[...row.cells].map(cell=>cell.textContent.trim())))),order(groups.map(([,label,count])=>[label,'—',String(count),'0',String(count)])))
  assert.deepEqual(order(await result.locator('meter').evaluateAll(meters=>meters.map(m=>[m.getAttribute('aria-label'),Number(m.value)]))),order(groups.map(([,label,count])=>[label+'  value',count])))
  assert.deepEqual(order(await result.locator('ul[aria-label] > li').allTextContents()),order(groups.map(([,label,count])=>label+' : '+count+' '+count)))
  const download=page.waitForEvent('download');await result.getByRole('link',{name:'Export '+names[item.kind]+' to CSV',exact:true}).click()
  const artifact=await download;assert.equal(await artifact.failure(),null);verifyCsv(await readFile(await artifact.path(),'utf8'),names[item.kind],groups)
 }
 const adminEmail='synthetic-buoy-9103'+'@'+'example.test'
 assert.equal((await app.request('/auth/invite',{cookie:app.cookie,method:'POST',body:{email:adminEmail,displayName:'Starter administrator',role:'admin'}})).status,202)
 const adminCookie=await app.signIn(adminEmail)
 const all=await api('/dashboards','POST',{presetId:presets[0],segmentId:null},adminCookie)
 await verifyRun({reportId:all.reportId,kind:0},[['at-risk','at-risk',1],['healthy','healthy',2],['unknown','unknown',6],['watch','watch',2]],['synthetic-buoy-9201','synthetic-buoy-9202','synthetic-buoy-9203','synthetic-buoy-9300','synthetic-buoy-9301',...ids],adminCookie)
 const before=await api('/reports'),outbound=app.outbound.length
 for(const body of [{presetId:'absent',segmentId:null},{presetId:presets[0],segmentId:'absent'},{presetId:presets[0],segmentId:null,sharedRoles:['finance']},{presetId:presets[0],segmentId:null,schedule:{channel:'slack'}}])assert.equal((await request('/dashboards','POST',body)).status,400)
 for(const [as,headers,status]of [[null,{},401],[finance.cookie,{},403],[app.cookie,{origin:'https://foreign.invalid'},403]])assert.equal((await request('/dashboards','POST',{presetId:presets[0],segmentId:segment.id},as,headers)).status,status)
 assert.deepEqual(await api('/reports'),before,'Refused starter requests create neither reports nor dashboards')
 for(const width of browser?[1440,390]:[null]){
  const context=browser?await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true}):null
  try{
   if(context)await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
   const page=context?await context.newPage():null
   for(const kind of [0,1]){
    const prior=await api('/reports');let dashboardId,reportId
    if(page){
     await page.goto(app.origin+'/app/reports',{waitUntil:'networkidle'});await page.locator('#dashboard-preset-panel > summary').click()
     const form=page.locator('#dashboard-preset');await form.getByLabel('Starter dashboard',{exact:true}).selectOption(presets[kind]);await form.getByLabel('Starter segment',{exact:true}).selectOption(segment.id)
     await submit(page,form.getByRole('button',{name:'Create private starter',exact:true}));assert.equal(await page.getByRole('alert').count(),0)
     dashboardId=new URL(page.url()).searchParams.get('dashboard')
    }else{const saved=await api('/dashboards','POST',{presetId:presets[kind],segmentId:segment.id});dashboardId=saved.id;reportId=saved.reportId}
    const catalog=await api('/reports'),dashboard=catalog.dashboards.find(d=>d.id===dashboardId)
    assert.ok(dashboard);assert.equal(catalog.dashboards.length,prior.dashboards.length+1);assert.equal(catalog.reports.length,prior.reports.length+1)
    assert.deepEqual(dashboard.sharedRoles,[]);assert.equal(dashboard.reportIds.length,1);reportId??=dashboard.reportIds[0];assert.deepEqual(dashboard.reportIds,[reportId])
    const report=catalog.reports.find(r=>r.id===reportId);assert.deepEqual(report.spec.sharedRoles,[]);assert.equal(report.spec.segmentId,segment.id)
    assert.equal(report.spec.groupBy,kind===0?'health.status':'ownerId');assert.equal(report.spec.operation,'count');assert.equal(report.spec.formula,null)
    const item={id:dashboardId,reportId,kind};created.push(item)
    await verifyRun(item,kind===0?expectedHealth:expectedBooks,ids.slice(0,5))
    assert.equal((await request('/reports/'+reportId,'GET',undefined,finance.cookie)).status,403,'A starter creates no viewer grant')
    assert.ok(!(await api('/reports','GET',undefined,finance.cookie)).dashboards.some(d=>d.id===dashboardId))
    if(page){
     if(width===1440){await verifyPage(page,item,kind===0?expectedHealth:expectedBooks);await scan(page,'Private starter '+kind)}
     await page.screenshot({path:join(evidence,'starter-'+presets[kind]+'-'+width+'.png'),fullPage:true})
    }
   }
  }finally{await context?.close()}
 }
 assert.equal(app.outbound.length,outbound,'Explicit starter creation sends no provider request')
 const selected=created.filter((_,i)=>i<2)
 async function reconcile(health,books,members){
  for(const item of created)await verifyRun(item,item.kind===0?health:books,members)
  if(browser){const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});try{
   await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}));const page=await context.newPage()
   for(const item of selected){await page.goto(app.origin+'/app/reports?dashboard='+item.id,{waitUntil:'networkidle'});await verifyPage(page,item,item.kind===0?health:books)}
  }finally{await context.close()}}
 }
 const setValues=async(i,patch)=>{Object.assign(values[i],patch);return api('/accounts/'+ids[i]+'/fields','PUT',{revision:await revision(ids[i]),values:values[i],source:'Reviewed changed starter register'})}
 await setValues(0,{report_selected:0});await setValues(5,{report_selected:1})
 const members=ids.slice(1),memberHealth=[['healthy','healthy',2],['unknown','unknown',1],['watch','watch',2]]
 await reconcile(memberHealth,[[csm.id,'Report colleague 9101',1],[peer.id,'Report colleague 9102',3],[null,'Unassigned',1]],members)
 await api('/accounts/'+ids[2]+'/owner','PUT',{ownerId:peer.id})
 const books=[[peer.id,'Report colleague 9102',4],[null,'Unassigned',1]]
 await reconcile(memberHealth,books,members)
 await setValues(1,{report_health:90});await setValues(3,{report_health:10})
 await reconcile([['at-risk','at-risk',1],['healthy','healthy',3],['watch','watch',1]],books,members)
 // Sharing remains an explicit separate action, and follows the viewer's
 // current book on every read. A moved account is never resurrected by a share.
 const book=selected[1],saved=(await api('/reports/'+book.reportId))
 await api('/reports','POST',{id:book.reportId,revision:saved.revision,spec:{...saved.spec,sharedRoles:['csm']}})
 await verifyRun(book,[[peer.id,'Report colleague 9102',4]],ids.slice(1).filter((_,i)=>i!==3),peer.cookie)
 await api('/accounts/'+ids[1]+'/owner','PUT',{ownerId:csm.id})
 await verifyRun(book,[[peer.id,'Report colleague 9102',3]],[ids[2],ids[3],ids[5]],peer.cookie)
 const shared=await api('/reports/'+book.reportId);await api('/reports','POST',{id:book.reportId,revision:shared.revision,spec:{...shared.spec,sharedRoles:[]}})
 assert.equal((await request('/reports/'+book.reportId+'/export.csv','GET',undefined,peer.cookie)).status,403)
 await api('/accounts/'+ids[3],'DELETE',{confirmation:'Starter customer 3'})
 await reconcile([['healthy','healthy',3],['watch','watch',1]],[[csm.id,'Report colleague 9101',1],[peer.id,'Report colleague 9102',2],[null,'Unassigned',1]],[ids[1],ids[2],ids[4],ids[5]])
 assert.equal((await request('/accounts','POST',{id:ids[3],name:'Starter customer 3',renewalDate:end,noticeDays:30,renewalEvidence:'Replayed starter',billing:null,support:null})).status,409)
 for(const i of [1,2,4,5])await setValues(i,{report_selected:0})
 await reconcile([],[],[])
 console.log('REPORT-002 private health and CSM starters reconcile every HTTP, chart, table and parsed CSV group after membership, ownership, source, revocation and erasure changes; empty cohorts remain empty.')
}

function csvCells(text){
 const rows=[];let row=[],value='',quoted=false
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}
  else if(c===','&&!quoted){row.push(value);value=''}
  else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value=''}
  else value+=c
 }
 assert.equal(quoted,false,'Downloaded CSV quotes are balanced')
 if(value||row.length){row.push(value);rows.push(row)}
 return rows
}
