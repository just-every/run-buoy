# Custom account fields

Open **Fields** in the signed-in app. Owners and admins create or edit a field by
saving its stable key; members read using the account access that already applies.
Define text, finite number, date, boolean, picklist, multi-select, currency or formula
fields. Currency values are `{ "currency": "USD", "amountMinor": 1800000 }`:
amounts stay in that currency's integer minor units. No conversion is implicit.

Record manual values as a JSON object and name the source record. Omitted keys
are explicitly cleared. A formula is read-only. Preview a definition against real
accounts before saving; the preview changes no definition, value or history.
The screen displays ten accounts from the preview; the HTTP response covers the
whole current portfolio. Re-saving a key edits its label, choices or formula;
changing its type requires a new key. A choice in use cannot be removed.

Reference custom values with `custom.seats_used`, and native inputs with paths
such as `support.openTickets`, `noticeDays` or `renewalDate`. Formula examples:

- `custom.seats_used / custom.seats_purchased`
- `if(custom.active == true, custom.seats_used / custom.seats_purchased, 0)`
- `days(renewalDate, custom.start)`
- `sum(custom.seats_used)` and `avg(noticeDays)`
- `count(custom.seats_used)`

Arithmetic uses finite JavaScript numbers, ordinary arithmetic precedence and
parentheses. Comparisons use `==`, `!=`, `<`, `<=`, `>` and `>=`, with matching
value types. `if` evaluates only the selected branch. `days(a,b)` subtracts UTC
calendar days, including timezone offsets for timestamp literals. A missing input,
invalid calculation or zero denominator yields no value and an explanation.
Rollups use all current accounts, not an inferred hierarchy: sum and average
require numeric values on every account; count counts present values, including
zero and false. Empty sum/average is missing and empty count is zero. Explanations
list inputs and portfolio account IDs. Custom currency paths expose `.amountMinor`
and `.currency`; formulas never supply an exchange rate or convert units.

Every changed manual or calculated value keeps actor ID, UTC time, old/new value
and source. Changes recalculate dependent values, including portfolio rollups,
and advance affected account revisions so earlier approvals become stale. Native
source refreshes recalculate before their successful response. Definitions,
values and history travel in installation archives. Account erasure removes its
values and history, and redacts its source references in other accounts’ calculation
history. Calculated results are regenerated from remaining accounts.

Segments accept `custom.<key>` as typed inputs, including fractional numeric
comparisons. Booleans use 1/0; multi-selects compare their JSON array text. A
currency field exposes separate currency and minor-unit paths, so a monetary
rule must name its currency as well as the amount. No custom field grants access.

Current account fields are complete. ACCOUNT-001 adds users and contacts plus
hierarchy/relationship rollups; RENEW-001/RENEW-002 add opportunities; ACCOUNT-006
adds custom objects. Each must carry these types, formulas, preview, explanation,
history and segment-input obligations through its new record kinds before shipping.

Customer contacts and product users use the same field types, formula semantics,
explanations and change history through [Customer people](https://github.com/just-every/run-buoy/blob/main/docs/people.md). Their typed
segment paths are `people.contact.*` and `people.user.*`; conjunctions for one kind
must be satisfied by the same related record, including currency and amount.
