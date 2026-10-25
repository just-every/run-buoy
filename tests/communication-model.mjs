// Real inference is opt-in and permitted only after the held credential is
// qualified as belonging to a provider test or sandbox account.
import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {startWorker} from './worker.mjs'
assert.equal(process.env.BUOY_MODEL_SANDBOX,'confirmed','Confirm provider test or sandbox credential scope before this journey.')
assert.ok(process.env.ANTHROPIC_API_KEY,'Inject the held sandbox credential by name.')
const bytes=await readFile(new URL('./fixtures/communication-month.json',import.meta.url)),corpus=JSON.parse(bytes),model='claude-haiku-5-5',capMinor=20
const app=await startWorker({clock:Date.parse('2026-10-25T12:00:00Z'),bindings:()=>({AI_ANTHROPIC_API_KEY:process.env.ANTHROPIC_API_KEY}),providerFetch:request=>fetch(request)})
try{
 const api=async(path,method='GET',body)=>{const r=await app.request('/api/buoy'+path,{cookie:app.cookie,method,body});assert.ok(r.ok,await r.clone().text());return r.json()}
 await api('/ai/settings','PUT',{...(await api('/ai')).settings,enabled:true,communicationsEnabled:true,provider:'anthropic',model,classes:['emails','tickets'],budgetMinor:capMinor,requestMinor:2,inputUsdPerMillion:0.1,outputUsdPerMillion:0.5,requestsPerMinute:20,noTraining:true,termsReference:'Synthetic evaluation only; provider training practices remain unverified.'})
 const scores=[]
 for(const account of corpus.accounts){
  await api('/accounts','POST',{id:account.id,name:account.name,renewalDate:'2027-09-30',noticeDays:30,renewalEvidence:'Synthetic evaluation',billing:null,support:null})
  for(const m of account.messages)await api('/ai/communications','POST',{id:m.id,accountId:account.id,dataClass:m.dataClass,observedOn:m.observedAt.slice(0,10),body:m.text})
  const result=await api('/ai/communications/score','POST',{accountId:account.id,month:'2026-09',consent:true})
  scores.push({accountId:account.id,expected:account.expected,...result})
 }
 const ranks=values=>values.map(v=>{const lower=values.filter(n=>n<v).length,equal=values.filter(n=>n===v).length;return lower+(equal+1)/2})
 const actual=ranks(scores.map(r=>r.score)),expected=scores.map(r=>r.expected.rank),mean=values=>values.reduce((a,b)=>a+b,0)/values.length,a=mean(actual),b=mean(expected)
 const spearman=actual.reduce((sum,x,i)=>sum+(x-a)*(expected[i]-b),0)/Math.sqrt(actual.reduce((sum,x)=>sum+(x-a)**2,0)*expected.reduce((sum,y)=>sum+(y-b)**2,0)),bands=scores.filter(r=>r.band===r.expected.band).length,totalMinor=scores.reduce((sum,r)=>sum+r.cost.chargedMinor,0)
 const result={synthetic:true,model,providerMode:'confirmed test or sandbox',corpusSha256:createHash('sha256').update(bytes).digest('hex'),capMinor,totalMinor,spearman,bands,scores}
 await writeFile(process.env.BUOY_MODEL_OUTPUT??'communication-model-result.json',JSON.stringify(result,null,2)+'\n')
 assert.ok(totalMinor<=capMinor);assert.ok(spearman>=0.8,'Synthetic ranking correlation');assert.ok(bands>=9,'Synthetic sentiment bands');console.log(JSON.stringify({passed:true,spearman,bands,capMinor,totalMinor}))
}finally{await app.close()}
