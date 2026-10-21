# Recorded weighted health

Open an account’s Health panel, then **Weighted health configuration and history**. Owners and admins choose numeric measures, their bounds, direction, positive weight and missing-source treatment. Preview before publishing; a preview changes neither the published card nor calculation history.

Available inputs are manual billing/support snapshots, delivered adoption observations, account numeric custom/calculated fields, and recorded CSM judgment. Monetary inputs retain their currency and minor units; Buoy does not infer FX conversion, recurring revenue or missing provider data. Survey measures are not implemented.

Each contribution scales linearly between its bounds and clamps to 0–100. The weighted mean uses the first matching layer-1 segment’s configured overrides. Missing inputs either make the result unknown or are excluded while the remaining weights are rebalanced. All excluded inputs remain unknown. Every breakdown retains source reference, observation time, freshness, contribution and effective weight. Stale observations stay visibly labeled.

Publishing creates an immutable version, recalculates accounts and records an opaque publish audit. A source change recalculates before its successful response; hourly scheduling refreshes unchanged results. Changed inputs retain a complete calculation snapshot. Select a version alone to preview current inputs, or select an input snapshot to compare genuinely retained observations with a version’s weights.

A configured card determines its band; an active red CSM judgment and separately configured adoption health retain their existing risk/missing effects. Final health fields cannot feed the segments selecting aggregate or scorecard inputs, directly or through tier/stage dependencies. Refused changes name the dependency chain. Downstream numeric score segments can prepare the existing person-approved entry tasks.

Future health dates expire recorded sentiment according to its missing policy and label native sources as stale; adoption and segment selection retain their recorded values. These are explainable observations, not churn predictions, forecasts of activity or causal claims. The full HEALTH-001 contract remains partial until its missing source measures and sourced ARR/score segment acceptance are proven.

Person-confirmed recurring terms are recorded on the account’s Recurring contract revenue panel. They supply native-currency ARR, MRR and purchased units as explicit scorecard inputs, with their retained contract version and confirmation reference. ARR/MRR segment rules must include their exact currency in the same all-rule. The original USD ARR over $50,000 and score below 60 flow uses these genuine confirmed terms; invoice totals remain separate. Provider financial history and reconciliation remain BILLING-003 work.
