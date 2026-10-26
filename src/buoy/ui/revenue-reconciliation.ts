import type {RevenueReconciliation} from '../revenue/reconciliation'
import {button,disclosure,escape,form,hidden,money,section,textarea,valueOf} from './html'
import {canManage,type Fields,type State} from './types'

export function revenueReconciliationPage(row:RevenueReconciliation|null,state:State,fields?:Fields){
 if(!canManage(state)||!row)return ''
 const draft=fields?.action==='revenue-reconcile'?fields:undefined
 const sources=`<dl><dt>Person-confirmed ARR</dt><dd>${escape(row.contract.currency)} ${money(row.contract.arrMinor,row.contract.currency)}</dd>
 <dt>Reviewed Stripe subscription ARR</dt><dd>${row.stripe.amounts.map(amount=>`${escape(amount.currency)} ${money(amount.arr.roundedMinor,amount.currency)} (${escape(amount.arr.numeratorMinor)}/${escape(amount.arr.denominator)} exact minor units)`).join('<br>')}</dd></dl>
 <p><a href="/app/accounts/${encodeURIComponent(row.accountId)}#contract-history">Confirmed contract source</a>: ${escape(row.contract.reference)}<br>
 <a href="/app/billing#billing-observation-${encodeURIComponent(row.billingSnapshotId)}">Reviewed Stripe source</a>: ${escape(row.stripe.reference)} · ${escape(row.stripe.observedAt)} UTC</p>`
 if(row.resolution)return section('Revenue reconciliation',sources+`<p>Resolved review ${escape(row.resolution.resolvedAt)} UTC by ${escape(row.resolution.resolvedBy)}.</p><p>${escape(row.resolution.reason)}</p><p>Both values remain unchanged. Retention reports keep the financial variance visible until the amounts agree; this note selects no source authority.</p>`,'revenue-reconciliation')
 const content=hidden('action','revenue-reconcile')+hidden('revision',valueOf(draft,'revision',row.revision))+hidden('contractVersionId',valueOf(draft,'contractVersionId',row.contractVersionId))+
  hidden('contractRevision',valueOf(draft,'contractRevision',row.contractRevision))+hidden('billingSnapshotId',valueOf(draft,'billingSnapshotId',row.billingSnapshotId))+
  textarea('reason','Resolution explanation',valueOf(draft,'reason'),true,'maxlength="2000"')+button('Resolve revenue mismatch')
 return section('Revenue reconciliation',`<p role="status">Pending: confirmed contract ARR differs from reviewed Stripe subscription ARR.</p>${sources}`+
  disclosure('Resolve revenue mismatch','Retain both sources and record an explanation.',
   form('revenue-reconcile-'+row.accountId,'/app/accounts/'+encodeURIComponent(row.accountId),content),'revenue-reconcile-panel-'+row.accountId,!!draft),'revenue-reconciliation')
}

export function revenueReconciliationForm(fields:Fields){
 return {revision:fields.revision,contractVersionId:fields.contractVersionId,contractRevision:fields.contractRevision,
  billingSnapshotId:fields.billingSnapshotId,reason:fields.reason}
}
