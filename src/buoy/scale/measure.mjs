import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'

export async function measure(name,limitMs,operation){
 const start=performance.now(),result=await operation(),elapsedMs=performance.now()-start
 console.log(JSON.stringify({scale:name,elapsedMs:Math.round(elapsedMs),limitMs}))
 if(limitMs!==null)assert.ok(elapsedMs<limitMs,`${name} took ${Math.round(elapsedMs)}ms; target is under ${limitMs}ms`)
 return result
}
export async function json(response,status=200){
 assert.equal(response.status,status,`Public request returned ${response.status}, expected ${status}. Body withheld to keep credentials private.`)
 return response.json()
}
export async function accountPages(worker,ids){
 for(const id of ids)for(let sample=0;sample<3;sample++)await measure('account-page '+id+' sample '+sample,2000,async()=>{
  const response=await worker.request('/app/accounts/'+id,{cookie:worker.cookie})
  assert.equal(response.status,200)
  const html=await response.text()
  assert.ok(html.includes(id),'Account page includes requested account identity')
  assert.ok(!html.includes('Unable to load Buoy'),'A 200 error page cannot satisfy account latency')
 })
}
