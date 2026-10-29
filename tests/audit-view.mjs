import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'

export function auditTuples(entries){
 assert.equal(new Set(entries.map(entry=>entry.id)).size,entries.length,'Audit entry identities are unique')
 return entries.map(({id,actor,action,subject,detail,occurredAt})=>{
  assert.ok(typeof id==='string'&&id.length>0,'Every audit tuple carries its persisted opaque identity')
  assert.equal(new Date(occurredAt).toISOString(),occurredAt,'Audit time is an exact recorded UTC instant')
  return {id,actor,action,subject,detail,occurredAt}
 })
}
export const archiveAudit=rows=>auditTuples(rows.filter(item=>item.table==='buoy_audit').map(({row})=>({...row,occurredAt:row.occurred_at}))).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||a.id.localeCompare(b.id))

export async function readAudit(call,query=''){
 const entries=[];let offset=0
 do{
  const page=await call('/audit?'+query+'&offset='+offset)
  assert.ok(page.entries.length<=50,'Public audit pages respect their bound')
  assert.equal(page.nextOffset,page.entries.length===50&&page.nextOffset!==null?offset+50:null,'Public audit cursor advances exactly one page')
  if(page.nextOffset!==null)assert.equal(page.entries.length,50,'A continued page is full')
  entries.push(...page.entries);offset=page.nextOffset
 }while(offset!==null)
 return auditTuples(entries)
}

export async function reconcileAuditScreen(browser,app,expected,{query='',screens}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true})
 try{
  await context.addCookies(app.cookie.split('; ').map(pair=>{const[name,...value]=pair.split('=');return{name,value:value.join('='),url:app.origin}}))
  const page=await context.newPage(),seen=[];let offset=0
  await page.goto(app.origin+'/app/audit?'+query,{waitUntil:'networkidle'})
  do{
   const records=page.locator('section').filter({has:page.getByRole('heading',{name:'Audit entries',exact:true})}).locator('article.record')
   const rendered=await records.evaluateAll(nodes=>nodes.map(node=>{
    const fields=Object.fromEntries([...node.querySelectorAll('dt')].map(dt=>[dt.textContent,dt.nextElementSibling.textContent]))
    return {id:fields['Entry reference'],actor:fields.Actor,action:node.querySelector('h3').textContent,subject:fields['Subject reference'],detail:node.querySelector(':scope > p')?.textContent??'',occurredAt:node.querySelector('time').getAttribute('datetime')}
   }))
   assert.deepEqual(auditTuples(rendered),expected.slice(offset,offset+50),'Each complete visible record matches its API identity, actor, action, subject, detail and time')
   for(let index=0;index<rendered.length;index++){
    const instant=new Date(expected[offset+index].occurredAt)
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).formatToParts(instant).map(part=>[part.type,part.value]))
    const day=parts.weekday+' '+parts.month+' '+parts.day+', '+parts.year
    const time=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',timeZone:'UTC'}).format(instant).toLowerCase()
    assert.equal((await records.nth(index).locator('time').innerText()).replace(/\s+/g,' '),day+', '+time,'Visible date and UTC clock show this record’s instant')
   }
   seen.push(...rendered)
   const next=page.getByRole('link',{name:'Next entries',exact:true})
   assert.equal(await next.count(),offset+50<expected.length?1:0,'Screen continuation neither drops nor invents a page')
   if(screens&&offset===0){
    await mkdir(screens,{recursive:true})
    const showEntries=()=>records.first().evaluate(node=>scrollTo(0,node.parentElement.getBoundingClientRect().top+scrollY-16))
    await showEntries()
    await page.screenshot({path:join(screens,'audit-1440.png')})
    await page.setViewportSize({width:390,height:1000})
    await showEntries()
    await page.screenshot({path:join(screens,'audit-390.png')})
    await page.setViewportSize({width:1440,height:1000})
   }
   offset+=50
   if(await next.count())await next.click();else break
  }while(true)
  assert.deepEqual(auditTuples(seen),expected,'All rendered pages reconcile without missing, extra, duplicated or reassociated entries')
 }finally{await context.close()}
}
