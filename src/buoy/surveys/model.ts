import {date,insist,object,text} from '../core'
import type {SurveyInput,SurveyAccount,SurveyImage,SurveyKind,SurveyAssessment,AssessedResponse,SurveyResponse} from './types'

export function surveyInstant(value:unknown,label='Survey observation time'){
 const raw=text(value,label,30)
 insist(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(raw)&&Number.isFinite(Date.parse(raw)),`${label} must be an ISO UTC timestamp.`)
 const canonical=new Date(raw).toISOString()
 insist(canonical.slice(0,19)===raw.slice(0,19),`${label} must be a real UTC instant.`)
 return canonical
}
export function surveyMeasurement(on=new Date().toISOString()){
 return /^\d{4}-\d{2}-\d{2}$/.test(on)?`${date(on,'Survey measurement day')}T23:59:59.999Z`:surveyInstant(on,'Survey measurement time')
}
export function surveyInput(input:unknown,stamp=new Date().toISOString()):SurveyInput {
 const row=object(input)
 insist(Object.keys(row).every(key=>['accountId','personId','surveyName','kind','value','observedAt','reference','sourceResponseId','accountRevision'].includes(key)),'Unsupported survey response property.')
 insist(row.kind==='nps'||row.kind==='csat','Survey kind must be nps or csat.')
 insist(typeof row.value==='number'&&Number.isInteger(row.value)&&row.value>=(row.kind==='nps'?0:1)&&row.value<=(row.kind==='nps'?10:5),'NPS must be a whole number 0–10; CSAT must be a whole number 1–5.')
 const observedAt=surveyInstant(row.observedAt)
 insist(observedAt<=stamp,'Survey observation time cannot be in the future.')
 return {accountId:text(row.accountId,'Account ID',200),personId:text(row.personId,'Customer person ID',200),surveyName:text(row.surveyName,'Survey name',200),kind:row.kind,value:row.value,observedAt,
  reference:text(row.reference,'Source reference',1000),sourceResponseId:text(row.sourceResponseId,'Source response ID',200),accountRevision:text(row.accountRevision,'Account revision',200)}
}
export const SURVEY_INTERPRETATION='Staff-recorded responses, not verified provider delivery. Rolling 90 × 24 hours in UTC, including both endpoints; a date-only measurement ends at 23:59:59.999Z. Each current account member contributes their newest response per kind across survey names, ordered by observation, recording time, then response ID. Removed memberships, older responses and observations outside the window are excluded. NPS is 100 × (promoters 9–10 minus detractors 0–6) / respondents; passives 7–8 remain in the denominator. CSAT is the 1–5 arithmetic mean. Missing scores are null; respondent counts are zero.'
const newest=(a:SurveyResponse,b:SurveyResponse)=>b.observedAt.localeCompare(a.observedAt)||b.recordedAt.localeCompare(a.recordedAt)||b.id.localeCompare(a.id)
export function assessSurvey(image:SurveyImage,on:string):SurveyAccount[]{
 const measuredAt=surveyMeasurement(on),start=new Date(Date.parse(measuredAt)-90*86400000).toISOString()
 return image.accounts.map(account=>{
  const rows=image.responses.filter(row=>row.accountId===account.accountId).sort(newest)
  const selected=new Set<string>()
  const responses:AssessedResponse[]=rows.map(row=>{
   const currentMembership=!!image.people.find(person=>person.personId===row.personId&&person.accountIds.includes(account.accountId)),key=`${row.personId}:${row.kind}`
   const exclusion=!currentMembership?'not-current-member':row.observedAt>measuredAt?'after-measurement':row.observedAt<start?'outside-window':selected.has(key)?'superseded':null
   if(exclusion===null)selected.add(key)
   return {...row,currentMembership,window:exclusion===null?'current':'excluded',exclusion}
  })
  const assessment=(kind:SurveyKind):SurveyAssessment=>{
   const history=responses.filter(row=>row.kind===kind),current=history.filter(row=>row.window==='current'),count=current.length
   const value=count===0?null:kind==='nps'?100*(current.filter(row=>row.value>=9).length-current.filter(row=>row.value<=6).length)/count:current.reduce((sum,row)=>sum+row.value,0)/count
   return {kind,value,respondentCount:count,latestDatum:history.find(row=>row.currentMembership&&row.observedAt<=measuredAt)??null,
    freshness:count?'current':history.some(row=>row.currentMembership&&row.observedAt<=measuredAt)?'stale':'missing',responses:history}
  }
  const nps=assessment('nps'),csat=assessment('csat')
  return {...account,nps:nps.value,csat:csat.value,npsResponses:nps.respondentCount,csatResponses:csat.respondentCount,assessments:{nps,csat},responses}
 })
}
export function surveyValues(account:SurveyAccount):Record<string,number|null>{
 return {'survey.nps':account.nps,'survey.csat':account.csat,'survey.npsResponses':account.npsResponses,'survey.csatResponses':account.csatResponses}
}
export const SURVEY_FIELDS:Record<string,'number'>={'survey.nps':'number','survey.csat':'number','survey.npsResponses':'number','survey.csatResponses':'number'}
