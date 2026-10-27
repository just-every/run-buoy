import type {TrustPage} from '../data-trust'
import {button,disclosure,escape,field,form,hidden,personSelect,section,textarea,valueOf} from './html'
import type {Fields,State} from './types'

export function dataTrustPanel(data:TrustPage,state:State,fields?:Fields){
 const action=fields?.action,base='/app/audit'
 const scan=form('trust-scan',base,hidden('action','trust-scan')+'<p>Find possible duplicate names, differences between confirmed and Stripe ARR, and stale sources behind health. Preparation changes no customer data.</p>'+button('Prepare trust review'))
 const draft=action==='trust-mapping'?fields:undefined
 const mapping=form('trust-mapping',base,hidden('action','trust-mapping')+field('sourceId','Segment source ID',valueOf(draft,'sourceId'))+field('groupId','Exact group ID',valueOf(draft,'groupId'))+field('userId','Exact user ID (optional)',valueOf(draft,'userId'),'text',false)+field('personId','Customer person ID (for user claims)',valueOf(draft,'personId'),'text',false)+`<label>Correct account<select name="accountId" required><option value="">Choose the reviewed account</option>${state.accounts.map(a=>`<option value="${escape(a.id)}"${draft?.accountId===a.id?' selected':''}>${escape(a.name)} (${escape(a.id)})</option>`).join('')}</select></label>`+textarea('reason','Source reference and correction evidence',valueOf(draft,'reason'),true,'maxlength="2000"')+button('Propose group correction'))
 const rows=data.proposals.map(row=>{
  const draft=action==='trust-review'&&fields?.id===row.id?fields:undefined
  const evidence=`<details><summary>Review source evidence</summary><pre>${escape(JSON.stringify(row.evidence,null,2))}</pre></details>`
  const review=row.status==='prepared'?form('trust-review-'+row.id,base,hidden('action','trust-review')+hidden('id',row.id)+`<label>Decision<select name="decision"><option value="approve"${draft?.decision==='approve'?' selected':''}>Approve ${row.kind==='mapping'?'exact correction':'fix task'}</option><option value="reject"${draft?.decision==='reject'?' selected':''}>Reject proposal</option></select></label>`+textarea('reason','Review reason',valueOf(draft,'reason'),true,'maxlength="2000"')+(row.kind!=='mapping'?personSelect('ownerId','Source owner for fix task',state.people,valueOf(draft,'ownerId',state.operator.id),'Choose an active person')+field('dueDate','Fix task due date',valueOf(draft,'dueDate'),'date'):'' )+button('Record trust decision')):`<p>${escape(row.status)} · ${escape(row.reviewedAt)} UTC · ${escape(row.reason)}</p>`
  return `<article class="record" id="trust-${escape(row.id)}"><h3>${escape(row.title)}</h3><p><a href="/app/accounts/${encodeURIComponent(row.accountId)}">Open affected account</a></p><p>${escape(row.fix)}</p>${evidence}${review}</article>`
 }).join('')
 return disclosure('Data trust review','Prepare findings, review evidence and approve exact work.',scan+disclosure('Correct a Segment group','Use a source-owner reference; no identity is inferred.',mapping,'trust-mapping-panel',!!draft)+section('Trust proposals',rows||'<p>No data trust proposals yet.</p>','trust-proposals'),'data-trust',action?.startsWith('trust-')??false)
}
