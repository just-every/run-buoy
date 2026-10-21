export type SurveyKind='nps'|'csat'
export interface SurveyInput {
 accountId:string;personId:string;surveyName:string;kind:SurveyKind;value:number;
 observedAt:string;reference:string;sourceResponseId:string;accountRevision:string
}
export interface SurveyResponse extends SurveyInput {
 id:string;sourceKind:'staff-recorded';recordedBy:string;recordedAt:string;resultRevision:string
}
export interface SurveyPerson {personId:string;name:string;kind:'contact'|'user';revision:string;accountIds:string[]}
export interface SurveyImage {
 accounts:{accountId:string;name:string;accountRevision:string}[];
 people:SurveyPerson[];responses:SurveyResponse[]
}
export interface AssessedResponse extends SurveyResponse {
 currentMembership:boolean;window:'current'|'excluded';
 exclusion:'outside-window'|'after-measurement'|'not-current-member'|'superseded'|null
}
export interface SurveyAssessment {
 kind:SurveyKind;value:number|null;respondentCount:number;latestDatum:SurveyResponse|null;
 freshness:'current'|'stale'|'missing';responses:AssessedResponse[]
}
export interface SurveyAccount {
 accountId:string;name:string;accountRevision:string;nps:number|null;csat:number|null;
 npsResponses:number;csatResponses:number;
 assessments:{nps:SurveyAssessment;csat:SurveyAssessment};responses:AssessedResponse[]
}
