import type {MonthlyBoundary,MonthlyRevenueHistory} from '../revenue/monthly'
import {date,disclosure,escape,money} from './html'

function boundary(label:string,value:MonthlyBoundary,currency:string){
 return `<p>${escape(label)} ARR at ${date(value.on)}: ${value.arrMinor===null?'Unavailable':money(value.arrMinor,currency)}${value.source?` · <a href="${escape(value.source.href)}">${escape(value.source.reference)}</a> (${date(value.source.on)})`:''}${value.reason?` · ${escape(value.reason)}`:''}</p>`
}
export function monthlyRevenuePanel(history:MonthlyRevenueHistory):string {
 const body=`<p>${history.sourceKind==='confirmed-contract'?'Confirmed recurring contract history':'Reviewed Stripe subscription history'} · through ${date(history.on)}.</p><ol class="journal">${history.months.map(month=>`<li class="record"><h3>${escape(month.month)}</h3><p>${date(month.start)}–${date(month.end)}</p>${month.currencies.map(row=>`<article><h4>${escape(row.currency)} · ${escape(row.movement??'Movement unavailable')}</h4>${boundary('Starting',row.start,row.currency)}${boundary('Ending',row.end,row.currency)}${row.sourceLinks.length?row.sourceLinks.map(link=>`<p><a href="${escape(link.href)}">${escape(link.label)}</a></p>`).join(''):''}</article>`).join('')}${month.exceptions.length?`<ul>${month.exceptions.map(item=>`<li>${item.currency?escape(item.currency)+' · ':''}${date(item.boundary)} · ${escape(item.reason)}</li>`).join('')}</ul>`:''}</li>`).join('')}</ol><p>${escape(history.interpretation)}</p>`
 return disclosure(history.sourceKind==='reviewed-stripe'?'Monthly Stripe recurring revenue':'Monthly confirmed recurring revenue','Twelve months of native ARR and linked source evidence.',body,'monthly-revenue-history-'+history.sourceKind)
}
