# Buoy

Customer success and renewals for a small B2B software company. Keep confirmed renewal dates beside billing and support evidence, work an approved at-risk playbook, and record the renewal decision. MIT licensed; data lives in your own Cloudflare D1 database.

The public website and owner guides are at [run-buoy.com](https://run-buoy.com).

## Run from a clone

You need Git and npm. Install RER once, then launch:

```sh
git clone https://github.com/just-every/run-buoy.git
cd run-buoy
npx -y @runeditrun/rer cli install
export PATH="$HOME/.local/bin:$PATH"
rer dev
```

`rer dev` installs the pinned dependencies, selects Node 22.20.0 and pnpm 10.12.4, migrates local D1 and prepares a local owner. Open the private `RER_OPEN` link it prints on this computer, confirm the owner at **Finish setup**, then open **Accounts**. No Cloudflare account or mail provider is needed locally. Keep the sign-in link private. A first run can take a few minutes; a queue wait prints its position.

To choose your own owner mailbox instead, run `rer install`, `rer setup --owner-email you@example.com`, then `rer dev`. For ordinary email-link sign-in, stop with `rer dev --stop`, start with `rer dev --login`, and follow the local outbox link printed by RER. Request your saved owner email at `/signin`, open its latest message in that outbox and confirm the sign-in. Local mail never leaves the computer.

Stop with `rer dev --stop`. Local data persists in `.wrangler/state`; private settings are in `.dev.vars`. Neither belongs in Git. Do not run build, backup or restore while serving.

## First useful journey

1. On **Accounts**, enter the account name, confirmed renewal date, notice days and the contract/source reference. Add a billing observation and a support observation, or leave them absent to see **Unknown** health. No business data is preloaded.
2. Billing uses an invoice total minus credits and allocated payments. For an overdue unpaid invoice or urgent open support ticket, the account becomes **At risk**, with the source and observation dates shown. Observations older than 30 days remain labelled stale. No risk signal with fresh billing and support gives **Healthy**; this is a defined rule, not a churn prediction.
3. Open the account. Prepare a playbook action and due date. Review its retained evidence, approve it as an owner/admin, then record completion evidence. Approval does not send a message or imply completion.
4. Prepare a renewal outcome, reason and evidence reference. Approve it to record who decided and when. A source refresh makes pending proposals stale; prepare a new proposal from the changed evidence. Earlier decisions stay attached to the date they approved.
5. **Imports** accepts the [Account, billing and support JSON v1 kit](fixtures/move-in/README.md). Paste your documented-shape snapshot, preview, review counts and diagnostics, then apply. The journal supports undo until a record changes or gains work. The example files are explicitly synthetic, for a trial only.

The first release accepts at most 500 accounts, 50 per import and 256 KB per API request. Amounts are integer minor units for AUD, CAD, EUR, GBP, NZD or USD. Billing and support are human-supplied snapshots, with references to evidence held in your existing systems. Buoy does not fetch those references or move money.

The owner and admins manage accounts, imports, approvals and completion. Members read and prepare proposals. Only the owner erases accounts or creates/revokes agent credentials. Native operator invitations and roles use Base's authenticated `/auth/invite`, `/auth/operators`, `/auth/operator/role` and `/auth/operator/status` endpoints; see [the auth guide](src/modules/operator-auth/README.md). API requests cannot bypass these rules. One installation is one team, with all team members able to read its accounts.

## Agents

[COMMANDS.md](COMMANDS.md) documents the HTTP commands `renewals.list`, `playbook.prepare` and `renewal.prepare`. A short-lived scoped agent credential can only use those commands. People review and approve in the account screen. Every proposal retains its source snapshot, preparer and approval record. No model provider is necessary.

## Backup, restore and erasure

```sh
rer dev --stop
rer export --output exports/buoy.rer
```

Keep this archive private and record the release commit beside it. It includes domain records, historical approval identity labels, imported normalized evidence, undo history and erasure tombstones. It excludes native operators, sessions, agent credentials, outbox mail and private settings. Original upload byte formatting is not retained. Evidence references are retained; files held in other systems are not copied.

Restore into a fresh clone of the same commit (before running `dev`):

```sh
rer install
rer import --input /path/to/buoy.rer --yes
rer setup --owner-email you@example.com
rer dev
```

The destination must be empty. Establish the new owner and confirm first-run setup; the domain records and their historical approval labels remain. Damaged archives and nonempty destinations are refused. `rer reset --yes` is destructive; export first if the data matters.

On an account page the owner can type the account name and erase it. This removes its work, decisions, normalized import source and retained copies together, while keeping nonpersonal erasure receipts and replay tombstones. It does not erase copies you already exported or evidence in other systems. Keep old backups under your retention policy; restoring an old backup into a different empty installation restores its historical contents.

## Deploy to your Cloudflare account

No run-site domain is needed; the app can use its Worker address. Use an account you control (fleet operations use only the RunEditRun account). In `deploy.json`, set `vars.MAIL_FROM` to your verified sender and select/configure your supported mail provider. The initial provider is Resend; its API key is required for hosted sign-in. Do not change project, edition, Worker, D1 or package identifiers.

Provide `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `OWNER_EMAIL`, `SESSION_SECRET`, `SETUP_TOKEN` and `MAIL_API_KEY` privately through your shell or secret manager. Generate independent random secrets of at least 32 characters for session/setup. Never commit them or paste them into command arguments. The Cloudflare token must permit this account's Worker deployment and D1 provisioning/migrations.

```sh
rer dev --stop
rer deploy --dry-run
rer deploy
```

The dry run builds and validates without provider calls. Real deploy provisions the declared resources, applies migrations, uploads secrets and checks health. Follow its owner-claim instructions, then sign in using your real mail provider. This repository's tests establish local behaviour; they do not prove your provider configuration or hosted delivery. Build and deploy never run tests. See [the command contract](SEED-COMMAND-CONTRACT.md) and `rer describe` for effects.

## Development

Package mode pins `@runeditrun/rer` **0.2.30**; [SOURCES.md](SOURCES.md) identifies the Base and sibling source. The app uses Base authentication, theme, document frames, import-kit and portability. The product's server-rendered forms work without client rendering.

```sh
rer dev --stop
rer verify
```

Verify builds once, typechecks, runs the public Worker/D1 flow tests, ordinary email-link sign-in and an installation export/restore journey. GitHub runs one Verify per push. Tests stay under the [200-test budget](test-budget.json). [ACCEPTANCE.md](ACCEPTANCE.md) is the release scope. Brand design, independent stranger acceptance and hosted qualification remain separate work.

## Run site and owner guides

`rer build --site` writes the public homepage, `/run`, `/docs` and seven owner guides to `dist/site`. Guides are compiled from [docs/](docs/index.md); edit those Markdown files to update the website. The installed `/` stays the Buoy Lobby. `rer dev` also prints `RER_SITE` for the local run-site preview.

The run-site workflow remains disabled unless the release gate enables `RUN_SITE_DEPLOY`. No site deployment is part of a local build.
