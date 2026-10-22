import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'

// ACCOUNT-005: a customer lookup and subsequent record changes through public
// HTTP doors. No direct D1 fixture writes and no implementation imports.
export async function searchJourney({call,json,request,cookie,member,account,signIn,scheduled}){
 const marker='Search voyage café 東京 🚢',ids=['search-coast','search-harbour','search-summit']
 const find=async(q,extra={})=>json(await call('/search?'+new URLSearchParams({q,...extra})))
 for(const [i,id] of ids.entries())await json(await call('/accounts','POST',{...account(id),name:marker+' '+i}),201)
 for(const field of [
  {key:'search_domain',label:'Customer domain',type:'text'},
  {key:'search_crm',label:'CRM external identity',type:'text'},
 ])await json(await call('/fields','POST',field),201)
 await json(await call('/customer-fields','POST',{key:'search_email',label:'Customer email',type:'text'}),201)
 const people=[]
 for(const [kind,accountIds] of [['contact',ids.slice(0,2)],['user',[ids[1]]]]){
  const person=await json(await call('/customer-people','POST',{kind,name:marker+' '+kind,accountIds,source:'Reviewed customer directory'}),201)
  const current=(await json(await call('/customer-people'))).records.find(r=>r.id===person.id)
  await json(await call('/customer-people/'+person.id+'/fields','PUT',{revision:current.revision,values:{search_email:kind+'@voyage.example'},source:'Customer-confirmed email'}))
  people.push({...person,kind,accountIds})
 }
 const a=async id=>(await json(await call('/state'))).accounts.find(a=>a.id===id)
 await json(await call('/accounts/'+ids[2]+'/fields','PUT',{revision:(await a(ids[2])).revision,values:{search_domain:'literal%_\\value'},source:'Customer-confirmed literal field'}))
 await json(await call('/accounts/'+ids[0]+'/fields','PUT',{revision:(await a(ids[0])).revision,values:{search_domain:'voyage.example',search_crm:'0015g00000CRM42'},source:'Reviewed customer CRM reference'}))
 const draft=await json(await call('/proposals','POST',{accountId:ids[0],kind:'playbook',payload:{title:marker+' customer follow-up',dueDate:'2027-02-01'}}),201)
 await json(await call('/proposals/'+draft.id+'/approve','POST',{}))
 const task=(await json(await call('/state'))).tasks.find(t=>t.proposalId===draft.id)
 assert.ok(task)
 await json(await call('/tasks/'+task.id+'/complete','POST',{outcome:'Customer launch confirmed',evidence:'Customer launch meeting reference SEA-811'}))
 const contact=(await find('CONTACT@VOYAGE.EXAMPLE')).results
 assert.deepEqual(contact.map(r=>[r.kind,r.id,r.accountIds]),[['contact',people[0].id,ids.slice(0,2)]],'Email finds one shared customer contact with both current accounts')
 assert.match(contact[0].excerpt,/contact@voyage\.example/)
 assert.deepEqual((await find('USER@voyage.example')).results.map(r=>r.id),[people[1].id])
 assert.ok((await find('VOYAGE.EXAMPLE')).results.some(r=>r.kind==='account'&&r.id===ids[0]),'Domain stored on an account is searchable')
 assert.deepEqual((await find('0015g00000crm42')).results.map(r=>r.id),[ids[0]],'Reviewed external-ID text finds the correct native account without claiming CRM sync')
 assert.deepEqual((await find('SEA-811')).results.map(r=>[r.kind,r.id]),[['task',task.id]],'Completed task evidence remains searchable')
 assert.deepEqual((await find('Customer launch confirmed')).results.map(r=>r.id),[task.id])
 const all=await find(marker),paged=[]
 assert.equal(all.results.length,6,'Three accounts, contact, user and approved task share one search')
 let cursor
 do{
  const page=await find(marker,{limit:'1',...(cursor?{cursor}:{})});paged.push(...page.results);cursor=page.nextCursor
 }while(cursor)
 assert.deepEqual(paged,all.results,'All kinds page without omission or repetition, including Unicode queries and shared people')
 assert.equal(new Set(paged.map(r=>r.kind+':'+r.id)).size,6)
 for(const result of all.results){
  assert.ok(result.excerpt.includes(marker));assert.ok(result.href.startsWith('/app/'))
  assert.ok((await find(result.id)).results.some(r=>r.kind===result.kind&&r.id===result.id),'Native record IDs are searchable')
  assert.equal((await request(result.href,{cookie})).status,200,'Each result opens its real signed-in native record')
 }
 assert.equal(all.nextCursor,null)
 assert.deepEqual((await json(await call('/search?'+new URLSearchParams({q:marker}),'GET',undefined,{cookie:member}))).results,all.results,'Member search follows existing account/customer read authority')
 await json(await request('/auth/invite',{method:'POST',cookie,body:{email:'search-admin@example.test',displayName:'Search administrator',role:'admin'}}),202)
 const admin=await signIn('search-admin@example.test')
 assert.deepEqual((await json(await call('/search?'+new URLSearchParams({q:marker}),'GET',undefined,{cookie:admin}))).results,all.results)
 assert.equal((await request('/api/buoy/search?q=voyage')).status,401)
 const agent=await json(await call('/agent-tokens','POST',{label:'Search credential custody sentinel'}),201)
 assert.equal((await call('/search?q=voyage','GET',undefined,{cookie:undefined,token:agent.token})).status,403)
 assert.equal((await find(agent.token)).results.length,0,'Search never indexes agent credentials')
 assert.equal((await find('Search credential custody sentinel')).results.length,0,'Credential labels are not customer records')
 const owner=(await json(await call('/state'))).people.find(p=>p.role==='owner')
 await json(await call('/accounts/'+ids[0]+'/mentions','POST',{personId:owner.id,note:'private-inbox-search-sentinel'}),201)
 assert.equal((await find('private-inbox-search-sentinel')).results.length,0,'A private inbox is not a shared search corpus')
 assert.deepEqual((await find('literal%_\\value')).results.map(r=>r.id),[ids[2]],'Stored percent, underscore and backslash match as ordinary text')
 for(const q of ['literalXXvalue','literal%Xvalue',"' OR 1=1 --",'no-such-search-result'])assert.deepEqual((await find(q)).results,[],'Search metacharacters are literal')
 const page=await find(marker,{limit:'1'})
 for(const query of ['', 'q=', 'q=%20', 'q=a&limit=0','q=a&limit=101','q=a&limit=1.5','q=a&cursor=garbage','q=a&q=b','q=a&unknown=b','q='+ 'x'.repeat(201),'q=a%00b',new URLSearchParams({q:'different',cursor:page.nextCursor}).toString()])
  assert.equal((await call('/search?'+query)).status,400,'Malformed query, page size or cursor is refused')
 // A current renewal opportunity and its custom text share the same search.
 await json(await call('/accounts/'+ids[1]+'/contract','POST',{revision:(await a(ids[1])).revision,contract:{currency:'USD',contractStart:'2026-01-01',contractEnd:'2027-01-31',lines:[{id:'synthetic-buoy-1',product:'Customer workspace',quantity:1,amountMinor:120000,frequency:'annual',entitlements:'One workspace'}],source:{reference:'synthetic-buoy-renewal-reference',confirmedOn:new Date().toISOString().slice(0,10)}}}),201)
 await scheduled('0 * * * *',Date.parse('2027-01-31T00:00:00Z'))
 const renewal=(await json(await call('/renewals'))).records.find(r=>r.accountId===ids[1]);assert.ok(renewal)
 await json(await call('/renewal-fields','POST',{key:'search_note',label:'Renewal search note',type:'text'}),201)
 await json(await call('/renewals/'+renewal.id+'/fields','PUT',{revision:renewal.revision,values:{search_note:'synthetic-buoy-renewal-note'},source:'Reviewed renewal record'}))
 for(const q of ['synthetic-buoy-renewal-reference','synthetic-buoy-renewal-note',renewal.id]){
  const hit=(await find(q)).results.find(r=>r.kind==='renewal');assert.equal(hit?.id,renewal.id);assert.deepEqual(hit.accountIds,[ids[1]])
  assert.equal((await request(hit.href,{cookie})).status,200,'Renewal result opens its native record')
 }
 assert.deepEqual((await json(await call('/search?q=synthetic-buoy-renewal-note','GET',undefined,{cookie:member}))).results,(await find('synthetic-buoy-renewal-note')).results)
 // Refreshes replace live values; old custom values must not remain searchable.
 await json(await call('/accounts/'+ids[0]+'/fields','PUT',{revision:(await a(ids[0])).revision,values:{search_domain:'new-voyage.example',search_crm:'0015g00000NEW83'},source:'Reviewed identity correction'}))
 assert.deepEqual((await find('0015g00000CRM42')).results,[])
 assert.deepEqual((await find('0015g00000NEW83')).results.map(r=>r.id),[ids[0]])
 await json(await call('/accounts/'+ids[0],'DELETE',{confirmation:marker+' 0'}))
 assert.deepEqual((await find('0015g00000NEW83')).results,[])
 assert.deepEqual((await find('SEA-811')).results,[],'Erased task evidence disappears immediately without an index rebuild')
 assert.deepEqual((await find('contact@voyage.example')).results,[],'Erased source-account custody is withdrawn from shared customer field search')
 const shared=(await find(marker+' contact')).results
 assert.equal(shared.length,1);assert.deepEqual(shared[0].accountIds,[ids[1]],'Shared person search retains only the surviving membership')
 for(const id of ids.slice(1))await json(await call('/accounts/'+id,'DELETE',{confirmation:marker+' '+ids.indexOf(id)}))
 assert.deepEqual((await find('synthetic-buoy-renewal-note')).results,[],'Erasure removes renewal search values immediately')
 assert.deepEqual((await find(marker)).results,[],'Account erasure withdraws all associated searchable records')
 await json(await call('/agent-tokens/'+agent.id,'DELETE'))
 console.log('ACCOUNT-005 native HTTP search: account/domain/external ID, contact/user email, task text, live edits/erasure, shared membership, pagination and staff/agent boundaries passed.')
}

export async function searchHttpJourney(){
 const {startWorker}=await import('./worker.mjs'),app=await startWorker()
 try{
  const call=(path,method='GET',body,extra={})=>app.request('/api/buoy'+path,{cookie:app.cookie,method,body,...extra})
  const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()}
  await json(await app.request('/auth/invite',{method:'POST',cookie:app.cookie,body:{email:'search-member@example.test',displayName:'Search colleague',role:'member'}}),202)
  const member=await app.signIn('search-member@example.test')
  const today=new Date().toISOString().slice(0,10)
  const account=id=>({id,name:'Search customer',renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Customer-confirmed renewal',billing:null,support:{observedAt:today,reference:'Customer support snapshot',openTickets:1,urgentTickets:1}})
  await searchJourney({call,json,request:app.request,cookie:app.cookie,member,account,signIn:app.signIn,scheduled:app.scheduled})
 }finally{await app.close()}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await searchHttpJourney()

export async function searchBrowser(browser,evidence){
 const {startWorker}=await import('./worker.mjs'),{scan,submit,focused,failures}=await import('./a11y-checks.mjs'),{join}=await import('node:path'),app=await startWorker()
 const api=async(path,method='GET',body)=>{const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()}
 try{
  for(let i=0;i<12;i++)await api('/accounts','POST',{id:'synthetic-buoy-'+(950+i),name:'Search browser customer '+i,renewalDate:'2027-01-31',noticeDays:30,renewalEvidence:'Customer-confirmed contract',billing:null,support:null})
  const customer=await api('/customer-people','POST',{kind:'contact',name:'Coastal customer contact',accountIds:['synthetic-buoy-950'],source:'Reviewed customer directory'})
  await api('/customer-fields','POST',{key:'search_email',label:'Customer email',type:'text'})
  const person=(await api('/customer-people')).records.find(p=>p.id===customer.id)
  await api('/customer-people/'+person.id+'/fields','PUT',{revision:person.revision,values:{search_email:'coast@example.test'},source:'Customer-confirmed email'})
  const account=(await api('/state')).accounts.find(a=>a.id==='synthetic-buoy-950')
  await api('/accounts/'+account.id+'/contract','POST',{revision:account.revision,contract:{currency:'USD',contractStart:'2026-01-01',contractEnd:'2027-01-31',lines:[],source:{reference:'synthetic-buoy-renewal-browser',confirmedOn:new Date().toISOString().slice(0,10)}}})
  await app.scheduled('0 * * * *',Date.parse('2027-01-31T00:00:00Z'))
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try{
    await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
    const page=await context.newPage(),proof=async label=>{await scan(page,'ACCOUNT-005 '+label+' '+width);await page.screenshot({path:join(evidence,'search-'+label+'-'+width+'.png'),fullPage:true})}
    await page.goto(app.origin+'/app/search',{waitUntil:'networkidle'});assert.match(await page.locator('#search-results').innerText(),/Enter customer text/);await proof('initial')
    const search=async(q,limit='50')=>{await page.getByLabel('Search customer records',{exact:true}).fill(q);await page.getByLabel('Results per page',{exact:true}).selectOption(limit);await submit(page,page.getByRole('button',{name:'Search records',exact:true}))}
    await search('coast@example.test');assert.equal(await page.locator('#search-results li').count(),1);assert.match(await page.locator('#search-results').innerText(),/Customer contact/);await proof('contact-email')
    const hit=page.locator('#search-results h3 a');await focused(page,hit,'Open matching customer by keyboard');await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}),page.keyboard.press('Enter')]);assert.ok(page.url().includes('person='+person.id));assert.match(await page.locator('#work').innerText(),/Coastal customer contact/)
    await page.goto(app.origin+'/app/search',{waitUntil:'networkidle'});await search('Search browser customer','10');assert.equal(await page.locator('#search-results li').count(),10);const first=await page.locator('#search-results h3 a').allTextContents();await proof('first-page');await submit(page,page.getByRole('link',{name:'Next search results',exact:true}));assert.equal(await page.locator('#search-results li').count(),3);assert.ok((await page.locator('#search-results h3 a').allTextContents()).every(v=>!first.includes(v)));await proof('next-page')
    await search('synthetic-buoy-renewal-browser');assert.match(await page.locator('#search-results').innerText(),/Renewal opportunity/);await proof('renewal');await submit(page,page.locator('#search-results h3 a'));assert.ok(page.url().includes('/app/renewals?renewal='))
    await page.goto(app.origin+'/app/search?q=coast&cursor=invalid',{waitUntil:'networkidle'});assert.equal(await page.getByRole('alert').count(),1);assert.equal(await page.getByLabel('Search customer records',{exact:true}).inputValue(),'coast');await proof('invalid-cursor');await search('not-a-customer-phrase');assert.match(await page.locator('#search-results').innerText(),/No matching current records/);assert.equal(await page.getByRole('alert').count(),0);await proof('recovered-empty')
    await search('<script>alert(1)</script>');assert.equal(await page.locator('#search-results script').count(),0);assert.match(await page.locator('#search-results').innerText(),/<script>alert/)
   }finally{await context.close()}
  }
  assert.deepEqual(failures,[],'Native search inherits axe, contrast, keyboard and 320 reflow at both widths')
  console.log('ACCOUNT-005 native search entry, contact email/deep link, pagination, renewal deep link, error recovery, empty and escaped queries at 1440/390 passed.')
 }finally{await app.close()}
}
