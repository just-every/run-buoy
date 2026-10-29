# Native agent door

Buoy mounts one MCP endpoint at `/mcp` for a customer success operator. Its
current surface is six tools over five native agent operations: account reads,
inert playbook and renewal proposals, matched-experiment preparation and retained
experiment reports. The sixth tool is a read-only preparation-state witness.
These tools do not cover the full customer-success registry in CONTRACT.md.

The shared agent-door and Business settings source comes from Base
`114ef7a61f080da053af783c5fbe06f625d692cc`; `base-copies.json` records the copied
files and modes. The independently pinned CLI is `@runeditrun/rer` 0.2.88.
Migrations `0078_business_settings.sql`, `0079_business_people.sql` and
`0080_agent_door.sql` use Buoy's ordinary D1 migration lifecycle.

## Declared capabilities

`agent-surface.json` declares `tools`, `policy`, `pause`, `audit` and `idempotency`.
Resources, prompts, events and subscriptions are undeclared. Their lists expose
no items; attempts to use those families return `capability_not_declared`.
There is no `buoy.events.list`, resource reader or specialist prompt in this
subset. Native audit records are available through person-session doors; they
are not an MCP event stream.

The transport accepts MCP 2026-07-28 and the 2025-11-25 initialize path. Discovery
names the installation, supported capabilities and limits. Current runtime
defaults are 600 requests per minute and a 1 MiB request body. Local bearer
grants additionally retain their own rate limits. Runtime limits do not stand
in for company policy or authorize a native action.

## Tools and native actions

All six tools compute `standard` with facts `{"measure":1}`. The measure is one
internal operation. Account and commercial evidence in this subset is not
classified as regulated identity or bank data. Agent arguments claiming a class
or confirmation cannot change classification.

| Tool | Grant scope | Native action | Clause metadata |
| --- | --- | --- | --- |
| `buoy.renewals.list` | `renewals.list` | Read current account/renewal evidence within current sponsor and data-class limits | AGENT-003, RENEW-001, SURFACE-001 |
| `buoy.playbook.prepare` | `playbook.prepare` | Prepare an inert at-risk account proposal | PLAY-001, AGENT-001, SURFACE-002 |
| `buoy.renewal.prepare` | `renewal.prepare` | Prepare an inert renewal-outcome proposal | RENEW-001, AGENT-003, SURFACE-003 |
| `buoy.experiment.prepare` | `experiment.prepare` | Prepare exact matched cohorts for an optional additional check-in | AGENT-002, SURFACE-001, SURFACE-002 |
| `buoy.experiment.report` | `experiment.report` | Read the retained native experiment report | AGENT-002, SURFACE-001 |
| `buoy.workspace.snapshot` | `renewals.list` | Read visible account revisions and proposal/experiment identities, statuses and preparers | AUDIT-001, GOVERN-001, SURFACE-001 |

Clause metadata identifies the native slice a tool uses. It does not establish
completion of an umbrella clause. Preparation creates no approved task,
confirmed renewal, intervention enrollment or measured customer outcome. These
tools read retained evidence and write local drafts; they expose no billing,
model, customer-message or connector execution. Existing internal notification
mail remains a separate native flow, with its own recipient permissions and
provider fees.

## Identity, policy and person actions

Business tokens use the installation's owner-claim trust and canonical `/mcp`
audience. Their sponsor resolves through the signed Business-to-native-person
binding; token email is not authority. The native owner lifecycle claims the
owner and completes Buoy's ordinary `/setup` form. Local opaque credentials
continue to identify their issuing owner, current command scopes and four
data-class grants. Both credential paths retain the agent as the effect actor
and the current native person as sponsor. Suspended or revoked authority cannot
be recovered from an earlier saved principal.

One company-policy pipeline decides MCP calls and the former local
`/api/buoy/commands` operations. A new installation has no answered company
policy, so tools are unavailable until the owner supplies a complete policy at
`/agents` or Business adopts one through `/api/rer/agent-policy`. A local grant
cannot widen that policy, and company permission cannot widen native authority.
The owner can Pause through `/agents`; the existing native Pause control also
stops agent dispatch and guarded preparation commits.

Under an all-autonomous policy, the permitted operation runs. Under a held
policy with standard set to review, these same inert operations run and enter
the review feed. That review is separate from native proposal approval. Owners,
admins and explicitly authorized staff still use their native approval doors;
these six tools grant no person approval, account edit, commercial change,
erasure or credential-management operation. No tool supplies native undo.

## Revisions, replay and accounting

Buoy revisions remain opaque strings. The two account preparation tools accept
the exact string as `expected_revision`; a mismatch refuses execution. Every
mutating MCP call requires `idempotency_key`. Replay returns the saved result
instead of creating another draft, while changing a request under the same key
is refused. Experiment preparation also preserves its native `operationKey`.

These operations incur no metered agent charge and exercise no provider-spend
cap. Shared provider-spend enforcement is not implemented; this subset grants
no paid action. Internal notification-provider fees remain outside the USD0
agent-operation ledger. A read, proposed experiment or task draft does not prove
provider execution, delivery, revenue retention or customer confirmation.

## Contract and verification scope

The manifest declares a native phase fixture and journey through public owner
and agent doors. They prepare fresh source-evidenced accounts, typed tenure and
matched cohorts and inspect retained proposals, attribution and inert outcomes.
Their presence is not a passing conformance receipt. Canonical
BASE-AGENT-001 through BASE-AGENT-013 requirements remain in CONTRACT.md; omitted
capability families retain explicit partial gaps rather than disappearing.

SURFACE-001 through SURFACE-009 remain partial. Full Core-job adapters, resource
templates, outside/commercial/access/provider classifications, change streams,
specialist handoffs and the joined CRM/billing/support/usage recovery week still
require implementation and their own proof. Native source copies and a small
tool registry do not establish those outcomes.
