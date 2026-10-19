import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
export function importClient(request, cookie) {
 const send = (action,body,extra={}) => request('/api/operator/import/'+action,{method:'POST',body,cookie,...extra})
 const json = async (action,body,extra) => { const r=await send(action,body,extra); assert.equal(r.status,200,await r.clone().text()); return r.json() }
 const finish = async(action,body,state) => {for(let i=0;i<100;i++){const result=await json(action,body);if(result.job?.state===state)return result.job;assert.ok(['queued','applying','undoing'].includes(result.job?.state))}assert.fail('Import did not finish')}
 async function plan(value,catchup=false) {
  const bytes=Buffer.from(JSON.stringify(value)), hash=b=>createHash('sha256').update(b).digest('hex'), totalChunks=Math.ceil(bytes.length/65536)
  let uploadId
  for(let index=0;index<totalChunks;index++){const chunk=bytes.subarray(index*65536,(index+1)*65536);uploadId=(await json('uploads',{uploadId,name:'accounts.json',bundleSha256:hash(bytes),totalBytes:bytes.length,totalChunks,index,chunkSha256:hash(chunk),base64:chunk.toString('base64')})).uploadId}
  const inventory=await json('uploads',{uploadId});assert.equal(inventory.complete,true);assert.equal(inventory.received.reduce((n,c)=>n+c.size,0),bytes.length)
  return json('plan',{uploadId,...(catchup?{catchup:true}:{})})
 }
 return {send,json,plan,apply:plan=>finish('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint},'completed'),undo:plan=>finish('undo',{planId:plan.planId},'undone')}
}
