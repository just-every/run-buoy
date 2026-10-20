import { button, date, disclosure, escape, field, form, hidden, section, valueOf } from './html'
import type { Fields } from './types'

export interface AgentPolicy {
 id:string;label:string;expiresAt:number;revokedAt:number|null;scopes:string[];dataClasses:string[];
 requestsPerMinute:number;budgetMinor:number;spentMinor:number
}
export interface AgentPage {
 disabled:boolean;agents:AgentPolicy[];costLabel:string;
 entries:{id:string;tokenId:string;command:string;status:string;reason:string;spentMinor:number;occurredAt:string}[]
}
export interface AgentCredential { id:string;token:string;expiresAt:number }
const scopes = [['scopeList','renewals.list','Read renewals'],['scopePlaybook','playbook.prepare','Prepare playbooks'],['scopeRenewal','renewal.prepare','Prepare renewal decisions']]
const classes = [['classAccount','account','Account terms'],['classBilling','billing','Billing snapshots'],['classSupport','support','Support snapshots'],['classSentiment','sentiment','CSM sentiment']]
const usd = (minor:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100)

// GOVERN-001: use the existing audit page's panels, disclosures and native forms.
export function agentsPage(data:AgentPage,values?:Fields,credential?:AgentCredential) {
 const mine=values?.action==='agent-issue'
 const checks=(choices:string[][])=>choices.map(([name,,label])=>`<label class="check"><input type="checkbox" name="${name}"${!mine||values?.[name]==='on'?' checked':''}>${escape(label)}</label>`).join('')
 const v=(name:string,fallback:unknown)=>mine?valueOf(values,name,fallback):fallback
 const issued=credential?section('New agent credential',`<p>Copy this credential now. It is shown only in this response. Keep it private and give it only to the intended agent.</p><label>Agent credential<textarea id="agent-credential" readonly rows="3">${escape(credential.token)}</textarea></label><p>Expires ${date(new Date(credential.expiresAt).toISOString())}.</p>`,'agent-issued'):''
 const switchForm=form('agent-switch','/app/audit',hidden('action','agent-switch')+`<label class="check"><input type="checkbox" name="disabled"${data.disabled?' checked':''}>Pause all agents</label><p>Pausing stops every read and preparation credential. Resuming keeps their original scopes and expiry.</p>`+button('Save agent switch'))
 const issue=form('agent-issue','/app/audit',hidden('action','agent-issue')+field('label','Agent label',v('label',''),'text',true,'maxlength="100"')+`<fieldset><legend>Allowed commands</legend>${checks(scopes)}</fieldset><fieldset><legend>Allowed data classes</legend>${checks(classes)}</fieldset><p>Preparation needs all four classes because its reviewed account snapshot contains them. Reads omit excluded classes and omit derived health when any class is excluded.</p><div class="form-grid">`+field('expiresDays','Expires after (days)',v('expiresDays',7),'number',true,'min="1" max="365" step="1"')+field('requestsPerMinute','Requests per UTC minute',v('requestsPerMinute',60),'number',true,'min="1" max="10000" step="1"')+field('budgetMinor','USD budget (cents)',v('budgetMinor',0),'number',true,'min="0" step="1"')+'</div><p>No metered agent charge; internal notification mail may use your provider. Provider fees are outside this budget. A budget does not enable customer sending, model calls or commercial changes.</p>'+button('Issue agent credential'))
 const agents=data.agents.map(agent=>`<article class="record" id="agent-${escape(agent.id)}"><h3>${escape(agent.label)}</h3><dl><dt>Commands</dt><dd>${escape(agent.scopes.join(', '))}</dd><dt>Data classes</dt><dd>${escape(agent.dataClasses.join(', '))}</dd><dt>Expiry</dt><dd>${date(new Date(agent.expiresAt).toISOString())}</dd><dt>Rate limit</dt><dd>${escape(agent.requestsPerMinute)} requests per UTC minute</dd><dt>Metered USD budget / actual spend</dt><dd>${escape(usd(agent.budgetMinor))} / ${escape(usd(agent.spentMinor))}</dd><dt>Status</dt><dd>${agent.revokedAt?'Revoked':agent.expiresAt<=Date.now()?'Expired':data.disabled?'Paused':'Active'}</dd></dl>${!agent.revokedAt?form(`agent-revoke-${agent.id}`,'/app/audit',hidden('action','agent-revoke')+hidden('id',agent.id)+button('Revoke credential',true)):''}</article>`).join('')
 const entries=data.entries.map(entry=>`<li class="record"><strong>${escape(entry.command)} · ${escape(entry.status)}</strong><p>Agent ${escape(entry.tokenId)} · <time datetime="${escape(entry.occurredAt)}">${date(entry.occurredAt)}</time> · actual metered spend ${escape(usd(entry.spentMinor))}</p>${entry.reason?`<p>${escape(entry.reason)}</p>`:''}</li>`).join('')
 return issued+section('Agent authority',`<p>${escape(data.costLabel)}. Agents can read and prepare only; people approve.</p>${switchForm}`,'agent-authority')+disclosure('Issue an agent credential','Choose the commands, data classes, expiry, rate and USD budget before issuing.',issue,'agent-issue-panel',mine)+section('Agent credentials',agents||'<p>No agent credentials have been issued.</p>','agent-credentials')+section('Agent action ledger',`<p>Latest 100 attempts, outcomes and refusals. No metered agent charge; internal notification mail may use your provider. Provider fees are outside this budget. An attempt records receipt, never completion. No request body or credential is retained.</p>${entries?`<ol class="journal">${entries}</ol>`:'<p>No agent requests recorded.</p>'}`,'agent-ledger')
}
