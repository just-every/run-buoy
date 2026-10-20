# Adoption and purchased seats

Open **Usage → Product adoption metrics**. An owner or admin defines a feature or module with a stable key and an exact list of event names, and records purchased seats for each account. Saving the same kind/key replaces its event set. This is a measurement configuration, not a license verification or billing source. A blank seat count removes the denominator; zero is a real configured count.

The report and CSV use the reviewed USAGE-001 mappings and current customer memberships. Unreviewed claims and group-only observations never invent an active person. A person appearing under multiple reviewed source identities is one active person, including in a segment or portfolio. Distinct event deliveries still count as distinct activity; replaying the same source/message ID does not.

Choose a **Through UTC date**. Daily, weekly and monthly active users are distinct customer people with a `track` or `event` observation in the trailing 1, 7 or 30 inclusive UTC calendar days. `identify` and `group` messages are not activity. Each count compares with its own immediately preceding window of the same length. For example, through October 1, the current weekly period is September 25–October 1 and the previous week is September 18–24. Feature and module adoption is the number of monthly active people using that set divided by monthly active people. Overlapping event sets do not multiply an individual set's adopting users.

All other period metrics use 30 days:

- Depth is the number of active events divided by monthly active people.
- Breadth is the number of configured feature/module sets used divided by all configured sets. It is unavailable when no sets exist.
- License utilization is monthly active people divided by purchased seats. It may exceed 100%. A missing account denominator makes the aggregate unavailable; zero total seats also makes it unavailable. A person has no individual purchased-seat denominator, so person utilization is unavailable.
- Weekly change is `(current WAU − previous WAU) / previous WAU`. A decline of at least 30%, including exactly 30%, is flagged. A zero previous count produces an unavailable trend, not an inferred decline.

Time to first value uses each person's first retained, currently attributed `identify` observation and the first strictly later active event belonging to any configured feature or module. The report gives the number of people with both and their mean elapsed seconds, rounded to milliseconds. Without either observation it is unavailable. This is not a verified signup date or proof of business value.

Reports are available for a person, account, current segment or selected portfolio. Filters intersect. Current definitions, memberships, reviewed mappings and seats apply to both periods; the report does not claim historical segment membership or historical license entitlements. Installation coverage and source-reference counts describe the full current/previous 30-day window (60 days), separately from filtered metrics. Retained data never proves that every source delivered every event.

The authenticated API has the same report at `GET /api/buoy/adoption`, with optional `on`, `accountId`, `personId` and `segmentId` filters. CSV uses `/api/buoy/adoption/report.csv` with the same filters. Owners/admins write event sets at `POST /api/buoy/adoption/definitions` and seats at `PUT /api/buoy/adoption/seats`. These reads use existing staff account-read authority, while configuration requires the existing owner/admin authority and browser writes require the exact installation Origin. Source credentials and agent grants confer no adoption-report authority.

Definitions and seat counts persist in the installation database and archive. Account erasure removes its seat denominator and attributed observations. No new outbound provider is called. The reports are observations, not predictions or evidence of causation. ADOPT-001 remains partial: individual-seat entitlements/per-person utilization, configurable health measures, alert routing, playbook triggers and typed segment-rule inputs do not consume these metrics yet. The original 90-day/30-account metric acceptance is asserted in `tests/adoption.mjs`; native configuration, filters, CSV, refusal/recovery and accessibility are asserted at 1440 and 390 in `tests/adoption-browser.mjs`.
