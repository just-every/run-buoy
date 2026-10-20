export type AdoptionKind = 'feature'|'module'
export interface AdoptionDefinition {kind:AdoptionKind;key:string;name:string;events:string[];updatedAt:string}
export interface AdoptionFraction {key:string;name:string;people:number;fraction:number|null}
export interface AdoptionPeriod {
 dau:number;wau:number;mau:number;eventCount:number;depth:number|null;breadth:number|null;utilization:number|null;
 features:AdoptionFraction[];modules:AdoptionFraction[]
}
export interface AdoptionMetrics {
 current:AdoptionPeriod;previous:AdoptionPeriod;weeklyChange:number|null;weeklyDrop:boolean;
 firstValue:{people:number;meanSeconds:number|null}
}
export interface AdoptionSubject {
 id:string;name:string;accountIds:string[];seats:number|null;metrics:AdoptionMetrics
}
export interface AdoptionPerson extends AdoptionSubject {kind:'contact'|'user'}
export interface AdoptionWindow {start:string;end:string}
export interface AdoptionWindows {current:{day:AdoptionWindow;week:AdoptionWindow;month:AdoptionWindow};previous:{day:AdoptionWindow;week:AdoptionWindow;month:AdoptionWindow}}
