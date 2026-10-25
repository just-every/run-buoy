// The production CLI runs unchanged; only its network boundary is replaced.
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const fixture=JSON.parse(await readFile(process.env.BUOY_TOTANGO_EDGE_FILE,'utf8'))
let calls=0
process.on('exit',()=>{if(fixture.mode!=='denied')assert.ok(calls>0)})
globalThis.fetch=async(url,options)=>{
 assert.equal(url,fixture.region==='eu'?'https://api-eu1.totango.com/api/v1/search/accounts':'https://api.totango.com/api/v1/search/accounts')
 assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.headers['app-token'],'synthetic-buoy-8500')
 const query=JSON.parse(options.body.get('query'))
 assert.deepEqual(query,{...fixture.query,offset:calls*fixture.query.count});calls++
 if(fixture.mode==='denied')return new Response('not authorized',{status:403})
 const offset=query.offset,hits=fixture.accounts.slice(offset,offset+query.count)
 if(fixture.mode==='short')hits.pop()
 const result={response:{stats:{total_hits:fixture.accounts.length+(fixture.mode==='changed'&&calls>1?1:0)},accounts:{hits}}}
 return new Response(JSON.stringify(result,null,2)+'\r\n',{headers:{'content-type':'application/json'}})
}
