# Scoped staff profiles

Buoy has a bounded ROLE-001 foundation. A native owner or admin can assign an
existing active native member a CS manager, CSM, sales, support, finance and
executive, or custom product profile. Native owner and admin identities remain
native. An unassigned member keeps the existing member behavior; the installation
does not silently reclassify existing people. Removing a profile explicitly
returns that person to the existing native member policy.

The default declarations mirror the role matrix in `CONTRACT.md`. Current
account reads/search, scoped workspace homes, a narrow account-details PATCH and
scoped confirmed-term retention reports with audited CSV export are implemented.
A declared permission does not enable every action in its row. Assigned profiles
still receive server-side refusals on unported linked records, complete-data
exports, bulk actions, publishing, broader edits, approvals, connectors,
credentials and audit. Custom objects, CRM identities, AI answers and embedded
provider surfaces do not ship. ROLE-001 remains partial; complete acceptance and
verification are not claimed here.

## Configure a profile

The native owner or admin reads `GET /api/buoy/roles`. The response includes the
current configuration revision, default and custom definitions, permission row
values, existing assignments, current staff, accounts and segments.

Create or replace a custom definition with `POST /api/buoy/roles/definitions`:

```json
{
  "revision": "the revision returned by GET /api/buoy/roles",
  "name": "Current segment reader",
  "permissions": {"read": "scope", "commercialRead": "band"},
  "scope": {"kind": "segment", "segmentId": "an existing native segment ID"},
  "commercial": "band"
}
```

Supply its returned `id` to replace the same custom definition. Omitted permission
rows mean no permission. Default definitions cannot be overwritten. The allowed
values for each permission row are returned by the configuration door; they
describe the contract, including actions whose endpoints have not been ported.
Erasure remains reserved to the native owner. A custom invitation row cannot
change a native member into an identity administrator.

Assign a profile with `PUT /api/buoy/roles/assignments`:

```json
{
  "revision": "the current configuration revision",
  "personId": "an active native member ID",
  "roleId": "support",
  "scope": {"kind": "all"},
  "commercial": "band",
  "sharedAccountIds": [],
  "grants": {"concessionLimitMinor": null, "renewalOutcome": false}
}
```

Scope, commercial visibility, shared accounts and named grants can be omitted to
use the role's defaults and empty grants. Valid scope kinds are `all`, `team`,
`own` and `segment`; only segment scope accepts a `segmentId`. Grant limits are
nonnegative whole USD cents, or null for no concession right. Named grants are
stored declarations; approval endpoints remain unavailable to assigned profiles.
They do not authorize a discount or external commercial change today.

Remove an assignment with `DELETE /api/buoy/roles/assignments/:personId` and a JSON
body containing the current `revision`. Every configuration change advances the
revision and records an opaque audit event. A stale revision refuses the change.
Native owner/admin targets and native owner/admin role IDs are refused by the
assignment door. Native identity status/version and configuration revision are
checked again in the write transaction. A native status or role change invalidates
the assignment's native version; a fresh sign-in does not revive the old grant.
A native administrator must deliberately assign the profile again.

## Restore and reassignment

Installation archives retain custom role definitions and their permission/scope
configuration. They exclude per-person assignments, including explicit shared
account IDs and named concession/renewal grants stored with those assignments.
Restoring a definition therefore restores no person's product-role authority.
The destination's native owner or admin must explicitly select current native
member identities and assign their profiles, scope, shares and grants again.

The existing native unassigned-member policy still applies; restrictive profile
assignments themselves are not restored. This is the conservative archive default
pending ct approval, not a claim that the complete ROLE-001 portability or role
matrix acceptance has shipped. Agent and connector credentials are separately
excluded and require their own deliberate reissue or reconnect.

## Current account and search boundary

The assigned profile's record scope intersects its role definition's current
scope and default read rule. Per-person settings can narrow the role's scope or
commercial visibility; they cannot widen the definition. Editing a custom
definition therefore applies its current permission and visibility restrictions
to existing assignments on their next read. CSMs see
their current owned accounts plus explicit shares; a share does not grant access
to another book's commercial fields. A custom role with `read: "scope"` uses its
configured scope. Team scope means accounts whose current active owner directly
names this person as manager. Own scope reads current native account assignments.
Segment scope consumes current active SEGMENT-001 membership. Reassignment,
manager changes and segment entry/exit therefore affect the next read. Profiles
cannot use saved-view definitions as access grants.

Sales' CRM ownership rule has no current source of CRM identities. Its profile
therefore receives no account rows; a native staff assignment or explicit share
does not invent CRM participation. This acceptance remains pending CRM work.

`GET /api/buoy/state` returns an explicit account projection: native identity,
name, revision, renewal date, owner, health band and permitted recurring-revenue
values. It also returns the current `roleAccess` summary and each account's
current edit affordance. It omits nested health
explanations, arbitrary custom values, source text, contract terms, histories,
timeline entries, task/proposal payloads and immutable evidence snapshots.
General linked-record, field and timeline doors still require their own field
and record permissions; permitted retention-source drilldown is described below.

Full commercial readers receive current confirmed ARR, MRR and native currency.
Band readers receive only a native-currency ARR band: under 10,000; 10,000 to
under 100,000; or 100,000 and above. Missing recurring contracts say ARR is
unavailable. These bands use the currency's native major units; they perform no
currency conversion, and an invoice total never substitutes for ARR. Contract
dates, line items, discounts and forecasts are absent from this account/search
projection. CSM commercial reads are
limited to their own book, even when the record is shared with them.

`GET /api/buoy/search` matches only this permitted projection, before matching,
pagination, result counts and excerpts. Hidden accounts, source text and exact
commercial values cannot produce a result or disclose a value through an excerpt.
Current assigned-profile search covers accounts only. Native unassigned staff
retain the existing broader record search.

Existing immediate internal notices and task reminder emails apply the recipient's
current account scope before sending. An assigned profile receives only the
permitted account name, a generic update and a link to that account; original
task titles, source text, notes and exact commercial values never enter its email
subject or body. A notice outside current scope, or with an invalidated native
assignment, is not sent. Native unassigned recipients retain their existing mail
content. Aggregate digest reports remain unported and are excluded for assigned
profiles.

Projection reads recheck the role revision, assignment revision, native version,
live scope inputs and recurring-revenue snapshot before returning. Other future
role-authorized writes must include the exported role and scope fences in the
same transaction as their effect.

## Scoped home and book

`GET /api/buoy/workspace/home` and `/app/workspace` show the caller's current
assigned book. A CS manager or finance/executive profile with the matrix's home
permission can request another person's home with `?person=PERSON_ID`; a CSM
cannot open another person's home. The caller's own record and commercial-field
scope still applies. Inspecting a person never adopts that person's privileges.
Another person's wholly outside-scope book is refused; a partly permitted book
contains only its permitted accounts.

The read-only home shows open tasks handled by the selected person and due today
on the installation calendar, including current away cover; current unread alerts
with dismissed alerts excluded; and renewal dates through both endpoints of the
next 90 days. Its book uses the safe account/commercial projection. Task and alert
free text is replaced by generic labels, while references, dates and permitted
account names identify the work. Calendar meetings remain explicitly unavailable.
The person selector contains only eligible current homes, rather than a global
staff directory. Saved-view editing, bulk changes and general task/plan operations
are not enabled by this read door.

## Edit current account details

`PATCH /api/buoy/accounts/:id` accepts the current `revision` and a nonempty subset
of `name`, `renewalDate`, `noticeDays` and `renewalEvidence`. The native account
validator applies. Edit authority must be `all`, `team` or `own`, intersected with
the current readable record scope and the role definition's scope. A CSM's shared
accounts remain read-only; a CS manager edits only accounts owned by current
direct reports. Custom permission rows obey the same scope checks.

The operation reads the real stored account and preserves its billing/support
snapshots and all other unsubmitted fields. Commercial fields, custom fields,
ownership changes and unknown properties refuse the whole request. Role/native
version, live scope, source document and current revision guards run in the same
transaction as the edit, revision advance and opaque `account.updated` audit
entry. A stale or withdrawn authority cannot partially apply an edit.

The native account form is offered only when the projected record is currently
editable. It prefills the permitted name/date and revision; it requires an
explicit notice period when that value is not projected, and new confirmation
evidence. It never fills hidden source evidence or monetary values into markup.
This narrow operation does not enable the remaining account/contact/task/plan or
commercial-edit matrix acceptance.

## Scoped retention reports and CSV

`GET /api/buoy/revenue/retention`, `/app/revenue` and
`GET /api/buoy/revenue/retention.csv` use the existing confirmed-term retention
calculation. A report permission must allow it, and every selected account needs
full commercial-field access. CSM reports cover their current own book; CS manager
reports cover their current direct-managed team; finance/executive reports cover
their readable scope. Custom roles intersect their configured scope with the
report row. Band-only or no-commercial profiles are refused even when a custom
role declares report permission. Native owner/admin can use the new CSV door;
unassigned native members retain their existing GET report behavior, without
gaining the new CSV permission.

The allowlist applies before report filters, exceptions, account movements and
totals. Existing period/end, segment, CSM, tier, plan and cohort filters remain
available. Labeled CSM and segment choices come only from current owners and
members of the allowed export-set; tier choices are likewise scoped, while
plan/cohort choices use permitted report rows. There is no global staff, account
or segment catalog. Blank optional controls mean no filter. A selected value
remains selectable when its current result is empty, without looking up an
outside person's or segment's name. Hidden and unknown owner filters both return
empty results; a segment without a current permitted export-set member receives
the same generic refusal as an unknown segment.

The report retains permitted account financial movements and their confirmation
sources. Native formulas retain their complete internal graph; hidden accounts
do not become report rows, totals, exceptions or filter labels. Role, scope,
native/segment label revisions and exact financial/filter source images are
fenced before returning. A successful CSV rechecks the original authority/scope
and records one opaque `data.exported` receipt; a refused export records no
success. CSV contains only the permitted report, not an installation archive or
complete-data export. The screen has no rate-publishing controls. Provider invoice
reconciliation and the remaining REPORT-001 acceptance remain unavailable or
unproved; this role boundary does not change that report's meaning.

## Remaining ROLE-001 acceptance

The complete role matrix still needs per-row UI and API proofs inside and outside
scope. Unported work includes linked contacts/custom objects/plans/tasks,
commercial custom-field classification and editing, saved-view/bulk workspace
authority, draft/publish authority, complete-data exports and other report kinds,
named concession and renewal approval execution, connector and agent management,
AI settings/answers and the listed
embedded provider surfaces. Existing GOVERN-001 agent command/data-class policies
remain separate; this foundation does not add agent record scopes or widen their
authority. No scoped privacy exception is introduced.
