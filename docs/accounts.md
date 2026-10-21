# Accounts and evidence

An account brings together a confirmed renewal date, a notice deadline and the billing and support observations that explain its health.

## Create an account

An owner or admin opens **Accounts**, then **Create account**. Enter:

- **Account name** — the customer name your team recognises.
- **Renewal date** — the confirmed contract date.
- **Notice period (days)** — the number of calendar days before renewal when notice is due.
- **Renewal evidence reference** — where the confirmed terms can be checked.

Select **Create account** to save. The installation holds up to 500 accounts. Members can read accounts and prepare proposals; an owner or admin adds or refreshes account sources.

## Read the notice deadline

Buoy subtracts the notice period from the renewal date using UTC calendar dates. A renewal on January 15, 2027 with 30 notice days gives a notice deadline of December 16, 2026. Dates are entered as `YYYY-MM-DD`; the app displays them in readable form.

A billing period does not establish a renewal date. Record confirmed contract terms and their source, then act on the notice deadline before the renewal date arrives.

## Add billing evidence

Select **Include billing observation** and supply the observation date, source reference, currency, invoice total, credits, allocated payments and payment due date.

Amounts are nonnegative whole minor units at the currency's ISO 4217 exponent: `100` means `1.00` USD, `100` means ¥100, and `1500` means 1.500 KWD. Any active ISO 4217 code works, as do codes withdrawn since 2023 (HRK, ANG, BGN, SLL and ZWL) for earlier invoices. Codes without minor units, such as XAU or XDR, are refused. Credits plus allocated payments cannot exceed the invoice total.

Only payments allocated to that invoice reduce its outstanding amount. For example, a total of `120000`, credits of `10000` and allocated payments of `30000` leave `80000` minor units outstanding. If its payment due date is before today, that is an at-risk signal.

## Add support evidence

Select **Include support observation** and enter the observation date, source reference, open-ticket count and urgent-ticket count. Counts are nonnegative whole numbers; urgent tickets cannot exceed open tickets. Any urgent open ticket is an at-risk signal.

Observation dates cannot be in the future. Use the date of the source observation, rather than today’s date merely because you are entering it now. References point to evidence in your existing systems; Buoy does not retrieve the source or its attachments.

## Understand health

Health names the recorded signals and gaps:

- **At risk** — an overdue unpaid invoice or an urgent open support ticket is recorded. Missing or stale evidence is also shown when present.
- **Unknown** — no defined risk signal is recorded, but billing or support evidence is missing or stale.
- **Healthy** — fresh billing and support snapshots show no defined risk signal.

An old risk signal still appears as **At risk**, alongside its stale-evidence warning. Missing observations remain unknown; they never become a paid invoice or zero tickets. Health explains the evidence Buoy holds and is not a prediction of whether the customer will renew.

Billing and support snapshots go stale after 30 days by default. Every snapshot today is a manual one, typed in here or moved in from a file, and **Recorded evidence** shows its source system and whether it is stale. The owner or an admin can change the threshold for each source kind under **Evidence freshness** on the accounts page (1 to 365 days, or `PUT /api/buoy/settings/staleness` with `billingDays` and `supportDays`). Evidence is stale when its observation date is more than that many UTC days ago. Changing a threshold changes no observation.

Open an account to inspect **Recorded evidence**, including source references and observation dates. The account’s **Details** and audit disclosures show its retained records.

## Record CSM sentiment

On an account, use **Record CSM sentiment** to add your judgment: a red, amber or green rating, a reason and how many days it counts (1 to 90, 30 by default). Owners, admins and members can record sentiment; agent credentials cannot, because a rating is a person's judgment. The account's **Health** section shows the rating as a person's judgment rather than source data, with who recorded it and the last day it counts. Dates are UTC calendar dates.

- **Red** makes the account **At risk** while it counts, so you can prepare a playbook from it.
- **Amber** and **Green** are shown beside the health band without changing it.
- From the day after its last day, the rating is expired: health says so and treats sentiment as missing, but takes its band from billing and support evidence.

A new rating replaces the current one. Earlier ratings stay in the account's history until the account is erased.

To see what will be stale or expired on a later date, read `GET /api/buoy/accounts/<id>/health?on=YYYY-MM-DD`. The date can be from today up to 366 days ahead, and the read changes nothing.

## Refresh sources

On the account page, an owner or admin uses **Refresh account sources**, reviews the terms and observations, and selects **Save source refresh**. A concurrent edit is refused; reload and review the current account before saving again.

A refresh changes the account revision. Pending proposals prepared against an earlier revision become stale and must be prepared again. Approved decisions retain the terms and evidence against which they were recorded. See [Playbooks](/docs/playbooks) and [Renewal decisions](/docs/renewals).

## Delete an account

The owner can use **Delete account** at the bottom of its page and type the account name to confirm. Export a [backup](/docs/backups) first if the records need to be retained.

Deletion removes the account’s work, decisions and retained normalized import evidence together. Nonpersonal erasure receipts and replay tombstones remain so erased records cannot simply be imported again. Deletion does not remove previously exported backups or evidence in other systems.

## Organizations and product relationships

Create each organization, child account and product relationship through the same
**Create account** door. Each is a full native record and counts against the
installation’s 500-record limit. On a child, open **Edit organization, staff owners
and stakeholders**, select its parent and record kind, and name the source. A
relationship represents a product line, subscription or business unit. Cycles are
refused without changing the hierarchy.

Assign the CSM through **Account owner**. The organization form separately records
the account executive, executive sponsor and support owner. Create customer
contacts/users and their explicit account memberships before choosing stakeholder
roles. One contact can be a champion on one account and an executive sponsor on
another. Tier and lifecycle stage remain editable through **Segments**.

Each product relationship has its own sources, recurring contract, renewal,
activity, custom fields and CSM. **Choose this record’s scorecard** pins an immutable
published version, or inherits the installation default. Publishing a new default
does not replace a pinned version. New sources still recalculate the pinned card.

The hierarchy ARR rollup includes each terminal descendant once, separating native
currencies and leaving a total unknown when a source is missing. Intermediate
organization contracts remain visible on their own record and are not added again.
Product users count once across all memberships in the subtree. Health lists the
terminal records, uses the worst band (at risk, unknown, watch, healthy), and shows
a mean only when every terminal record has a numeric score. A parent’s score is
therefore weighted by its number of terminal sources when combining child means.

Erasing a parent removes that requested native record. Its other native child
accounts remain detached with their IDs and record kinds preserved; reattach them
explicitly. A product relationship is never silently converted or erased with its
parent. Erased-parent source history is withdrawn.

**Current record activity** links native sources in observation/action order,
newest first, with stable pages. Connected mailbox, meeting, CRM and support
history remains unfinished; the current feed does not claim a connected timeline.
