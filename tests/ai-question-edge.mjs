import assert from 'node:assert/strict'

export const scriptedQuestions=[
 'Why is Harbour at risk?',
 'Which accounts renew next quarter?',
 'Prepare a meeting brief',
 'Which accounts have no executive contact?',
 'What evidence is missing?',
]

// This fake lives only at the paid model edge. A missing question fails here,
// independently of the endpoint assertions of returned records and prose.
export function scriptedResponse(payload){
 const question=scriptedQuestions.find(q=>payload.instructions.includes(q))
 assert.ok(question,'Generation instructions must contain the actual scripted question')
 assert.match(payload.instructions,/2026-10-25/,'Relative renewal questions have the current UTC date')
 const generated=payload.instructions.startsWith('Generate')
 const visible=r=>(r.id??r.accountId)==='synthetic-buoy-8002'
 const next=r=>(r.id??r.accountId)==='synthetic-buoy-8020'
 if(!generated){
  const select=question===scriptedQuestions[0]?visible:question===scriptedQuestions[1]?next:question===scriptedQuestions[2]?()=>true:()=>false
  return {indexes:payload.records.flatMap((r,i)=>select(r)?[i]:[])}
 }
 const chosen=payload.records.flatMap((r,index)=>{
  const relevant=question===scriptedQuestions[0]?visible(r)&&r.field==='health':question===scriptedQuestions[1]?next(r)&&r.field==='renewal':question===scriptedQuestions[2]?['identity','health','renewal'].includes(r.field):false
  if(!relevant)return []
  const prefix=question===scriptedQuestions[0]?'Harbour risk assessment: ':question===scriptedQuestions[1]?'Next-quarter renewal: ':'Meeting preparation: '
  return [{text:prefix+r.quote,sources:[{index,quote:r.quote}]}]
 })
 return {claims:chosen}
}
