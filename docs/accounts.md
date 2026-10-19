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

Amounts are nonnegative whole minor units. For the supported two-decimal currencies, `100` means `1.00`. The supported codes are USD, CAD, EUR, GBP, AUD and NZD. Credits plus allocated payments cannot exceed the invoice total.

Only payments allocated to that invoice reduce its outstanding amount. For example, a total of `120000`, credits of `10000` and allocated payments of `30000` leave `80000` minor units outstanding. If its payment due date is before today, that is an at-risk signal.

## Add support evidence

Select **Include support observation** and enter the observation date, source reference, open-ticket count and urgent-ticket count. Counts are nonnegative whole numbers; urgent tickets cannot exceed open tickets. Any urgent open ticket is an at-risk signal.

Observation dates cannot be in the future. Use the date of the source observation, rather than today’s date merely because you are entering it now. References point to evidence in your existing systems; Buoy does not retrieve the source or its attachments.

## Understand health

Health names the recorded signals and gaps:

- **At risk** — an overdue unpaid invoice or an urgent open support ticket is recorded. Missing or stale evidence is also shown when present.
- **Unknown** — no defined risk signal is recorded, but billing or support evidence is missing or older than 30 days.
- **Healthy** — fresh billing and support snapshots show no defined risk signal.

An old risk signal still appears as **At risk**, alongside its stale-evidence warning. Missing observations remain unknown; they never become a paid invoice or zero tickets. Health explains the evidence Buoy holds and is not a prediction of whether the customer will renew.

Open an account to inspect **Recorded evidence**, including source references and observation dates. The account’s **Details** and audit disclosures show its retained records.

## Refresh sources

On the account page, an owner or admin uses **Refresh account sources**, reviews the terms and observations, and selects **Save source refresh**. A concurrent edit is refused; reload and review the current account before saving again.

A refresh changes the account revision. Pending proposals prepared against an earlier revision become stale and must be prepared again. Approved decisions retain the terms and evidence against which they were recorded. See [Playbooks](/docs/playbooks) and [Renewal decisions](/docs/renewals).

## Delete an account

The owner can use **Delete account** at the bottom of its page and type the account name to confirm. Export a [backup](/docs/backups) first if the records need to be retained.

Deletion removes the account’s work, decisions and retained normalized import evidence together. Nonpersonal erasure receipts and replay tombstones remain so erased records cannot simply be imported again. Deletion does not remove previously exported backups or evidence in other systems.
