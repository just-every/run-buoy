// The actual preparation command runs; only the provider HTTP boundary is fake.
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const fixture=JSON.parse(await readFile(process.env.BUOY_CHURNZERO_EDGE_FILE,'utf8'))
let calls=0
globalThis.fetch=async(input,options)=>{
 const url=new URL(input)
 assert.equal(url.origin,fixture.query.tenant);assert.equal(url.pathname,'/public/v1/Account')
 assert.equal(options.method,'GET');assert.equal(options.redirect,'error')
 assert.equal(options.headers.authorization,'Basic '+Buffer.from('synthetic-buoy-credentials:synthetic-buoy-8501').toString('base64'))
 const offset=calls++*fixture.query.pageSize
 assert.equal(url.searchParams.get('$select'),fixture.query.select.join(','))
 assert.equal(url.searchParams.get('$filter'),fixture.query.filter)
 assert.equal(url.searchParams.get('$count'),'true');assert.equal(url.searchParams.get('$orderby'),'Id asc')
 assert.equal(url.searchParams.get('$skip'),String(offset));assert.equal(url.searchParams.get('$top'),String(fixture.query.pageSize))
 if(fixture.mode==='denied')return new Response('private provider error body',{status:403})
 if(fixture.mode==='redirect')return new Response(null,{status:302,headers:{location:'https://example.invalid/redirect'}})
 const rows=fixture.accounts.slice(offset,offset+fixture.query.pageSize)
 if(fixture.mode==='short')rows.pop()
 if(fixture.mode==='reflected')rows[0].Name='synthetic-buoy-8501'
 if(fixture.mode==='duplicate'&&calls>1)rows[0].ExternalId=fixture.accounts[0].ExternalId
 const result={'@odata.count':fixture.accounts.length+(fixture.mode==='changed'&&calls>1?1:0),value:rows,
  ...(offset+rows.length<fixture.accounts.length?{'@odata.nextLink':'https://example.invalid/never-fetch'}:{})}
 return new Response(JSON.stringify(result,null,2)+'\r\n',{headers:{'content-type':'application/json'}})
}
