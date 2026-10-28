import assert from 'node:assert/strict'

// The public router inventory includes deliberately separate server transports.
// Those transports never gain staff or agent authority from a cookie.
export async function routeAuthorityMatrix({app,cookie,member,account,proposal,json}) {
 const owner=(path,method='GET',body)=>app.request('/api/buoy'+path,{cookie,method,body})
 const grant=await json(await owner('/agent-tokens','POST',{label:'Route authority reader',scopes:['renewals.list'],requestsPerMinute:10000}),201)
 const {routes}=await json(await owner('/routes'))
 assert.ok(routes.length>0,'The matrix reaches the running product router')
 const before=await json(await owner('/state'))
 for(const {method,path}of routes){
  const target=path.replace(/:([^/]+)/g,(_,name)=>{
   if(name==='id'&&path.startsWith('/api/buoy/accounts/'))return account.id
   if(name==='id'&&path.startsWith('/api/buoy/proposals/'))return proposal.id
   return 'synthetic-buoy-2029'
  })
  const body=method==='GET'?undefined:path==='/api/buoy/commands'?{command:'renewals.list'}:
   path==='/api/buoy/accounts'?{...account,id:'synthetic-buoy-2030'}:
   path==='/api/buoy/workspace/views/:id'?{revision:'synthetic-buoy-2029'}:
   /^\/api\/buoy\/accounts\/:id$/.test(path)&&method==='PUT'?{...account,revision:before.accounts[0].revision}:
   /^\/api\/buoy\/accounts\/:id$/.test(path)&&method==='DELETE'?{confirmation:account.name}:{}
  const schema=path==='/api/buoy/v1/openapi.json'
  const webhook=path==='/api/buoy/billing/:id/webhook'
  const serverData=path.startsWith('/api/buoy/v1/')&&!schema&&!path.startsWith('/api/buoy/v1/tokens')
  const sourceIntake=/^\/api\/buoy\/(?:playbooks\/intake|usage\/intake|inapp\/(?:deliver|receipts))\//.test(path)
  const signedOut=await app.request(target,{method,body,headers:{origin:null}})
  assert.equal(signedOut.status,schema?200:webhook?404:401,`${method} ${path}: no session or source credential`)
  const agent=await app.request(target,{method,body,token:grant.token,headers:{origin:'https://foreign.invalid'}})
  assert.equal(agent.status,schema||path==='/api/buoy/commands'?200:webhook?404:403,`${method} ${path}: held agent authority`)
  if(method!=='GET'){
   for(const headers of [{origin:'https://foreign.invalid'},{origin:app.origin,'sec-fetch-site':'cross-site'},{origin:null}]){
    const foreign=await app.request(target,{method,body,cookie,headers})
    const expected=webhook?404:(serverData||sourceIntake)&&headers.origin===null?401:403
    assert.equal(foreign.status,expected,`${method} ${path}: browser writes require same-site metadata; server transports require their own credential`)
   }
  }
  const colleague=await app.request(target,{method,body,cookie:member})
  if(path==='/api/buoy/accounts'&&method==='POST'||/^\/api\/buoy\/accounts\/:id$/.test(path)&&method!=='GET'||path==='/api/buoy/proposals/:id/approve'){
   assert.equal(colleague.status,403,`${method} ${path}: an ordinary member cannot change accounts or approve`)
  }else if(webhook)assert.equal(colleague.status,404)
  else if(serverData)assert.equal(colleague.status,403,'Integration data refuses browser credentials')
  else assert.ok([200,201,202,400,403,404,409].includes(colleague.status),`${method} ${path}: member reaches an authenticated outcome, got ${colleague.status}: ${await colleague.clone().text()}`)
 }
 const after=await json(await owner('/state'))
 for(const field of ['accounts','proposals','tasks','decisions'])assert.deepEqual(after[field],before[field],'The refusal matrix leaves '+field+' unchanged')
 await json(await owner('/agent-tokens/'+grant.id,'DELETE'))
 console.log(`HTTP authority matrix passed for ${routes.length} live product routes`)
}
