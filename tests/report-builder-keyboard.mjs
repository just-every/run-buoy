import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {focused,openForms,scan,submit,type} from './a11y-checks.mjs'

import {show as open,choose} from './native-keyboard.mjs'

// Parse the actual attachment independently of the application's CSV writer.
function csvRows(text){
 const rows=[];let row=[],field='',quoted=false
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(c==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted
  }else if(!quoted&&(c===','||c==='\n')){
   row.push(field.replace(/\r$/,''));field=''
   if(c==='\n'){rows.push(row);row=[]}
  }else field+=c
 }
 assert.equal(quoted,false,'The downloaded CSV has complete quoted fields')
 if(field||row.length){row.push(field);rows.push(row)}
 return rows
}

async function values(page,id,name,expected,chart){
 const result=page.locator('#report-result-'+id)
 assert.match(await result.innerText(),/4 matching accounts/)
 const table=result.getByRole('table',{name:name+' values',exact:true})
 const rows=await table.locator('tbody tr').evaluateAll(nodes=>nodes.map(row=>[...row.cells].map(cell=>cell.textContent.trim())))
 assert.deepEqual(rows.sort(),expected.map(group=>group.map(String)).sort(),'Every report table row matches the independently seeded currencies, counts, missing inputs and totals')
 const bars=result.getByRole('list',{name:name+' chart',exact:true})
 if(chart==='bar'){
  assert.equal(await bars.locator('li').count(),expected.length,'Every group has its chart alternative')
  for(const [label,currency,,,value]of expected){
   const item=bars.locator('li').filter({hasText:label+' '+(currency==='—'?'':currency)+':'})
   assert.equal(await item.count(),1)
   assert.ok((await item.innerText()).includes(String(value)),'The chart text agrees with its semantic table')
   const meter=item.locator('meter')
   if(value==='Unavailable')assert.equal(await meter.count(),0,'Missing money never acquires a fabricated bar')
   else{assert.equal(await meter.count(),1);assert.equal(await meter.getAttribute('value'),String(value));assert.equal(await meter.getAttribute('aria-label'),label+' '+currency+' value')}
  }
 }else assert.equal(await bars.count(),0,'The table display removes the graphical bars')
}

async function download(page,name,expected,formula){
 const link=page.getByRole('link',{name:'Export '+name+' to CSV',exact:true})
 await focused(page,link,'Report download keyboard focus')
 const [artifact]=await Promise.all([page.waitForEvent('download'),page.keyboard.press('Enter')])
 assert.equal(await artifact.failure(),null)
 const [header,...rows]=csvRows(await readFile(await artifact.path(),'utf8'))
 assert.deepEqual(header,['Report','Grouping','Currency','Accounts','Missing inputs','Value','Unit','Formula'])
 assert.deepEqual(rows.sort(),expected.map(([label,currency,count,missing,value])=>[name,label,currency==='—'?'':currency,String(count),String(missing),String(value),'native minor units',formula]).sort(),'The browser attachment has every expected group and field, without missing, extra or duplicate rows')
}

export async function reportBuilderKeyboard({page,app,width,evidence,spec,expected,actor}){
 const name=`Native "ARR", report ${actor} ${width}`
 await page.goto(app.origin+'/app/reports',{waitUntil:'networkidle'})
 await open(page,page.locator('#report-create-panel'))
 let form=page.locator('#report-create')
 await type(page,form.getByLabel('Report name',{exact:true}),name)
 for(const [label,value]of [['Group by','ownerId'],['Measure','revenue.arrMinor'],['Aggregation','sum'],['Segment',''],['Display','bar']])await choose(page,form.getByRole('combobox',{name:label,exact:true}),value)
 await type(page,form.getByRole('textbox',{name:'Filter rules JSON',exact:true}),'{ invalid JSON')
 await type(page,form.getByLabel('Calculated column formula (optional)',{exact:true}),'')
 await type(page,form.getByLabel('Viewer role IDs, comma separated (optional)',{exact:true}),'finance')
 await submit(page,form.getByRole('button',{name:'Save report',exact:true}))
 const error=page.getByRole('alert')
 assert.match(await error.innerText(),/valid report JSON/)
 assert.ok(await error.evaluate(element=>element===document.activeElement),'Validation announces and focuses the error')
 assert.equal(await page.getByLabel('Report name',{exact:true}).inputValue(),name,'Validation retains the typed report name')
 assert.equal(await page.getByRole('textbox',{name:'Filter rules JSON',exact:true}).inputValue(),'{ invalid JSON')
 await scan(page,'Report keyboard validation '+actor+' '+width)
 await type(page,page.getByRole('textbox',{name:'Filter rules JSON',exact:true}),JSON.stringify(spec.rules))
 await submit(page,page.locator('#report-create').getByRole('button',{name:'Save report',exact:true}))
 assert.equal(await page.getByRole('alert').count(),0)
 const id=new URL(page.url()).searchParams.get('report')
 assert.ok(id,'The native form navigates to its newly saved report')
 await values(page,id,name,expected,'bar')
 await openForms(page)
 await scan(page,'Report keyboard author '+actor+' '+width)
 await page.screenshot({path:join(evidence,'reports-author-'+actor+'-'+width+'.png'),fullPage:true})
 await download(page,name,expected,'revenue.arrMinor')
 const revised=name+' revised',half=expected.map(([label,currency,count,missing,value])=>[label,currency,count,missing,typeof value==='number'?value/2:value])
 for(const chart of ['table','bar']){
  const panel=page.locator('#report-edit-panel-'+id)
  await open(page,panel)
  form=page.locator('#report-edit-'+id)
  await type(page,form.getByRole('textbox',{name:'Report definition JSON',exact:true}),JSON.stringify({...spec,name:revised,sharedRoles:['finance'],formula:'revenue.arrMinor / 2',chart}))
  await submit(page,form.getByRole('button',{name:'Save report changes',exact:true}))
  assert.equal(await page.getByRole('alert').count(),0)
  await values(page,id,revised,half,chart)
 }
 await download(page,revised,half,'revenue.arrMinor / 2')
 await openForms(page)
 await scan(page,'Report keyboard edited '+actor+' '+width)
 await page.screenshot({path:join(evidence,'reports-edited-'+actor+'-'+width+'.png'),fullPage:true})
 return id
}

export async function dashboardKeyboard({page,app,width,evidence,dashboard,narrowed}){
 await page.goto(app.origin+'/app/reports?dashboard='+dashboard.id,{waitUntil:'networkidle'})
 await open(page,page.locator('#dashboard-create-panel'))
 const form=page.locator('#dashboard-create')
 await type(page,form.getByLabel('Dashboard name',{exact:true}),'Native dashboard '+width)
 await type(page,form.getByRole('textbox',{name:'Report IDs, comma separated',exact:true}),narrowed.id)
 await type(page,form.getByLabel('Dashboard viewer role IDs, comma separated (optional)',{exact:true}),'finance')
 await submit(page,form.getByRole('button',{name:'Save dashboard',exact:true}))
 assert.match(await page.locator('[id^=report-result-]').innerText(),/2 matching accounts/)
 await scan(page,'REPORT-002 dashboard '+width)
 await page.screenshot({path:join(evidence,'reports-dashboard-'+width+'.png'),fullPage:true})
}
