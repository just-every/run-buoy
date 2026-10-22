import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {join} from 'node:path'
import {startWorker} from './worker.mjs'
import {scan,submit,failures} from './a11y-checks.mjs'

export async function privacyBrowser(browser,evidence){
 console.log('Privacy browser: starting isolated Worker')
 const app=await startWorker()
 console.log('Privacy browser: Worker ready')
 const call=async(path,method='GET',body)=>{const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()}
 try{
  const account=await call('/accounts','POST',{id:'synthetic-buoy-360',name:'Customer privacy workspace',renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Confirmed customer terms',billing:null,support:null})
  const source=await call('/usage/sources','POST',{name:'synthetic-buoy-3900',kind:'native',reference:'Reviewed privacy browser source'})
  const credential=await call('/usage/sources/'+source.id+'/credentials','POST',{label:'synthetic-buoy-3901'})
  for(const width of [1440,390]){
   console.log('Privacy browser: fixture',width)
   const person=await call('/customer-people','POST',{kind:width===1440?'contact':'user',name:'synthetic-buoy-'+width,accountIds:[account.id],source:'Reviewed customer directory'})
   const email='synthetic-buoy-'+width+'@example.test'
   const intake=await app.dispatch(new Request(app.origin+'/api/buoy/usage/intake/'+source.id,{method:'POST',headers:{authorization:'Bearer '+credential.secret,'content-type':'application/json'},body:JSON.stringify({type:'event',event:'Privacy browser event',messageId:'synthetic-buoy-'+width,userId:'synthetic-buoy-3902',properties:{customerName:'synthetic-buoy-'+width,email}})}));assert.equal(intake.status,202)
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try{
    await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return {name,value:rest.join('='),url:app.origin}}))
    const page=await context.newPage(),path=app.origin+'/app/customer-people?person='+person.id
    const proof=async label=>{console.log('Privacy browser:',width,label);await scan(page,'ERASE-002 '+label+' '+width);await page.screenshot({path:join(evidence,'privacy-'+label+'-'+width+'.png'),fullPage:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(evidence,'privacy-'+label+'-viewport-'+width+'.png')});for(const [part,selector]of [["owner-controls", "#privacy-export-panel"], ["receipt", "#privacy-receipts"]]){const target=page.locator(selector).first();if(await target.count())await target.screenshot({path:join(evidence,'privacy-'+label+'-'+part+'-'+width+'.png')})}}
    const verified=async form=>{await form.getByLabel('Verification method',{exact:true}).selectOption('verified-offline');await form.getByLabel('Request received date (UTC)',{exact:true}).fill(new Date().toISOString().slice(0,10));await form.getByLabel('Opaque requester reference (UUID)',{exact:true}).fill(randomUUID())}
    const show=async id=>{const d=page.locator('#'+id);if(!await d.evaluate(e=>e.open))await d.locator('summary').click()}
    console.log('Privacy browser: opening native screen',width)
    await page.goto(path,{waitUntil:'networkidle'});assert.match(await page.locator('#customer-privacy').innerText(),/Unlinked personal text/);await show('privacy-holders-panel')
    let form=page.locator('#privacy-holders')
    await form.getByLabel('External holders (JSON array)',{exact:true}).fill('invalid')
    await submit(page,form.getByRole('button',{name:'Save external holders',exact:true}))
    assert.equal(await page.locator('[role=alert]').count(),1);assert.equal(await page.locator('#privacy-holders [name=holders]').inputValue(),'invalid')
    await proof('holder-refusal')
    form=page.locator('#privacy-holders');await form.getByLabel('External holders (JSON array)',{exact:true}).fill(JSON.stringify([{system:'Salesforce',reference:'Owner-reviewed CRM inventory'},{system:'Zendesk',reference:'Owner-reviewed support inventory'}]))
    await submit(page,form.getByRole('button',{name:'Save external holders',exact:true}))
    assert.equal(await page.locator('[role=alert]').count(),0)
    await show('privacy-erase-panel');form=page.locator('#privacy-erase')
    await verified(form)
    await form.getByLabel('Type customer name to confirm erase',{exact:true}).fill('incorrect customer')
    await submit(page,form.getByRole('button',{name:'Confirm customer erasure',exact:true}))
    assert.equal(await page.locator('[role=alert]').count(),1);assert.ok((await call('/customer-people')).records.some(p=>p.id===person.id));await proof('erase-refusal')
    await page.goto(path,{waitUntil:'networkidle'});await show('privacy-export-panel');form=page.locator('#privacy-export')
    await verified(form)
    await form.getByLabel('Type customer name to confirm export',{exact:true}).fill('synthetic-buoy-'+width)
    await proof('export-confirmation')
    const [download]=await Promise.all([page.waitForEvent('download'),form.getByRole('button',{name:'Download customer export',exact:true}).click()])
    assert.equal(download.suggestedFilename(),'buoy-customer-export.json')
    const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk)
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.equal(data.records.person[0].id,person.id);assert.ok(data.receipt.externalHolders.includes('Zendesk'))
    await page.goto(path,{waitUntil:'networkidle'});await show('privacy-hold-panel');form=page.locator('#privacy-hold')
    await form.getByLabel('Type customer name to confirm hold change',{exact:true}).fill('synthetic-buoy-'+width)
    await form.getByLabel('Hold reason',{exact:true}).selectOption('legal-obligation')
    await submit(page,form.getByRole('button',{name:'Set customer hold',exact:true}))
    assert.equal(await page.locator('[role=alert]').count(),0)
    const preview=async()=>{await show('privacy-preview-panel');const form=page.locator('#privacy-preview');await form.getByLabel('Customer emails (one per line)',{exact:true}).fill(email);await submit(page,form.getByRole('button',{name:'Preview customer redactions',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)}
    await preview();form=page.locator('#privacy-erase');await verified(form)
    await form.getByLabel('Type customer name to confirm erase',{exact:true}).fill('synthetic-buoy-'+width)
    assert.equal(await form.locator('input[type=checkbox]:disabled').count(),2)
    await proof('held-preview')
    await submit(page,form.getByRole('button',{name:'Confirm customer erasure',exact:true}))
    assert.equal(await page.locator('[role=alert]').count(),0);assert.match(await page.locator('#privacy-receipts').innerText(),/Retained under hold/)
    assert.ok((await call('/customer-people')).records.some(p=>p.id===person.id));await proof('held-receipt')
    await page.goto(path,{waitUntil:'networkidle'});await show('privacy-hold-panel');form=page.locator('#privacy-hold')
    await form.getByLabel('Type customer name to confirm hold change',{exact:true}).fill('synthetic-buoy-'+width)
    await form.getByLabel('Hold reason',{exact:true}).selectOption('review-completed')
    await submit(page,form.getByRole('button',{name:'Release customer hold',exact:true}));assert.equal(await page.locator('[role=alert]').count(),0)
    await preview();form=page.locator('#privacy-erase');await verified(form)
    assert.equal(await form.locator('input[type=checkbox]').count(),2)
    for(const choice of await form.locator('input[type=checkbox]').all())await choice.check()
    await form.getByLabel('Type customer name to confirm erase',{exact:true}).fill('synthetic-buoy-'+width)
    await proof('erase-confirmation')
    await submit(page,form.getByRole('button',{name:'Confirm customer erasure',exact:true}))
    assert.equal(await page.locator('[role=alert]').count(),0)
    assert.match(await page.locator('#privacy-receipts').innerText(),/Customer erased/)
    assert.match(await page.locator('#privacy-receipts').innerText(),/Salesforce, Zendesk/)
    assert.ok(!(await page.locator('#work').innerText()).includes('synthetic-buoy-'+width))
    const events=await call('/usage/events?sourceId='+source.id);assert.ok(!JSON.stringify(events).includes(email));assert.ok(!JSON.stringify(events).includes('customerName\":\"synthetic-buoy-'+width))
    assert.ok((await call('/state')).accounts.some(a=>a.id===account.id));await proof('receipt')
   }finally{await context.close()}
  }
  assert.deepEqual(failures,[],'Privacy browser accessibility')
  console.log('ERASE-002 native verified-request forms, exact text preview/redaction, holds, refusal recovery, JSON download, erasure and opaque receipts passed at 1440/390.')
 }finally{await app.close()}
}
