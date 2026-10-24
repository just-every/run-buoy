# Buoy operations

Use the clone and run, backup and deploy instructions in README.md. RER 0.2.79 runs the edition adapter in scripts/installer/local.mjs; there is no vendored CLI. Node 22.20.0 and pnpm 10.12.4 remain pinned.

The hosted project retains the identity declared in edition.json and rer-project.json. The edition remains buoy, the Worker remains customer-success-buoy, the declared local D1 remains foundation and the package keeps its existing name. Hosting provisions through the Base owner-account deploy kit. No domain or Run site deployment is required in this release.

Local archives use Base portability's inventory: buoy_accounts, buoy_proposals, buoy_tasks, buoy_decisions, buoy_events and all ik_* custody/erasure tables are included. buoy_agent_tokens and buoy_assertions are excluded. Base excludes oa_* and oc_* identity, sessions, secrets, local outbox, migration bookkeeping and dependency secrets. A restored installation claims a fresh owner; historical approval labels are evidence, not permissions. Old archives remain the owner's retention responsibility.

The public API and documented command boundary are in COMMANDS.md. The import kit is documented in ./fixtures/move-in/README.md. RER build and deploy perform no tests. Verify runs one production build, typecheck and the focused public-door tests. No live provider calls are made by tests.

## Hosted delivery

The hosted project descriptor keeps the existing `just-every/run-buoy` identity.
The Worker and package identities above remain unchanged. `packaging.json` declares
this installation's D1 migrations, hourly schedule, app origin and mail providers.
After the real production build, run `pnpm delivery:spec` to refresh the committed
integration specification. `pnpm check:deployment-spec` refuses stale output.
`node scripts/delivery/base/cli.mjs package --config packaging.json --output rer-package`
creates the hosted artifact, descriptor and dispatch-only Managed workflow.
The generated package and delivery output are disposable and remain ignored.

Managed hosting assigns `AUTH_ORIGIN`, `MAIL_PROVIDER`, `MAIL_FROM`,
`MAIL_RELAY_URL` and a private `MAIL_API_KEY`. Assisted hosting asks for the
chosen RER relay, Resend, SendGrid or Cloudflare provider's own configuration.
The development outbox never sends external email. A hosted installation must
configure a real provider before relying on sign-in messages or notifications.
Retain private configuration separately from source and portable archives.

For recovery, pause writes and hourly scheduled work, retain the exact source,
export the installation with the existing native archive command and restore
into fresh empty resources. Claim a fresh owner, re-export and compare domain
data before routing traffic. Preserve all applied migration names and bytes.
The source checks are `node scripts/edition-authoring/cli.mjs check` and
`node scripts/edition-authoring/cli.mjs verify-base --offline`.
