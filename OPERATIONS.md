# Buoy operations

Use the clone/run, backup and deploy instructions in README.md. RER 0.2.19 runs the edition adapter in scripts/installer/local.mjs; there is no vendored CLI. Node 22.20.0 and pnpm 10.12.4 remain pinned.

Identifiers remain customer-success/buoy (project), buoy (edition), customer-success-buoy (Worker), foundation (declared local D1) and @customer-success/buoy (package). Hosting provisions through the Base owner-account deploy kit. No domain/run-site deployment is required in this release.

Local archives use Base portability's inventory: buoy_accounts, buoy_proposals, buoy_tasks, buoy_decisions, buoy_events and all ik_* custody/erasure tables are included. buoy_agent_tokens and buoy_assertions are excluded. Base excludes oa_*/oc_* identity, sessions, secrets, local outbox, migration bookkeeping and dependency secrets. A restored installation claims a fresh owner; historical approval labels are evidence, not permissions. Old archives remain the owner's retention responsibility.

The public API and documented command boundary are in COMMANDS.md. The import kit is documented under fixtures/move-in. RER build/deploy perform no tests. Verify runs one production build, typecheck and the focused public-door tests. No live provider calls are made by tests.
