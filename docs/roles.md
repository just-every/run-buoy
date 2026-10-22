# Scoped staff profiles

Buoy has a bounded ROLE-001 foundation. A native owner or admin can assign an
existing active native member a CS manager, CSM, sales, support, finance and
executive, or custom product profile. Native owner and admin identities remain
native. An unassigned member keeps the existing member behavior; the installation
does not silently reclassify existing people. Removing a profile explicitly
returns that person to the existing native member policy.

The default declarations mirror the role matrix in `CONTRACT.md`. Only current
account reads and account search have been ported to these profiles. A declared
permission is not an implemented action: assigned profiles receive a server-side
refusal on other product endpoints, including exports, linked records, workspace
homes, publishing, edits, approvals, connectors, credentials and audit. Custom
objects, CRM identities, AI answers and embedded provider surfaces do not ship.
ROLE-001 remains partial.

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
values. It also returns the current `roleAccess` summary. It omits nested health
explanations, arbitrary custom values, source text, contract terms, histories,
timeline entries, task/proposal payloads and immutable evidence snapshots. Those
read doors require their own field and record permissions before they can ship.

Full commercial readers receive current confirmed ARR, MRR and native currency.
Band readers receive only a native-currency ARR band: under 10,000; 10,000 to
under 100,000; or 100,000 and above. Missing recurring contracts say ARR is
unavailable. These bands use the currency's native major units; they perform no
currency conversion, and an invoice total never substitutes for ARR. Contract
dates, line items, discounts and forecasts are absent. CSM commercial reads are
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

## Remaining ROLE-001 acceptance

The complete role matrix still needs per-row UI and API proofs inside and outside
scope. Unported work includes linked contacts/custom objects/plans/tasks,
commercial custom-field classification, manager and finance workspace homes,
draft/publish authority, report/data exports, named concession and renewal approval
execution, connector and agent management, AI settings/answers and the listed
embedded provider surfaces. Existing GOVERN-001 agent command/data-class policies
remain separate; this foundation does not add agent record scopes or widen their
authority. No scoped privacy exception is introduced.
