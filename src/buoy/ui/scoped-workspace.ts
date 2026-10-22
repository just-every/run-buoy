import type {ScopedWorkspaceHome} from '../roles/workspace'
import {majorAmount} from '../currencies'
import {button,date,escape,pathId,section} from './html'

const path='/app/workspace'
function money(account:ScopedWorkspaceHome['book'][number]){
 if(account.arrBand)return account.arrBand.label
 if(account.commercial){const {currency,arrMinor,mrrMinor}=account.commercial;return currency&&arrMinor!==null&&mrrMinor!==null?'ARR '+currency+' '+majorAmount(arrMinor,currency)+' · MRR '+currency+' '+majorAmount(mrrMinor,currency):'Recurring revenue unavailable'}
 return 'Commercial fields are outside your field access.'
}
const link=(id:string,label:string)=>'<a href="/app/accounts/'+pathId(id)+'">'+escape(label)+'</a>'
export function scopedWorkspacePage(home:ScopedWorkspaceHome){
 let body=section(home.person.displayName+' · Today’s work','<p>'+escape(home.interpretation)+'</p><p>Installation date: '+date(home.on)+'</p><form method="get" action="'+path+'"><label>CSM home<select name="person" aria-label="CSM home">'+home.people.map(person=>'<option value="'+escape(person.id)+'"'+(person.id===home.person.id?' selected':'')+'>'+escape(person.displayName)+'</option>').join('')+'</select></label>'+button('Open CSM home')+'</form>','csm-home')
 body+=section('Tasks due today',home.tasks.length?'<ul class="journal">'+home.tasks.map(task=>'<li class="record"><h3>'+link(task.accountId,task.accountName)+'</h3><p>'+escape(task.title)+' · '+date(task.dueDate)+' · '+escape(task.priority)+' priority · '+escape(task.type)+'</p><p>Task reference: '+escape(task.id)+'</p></li>').join('')+'</ul>':'<p>No open tasks due today in this book.</p>','workspace-tasks')
 body+=section('Open alerts',home.alerts.length?'<ul class="journal">'+home.alerts.map(alert=>'<li class="record"><h3>'+link(alert.accountId,alert.accountName)+'</h3><p>'+escape(alert.title)+' · '+date(alert.createdAt.slice(0,10))+'</p><p>Alert reference: '+escape(alert.id)+'</p></li>').join('')+'</ul>':'<p>No current unread alerts in this book.</p>','workspace-alerts')
 body+=section('Renewals in the next 90 days',home.renewals.length?'<ul class="journal">'+home.renewals.map(renewal=>'<li class="record"><h3>'+link(renewal.accountId,renewal.name)+'</h3><p>'+date(renewal.renewalDate)+' · '+renewal.opportunities.length+' recorded renewal '+(renewal.opportunities.length===1?'opportunity':'opportunities')+'</p></li>').join('')+'</ul>':'<p>No recorded account renewal date in this window.</p>','workspace-renewals')
 body+=section('Today’s customer meetings','<p>'+escape(home.meetings.reason)+'</p>','workspace-meetings')
 body+=section(home.person.displayName+' · Book of business',home.book.length?'<ul class="journal">'+home.book.map(account=>'<li class="record"><h3>'+link(account.id,account.name)+'</h3><dl><dt>Health</dt><dd>'+escape(account.health.status)+'</dd><dt>Renewal date</dt><dd>'+date(account.renewalDate)+'</dd><dt>Recurring revenue</dt><dd>'+escape(money(account))+'</dd></dl></li>').join('')+'</ul>':'<p>No accounts in this book are inside your current record scope.</p>','workspace-list')
 return body
}
