export type StripeRecord=Record<string,unknown>
export interface BillingTier {upTo:number|null;unitAmountDecimal:string|null;flatAmountDecimal:string|null}
export interface BillingDiscount {
 id:string;couponId:string;promotionCodeId:string|null;startAt:string;endAt:string|null;
 duration:'forever'|'repeating'|'once';durationMonths:number|null;
 percentOffDecimal:string|null;amountOffMinor:number|null;currency:string|null;
 currencyAmounts:Record<string,number>;products:string[]|null;couponRedeemable:boolean
}
export interface BillingLine {
 id:string;priceId:string;productId:string;quantity:number|null;currency:string;
 unitAmountDecimal:string|null;interval:'month'|'year'|'week'|'day';intervalCount:number;
 usageType:'licensed'|'metered';billingScheme:'per_unit'|'tiered';
 tiersMode:'volume'|'graduated'|null;tiers:BillingTier[];
 transformQuantity:{divideBy:number;round:'up'|'down'}|null;discounts:BillingDiscount[]
}
export interface BillingSubscription {
 id:string;status:string;createdAt:string;cancelAtPeriodEnd:boolean;canceledAt:string|null;
 periodStart:string;periodEnd:string;lines:BillingLine[];discounts:BillingDiscount[]
}
export interface BillingInvoice {
 id:string;currency:string;status:string;amountDueMinor:number;amountPaidMinor:number;
 amountRemainingMinor:number;dueAt:string|null;attempted:boolean;attemptCount:number;
 paymentIntentId:string|null;subscriptionId?:string|null;createdAt:string
}
export interface BillingPayment {
 id:string;currency:string;amountMinor:number;amountReceivedMinor:number;status:string;
 failed:boolean;createdAt:string
}
export interface BillingRefund {id:string;chargeId:string;currency:string;amountMinor:number;status:string;createdAt:string}
export interface BillingCreditNote {id:string;invoiceId:string;currency:string;amountMinor:number;status:string;createdAt:string}
export interface ExactAmount {numeratorMinor:string;denominator:string;roundedMinor:number}
export interface BillingRevenue {currency:string;arr:ExactAmount;mrr:ExactAmount;subscriptionIds:string[];priceIds:string[]}
export interface BillingDocument {
 customerId:string;subscriptions:BillingSubscription[];invoices:BillingInvoice[];
 payments:BillingPayment[];refunds:BillingRefund[];creditNotes:BillingCreditNote[];
 revenue:BillingRevenue[];
 risks:{kind:'failed-payment'|'overdue-invoice';reference:string;currency:string;amountMinor:number;observedAt:string}[]
}
export interface BillingConnection {
 id:string;name:string;disconnected_at:string|null;credential_present:number;
 stale_days:number;version:number;cursor:string|null;last_success:string|null;last_error:string|null;
 webhook_present:number;freshness:string
}
export interface BillingObservation {
 id:string;accountId:string;bindingId:string;connectionId:string;customerId:string;
 sourceSystem:string;sourceReference:string;observedAt:string;receivedAt:string;
 accountRevision:string;document:BillingDocument;freshness:string;confidence:string
}
export interface BillingState {
 connections:BillingConnection[];
 accounts:{id:string;name:string;revision:string}[];
 bindings:{id:string;connectionId:string;customerId:string;accountId:string;revision:string;reviewedBy:string;reviewedAt:string}[];
 observations:BillingObservation[];history:BillingObservation[];
 changes:{id:string;account_id:string;snapshot_id:string;source_reference:string;observed_at:string;before:unknown;after:unknown}[];
 runs:{id:string;connection_id:string;customer_id:string|null;started_at:string;finished_at:string|null;status:string;read_count:number;snapshot_count:number;error:string|null;cursor_before:string|null;cursor_after:string|null;trigger_kind:string}[]
}
export interface BindingPreview {connectionId:string;customerId:string;accountId:string;accountName:string;accountRevision:string;token:string;expiresAt:string}
