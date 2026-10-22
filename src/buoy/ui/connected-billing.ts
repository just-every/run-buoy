import type {StripeEvidence} from '../billing-evidence'
import {stripeFreshness} from '../billing-evidence'
import {escape,money,section} from './html'

export function connectedBillingPanel(row:StripeEvidence|undefined|null,on:string){
 if(!row)return ''
 const state=stripeFreshness(row,on),doc=row.document
 return section('Connected Stripe billing','<p>Stripe test-mode source · '+escape(state)+'. '+(state==='current'?'Current provider observation.':'Dependent confidence is reduced; retained values are not a successful new sync.')+'</p>'+(doc?'<dl><dt>Observed (UTC)</dt><dd>'+escape(row.observedAt)+'</dd><dt>Source reference</dt><dd>'+escape(row.reference)+'</dd><dt>Freshness threshold</dt><dd>'+row.staleDays+' UTC days</dd></dl><ul>'+doc.revenue.map(r=>'<li>'+escape(r.currency)+' recurring ARR '+money(r.arr.roundedMinor,r.currency)+' · MRR '+money(r.mrr.roundedMinor,r.currency)+'</li>').join('')+'</ul>'+(doc.risks.length?'<ul>'+doc.risks.map(r=>'<li>'+escape(r.kind==='failed-payment'?'Failed payment':'Overdue invoice')+' · '+money(r.amountMinor,r.currency)+' · '+escape(r.reference)+'</li>').join('')+'</ul>':'<p>No failed or overdue payment signal in this observation.</p>'):'<p>No successful billing observation has been read for this binding.</p>')+'<p><a href="/app/billing">Review Stripe observations and reconciliation</a></p>','stripe-billing')
}
