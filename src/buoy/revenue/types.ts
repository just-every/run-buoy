export interface RecurringLine {
 id:string;product:string;quantity:number;amountMinor:number;
 frequency:'monthly'|'annual';entitlements:string
}
export interface ConfirmedContract {
 currency:string;contractStart:string;contractEnd:string;lines:RecurringLine[];
 source:{reference:string;confirmedOn:string}
}
export type RevenueSourceKind='person-confirmed'|'billing'|'crm'|'warehouse'|'file'
export interface ContractVersion {
 id:string;accountId:string;revision:string;sourceKind:RevenueSourceKind;
 contract:ConfirmedContract;recordedBy:string;recordedAt:string
}
export interface Revenue {
 arrMinor:number|null;mrrMinor:number|null;currency:string|null;
 mrrExact:{numeratorMinor:number;denominator:12}|null;
 mrrRounding:'half-up to whole native minor unit';
 products:string[]|null;seats:number|null;
 contractStart:string|null;contractEnd:string|null;
 sourceKind:RevenueSourceKind|null;reference:string|null;confirmedOn:string|null;
 status:'missing'|'scheduled'|'active'|'expired';
 freshness:'missing'|'current'|'stale';staleAfterDays:30;
 amountMeaning:'Line amountMinor is the total for its billing period, not a unit price'
}
export interface RevenueAccount {
 accountId:string;name:string;revision:string;versionId:string|null;contractRevision:string|null;
 sourceKind:RevenueSourceKind|null;contract:ConfirmedContract|null;recordedBy:string|null;recordedAt:string|null;
 revenue:Revenue
}
export type RevenueValues=Record<string,string|number|null>
