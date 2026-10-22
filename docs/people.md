# Customer contacts and users

Open **Customer people** at `/app/customer-people`. An owner or administrator creates a customer contact or product user, selects its account memberships, and records a source reference. These are customer records; team members and their access are managed in Team. Memberships are explicit and may span more than one account. Creating a customer record does not approve any usage identity mapping.

Select a customer in **Customer record** to read its values, formula explanations and history. **Edit customer record** changes its name or memberships with a fresh source reference. Its kind is fixed when created; create the other record kind explicitly when needed. Writes use the displayed revision: if another write changes the record, reload the current record before saving again.

## Typed fields

**Create a customer field** defines a key, label and one of the following types. Definitions apply to both contacts and users.

| Type | Value in the manual JSON editor |
| --- | --- |
| Text | `"Customer-confirmed evidence"` |
| Number | `24` or `0.6` |
| Currency | `{"currency":"USD","amountMinor":1800000}` |
| Date | `"2026-10-01"` |
| Picklist | `"Enterprise"`, one of the defined choices |
| Multi-select | `["Reports","Exports"]`, using defined choices |
| Boolean | `true` or `false` |
| Formula | Calculated and read-only |

Picklist and multi-select options are entered one per line. An existing key cannot change its type, and removing a choice in use is refused. Currency retains its ISO currency code and integer minor-unit amount; it is never converted implicitly. Dates must be real calendar dates.

**Edit customer field values** accepts a JSON object keyed by manual field key. Keep the JSON value types shown above. Omitted manual keys clear their existing values. Formula keys cannot be written manually. Every change requires a source reference.

For example, define number fields `used` and `purchased`, a picklist `package`, and a currency field `contract`, then save:

```json
{
  "used": 24,
  "purchased": 40,
  "package": "Enterprise",
  "contract": {"currency": "USD", "amountMinor": 1800000}
}
```

## Calculations and preview

**Preview a customer field** accepts an unsaved definition such as:

```json
{
  "key": "utilization",
  "label": "License utilization",
  "type": "formula",
  "formula": "custom.used / custom.purchased"
}
```

Preview evaluates the full current customer portfolio and displays up to ten real customer records and ten real accounts, including linked customers and explanations. It writes no definitions, values or history. Copy the reviewed key, label, type and formula into **Create a customer field** to save it.

Formulas use a bounded expression parser. Arithmetic uses ordinary precedence; comparisons require matching types. `if(condition, then, else)` evaluates only the selected branch. Formula results must be finite numbers. Unknown functions, executable JavaScript, prototype access and circular field dependencies are refused. Missing inputs and division by zero show **Not recorded** with an explanation.

| Example | Meaning |
| --- | --- |
| `custom.used / custom.purchased` | Customer license utilization |
| `if(custom.purchased > 0, custom.used / custom.purchased, 0)` | Use an explicit zero-denominator branch |
| `days("2026-10-21", custom.started)` | UTC calendar-day difference |
| `count(custom.used)` | Number of customer records with a value |
| `sum(custom.used)` | Sum across every current customer record |
| `avg(custom.used)` | Average across every current customer record |

Rollups evaluate customer records once each, including a customer with multiple account memberships. `sum` and `avg` require numeric values on every current customer record; a missing value leaves the result empty with an explanation. `count` counts present values. Currency formula inputs name their explicit component, for example `custom.contract.amountMinor`; retain the currency context when interpreting amounts.

Saving an input recalculates dependent formulas before the write completes. The history records each changed value with its actor, UTC instant, previous value, new value and source reference. For the example above, changing `used` from `24` to `32` changes utilization from `0.6` to `0.8` and records both changes.

## Segments and usage attribution

Customer fields are typed segment inputs before they can be used for usage attribution. The customer page lists their names and types; **Segments** lists the account rules. Account rule paths distinguish contacts from users, for example `people.contact.custom.utilization` and `people.user.custom.active`. Numeric comparisons accept fractions. Boolean rule values use `1` or `0`; multi-select rule values use JSON array text. Monetary comparisons pair `.currency` with `.amountMinor` in an all-conditions rule.

Customer records and account memberships provide the carrier for USAGE-001 mapping review. Raw source user/group IDs remain exact and source-namespaced. Review usage mappings separately in **Usage**; creating a customer record alone does not attribute pending events.

## Acceptance journey

`tests/customer-people-browser.mjs` drives native forms against the real public Worker at 1440 and 390 pixels. It creates a contact and a user with explicit memberships, saves every manual field type, previews the utilization formula over ten real accounts, saves it, verifies missing/zero explanations, changes an input and reads actor/time/source old–new history. It also edits memberships and proves an unsafe formula is refused while preserving the entered definition.

The journey reuses the inherited axe, keyboard, reflow and painted-background contrast checks. Named ACCOUNT-004 / USAGE-001 screenshots are written beneath `EVIDENCE_DIR` (default `../evidence/customer-people`, outside the repository). After building the Worker, run `pnpm run test:customer-people-browser`. The journey establishes native behavior, not provider delivery or certification.

## Customer privacy requests

The installation owner can open a customer’s privacy controls, record an external
holder inventory, and export or erase the current customer record by entering its
exact name. A changed revision requires reloading and reviewing again. Admins,
members and agent credentials cannot perform these requests.

The JSON export includes current memberships, typed values/history, received
surveys, reviewed source-user usage across groups, in-app/license custody and
linked stakeholder/view history. Buoy records an opaque export receipt without
retaining the downloaded contents. Erasure removes this current custody and
recalculates surviving aggregates, preserving unrelated records. Source-scoped
user digests refuse erased usage replay; no raw identity is kept in that fence.

Receipts list explicitly recorded external system names, including reviewed usage
sources. The manual holder inventory is unverified: Buoy does not claim to discover
Salesforce/Zendesk records or delete anything there. Unlinked personal text in other records is not discovered; review it separately.
Previously downloaded exports and installation archives must be handled separately. Connected email/timeline
custody and the full connected-holder privacy acceptance remain unfinished. The
current owner-only confirmation, digest and receipt/holder retention defaults
remain subject to contract-policy review.
