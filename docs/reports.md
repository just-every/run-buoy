# Saved reports and dashboards

Open **Reports** from Buoy's navigation. An owner or administrator can build an
account report, choose filters, group by a current field, and select sum,
average or count. Add an optional calculated column using the same plain formula
language as account fields. The report displays its formula, each matching
account's inputs and an explanation. Missing or invalid inputs remain unavailable;
they never silently become zero. Native ARR and MRR retain their currency and
minor units, with separate totals per currency.

A saved report is a live definition, not a historical copy. Current segment
membership filters the cohort before calculations, grouping, charting and CSV.
The CSV uses the same calculation as the screen and guards text cells against
spreadsheet formula interpretation. A bar chart always includes a text table.

Use **Start from a dashboard** to explicitly choose **Current portfolio health
distribution** or **Current CSM book size**, then choose all permitted accounts
or a current segment. **Create private starter** saves one private dashboard and
its editable account-count report. Health distribution groups by the current
health band, including unknown; book size groups by the current assigned CSM,
including unassigned accounts. Empty cohorts produce an empty chart, table and
CSV rather than invented groups. Both starters reevaluate membership, ownership
and source evidence on each read. They describe current evidence, not historical
trends or predictions. No role share, schedule or outbound delivery is created.

Dashboards collect saved reports. Explicit role sharing applies separately to the
dashboard and its reports. Sharing a definition grants no account or commercial
permission. Assigned profiles receive only their current permitted account
fields; a report requiring another field is unavailable to that profile. Current
account-book transfers take effect on the next read. Read-only viewers cannot
edit either definition through the UI or API. Owner/admin writes require the
current revision and an authenticated same-origin request and leave an audit row.

Report and dashboard shares are installation-local authority excluded from
backups, alongside role assignments. A fresh owner can read restored definitions
and explicitly share them again. An identity-specific saved filter follows the
account's erasure custody; a general report reevaluates the remaining accounts.

This is a partial implementation of REPORT-002. Other object kinds, the complete
prebuilt dashboard catalog beyond these two starters, historical health trends,
engagement and onboarding measures, delegated authorship and scheduled email or
Slack delivery remain required. Creating a report never sends anything. RL-105
requires explicitly assigned author rights under ROLE-001; only owners and
administrators can publish through today's implemented door. Explicit role
sharing never broadens the viewer's existing field or record authority. Delivery
stays disabled until its own delivery clause and approved destinations ship.
