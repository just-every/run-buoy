import type {ScorecardValue} from '../scorecards/types'
export interface Objective {id:string;title:string;kind:'metric'|'customer-statement';field?:string;target?:number;direction?:'at-least'|'at-most';dueOn:string}
export interface Milestone {id:string;title:string;objectiveId:string;outcomeId:string}
export interface PlanDocument {name:string;objectives:Objective[];taskIds?:string[];milestones?:Milestone[]}
export interface PlanRow {id:string;accountId:string;revision:string;staffOwnerId:string|null;customerOwnerId:string|null;document:string;createdAt:string;updatedAt:string;confirmations?:string}
export const PLAN_SQL="SELECT json_group_array(json_object('id',id,'accountId',account_id,'revision',revision,'staffOwnerId',staff_owner_id,'customerOwnerId',customer_owner_id,'document',document,'createdAt',created_at,'updatedAt',updated_at,'confirmations',''||COALESCE((SELECT json_group_array(json_object('objectiveId',objective_id,'personId',person_id,'recordedAt',recorded_at)) FROM buoy_plan_confirmations c WHERE c.plan_id=buoy_success_plans.id AND c.plan_revision=buoy_success_plans.revision),'[]'))) AS snapshot FROM (SELECT * FROM buoy_success_plans ORDER BY id) AS buoy_success_plans"
export function objectiveState(objective:Objective,values:Record<string,ScorecardValue>,confirmed=false){
 const value=objective.field?values[objective.field]:null
 if(objective.kind==='customer-statement')return {...objective,value:null,status:confirmed?'achieved' as const:'awaiting-customer-confirmation' as const}
 const available=typeof value==='number'&&Number.isFinite(value)
 return {...objective,value:available?value:null,status:!available?'unavailable' as const:(objective.direction==='at-most'?value<=objective.target!:value>=objective.target!)?'achieved' as const:'in-progress' as const}
}
export function planProjection(row:PlanRow,values:Record<string,ScorecardValue>){
 const document=JSON.parse(row.document) as PlanDocument
 return {...row,document:undefined,...document,objectives:document.objectives.map(o=>objectiveState(o,values,(JSON.parse(row.confirmations??'[]') as {objectiveId:string;personId:string}[]).some(c=>c.objectiveId===o.id&&c.personId===row.customerOwnerId))),visibility:'Private plan; only an explicit current portal grant shares its reviewed revision.'}
}
export function goalMeasure(rows:PlanRow[],accountId:string,values:Record<string,ScorecardValue>){
 const plans=rows.filter(p=>p.accountId===accountId).map(p=>planProjection(p,values)),objectives=plans.flatMap(p=>p.objectives)
 // Missing evidence never becomes an attained goal or an invented zero.
 const unavailable=objectives.some(o=>o.status==='unavailable')
 return {value:!objectives.length||unavailable?null:100*objectives.filter(o=>o.status==='achieved').length/objectives.length,plans}
}

export function goalReadiness(plans:ReturnType<typeof planProjection>[]) {
 const objectives=plans.flatMap(p=>p.objectives),achieved=objectives.filter(o=>o.status==='achieved').length,unavailable=objectives.filter(o=>o.status==='unavailable').length,awaitingConfirmation=objectives.filter(o=>o.status==='awaiting-customer-confirmation').length
 return {status:!objectives.length?'no-plan':unavailable?'evidence-unavailable':achieved===objectives.length?'goals-achieved':'goals-pending',total:objectives.length,achieved,unavailable,awaitingConfirmation,interpretation:'Current goal evidence only; this is not customer confirmation or a renewal prediction.'}
}
