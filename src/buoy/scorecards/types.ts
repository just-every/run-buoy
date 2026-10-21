export type Band='at-risk'|'watch'|'healthy'|'unknown'
export interface Measure {key:string;name:string;field:string;min:number;max:number;weight:number;direction:'higher'|'lower';missing:'unknown'|'exclude'}
export interface ScorecardConfig {name:string;measures:Measure[];bands:{riskBelow:number;healthyAt:number};segments:{segmentId:string;weights:Record<string,number>}[]}
export interface ScorecardField {key:string;name:string;kind:'billing'|'support'|'custom'|'calculated'|'adoption'|'sentiment';unit?:string}
export interface SourceEvidence {kind:string;label:string;freshness:'current'|'stale'|'missing'|'untracked';observedAt:string|null;reference:string|null;details?:unknown}
export interface RetainedInputs {
 values:Record<string,number|null>;sources:Record<string,SourceEvidence[]>;
 fields:ScorecardField[];segments:{id:string;revision:string}[];measuredOn:string
}
export interface Breakdown extends Measure {value:number|null;score:number|null;effectiveWeight:number;included:boolean;missingTreatment:'present'|'unknown'|'exclude';sources:SourceEvidence[]}
export interface ScorecardResult {
 accountId:string;accountRevision:string;configRevision:string;versionId:string;
 selectedSegment:{id:string;revision:string}|null;inputs:RetainedInputs;
 breakdown:Breakdown[];bands:ScorecardConfig['bands'];score:number|null;band:Band;calculatedAt:string
}
export interface ScorecardVersion {
 id:string;revision:string;config:ScorecardConfig;publishedBy:string;publishedAt:string;
 dependencies:{segments:{id:string;revision:string}[];consumers:{id:string;revision:string}[];fields:ScorecardField[]}
}
