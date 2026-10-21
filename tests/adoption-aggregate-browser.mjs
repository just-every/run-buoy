// ADOPT-001 segment aggregate alerts: real forms and owner inbox at both widths.
import assert from 'node:assert/strict'
import {join} from 'node:path'
import {scan,submit,focused} from './a11y-checks.mjs'
export async function adoptionAggregateBrowser({page,api,accounts,width,evidence,origin}){
 const ids=accounts.slice(0,2).map(a=>a.id),on=new Date().toISOString().slice(0,10)
 const segment=await api('/segments','POST',{name:'Aggregate adoption review '+width,mode:'static',accountIds:ids,rules:{match:'all',conditions:[]},tier:null,stage:null,playbook:null})
 const show=async id=>{const p=page.locator('#'+id);if(!await p.evaluate(e=>e.open))await p.locator('summary').click()}
 const proof=async(label,locator)=>{await scan(page,`ADOPT-001 segment aggregate ${label} ${width}`);if(evidence){await locator.scrollIntoViewIfNeeded();await locator.screenshot({path:join(evidence,`aggregate-${label}-${width}.png`)})}}
 const expected=(await api('/adoption')).segments.find(s=>s.id===segment.id).metrics.current.utilization
 assert.equal(typeof expected,'number')
 await page.goto(origin+'/app/adoption',{waitUntil:'networkidle'});await show('adoption-consumer-create')
 let form=page.locator('#adoption-consumer-new')
 const title='Review segment adoption '+width
 await form.getByLabel('Measure name',{exact:true}).fill(title)
 await form.getByLabel('Measure scope',{exact:true}).selectOption('segment')
 await form.getByLabel('Aggregate segment',{exact:true}).selectOption(segment.id)
 await form.getByLabel('Adoption metric',{exact:true}).selectOption('adoption.current.utilization')
 await form.getByLabel('Threshold comparison',{exact:true}).selectOption('lte')
 await form.getByLabel('Threshold value (blank for is missing)',{exact:true}).fill(String(expected))
 // The unfinished health consumer is honestly refused, preserving all entries.
 await submit(page,form.getByRole('button',{name:'Create adoption measure',exact:true}))
 assert.equal(await page.locator('[role=alert]').count(),1)
 assert.equal(await form.getByLabel('Aggregate segment',{exact:true}).inputValue(),segment.id)
 assert.equal(await form.getByLabel('Threshold value (blank for is missing)',{exact:true}).inputValue(),String(expected))
 await proof('refused-health',page.locator('#adoption-consumer-create'))
 await form.getByLabel('Affect health',{exact:true}).selectOption('false')
 const create=form.getByRole('button',{name:'Create adoption measure',exact:true});await create.focus();await focused(page,create,`ADOPT-001 aggregate keyboard save ${width}`)
 await submit(page,create);assert.equal(await page.locator('[role=alert]').count(),0)
 let rule=(await api('/adoption/consumers')).rules.find(r=>r.name===title);assert.ok(rule)
 let measures=(await api('/adoption/consumers')).evaluations.find(e=>e.accountId===ids[0]).measures.find(m=>m.ruleId===rule.id)
 assert.equal(measures.subjects[0].value,expected);assert.equal(measures.subjects[0].id,segment.id);assert.equal(measures.matched,true)
 assert.deepEqual(measures.seatEvidence.map(s=>s.accountId).sort(),ids.toSorted())
 await show('adoption-consumer-'+rule.id);await show('adoption-consumer-evidence-'+ids[0])
 assert.ok((await page.locator('#adoption-consumer-evidence-'+ids[0]).innerText()).includes('Aggregate adoption review '+width))
 await proof('configured',page.locator('#adoption-consumer-'+rule.id))
 await proof('evidence',page.locator('#adoption-consumer-evidence-'+ids[0]))
 await page.goto(origin+'/app/notifications',{waitUntil:'networkidle'})
 assert.ok((await page.locator('main').innerText()).includes(title));await proof('owner-inbox',page.locator('main'))
 await api('/adoption/seats','PUT',{accountId:ids[1],seats:null})
 await page.goto(origin+'/app/adoption',{waitUntil:'networkidle'});await show('adoption-consumer-evidence-'+ids[0])
 measures=(await api('/adoption/consumers')).evaluations.find(e=>e.accountId===ids[0]).measures.find(m=>m.ruleId===rule.id)
 assert.equal(measures.subjects[0].value,null);assert.equal(measures.missing,true)
 assert.match(await page.locator('#adoption-consumer-evidence-'+ids[0]).innerText(),/Required adoption measure is unknown/)
 await proof('peer-denominator-missing',page.locator('#adoption-consumer-evidence-'+ids[0]))
 await show('adoption-consumer-'+rule.id);form=page.locator('#adoption-consumer-'+rule.id+' form')
 await form.getByLabel('Measure enabled',{exact:true}).selectOption('false')
 await submit(page,form.getByRole('button',{name:'Save measure changes',exact:true}))
 rule=(await api('/adoption/consumers')).rules.find(r=>r.id===rule.id);assert.equal(rule.enabled,false)
 await show('adoption-consumer-'+rule.id)
 await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'ADOPT-001 aggregate controls reflow to 320')
 await page.setViewportSize({width,height:1000});await proof('disabled',page.locator('#adoption-consumer-'+rule.id))
 await api('/adoption/seats','PUT',{accountId:ids[1],seats:20,reference:'Restored segment member license schedule',observedAt:on})
}
