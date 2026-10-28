# Agent door foundation

Buoy includes the shared agent-door and Business settings runtime source from
Base `d555e789cffb744a9f83d76ebe42a2e3bdd7a055`. `base-copies.json` records the
source commit, file digests and modes. The CLI dependency remains a separate pin.
Only runtime, conformance and adoption documentation are copied; upstream unit
tests and signing fixtures are not part of the installation.

The additive migrations are `0078_business_settings.sql`,
`0079_business_people.sql` and `0080_agent_door.sql`. They use the existing D1
migration lifecycle and preserve all older migration bytes. These tables alone
do not enable Business settings, MCP, agent policy or person approval routes.
The production Worker has not mounted the shared door yet.

Current agent access remains Buoy's explicitly scoped local bearer commands:
`renewals.list`, `playbook.prepare`, `renewal.prepare`, `experiment.prepare` and
`experiment.report`. Existing grants, data-class limits, expiry, revocation and
Pause continue to apply. Preparation does not approve a proposal, confirm a
renewal, charge a customer or establish a measured outcome. See the owner guide
for these current commands; there is no shared-door conformance claim.

## Native revision prerequisite

Buoy account, plan, renewal and experiment versions are opaque string revisions.
Native writes compare those exact values inside their guarded transactions.
The copied door's `ToolDefinition.revision` accepts `number | null`, and its
registry adds an integer `expected_revision` argument. Adoption must preserve
Buoy's native revisions through both initial calls and held execution. A numeric
hash, truncated UUID or replacement revision counter is not the native version.

Shared-door activation remains pending a compatible opaque-revision contract.
Do not infer completion of `SURFACE-001` through `SURFACE-009` from these source
copies or migrations. The native tool/resource registry, signed Business person
binding, attribution and specialist journey remain adoption work.
