import type {surveyState} from '../surveys'
import {button,disclosure,escape,field,form,hidden,section,valueOf} from './html'
import {canManage,type Fields,type State} from './types'
export type SurveyPage=Awaited<ReturnType<typeof surveyState>>
export function surveyPage(data:SurveyPage,state:State,accountId:string,fields?:Fields){
 const account=data.accounts.find(a=>a.accountId===accountId)!,draft=fields?.action==='survey-response'?fields:undefined,val=(key:string,fallback:unknown='')=>valueOf(draft,key,fallback)
 let body=section('Recorded relationship survey responses',`<p>${escape(data.interpretation)}</p><dl><dt>NPS</dt><dd>${escape(account.nps===null?'Unknown':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(account.nps))}</dd><dt>NPS respondents</dt><dd>${account.npsResponses}</dd><dt>CSAT (1–5)</dt><dd>${escape(account.csat===null?'Unknown':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(account.csat))}</dd><dt>CSAT respondents</dt><dd>${account.csatResponses}</dd></dl><p>These recorded observations can feed weighted health and typed segments. This door sends no survey and does not claim provider delivery.</p>`,'surveys')
 if(canManage(state))body+=disclosure('Record a received survey response','Enter an actual received response with its exact respondent and source reference.',form('survey-response','/app/accounts/'+encodeURIComponent(accountId),hidden('action','survey-response')+hidden('accountRevision',val('accountRevision',state.accounts.find(a=>a.id===accountId)!.revision))
  +`<label>Survey respondent<select aria-label="Survey respondent" name="surveyPersonId" required>${data.people.filter(p=>p.accountIds.includes(accountId)).map(p=>`<option value="${escape(p.personId)}"${val('surveyPersonId')===p.personId?' selected':''}>${escape(p.name)}</option>`).join('')}</select></label>`
  +field('surveyName','Received survey name',val('surveyName'),'text',true,'maxlength="200"')
  +`<label>Survey response kind<select aria-label="Survey response kind" name="surveyKind"><option value="nps"${val('surveyKind')==='nps'?' selected':''}>NPS (0–10)</option><option value="csat"${val('surveyKind')==='csat'?' selected':''}>CSAT (1–5)</option></select></label>`
  +field('surveyValue','Received survey score',val('surveyValue'),'number',true,'min="0" max="10" step="1"')
  +field('surveyObservedAt','Response observed at (ISO UTC)',val('surveyObservedAt'),'text',true,'placeholder="2026-10-22T09:00:00.000Z"')
  +field('surveyReference','Survey response source reference',val('surveyReference'),'text',true,'maxlength="1000"')
  +field('surveySourceResponseId','Original survey response ID',val('surveySourceResponseId'),'text',true,'maxlength="200"')+button('Record received response')),'survey-configure',!!draft)
 body+=disclosure('Survey response history','Newest responses retain their source; exclusion reasons explain the current score.',account.responses.length?'<ul class="records">'+account.responses.map(r=>`<li class="record"><h3>${escape(r.surveyName)} · ${escape(r.kind.toUpperCase())} ${r.value}</h3><p>Respondent: ${escape(data.people.find(p=>p.personId===r.personId)?.name??r.personId)} · observed ${escape(r.observedAt)} UTC.</p><p>Source: ${escape(r.reference)} · response ${escape(r.sourceResponseId)} · staff-recorded ${escape(r.recordedAt)} by ${escape(r.recordedBy)}.</p><p>${r.window==='current'?'Included in the current score':'Excluded: '+escape(r.exclusion)}</p></li>`).join('')+'</ul>':'<p>No recorded survey responses.</p>','survey-history')
 return body
}
export function surveyForm(fields:Fields,accountId:string){
 const value=Number(fields.surveyValue);if(!fields.surveyValue?.trim()||!Number.isInteger(value))throw new Error('Enter the received whole survey score.')
 return {accountId,accountRevision:fields.accountRevision,personId:fields.surveyPersonId,surveyName:fields.surveyName,kind:fields.surveyKind,value,observedAt:fields.surveyObservedAt,reference:fields.surveyReference,sourceResponseId:fields.surveySourceResponseId}
}
export function surveyPersonTimeline(data:SurveyPage,personId:string){
 const responses=data.responses.filter(r=>r.personId===personId)
 return section('Recorded survey timeline',responses.length?'<ol class="journal">'+responses.map(r=>`<li class="record"><h3>${escape(r.surveyName)} · ${escape(r.kind.toUpperCase())} ${r.value}</h3><p>Observed ${escape(r.observedAt)} UTC · ${escape(r.reference)} · staff-recorded.</p><p><a href="/app/accounts/${encodeURIComponent(r.accountId)}#surveys">Account survey evidence</a></p></li>`).join('')+'</ol>':'<p>No recorded survey responses for this customer person.</p>','customer-survey-timeline')
}
