import type {ScopedRenewalApprovals} from '../roles/renewal-approval'
import {button,escape,form,hidden,money,section} from './html'
import type {Fields} from './types'

export function scopedRenewalApprovalPage(queue:ScopedRenewalApprovals,fields?:Fields){
 const rows=queue.proposals.map(proposal=>{
  const reviewed=fields?.proposalId===proposal.id
  return '<li class="record"><h3>'+escape(proposal.accountName)+'</h3><dl><dt>Proposed outcome</dt><dd>'+escape(proposal.outcome.replaceAll('-',' '))+'</dd><dt>Reason</dt><dd>'+escape(proposal.reason)+'</dd><dt>Evidence</dt><dd>'+escape(proposal.evidence)+'</dd>'+(proposal.renewal?'<dt>Source expected ARR</dt><dd>'+money(proposal.renewal.expectedArrMinor,proposal.renewal.currency)+'</dd><dt>Outcome ARR</dt><dd>'+money(proposal.renewal.resultArrMinor,proposal.renewal.currency)+'</dd>':'')+'</dl>'+form('renewal-approve-'+proposal.id,'/app/approvals',hidden('action','scoped-renewal-approve')+hidden('proposalId',proposal.id)+hidden('revision',reviewed?fields.revision:proposal.revision)+hidden('sourceRevision',reviewed?fields.sourceRevision:proposal.sourceRevision??'')+button('Approve renewal outcome'))+'</li>'
 }).join('')
 return section('Renewal outcomes awaiting your approval','<p>Review the outcome, reason and source evidence before recording this decision.</p>'+(rows?'<ul class="journal">'+rows+'</ul>':'<p>No current renewal outcomes await your approval within your permitted scope.</p>'),'scoped-renewal-approvals')
}
