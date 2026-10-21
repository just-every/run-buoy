import { emailLabel } from '../notify-mail'
import {signalDismissal,type SignalDismissal} from './signal-dismissal'
import { button, date, escape, form, hidden, personSelect, section, textarea } from './html'
import type { Fields, Reminder, State } from './types'

export interface InboxPage {
 items: {id:string;type:string;title:string;body:string;createdAt:string;readAt:string|null;email:string;accountId:string;accountName:string;adoptionRuleId?:string|null;dismissal?:SignalDismissal|null}[];
 reminders: Reminder[];
 preferences: {frequency:string;modes:Record<string,string>};
 digests: {id:string;period:string;frequency:string;email:string}[];
}
const types = {mention:'Mentions',assignment:'Assignments',signal:'Signals',approval:'Approvals'}
const select = (name:string,label:string,chosen:string,options:Record<string,string>) => `<label>${escape(label)}<select name="${name}" required>${Object.entries(options).map(([value,label])=>`<option value="${value}"${chosen===value?' selected':''}>${label}</option>`).join('')}</select></label>`
export function notificationsPage(data: InboxPage, state: State, fields?: Fields) {
 const prefs = data.preferences, editing = fields?.action === 'notification-preferences'
 const settings = section('Your email preferences', `<p>Your inbox keeps every notification. Choose email separately for each type. Daily digests run from 8 am in the installation’s time zone; weekly digests run on Monday. They include queued notifications and recorded changes in your current book. Task reminders and escalations follow the separate schedule set by your administrator.</p>`
  + form('notification-preferences','/app/notifications',hidden('action','notification-preferences') + select('frequency','Email digest',editing ? fields.frequency : prefs.frequency,{off:'Off',daily:'Daily',weekly:'Weekly'}) + `<div class="form-grid">${Object.entries(types).map(([type,label])=>select(type,label,editing?fields[type]:prefs.modes[type],{immediate:'As it happens',digest:'Digest only',none:'No email'})).join('')}</div>` + button('Save your preferences')))
 const items = section('Your inbox', data.items.length ? `<ul class="journal">${data.items.map(item=>`<li class="record"><div class="record-head"><strong>${escape(item.type)} · ${escape(item.title)}</strong><span>${item.readAt?'Read':'Unread'}</span></div><p>${escape(item.body)}</p><p><a href="/app/accounts/${encodeURIComponent(item.accountId)}">${escape(item.accountName)}</a> · ${date(item.createdAt)} · ${escape(emailLabel(item.email))}</p>${item.readAt?'':form('read-'+item.id,'/app/notifications',hidden('action','notification-read')+hidden('id',item.id)+button('Mark read'))}${signalDismissal(item,fields)}</li>`).join('')}</ul>` : '<p>No notifications yet.</p>')
 const mention = section('Mention a teammate', '<p>Send an account note to one active teammate’s inbox.</p>' + form('mention','/app/notifications',hidden('action','mention') + `<label>Account<select name="accountId" required><option value="">Choose an account</option>${state.accounts.map(a=>`<option value="${escape(a.id)}"${fields?.accountId===a.id?' selected':''}>${escape(a.name)}</option>`).join('')}</select></label>` + personSelect('personId','Teammate',state.people,fields?.personId,'Choose a teammate') + textarea('note','Account note',fields?.note??'',true,'maxlength="1000"') + button('Send mention')))
 const reminders = data.reminders.length ? section('Task reminders and escalation', `<ul class="reasons">${data.reminders.map(n=>`<li>${escape(n.kind)}: <a href="/app/accounts/${encodeURIComponent(n.accountId)}#tasks">${escape(n.title)}</a> · ${escape(n.emailLabel)}</li>`).join('')}</ul>`) : ''
 const digests = section('Digest history', data.digests.length ? `<ul class="reasons">${data.digests.map(d=>`<li>${escape(d.frequency)} · ${date(d.period)} · ${escape(emailLabel(d.email))}</li>`).join('')}</ul>` : '<p>No digest has run yet.</p>')
 return `<div class="backup-columns"><div>${items}${reminders}</div><div>${settings}${mention}${digests}</div></div>`
}
