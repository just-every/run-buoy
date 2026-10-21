// ADOPT-001 native configuration, health, routed-inbox and refusal/recovery.
import assert from 'node:assert/strict'
import {join} from 'node:path'
import {scan,submit,focused} from './a11y-checks.mjs'
import {currentAdoption} from './adoption-current-fixture.mjs'
export async function adoptionConsumerBrowser({page,api,accounts,people,sdk,width,evidence,origin}){
 const on=new Date().toISOString().slice(0,10),accountId=accounts[0].id
 await currentAdoption({sdk,people},'native-consumer-'+width)
 const state=await api('/state'),current=state.accounts.find(a=>a.id===accountId)
 await api('/accounts/'+accountId,'PUT',{id:current.id,name:current.name,renewalDate:current.renewalDate,noticeDays:current.noticeDays,renewalEvidence:current.renewalEvidence,revision:current.revision,billing:{observedAt:on,reference:'Current paid invoice for adoption review',currency:'USD',totalMinor:10000,creditsMinor:0,allocatedMinor:10000,dueDate:on},support:{observedAt:on,reference:'Support review with no urgent tickets',openTickets:0,urgentTickets:0}})
 await api('/accounts/'+accountId+'/owner','PUT',{ownerId:state.operator.id,note:'Current adoption reviewer'})
 await api('/adoption/seats','PUT',{accountId,seats:20,reference:'Reviewed adoption license schedule',observedAt:on})
 const show=async id=>{const p=page.locator('#'+id);if(!await p.evaluate(e=>e.open))await p.locator('summary').click()}
 const proof=async(label,locator)=>{await scan(page,`ADOPT-001 health and routed alerts ${label} ${width}`);if(evidence){await page.screenshot({path:join(evidence,`consumer-${label}-${width}.png`)});if(locator)await locator.screenshot({path:join(evidence,`consumer-${label}-detail-${width}.png`)})}}
 await page.goto(origin+'/app/adoption',{waitUntil:'networkidle'});await show('adoption-consumer-create')
 let form=page.locator('#adoption-consumer-new')
 await form.getByLabel('Measure name',{exact:true}).fill('Review low product adoption '+width)
 await form.getByLabel('Measure scope',{exact:true}).selectOption('account');await form.getByLabel('Adoption metric',{exact:true}).selectOption('adoption.current.utilization')
 await form.getByLabel('Threshold comparison',{exact:true}).selectOption('lte');await form.getByLabel('Threshold value (blank for is missing)',{exact:true}).fill('0.5')
 // Refusal through native form transport must preserve all the user's entries.
 await form.getByLabel('Affect health',{exact:true}).selectOption('false');await form.getByLabel('Route an alert',{exact:true}).selectOption('false')
 await submit(page,form.getByRole('button',{name:'Create adoption measure',exact:true}))
 assert.equal(await page.locator('[role=alert]').count(),1);assert.equal(await form.getByLabel('Threshold value (blank for is missing)',{exact:true}).inputValue(),'0.5')
 await proof('refusal',page.locator('#adoption-consumer-create'))
 await form.getByLabel('Affect health',{exact:true}).selectOption('true');await form.getByLabel('Route an alert',{exact:true}).selectOption('true')
 const create=form.getByRole('button',{name:'Create adoption measure',exact:true});await create.focus();await focused(page,create,`ADOPT-001 keyboard measure save ${width}`)
 await submit(page,create);assert.equal(await page.locator('[role=alert]').count(),0)
 const consumer=(await api('/adoption/consumers')).rules.find(r=>r.name==='Review low product adoption '+width)
 assert.ok(consumer)
 await show('adoption-consumer-'+consumer.id);await show('adoption-consumer-evidence-'+accountId)
 assert.match(await page.locator('#adoption-consumer-evidence-'+accountId).innerText(),/0.5/)
 assert.match(await page.locator('#adoption-consumer-evidence-'+accountId).innerText(),/Reviewed adoption license schedule/)
 await proof('configured',page.locator('#adoption-consumer-'+consumer.id))
 await page.goto(origin+'/app/accounts/'+accountId,{waitUntil:'networkidle'})
 assert.match(await page.locator('main').innerText(),/Review low product adoption/)
 assert.equal((await api('/state')).accounts.find(a=>a.id===accountId).health.status,'at-risk')
 await proof('account-risk',page.locator('main'))
 await page.goto(origin+'/app?intro=hidden',{waitUntil:'networkidle'});assert.match(await page.locator('main').innerText(),/Review low product adoption/)
 await proof('runway-risk',page.locator('main'))
 await page.goto(origin+'/app/notifications',{waitUntil:'networkidle'});assert.match(await page.locator('main').innerText(),new RegExp('Review low product adoption '+width))
 await proof('owner-inbox',page.locator('main'))
 await page.goto(origin+'/app/adoption',{waitUntil:'networkidle'});await show('adoption-consumer-'+consumer.id);form=page.locator('#adoption-consumer-'+consumer.id+' form')
 await form.getByLabel('Threshold value (blank for is missing)',{exact:true}).fill('0.1');await submit(page,form.getByRole('button',{name:'Save measure changes',exact:true}))
 assert.equal((await api('/state')).accounts.find(a=>a.id===accountId).health.status,'healthy')
 await page.goto(origin+'/app/accounts/'+accountId,{waitUntil:'networkidle'});await proof('account-recovered',page.locator('main'))
 await api('/adoption/seats','PUT',{accountId,seats:null})
 await page.goto(origin+'/app/accounts/'+accountId,{waitUntil:'networkidle'})
 assert.equal((await api('/state')).accounts.find(a=>a.id===accountId).health.status,'unknown');assert.match(await page.locator('main').innerText(),/Required adoption measure is unknown/)
 await proof('account-missing',page.locator('main'))
 await page.goto(origin+'/app/adoption',{waitUntil:'networkidle'});await show('adoption-consumer-'+consumer.id);await show('adoption-consumer-evidence-'+accountId)
 await proof('missing-evidence',page.locator('#adoption-consumer-evidence-'+accountId))
 form=page.locator('#adoption-consumer-'+consumer.id+' form');await form.getByLabel('Measure enabled',{exact:true}).selectOption('false');await submit(page,form.getByRole('button',{name:'Save measure changes',exact:true}))
 assert.equal((await api('/state')).accounts.find(a=>a.id===accountId).health.status,'healthy')
 await show('adoption-consumer-'+consumer.id);await page.setViewportSize({width:320,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'ADOPT-001 consumer configuration and evidence reflow to 320')
 await page.setViewportSize({width,height:1000});await proof('disabled',page.locator('#adoption-consumer-'+consumer.id))
 await api('/adoption/seats','PUT',{accountId,seats:20,reference:'Restored native adoption schedule',observedAt:on})
}
