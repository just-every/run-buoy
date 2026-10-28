export interface Definition {name:string;segmentId:string;segmentName:string;kind:'healthy'|'renewed'|'plan-objective';windowDays:number;objectiveId?:string;operationInput?:string}
export interface ReportRow {id:string;document:string;started_at:string;deadline:string;operation_key:string;closed_at:string|null}
export interface Subject {plan_id?:string|null;plan_revision?:string|null;plan_objective?:string|null;plan_customer_id?:string|null;report_id:string;account_id:string;task_id:string|null;run_id:string|null;cohort:'enrolled'|'comparison';baseline_revision:string;reached_at:string|null;evidence:string|null}
export interface Decision {id:string;account_id:string;outcome:string;recorded_at:string;reason:string;evidence:string}
