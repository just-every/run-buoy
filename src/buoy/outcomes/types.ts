export interface Definition {name:string;segmentId:string;segmentName:string;kind:'healthy'|'renewed';windowDays:number}
export interface ReportRow {id:string;document:string;started_at:string;deadline:string;operation_key:string;closed_at:string|null}
export interface Subject {report_id:string;account_id:string;task_id:string|null;run_id:string|null;cohort:'enrolled'|'comparison';baseline_revision:string;reached_at:string|null;evidence:string|null}
export interface Decision {id:string;account_id:string;outcome:string;recorded_at:string;reason:string;evidence:string}
