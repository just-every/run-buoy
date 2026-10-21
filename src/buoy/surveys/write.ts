import {accountAudit} from '../audit-records'
import {authority,guard,id,insist,now,requirePerson,stmt,type Actor} from '../core'
import {surveyInput} from './model'
import {surveyInputs} from './snapshot'
import type {SurveyInput,SurveyResponse} from './types'

function replay(prior:SurveyResponse,input:SurveyInput){
 insist((['accountId','personId','surveyName','kind','value','observedAt','reference','sourceResponseId','accountRevision'] as const).every(key=>prior[key]===input[key]),'Source response ID already has different response content.',409)
 return {response:prior,accountId:prior.accountId,revision:prior.resultRevision,replayed:true}
}
export async function recordResponse(db:D1Database,actor:Actor,input:Record<string,unknown>){
 requirePerson(actor)
 insist(await stmt(db,"SELECT id FROM oa_operators WHERE id=? AND status='active' AND role IN ('owner','admin')",actor.id).first(),'Only an active owner or admin can record survey responses.',403)
 const stamp=now(),body=surveyInput(input,stamp),image=await surveyInputs(db,stamp)
 const prior=image.value.responses.find(row=>row.accountId===body.accountId&&row.personId===body.personId&&row.kind===body.kind&&row.surveyName===body.surveyName&&row.sourceResponseId===body.sourceResponseId)
 if(prior)return replay(prior,body)
 const account=image.value.accounts.find(row=>row.accountId===body.accountId)
 insist(account,'Account not found.',404)
 insist(account.accountRevision===body.accountRevision,'Account changed. Reload before recording the response.',409)
 insist(image.value.people.some(person=>person.personId===body.personId&&person.accountIds.includes(body.accountId)),'Respondent must be an explicitly linked current customer person.',409)
 const nextRevision=id(),response:SurveyResponse={...body,id:id(),resultRevision:nextRevision,sourceKind:'staff-recorded',recordedBy:`person:${actor.id}`,recordedAt:stamp}
 try{
  await db.batch([authority(db,actor,true),guard(db,`(${image.sql.replace(/ AS snapshot\s*$/,'')})=?`,image.raw),
   stmt(db,`INSERT INTO buoy_survey_responses(id,account_id,person_id,survey_name,kind,value,observed_at,reference,source_response_id,source_kind,account_revision,result_revision,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,response.id,body.accountId,body.personId,body.surveyName,body.kind,body.value,body.observedAt,body.reference,body.sourceResponseId,response.sourceKind,body.accountRevision,nextRevision,response.recordedBy,stamp),
   stmt(db,'UPDATE buoy_accounts SET revision=? WHERE id=?',nextRevision,body.accountId),
   ...accountAudit(db,actor,body.accountId,'survey.response-recorded'),stmt(db,'DELETE FROM buoy_assertions')])
 }catch(error){
  // A concurrent identical intake is still an idempotent replay. All other
  // failures retain their real error or report the changed snapshot explicitly.
  const current=await surveyInputs(db,stamp),duplicate=current.value.responses.find(row=>row.accountId===body.accountId&&row.personId===body.personId&&row.kind===body.kind&&row.surveyName===body.surveyName&&row.sourceResponseId===body.sourceResponseId)
  if(duplicate)return replay(duplicate,body)
  insist(current.raw===image.raw,'Survey inputs changed. Reload before recording the response.',409)
  throw error
 }
 return {response,accountId:body.accountId,revision:nextRevision,replayed:false}
}
