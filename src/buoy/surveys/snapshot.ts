import {insist} from '../core'
import {assessSurvey,surveyMeasurement,surveyValues} from './model'
import type {SurveyImage} from './types'

// Raw, ordered image doubles as a transaction fence. Current respondent
// memberships and revisions are included independently of account revisions.
export function surveyImageSql(){return `SELECT json_object(
 'accounts',json((SELECT json_group_array(json_object('accountId',id,'name',json_extract(document,'$.name'),'accountRevision',revision)) FROM (SELECT * FROM buoy_accounts ORDER BY id))),
 'people',json((SELECT json_group_array(json_object('personId',id,'name',name,'kind',kind,'revision',revision,
  'accountIds',json((SELECT json_group_array(account_id) FROM (SELECT account_id FROM buoy_customer_memberships WHERE person_id=p.id ORDER BY account_id))))) FROM (SELECT * FROM buoy_customer_people ORDER BY id) p)),
 'responses',json((SELECT json_group_array(json_object('id',id,'accountId',account_id,'personId',person_id,'surveyName',survey_name,'kind',kind,'value',value,
  'observedAt',observed_at,'reference',reference,'sourceResponseId',source_response_id,'sourceKind',source_kind,'accountRevision',account_revision,'resultRevision',result_revision,'recordedBy',recorded_by,'recordedAt',recorded_at))
  FROM (SELECT * FROM buoy_survey_responses ORDER BY account_id,person_id,kind,observed_at,id)))
 ) AS snapshot`}
export function parseSurveyImage(raw:string,on=new Date().toISOString()){
 return assessSurvey(JSON.parse(raw) as SurveyImage,on)
}
export async function surveyInputs(db:D1Database,on=new Date().toISOString()){
 const measuredAt=surveyMeasurement(on),sql=surveyImageSql(),row=await db.prepare(sql).first<{snapshot:string}>()
 insist(row,'Survey response inputs unavailable.',503)
 const accounts=parseSurveyImage(row.snapshot,measuredAt)
 return {on:measuredAt,sql,raw:row.snapshot,value:JSON.parse(row.snapshot) as SurveyImage,accounts,values:new Map(accounts.map(account=>[account.accountId,surveyValues(account)]))}
}
