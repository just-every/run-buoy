import type {TrustPage} from '../data-trust'
import {button,disclosure,escape,field,form,hidden,money,personSelect,section,textarea,valueOf} from './html'
import type {Fields,State} from './types'

export function dataTrustPanel(data:TrustPage,state:State,fields?:Fields){
 const action=fields?.action,base='/app/audit'
 const scan=form('trust-scan',base,hidden('action','trust-scan')+'<p>Find possible duplicate names, differences between confirmed and Stripe ARR, and stale sources behind health. Preparation changes no customer data.</p>'+button('Prepare trust review'))
 const draft=action==='trust-mapping'?fields:undefined
 const mapping=form('trust-mapping',base,hidden('action','trust-mapping')+field('sourceId','Segment source ID',valueOf(draft,'sourceId'))+field('groupId','Exact group ID',valueOf(draft,'groupId'))+field('userId','Exact user ID (optional)',valueOf(draft,'userId'),'text',false)+field('personId','Customer person ID (for user claims)',valueOf(draft,'personId'),'text',false)+`<label>Correct account<select aria-label="Correct account" name="accountId" required><option value="">Choose the reviewed account</option>${state.accounts.map(a=>`<option value="${escape(a.id)}"${draft?.accountId===a.id?' selected':''}>${escape(a.name)} (${escape(a.id)})</option>`).join('')}</select></label>`+textarea('reason','Source reference and correction evidence',valueOf(draft,'reason'),true,'maxlength="2000" aria-label="Source reference and correction evidence"')+button('Propose group correction'))
 const rows=data.proposals.map(row=>{
  const draft=action==='trust-review'&&fields?.id===row.id?fields:undefined
  const source=row.evidence
  const record=(label:string,value:unknown)=>`<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`
  let facts=''
  if(row.kind==='duplicate')facts=(source.accounts as {id:string;name:string}[]).map(a=>record('Company',`${a.name} (${a.id})`)).join('')+record('Match basis',source.match)
  else if(row.kind==='arr'){
   const contract=source.contract as {currency:string;arrMinor:number;reference:string},stripe=source.stripe as {reference:string;observedAt:string;amounts:{currency:string;arr:{roundedMinor:number}}[]}
   facts=`<dt>Confirmed ARR</dt><dd>${escape(contract.currency)} ${money(contract.arrMinor,contract.currency)}</dd>`+record('Contract reference',contract.reference)+`<dt>Stripe ARR</dt><dd>${stripe.amounts.map(a=>escape(a.currency)+' '+money(a.arr.roundedMinor,a.currency)).join(', ')}</dd>`+record('Stripe reference',stripe.reference)+record('Observed at',stripe.observedAt)
  }else if(row.kind==='mapping'){
   const preview=source.preview as {source:{name:string;reference:string};previous:{account_id:string};account:{id:string};claims:{eventCount:number}},claim=source.claim as {userId:string|null;groupId:string;personId:string|null}
   facts=record('Source',preview.source.name)+record('Source reference',preview.source.reference)+record('Exact group',claim.groupId)+record('Exact user',claim.userId??'Group only')+record('Previous account',preview.previous.account_id)+record('Correct account',preview.account.id)+record('Affected observations',preview.claims.eventCount)+record('Source-owner evidence',source.reference)
   if(source.sourceClaim){const observed=source.sourceClaim as {messageId:string;observedAt:string};facts+=`<dt>Stored group observation</dt><dd><a href="/api/buoy/usage/events?sourceId=${encodeURIComponent((source.claim as {sourceId:string}).sourceId)}&amp;messageId=${encodeURIComponent(observed.messageId)}">Open source observation</a> · ${escape(observed.observedAt)} UTC</dd>`}
  }else facts=(source.sources as {kind:string;staleAfterDays:number}[]).map(s=>record('Stale health source',`${s.kind}: older than ${s.staleAfterDays} days`)).join('')
  const evidence=`<details><summary>Review source evidence</summary><dl>${facts}</dl></details>`
  const review=row.status==='prepared'?form('trust-review-'+row.id,base,hidden('action','trust-review')+hidden('id',row.id)+`<label>Decision<select aria-label="Decision" name="decision"><option value="approve"${draft?.decision==='approve'?' selected':''}>Approve ${row.kind==='mapping'?'exact correction':'fix task'}</option><option value="reject"${draft?.decision==='reject'?' selected':''}>Reject proposal</option></select></label>`+textarea('reason','Review reason',valueOf(draft,'reason'),true,'maxlength="2000" aria-label="Review reason"')+(row.kind!=='mapping'?personSelect('ownerId','Source owner for fix task',state.people,valueOf(draft,'ownerId',state.operator.id),'Choose an active person',false)+field('dueDate','Fix task due date',valueOf(draft,'dueDate'),'date',false)+'<p>Owner and due date are required when approving a fix task.</p>':'' )+button('Record trust decision')):`<p>${escape(row.status)} · ${escape(row.reviewedAt)} UTC · ${escape(row.reason)}</p>`
  return `<article class="record" id="trust-${escape(row.id)}"><h3>${escape(row.title)}</h3><p><a href="/app/accounts/${encodeURIComponent(row.accountId)}">Open affected account</a></p><p>${escape(row.fix)}</p>${evidence}${review}</article>`
 }).join('')
 return disclosure('Data trust review','Prepare findings, review evidence and approve exact work.',scan+disclosure('Correct a Segment group','Use a source-owner reference; no identity is inferred.',mapping,'trust-mapping-panel',!!draft)+section('Trust proposals',rows||'<p>No data trust proposals yet.</p>','trust-proposals'),'data-trust',action?.startsWith('trust-')??false)
}
