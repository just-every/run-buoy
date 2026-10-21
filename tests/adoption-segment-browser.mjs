import assert from 'node:assert/strict'
import {join} from 'node:path'
import {scan,submit} from './a11y-checks.mjs'

export async function adoptionSegmentBrowser({page,api,accounts,width,evidence,origin}){
 const account=accounts[0],on=new Date().toISOString().slice(0,10)
 await api('/adoption/seats','PUT',{accountId:account.id,seats:20,reference:'Reviewed current customer seat schedule',observedAt:on,staleDays:30})
 await page.goto(origin+'/app/segments',{waitUntil:'networkidle'})
 await page.locator('#create-segment > summary').click()
 const form=page.locator('#segment-create'),title=`License adoption review ${width}`
 await form.getByLabel('Segment name',{exact:true}).fill(title)
 const conditions=[{field:'id',op:'eq',value:account.id},{field:'adoption.current.utilization',op:'lt',value:.6}]
 await form.getByLabel('Rule conditions').fill(JSON.stringify(conditions))
 await form.getByLabel('Entry playbook title').fill('Confirm customer license adoption')
 await submit(page,form.getByRole('button',{name:'Create segment',exact:true}))
 const segment=(await api('/segments')).segments.find(s=>s.name===title)
 assert.equal(segment.members.length,1);assert.equal(segment.history.length,1)
 assert.equal((await api('/adoption?on='+on+'&accountId='+account.id)).accounts[0].metrics.current.utilization,.5)
 await scan(page,`ADOPT-001 metric segment report ${width}`)
 const panel=page.locator('#segment-'+segment.id);await panel.scrollIntoViewIfNeeded()
 if(evidence)await panel.screenshot({path:join(evidence,`adoption-segment-report-${width}.png`)})
 await page.goto(origin+'/app/accounts/'+account.id,{waitUntil:'networkidle'})
 const proposal=segment.history[0].proposalId
 await submit(page,page.locator('#approve-'+proposal).getByRole('button',{name:'Approve and create task',exact:true}))
 assert.equal((await api('/state')).tasks.filter(t=>t.proposalId===proposal).length,1)
 if(evidence)await page.locator('#work').screenshot({path:join(evidence,`adoption-segment-task-${width}.png`)})
 await page.goto(origin+'/app/segments',{waitUntil:'networkidle'})
 await page.locator('#edit-segment-'+segment.id+' > summary').click()
 const edit=page.locator('#segment-edit-'+segment.id)
 await edit.getByLabel('Rule conditions').fill(JSON.stringify([{field:'adoption.current.utilization',op:'lt',value:'0.6'}]))
 await submit(page,edit.getByRole('button',{name:'Save segment',exact:true}))
 assert.equal(await page.locator('[role=alert]').count(),1)
 assert.match(await edit.getByLabel('Rule conditions').inputValue(),/0.6/)
 await scan(page,`ADOPT-001 metric rule recovery ${width}`)
 await edit.getByLabel('Rule conditions').fill(JSON.stringify(conditions))
 await submit(page,edit.getByRole('button',{name:'Save segment',exact:true}))
 assert.equal(await page.locator('[role=alert]').count(),0)
 await page.goto(origin+'/app/adoption?on='+on+'&accountId='+account.id,{waitUntil:'networkidle'})
 assert.match(await page.locator('#adoption-summary').innerText(),/50%/)
 await scan(page,`ADOPT-001 segment consumer guidance ${width}`)
 if(evidence)await page.locator('#adoption-summary').screenshot({path:join(evidence,`adoption-consumer-summary-${width}.png`)})
}
