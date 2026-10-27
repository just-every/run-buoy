import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync,spawnSync} from 'node:child_process'
import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {csvRows} from '../src/buoy/migrate/csv.ts'

export async function totangoApiJourney({app,scratch,door,columns,state,before,target}){
 const [header,...rows]=csvRows(await readFile('fixtures/move-in/totango/accounts.csv','utf8'))
 const selected=header.filter(key=>!['Account ID','Account Name'].includes(key))
 const query={terms:[{type:'string',term:'status_group',in_list:['paying']}],fields:selected.map(attribute=>({type:'string_attribute',attribute,field_display_name:attribute})),count:10,scope:'all'}
 const accounts=rows.map(values=>{const row=Object.fromEntries(header.map((key,i)=>[key,values[i]]));return {name:row['Account ID'],display_name:row['Account Name'],selected_fields:selected.map(key=>row[key])}})
 const queryFile=join(scratch,'query.json'),edgeFile=join(scratch,'edge.json'),output=join(scratch,'api-bundle.json')
 await writeFile(queryFile,JSON.stringify(query))
 const fixture={query,accounts,region:'eu'};await writeFile(edgeFile,JSON.stringify(fixture))
 const args=['--import','./tests/totango-api-edge.mjs','src/buoy/migrate/cli.mjs','--source','totango','--api-query',queryFile,'--region','eu','--columns',JSON.stringify({...columns,id:'name',name:'display_name'}),'--output',output]
 const env={...process.env,BUOY_TOTANGO_APP_TOKEN:'synthetic-buoy-8500',BUOY_TOTANGO_EDGE_FILE:edgeFile}
 const prepared=execFileSync(process.execPath,args,{env,encoding:'utf8'})
 assert.doesNotMatch(prepared,/synthetic-buoy-8500/)
 const input=JSON.parse(await readFile(output,'utf8'))
 assert.equal(input.api.pages.length,2);assert.deepEqual(input.api.query,query);assert.equal(input.csv,undefined)
 assert.ok(!JSON.stringify(input).includes('synthetic-buoy-8500'),'The credential never enters retained source custody')
 for(const [i,page]of input.api.pages.entries()){
  const expected=JSON.stringify({response:{stats:{total_hits:20},accounts:{hits:accounts.slice(i*10,i*10+10)}}},null,2)+'\r\n'
  assert.equal(page.text,expected);assert.equal(page.sha256,createHash('sha256').update(expected).digest('hex'))
 }
 const plan=await door.plan(input);assert.equal(plan.counts.mapped,20);assert.equal(plan.counts.rejected,0);assert.equal(plan.diagnostics.filter(d=>d.field==='Health Profile').length,20)
 assert.deepEqual(await state(app),before);await door.apply(plan)
 for(let n=1;n<=20;n++){
  const row=(await state(app)).find(a=>a.id===target('totango','synthetic-buoy-'+n));assert.ok(row)
  assert.equal(row.name,'Synthetic Totango '+n);assert.equal(row.renewalDate,'2027-03-31');assert.equal(row.noticeDays,n);assert.equal(row.renewalEvidence,'synthetic-buoy-'+n)
  assert.equal(row.billing.totalMinor,n*100+25);assert.equal(row.support.openTickets,n)
 }
 assert.equal((await door.json('reconcile',{planId:plan.planId})).ok,true);await door.undo(plan);assert.deepEqual(await state(app),before)
 for(const mode of ['denied','short','changed']){
  await writeFile(edgeFile,JSON.stringify({...fixture,mode}))
  const denied=spawnSync(process.execPath,args.map(value=>value===output?join(scratch,mode+'.json'):value),{env,encoding:'utf8'})
  assert.notEqual(denied.status,0);assert.doesNotMatch(denied.stdout+denied.stderr,/synthetic-buoy-8500/)
  await assert.rejects(readFile(join(scratch,mode+'.json')),{code:'ENOENT'})
 }
 for(const alter of [api=>{api.pages[0].text+=' '},api=>{api.pages.pop()},api=>{api.pages[1].offset=0}]){
  const changed=structuredClone(input);alter(changed.api);const rejected=await door.plan(changed)
  assert.equal(rejected.counts.mapped,0);assert.equal(rejected.counts.rejected,1);await door.json('undo',{planId:rejected.planId})
 }
 const mixed=await door.plan({...input,csv:'forbidden'});assert.equal(mixed.counts.mapped,0);assert.match(mixed.rejected[0].reason,/second export representation/);await door.json('undo',{planId:mixed.planId})
 return input
}

export function apiBrowserBundle(input){
 const [header,...rows]=csvRows(input.csv),labels=header.filter(key=>![input.columns.id,input.columns.name].includes(key))
 const hits=rows.map(values=>{const row=Object.fromEntries(header.map((key,i)=>[key,values[i]]));return {name:row[input.columns.id],display_name:row[input.columns.name],selected_fields:labels.map(label=>row[label])}})
 const text=JSON.stringify({response:{stats:{total_hits:hits.length},accounts:{hits}}})
 return {format:input.format,source:'totango',dateOrder:input.dateOrder,columns:{...input.columns,id:'name',name:'display_name'},api:{region:'us',query:{terms:[],fields:labels.map(attribute=>({type:'string_attribute',attribute,field_display_name:attribute})),count:1000},retrievedAt:'2026-10-25T12:00:00Z',pages:[{offset:0,text,sha256:createHash('sha256').update(text).digest('hex')}]}}
}

// Deliberately synthetic opaque documents, never a purported vendor definition schema.
export function referenceFiles(){
 const documents=[
  {name:'definitions.json',kind:'successplay-definitions',document:{id:'synthetic-buoy-9100',version:3,trigger:{kind:'event',conditions:[]},actions:[{id:'synthetic-buoy-9101',kind:'task',timing:{days:2},assignment:'synthetic-buoy-9102'},{id:'synthetic-buoy-9103',kind:'unsupported',configuration:{'a / b~c':true}}],successFlowId:'synthetic-buoy-9104'}},
  {name:'categories.json',kind:'successflow-categories',document:{id:'synthetic-buoy-9104',label:'Synthetic category',associations:['synthetic-buoy-9100']}},
 ]
 return documents.map(({document,...reference})=>{const text='\uFEFF'+JSON.stringify(document,null,2).replaceAll('\n','\r\n')+'\r\n';return {...reference,text,sha256:createHash('sha256').update(text).digest('hex')}})
}
const referenceFields=[
 'definitions.json#','definitions.json#/id','definitions.json#/version','definitions.json#/trigger','definitions.json#/trigger/kind','definitions.json#/trigger/conditions',
 'definitions.json#/actions','definitions.json#/actions/0','definitions.json#/actions/0/id','definitions.json#/actions/0/kind','definitions.json#/actions/0/timing','definitions.json#/actions/0/timing/days','definitions.json#/actions/0/assignment',
 'definitions.json#/actions/1','definitions.json#/actions/1/id','definitions.json#/actions/1/kind','definitions.json#/actions/1/configuration','definitions.json#/actions/1/configuration/a ~1 b~0c','definitions.json#/successFlowId',
 'categories.json#','categories.json#/id','categories.json#/label','categories.json#/associations','categories.json#/associations/0',
]
export async function totangoReferenceJourney({app,scratch,input,door,state,before}){
 const references=referenceFiles(),manifest=join(scratch,'references.json'),output=join(scratch,'with-references.json')
 for(const reference of references)await writeFile(join(scratch,reference.name),reference.text)
 await writeFile(manifest,JSON.stringify(references.map(({name,kind})=>({name,kind,path:name}))))
 const args=['src/buoy/migrate/cli.mjs','--source','totango','--input','fixtures/move-in/totango/accounts.csv','--columns',JSON.stringify(input.columns),'--references',manifest,'--output',output]
 execFileSync(process.execPath,args)
 const bundle=JSON.parse(await readFile(output,'utf8'));assert.deepEqual(bundle.references,references)
 assert.equal(bundle.csv,input.csv);assert.equal(bundle.originalSha256,input.originalSha256)
 const plan=await door.plan(bundle)
 assert.equal(plan.counts.mapped,20);assert.equal(plan.counts.rejected,0)
 const diagnostics=plan.diagnostics.filter(d=>['definitions.json','categories.json'].includes(d.sourceId))
 assert.deepEqual(diagnostics.map(d=>d.field).sort(),[...referenceFields].sort(),'Every supplied source element, including containers and empty arrays, is explicitly unmapped')
 for(const diagnostic of diagnostics){assert.match(diagnostic.message,/no playbook or automation is created/);assert.match(diagnostic.location.pointer,/^\/references\/[01]\/text$/)}
 assert.deepEqual(await state(app),before,'Reference review writes no native accounts')
 const automation=async()=>{
  const books=await (await app.request('/api/buoy/playbooks',{cookie:app.cookie})).json()
  const snapshot=await (await app.request('/api/buoy/state',{cookie:app.cookie})).json()
  return {definitions:books.definitions,runs:books.runs,tasks:snapshot.tasks,outbound:app.outbound.length}
 }
 const inert=await automation()
 assert.equal((await door.send('apply',{planId:plan.planId,reviewedFingerprint:'0'.repeat(64)})).status,403)
 const job=await door.apply(plan);assert.equal((await door.apply(plan)).id,job.id)
 assert.equal((await state(app)).length,before.length+20)
 assert.equal((await door.json('status',{planId:plan.planId})).job.id,job.id)
 assert.equal((await door.json('reconcile',{planId:plan.planId})).ok,true)
 await app.scheduled();assert.deepEqual(await automation(),inert,'Source task and trigger descriptions never become executable configuration')
 await door.undo(plan);assert.deepEqual(await state(app),before);assert.deepEqual(await automation(),inert)
 for(const alter of [
  refs=>{refs[0].text+=' '},
  refs=>{refs.push({...refs[0]})},
  refs=>{refs[0].kind='unknown'},
  refs=>{refs[0].text='{"id":1,"id":2}';refs[0].sha256=createHash('sha256').update(refs[0].text).digest('hex')},
 ]){
  const changed=structuredClone(bundle);alter(changed.references)
  const refused=await door.plan(changed);assert.equal(refused.counts.mapped,0);assert.equal(refused.counts.rejected,1)
  assert.deepEqual(await state(app),before);await door.json('undo',{planId:refused.planId})
 }
 // Source credentials must be refused before a preparer creates a durable bundle.
 await writeFile(join(scratch,'definitions.json'),JSON.stringify({headers:{Authorization:'synthetic-buoy-9199'}}))
 const denied=spawnSync(process.execPath,args.map(value=>value===output?join(scratch,'credential-reference.json'):value),{encoding:'utf8'})
 assert.notEqual(denied.status,0);assert.doesNotMatch(denied.stdout+denied.stderr,/synthetic-buoy-9199/)
 await assert.rejects(readFile(join(scratch,'credential-reference.json')),{code:'ENOENT'})
 assert.deepEqual(await automation(),inert)
}
