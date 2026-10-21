import assert from 'node:assert/strict'
import {join} from 'node:path'
import {startWorker} from './worker.mjs'
import {scan,submit,failures} from './a11y-checks.mjs'
export async function renewalBrowser(browser,evidence){
 const app=await startWorker(),api=async(path,method='GET',body)=>{const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()}
 try{
  const end=new Date(Date.now()+40*86400000).toISOString().slice(0,10),today=new Date().toISOString().slice(0,10)
  for(let i=0;i<12;i++){
   const a=await api('/accounts','POST',{id:'synthetic-buoy-'+(500+i),name:'Renewal workspace '+i,renewalDate:end,noticeDays:30,renewalEvidence:'Confirmed notice period',billing:null,support:null})
   await api('/accounts/'+a.id+'/contract','POST',{revision:a.revision,contract:{currency:'USD',contractStart:'2026-01-01',contractEnd:end,lines:[{product:'Reporting seats',quantity:20,amountMinor:120000,frequency:'annual',entitlements:'20 seats'}],source:{reference:'Confirmed customer order '+i,confirmedOn:today}}})
  }
  const first=(await api('/renewals')).records.find(r=>r.accountId==='synthetic-buoy-500')
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
   try{
    await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...rest]=pair.split('=');return{name,value:rest.join('='),url:app.origin}}))
    const page=await context.newPage(),url=app.origin+'/app/renewals?renewal='+first.id
    const show=async id=>{const d=page.locator('#'+id);if(!await d.evaluate(el=>el.open))await d.locator('summary').click()}
    const save=async(form,label)=>{await submit(page,form.getByRole('button',{name:label,exact:true}));assert.equal(await page.locator('[role=alert]').count(),0,await page.locator('#work').innerText())}
    const proof=async label=>{await scan(page,'RENEW-001 '+label+' '+width);await page.screenshot({path:join(evidence,'renewal-'+label+'-'+width+'.png'),fullPage:true})}
    await page.goto(url,{waitUntil:'networkidle'});assert.equal(await page.locator('#renewal-list > ul > li').count(),12);await proof('board-list')
    await show('renewal-edit-panel');let form=page.locator('#renewal-edit')
    await form.getByLabel('Renewal stage',{exact:true}).selectOption('Negotiation');await form.getByLabel('Forecast category',{exact:true}).selectOption('at-risk')
    await form.getByLabel('Risk reasons (one per line)',{exact:true}).fill('Customer procurement review '+width)
    await save(form,'Save renewal pipeline')
    let current=(await api('/renewals')).records.find(r=>r.id===first.id);assert.equal(current.stage,'Negotiation');assert.deepEqual(current.riskReasons,['Customer procurement review '+width])
    const definition=async data=>{await show('renewal-field-panel');const form=page.locator('#renewal-field');await form.locator('[name=definition]').fill(JSON.stringify(data));await form.getByLabel('Field action',{exact:true}).selectOption('save');await save(form,'Apply renewal field action')}
    if(width===1440){
     for(const d of [{key:'used',label:'Used seats',type:'number'},{key:'purchased',label:'Purchased seats',type:'number'},{key:'note',label:'Review note',type:'text'},{key:'start',label:'Term start',type:'date'},{key:'package',label:'Package',type:'picklist',options:['Growth','Scale']},{key:'products',label:'Products',type:'multi-select',options:['Reports','Exports']},{key:'approved',label:'Customer approved',type:'boolean'},{key:'amount',label:'Confirmed amount',type:'currency'}])await definition(d)
     for(const r of(await api('/renewals')).records){await api('/renewals/'+r.id+'/fields','PUT',{revision:(await api('/renewals')).records.find(x=>x.id===r.id).revision,values:{used:12,purchased:20,note:'Customer-confirmed terms',start:'2026-01-01',package:'Scale',products:['Reports','Exports'],approved:true,amount:{currency:'USD',amountMinor:120000}},source:'Reviewed customer order'})}
     await page.goto(url,{waitUntil:'networkidle'})
    }
    await show('renewal-values-panel');form=page.locator('#renewal-values');const values=JSON.parse(await form.getByLabel('Renewal values (JSON object)',{exact:true}).inputValue());values.used=width===1440?14:16
    await form.getByLabel('Renewal values (JSON object)',{exact:true}).fill(JSON.stringify(values));await form.getByLabel('Renewal field source reference',{exact:true}).fill('Confirmed usage '+width);await save(form,'Save renewal field values')
    const ratio={key:'ratio_'+width,label:'Seat ratio '+width,type:'formula',formula:'custom.used / custom.purchased'}
    await show('renewal-field-panel');form=page.locator('#renewal-field');await form.locator('[name=definition]').fill(JSON.stringify(ratio));await form.getByLabel('Field action',{exact:true}).selectOption('preview')
    const before=await api('/renewals');await save(form,'Apply renewal field action')
    assert.equal(await page.locator('#renewal-field-preview > ul > li').count(),10);assert.match(await page.locator('#renewal-field-preview').innerText(),/Nothing saved/);assert.deepEqual(await api('/renewals'),before)
    await proof('ten-account-preview');await definition(ratio)
    current=(await api('/renewals')).fields.records.find(r=>r.id===first.id);assert.equal(current.values[ratio.key],values.used/20)
    for(const d of [{key:'conditional_'+width,label:'Conditional utilization '+width,type:'formula',formula:'if(custom.purchased == 0, 0, custom.'+ratio.key+' * 2)'},{key:'term_days_'+width,label:'UTC term days '+width,type:'formula',formula:'days(renewalDate, custom.start)'},{key:'portfolio_'+width,label:'Full opportunity seats '+width,type:'formula',formula:'sum(custom.used)'}])await definition(d)
    const zero=(await api('/renewals')).records.find(r=>r.accountId==='synthetic-buoy-503'),zeroFields=(await api('/renewals')).fields.records.find(r=>r.id===zero.id),zeroValues=Object.fromEntries((await api('/renewals')).fields.definitions.filter(d=>d.type!=='formula').map(d=>[d.key,zeroFields.values[d.key]]));zeroValues.purchased=0;await api('/renewals/'+zero.id+'/fields','PUT',{revision:zero.revision,values:zeroValues,source:'Confirmed zero purchased seats'});await page.goto(app.origin+'/app/renewals?renewal='+zero.id,{waitUntil:'networkidle'});assert.match(await page.locator('#renewal-record').innerText(),/Cannot divide by zero/);await proof('missing-result-explanation')
    await page.goto(app.origin+'/app/segments',{waitUntil:'networkidle'});await show('create-segment');form=page.locator('#segment-create');const name='Native same-renewal typed inputs '+width;await form.getByLabel('Segment name',{exact:true}).fill(name);await form.locator('[name=conditions]').fill(JSON.stringify([{field:'records.renewal.custom.'+ratio.key,op:'gt',value:.65},{field:'records.renewal.custom.amount.currency',op:'eq',value:'USD'},{field:'records.renewal.custom.amount.amountMinor',op:'eq',value:120000}]));await save(form,'Create segment');const segment=(await api('/segments')).segments.find(s=>s.name===name);assert.deepEqual(segment.members.map(m=>m.accountId),['synthetic-buoy-500']);await proof('typed-same-record-segment')
    await page.goto(url,{waitUntil:'networkidle'});assert.match(await page.locator('#renewal-history').innerText(),new RegExp('Confirmed usage '+width));await proof('typed-values-history')
    await show('renewal-field-panel');form=page.locator('#renewal-field');await form.locator('[name=definition]').fill(JSON.stringify({...ratio,formula:'system.exit()'}));await form.getByLabel('Field action',{exact:true}).selectOption('preview');await submit(page,form.getByRole('button',{name:'Apply renewal field action',exact:true}));assert.equal(await page.locator('[role=alert]').count(),1);await proof('formula-refusal')
    // Use a different open opportunity per viewport so both native outcomes are approved.
    const target=(await api('/renewals')).records.find(r=>r.accountId==='synthetic-buoy-'+(width===1440?501:502));await page.goto(app.origin+'/app/renewals?renewal='+target.id,{waitUntil:'networkidle'});await show('renewal-outcome-panel');form=page.locator('#renewal-outcome')
    await form.getByLabel('Renewal outcome',{exact:true}).selectOption(width===1440?'churned':'renewed-with-contraction');await form.getByLabel('Expected outcome ARR (native minor units)',{exact:true}).fill(width===1440?'0':'100000');await form.getByLabel('Outcome reason code',{exact:true}).fill('customer-confirmed');await form.getByLabel('Outcome evidence',{exact:true}).fill('Signed customer decision '+width);await save(form,'Prepare renewal outcome')
    assert.equal((await api('/renewals')).records.find(r=>r.id===target.id).outcome,null,'Preparation is no outcome')
    const approval=page.getByRole('button',{name:'Approve this renewal outcome',exact:true});await proof('prepared-outcome');await submit(page,approval)
    assert.equal(await page.locator('[role=alert]').count(),0);assert.equal((await api('/renewals')).records.find(r=>r.id===target.id).outcome,width===1440?'churned':'renewed-with-contraction');assert.match(await page.locator('#renewal-record').innerText(),/Billing reconciliation pending/);await proof('approved-outcome')
   }finally{await context.close()}
  }
  assert.deepEqual(failures,[],'Renewal inherited accessibility at both widths')
  console.log('RENEW-001 native quarter board/list, pipeline, every inherited field type, ten-account no-write preview, explanations/history, formula refusal and approval passed at 1440/390.')
 }finally{await app.close()}
}
