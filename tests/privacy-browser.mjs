import assert from 'node:assert/strict'
import {join} from 'node:path'
import {startWorker} from './worker.mjs'
import {scan,submit,failures} from './a11y-checks.mjs'

export async function privacyBrowser(browser,evidence){
 const app=await startWorker()
 const call=async(path,method='GET',body)=>{const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()}
 try{
  const account=await call('/accounts','POST',{id:'synthetic-buoy-360',name:'Customer privacy workspace',renewalDate:'2027-03-31',noticeDays:30,renewalEvidence:'Confirmed customer terms',billing:null,support:null})
  for(const width of [1440,390]){
   const person=await call('/customer-people','POST',{kind:width===1440?'contact':'user',name:'synthetic-buoy-'+width,accountIds:[account.id],source:'Reviewed customer directory'})
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try{
    await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return {name,value:rest.join('='),url:app.origin}}))
    const page=await context.newPage(),path=app.origin+'/app/customer-people?person='+person.id
    const proof=async label=>{await scan(page,'ERASE-002 '+label+' '+width);await page.screenshot({path:join(evidence,'privacy-'+label+'-'+width+'.png'),fullPage:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(evidence,'privacy-'+label+'-viewport-'+width+'.png')});for(const [part,selector]of [["owner-controls", "#privacy-export-panel"], ["receipt", "#privacy-receipts"]]){const target=page.locator(selector).first();if(await target.count())await target.screenshot({path:join(evidence,'privacy-'+label+'-'+part+'-'+width+'.png')})}}
    const show=async id=>{const d=page.locator('#'+id);if(!await d.evaluate(e=>e.open))await d.locator('summary').click()}
    await page.goto(path,{waitUntil:'networkidle'});await show('privacy-holders-panel')
    let form=page.locator('#privacy-holders')
    await form.getByLabel('External holders (JSON array)',{exact:true}).fill('invalid')
    await submit(page,form.getByRole('button',{name:'Save external holders',exact:true}))
    assert.equal(await page.locator('[role=alert]').count(),1);assert.equal(await page.locator('#privacy-holders [name=holders]').inputValue(),'invalid')
    await proof('holder-refusal')
    form=page.locator('#privacy-holders');await form.getByLabel('External holders (JSON array)',{exact:true}).fill(JSON.stringify([{system:'Salesforce',reference:'Owner-reviewed CRM inventory'},{system:'Zendesk',reference:'Owner-reviewed support inventory'}]))
    await submit(page,form.getByRole('button',{name:'Save external holders',exact:true}))
    assert.equal(await page.locator('[role=alert]').count(),0)
    await show('privacy-erase-panel');form=page.locator('#privacy-erase')
    await form.getByLabel('Type customer name to confirm erase',{exact:true}).fill('incorrect customer')
    await submit(page,form.getByRole('button',{name:'Confirm customer erasure',exact:true}))
    assert.equal(await page.locator('[role=alert]').count(),1);assert.ok((await call('/customer-people')).records.some(p=>p.id===person.id));await proof('erase-refusal')
    await page.goto(path,{waitUntil:'networkidle'});await show('privacy-export-panel');form=page.locator('#privacy-export')
    await form.getByLabel('Type customer name to confirm export',{exact:true}).fill('synthetic-buoy-'+width)
    await proof('export-confirmation')
    const [download]=await Promise.all([page.waitForEvent('download'),form.getByRole('button',{name:'Download customer export',exact:true}).click()])
    assert.equal(download.suggestedFilename(),'buoy-customer-export.json')
    const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk)
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.equal(data.records.person[0].id,person.id);assert.ok(data.receipt.externalHolders.includes('Zendesk'))
    await page.goto(path,{waitUntil:'networkidle'});await show('privacy-erase-panel');form=page.locator('#privacy-erase')
    await form.getByLabel('Type customer name to confirm erase',{exact:true}).fill('synthetic-buoy-'+width)
    await proof('erase-confirmation')
    await submit(page,form.getByRole('button',{name:'Confirm customer erasure',exact:true}))
    assert.equal(await page.locator('[role=alert]').count(),0)
    assert.match(await page.locator('#privacy-receipts').innerText(),/Customer erased/)
    assert.match(await page.locator('#privacy-receipts').innerText(),/Salesforce, Zendesk/)
    assert.ok(!(await page.locator('#work').innerText()).includes('synthetic-buoy-'+width))
    assert.ok((await call('/state')).accounts.some(a=>a.id===account.id));await proof('receipt')
   }finally{await context.close()}
  }
  assert.deepEqual(failures,[],'Privacy browser accessibility')
  console.log('ERASE-002 native owner forms, refusal recovery, JSON download, erasure and opaque receipts passed at 1440/390.')
 }finally{await app.close()}
}
