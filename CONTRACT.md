# Buoy target product contract

Target edition: 17 October 2026. Buoy is a connected customer success platform for a US head of customer success at a B2B subscription or recurring-service company (roughly 5 to 50 customer-facing people, 100 to 10,000 accounts) replacing Gainsight CS, ChurnZero, Totango or Planhat, with the account workspaces, AI capture and agent execution buyers now see in Vitally and Velaris. Reporting money is USD in integer cents, and subscriptions billed in other currencies keep their native amounts beside it (BILLING-004). Dates and schedules follow US time zones and daylight saving, and the first integrations are the US services those buyers already run: Salesforce (with Service Cloud cases and CPQ), HubSpot, Stripe, Chargebee, Zuora, Zendesk, Intercom, Segment, Snowflake, BigQuery, Amazon S3, Google Workspace, Microsoft 365, SendGrid, Slack and Microsoft Teams.

## Product target

Buoy is the customer success platform a US head of customer success buys instead of Gainsight CS, ChurnZero, Totango or Planhat, and picks over Vitally and Velaris: every account's CRM, billing, support and usage data joined and kept fresh, health they can configure and explain, playbooks and journeys that run themselves, onboarding and success plans shared with the customer, and a renewal pipeline whose retention figures reconcile to billing, carried further by agents that verify outcomes under human control.

| | |
| --- | --- |
| Category | Customer success platforms |
| Incumbents a buyer switches from | Gainsight CS, ChurnZero, Totango, Planhat |
| Up-and-comers it must also beat | Vitally, Velaris |
| First buyer | A US head of customer success at a B2B SaaS or recurring-service company with 5 to 50 customer-facing people and 100 to 10,000 accounts, reporting in USD, running Salesforce or HubSpot (often with support cases, contract revenue and custom objects held there), Stripe, Chargebee, Zuora or an ERP billing export, and Zendesk, Intercom or CRM-native support, on the buyer's own Cloudflare account |
| What switching means | Accounts, people, health history, tasks, playbooks, plans, surveys and renewals arrive from the incumbent with a reviewed plan and can be re-imported through a parallel run; the Salesforce fields and support-tool context the incumbent fed keep working; every daily job (watching health, running playbooks and journeys, onboarding, renewing, reporting retention) has a Buoy equivalent |

The primary journey: move the incumbent book in, join customer evidence, explain health, run onboarding and success work, verify risk recovery, and renew or expand with billing-reconciled retention.

## How to read this contract

- This follows the RER contract standard.
- Core, Agent surface and Later are reported separately.
- Done means every acceptance point has recorded proof.
- Field proof is kept in its register.
- ACCEPTANCE.md and the homepage claims document are generated from this file.

## Door rules

- **D-1.** Automation execution. ROLE-001 governs design, publish, run and analysis scopes, including team-scoped CS-manager publishing. Before dispatch, recheck current authority, exact source revision, recipient permission and suppression. A person’s workflow authorization binds its reviewed version or exact approval; agent execution carries standard for internal reversible work, external for outside messages and live for changes to running automation, decided by company policy. A manual receipt is an unverified human report, never provider execution or delivery (RL-103, RL-104).
- **D-2.** Scheduled reporting. Re-evaluate the recipient’s current account, object and field scope and consent before producing or disclosing scheduled results. Sharing a definition never grants its data. An agent’s outside disclosure carries external and is decided by company policy (RL-105).
- **D-3.** New command accounting. Every paid, send or update command inherits GOVERN-001 reservation-before-effect USD accounting, data-class, rate and Pause proof at its own door before shipping, including permitted and refused calls under the company’s policy for its computed classes. Provider fees remain distinct from metered agent-operation charges.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | none | not run |
| BASE-ACCESS-002 | Sessions | HTTP-001, ROLE-002 | not run |
| BASE-ACCESS-003 | Public endpoints | none | not run |
| BASE-ACCESS-004 | Server-side authorisation | IMPORT-001 | not run |
| BASE-INPUT-001 | Validation | DATA-001, ACCOUNT-004, ACCOUNT-006, USAGE-001, API-001 | not run |
| BASE-INPUT-002 | HTML | INAPP-001 | not run |
| BASE-INPUT-003 | Uploads | IMPORT-001 | not run |
| BASE-SECRET-001 | No leakage | RESTORE-001, CONNECT-001, USAGE-001, SECURE-002, AI-004 | not run |
| BASE-SECRET-002 | Startup | none | not run |
| BASE-DATA-001 | Export and import | IMPORT-001, RESTORE-001, ERASE-002 | not run |
| BASE-DATA-002 | Retention | none | not run |
| BASE-DATA-003 | Erasure | ERASE-001, ACCOUNT-001, ACCOUNT-004, ACCOUNT-006, USAGE-001, REVIEW-001, NOTIFY-001, ERASE-002, AI-002 | not run |
| BASE-DATA-004 | Outbound flows | SECURE-002, AI-004, BOUNDARY-001, BOUNDARY-005 | not run |
| BASE-DATA-005 | Independence | none | not run |
| BASE-PUBLIC-001 | Privacy | SITE-001, INAPP-001 | not run |
| BASE-PUBLIC-002 | Origins | INAPP-001 | not run |
| BASE-PUBLIC-003 | Accessibility | none | not run |
| BASE-OPS-001 | Health | none | not run |
| BASE-OPS-002 | Migrations | none | not run |
| BASE-OPS-003 | Idempotency | USAGE-001, API-001 | not run |
| BASE-OPS-004 | Failure is visible | CONNECT-001, PLAY-003 | not run |
| BASE-OPS-005 | Audit | AUDIT-001 | not run |
| BASE-ROLE-001 | Roles through every door | HTTP-001, ACCOUNT-001, ACCOUNT-003, ACCOUNT-005, ACCOUNT-006, PLAY-001, PLAY-003, PLAN-001, REVIEW-001, NOTIFY-001, REPORT-002, ROLE-001, API-001, AI-001, AI-005 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | CONNECT-001, PLAY-001, AUDIT-001, API-001 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | RESTORE-001 | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | ERASE-001, REVIEW-001, ERASE-002, SURFACE-005 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | ROLE-002 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | none | not run |
| BASE-INSTALL-001 | Free self-host and removal | BOUNDARY-005 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | PLAY-002, PLAY-003, NOTIFY-001 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | STYLE-001, A11Y-001 | not run |
| BASE-DOCS-001 | On-site docs from one contract | none | not run |
| BASE-AGENT-001 | One MCP door per seed | none | not run |
| BASE-AGENT-002 | The seed's jobs are tools, through the UI's own actions | AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, SURFACE-001 | not run |
| BASE-AGENT-003 | Records are resources | AI-001, AI-005, SURFACE-007 | not run |
| BASE-AGENT-004 | Business identity and short-lived, audience-bound tokens | RESTORE-001, GOVERN-001 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role, never more | HTTP-001, ROLE-001, GOVERN-001, SURFACE-004 | not run |
| BASE-AGENT-006 | Every action declares its risk class | AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, SURFACE-001, SURFACE-002, SURFACE-003, SURFACE-004, SURFACE-005, SURFACE-006 | not run |
| BASE-AGENT-007 | The company's policy decides, at one chokepoint | APPROVAL-001, AI-002, AI-006, GOVERN-001, AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, SURFACE-002, SURFACE-003 | not run |
| BASE-AGENT-008 | Truthful attribution | APPROVAL-001, SURFACE-003, SURFACE-006 | not run |
| BASE-AGENT-009 | Every agent action is audited with its class and decision | GOVERN-001 | not run |
| BASE-AGENT-010 | Agents can follow changes | SURFACE-008 | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | AI-004, AI-006, GOVERN-001 | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | APPROVAL-001 | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-009 | not run |

## Published clauses

- `HTTP-001`: *Tier:* Core · *Cites:* BASE-ACCESS-002, BASE-ROLE-001, BASE-AGENT-005
- `DATA-001`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `APPROVAL-001`: *Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-012
- `IMPORT-001`: *Tier:* Core · *Cites:* BASE-DATA-001, BASE-INPUT-003, BASE-ACCESS-004
- `ERASE-001`: *Tier:* Core · *Cites:* BASE-DATA-003, BASE-DATA-006
- `RESTORE-001`: *Tier:* Core · *Cites:* BASE-DATA-001, BASE-BACKUP-001, BASE-SECRET-001, BASE-AGENT-004
- `SITE-001`: *Tier:* Core · *Cites:* BASE-PUBLIC-001
- `STYLE-001`: *Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001

### Existing guarantees

#### HTTP-001 — Authenticated product HTTP

**Requirement.** Buoy distinguishes browser-session writes from explicitly scoped bearer commands. Browser writes require the installation’s exact Origin and same-site request metadata. A valid bearer preparation works with no Origin or a foreign Origin and retains its grant’s scope when a cookie is also present; an invalid bearer never falls back to cookie authority. GOVERN-001 defines command and data-class grants. Under the held company policy, agents prepare account work while approval and account edits are refused; other policies decide those calls from their classes. The transport details are specified in [domain rules](docs/contract/domain-rules.md#http-001).

**Acceptance.**
1. Under the held company policy, signed out, cross-origin, as a member and as an agent token, call every product route; unauthenticated reads return 401, cross-origin cookie writes return 403, and members cannot change accounts or approve.
2. Send a scoped bearer preparation command without Origin and with a foreign Origin; both succeed and the proposal and audit event identify the agent.
3. Under the held company policy, attempt approval and account edits with the bearer token; both return 403, and an unsupported command is refused.
4. Repeat with a session cookie alongside a valid token, then an invalid, expired or revoked token; the valid token keeps only its bearer scope and an invalid token cannot authorize a cross-origin session write.

#### DATA-001 — Provenanced, validated observations

**Requirement.** Every account observation (billing, support, usage, CRM, survey or manual) carries its source system, source reference and observed time. Money is integer minor units of a stated ISO 4217 currency (USD unless BILLING-004 applies) that cannot go negative, dates are real calendar dates, and unsupported fields are refused. Missing and stale evidence stays visible beside the value it qualifies, with a staleness threshold set per source (30 days for manual snapshots by default). No observation is silently overwritten: a refresh creates a new account revision. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#data-001).

**Acceptance.**
1. Create and refresh accounts with valid, negative, impossible-date, missing and stale billing and support observations through the account door; invalid input is refused, missing and stale evidence is named on the account, and the earlier revision remains referenced by earlier work.
2. Change a source kind's threshold and the stale evidence it names follows.

#### APPROVAL-001 — Revision-bound human approval

**Requirement.** A proposal binds the account revision on which it was prepared. When a person approves, the exact reviewed revision creates one task, decision or action, with approver and time; completion has separate evidence. A source refresh invalidates pending decisions without rewriting earlier decisions. For agent calls, task creation carries standard and a binding renewal or concession carries commitment and money; the company’s policy decides the call. An agent’s decision never impersonates a person’s approval.

**Acceptance.**
1. Prepare a playbook and a renewal decision, approve twice, complete with and without evidence, refresh the account and attempt approval of a stale proposal; one task and one decision exist, the stale approval returns 409 and the earlier decision keeps its original renewal date.

#### IMPORT-001 — Reviewed move-in custody

**Requirement.** Every import, including each incumbent migration in MIGRATE-001 to MIGRATE-005, runs through the single Base import door: original-byte upload, no-write plan, the exact reviewed fingerprint, idempotent apply, native reconciliation and a journal with strict undo that survives restart. Business imports require an enabled door and a signed action-bound grant; self-hosted installs start disabled. Revoked signing keys stay revoked. The import page alone permits same-origin static scripts and connections; its mutations require the current owner session and exact Origin. The current format is a JSON account snapshot (up to 50 records and 256 KB); unsupported records are reported, credential removals are disclosed, imported accounts are inert, and installation archives remain separate. A later snapshot uses explicit catch-up; absent source records are retained with that explanation, never deleted. Undo refuses accounts edited since import or with dependent work. Erasure withdraws original bytes and door snapshots together with native rows and the portable restore checkpoint. Transport details are specified in [domain rules](docs/contract/domain-rules.md).

**Acceptance.**
1. Through the migrated Worker, upload and plan a JSON account file; native reads are unchanged.
2. Apply with a wrong fingerprint (403), then the reviewed fingerprint; replay returns the same job, reconciliation matches native records, and undo removes unchanged accounts.
3. An owner edit and dependent work each refuse undo (409).
4. Anonymous, member, revoked-session and cross-origin mutations fail; disabled or revoked Business grants fail; owner undo works with Business disabled.
5. Claim with and without the provisioning flag, disable and revisit the owner path, and re-enable after key revocation; only the provisioning opt-in opens initially, an explicit disable stays closed and revoked keys stay revoked.
6. Erase an imported account and read its public job/journal plus door reconciliation; retained source values disappear, the journal inventories door custody, reconciliation returns snapshot withdrawn, and native replay is refused.

#### ERASE-001 — Owner erasure with tombstones

**Requirement.** Owner erasure, confirmed by typing the account name, atomically removes the account, its work, decisions and native and import custody; permanent target and source tombstones prevent replay into that installation. Copies held by connected systems are listed on the erasure receipt for the owner to action (ERASE-002); Buoy does not claim to delete them.

**Acceptance.**
1. As a member, attempt erasure and receive 403; as the owner, erase an imported account with work, then read state, the import journal and history; nothing names the account, and re-creating the same ID returns 409.

#### RESTORE-001 — Portable installation archives

**Requirement.** Buoy archives carry native customer records and reviewed import custody. Destination authentication belongs to the new owner; agent tokens, connector credentials, outbox mail and installation settings confer no restored authority and are excluded. Archive volume follows SCALE-001.

**Acceptance.**
1. Export an installation with accounts, approved decisions, an agent token and an erased account; restore into an empty copy, then attempt a second restore and a damaged archive; state matches, the agent token is refused, the tombstone holds and both bad restores fail.

#### SITE-001 — Public run site

**Requirement.** The static run site contains the product homepage, `/run`, Markdown owner guides and a 404. It reads no installation data and links only public routes. Installed `/` keeps the shared Lobby. Run-site deployment stays gated off until its release gate.

**Acceptance.**
1. Build with `rer build --site` and crawl the output through Cloudflare's static-asset server; the homepage reaches `/run` and `/docs`, every guide renders and unknown paths return the 404.

#### STYLE-001 — One theme at every width

**Requirement.** The run site, Lobby, sign-in, setup and product share one theme file and Buoy's self-hosted faces: Inter for the wordmark, headings and text (headings in an ultra-heavy, tightly tracked display weight that keeps clear word spaces, the second line in the plum-to-turquoise gradient), Caveat only for hand-drawn notes and IBM Plex Mono for commands; white grid paper, near-black ink and the mark's plum, with red for the one failure, green for recovery and amber for Watch, always with a text label; and the smiling life-ring mark with tuned 16 and 32 pixel favicons. Real forms, role boundaries, checklist content and evidence remain available at desktop and phone widths.

**Acceptance.**
1. Open the homepage, `/run`, `/docs`, setup, sign-in, the account list, an account and the import screen at 1440 and 390 pixels; fonts load from the installation, the mark and the 16 and 32 pixel favicons show, no content or control is clipped and every form remains usable.

## Target clauses

### Accounts, people and the customer record

#### ACCOUNT-001 — Account hierarchy, people and ownership

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-003

**Requirement.** Parent organizations, accounts and end users form one hierarchy, with rollups of ARR, users and health from children to parents. Each account holds stakeholders with roles (champion, executive sponsor, economic buyer, admin, billing contact, end user), the assigned CSM, account executive, executive sponsor and support owner, a lifecycle stage, a tier and custom fields. Contacts can belong to several accounts. An account can also hold relationships (a product line, subscription or business unit under one company, as Gainsight models them), each with its own health scorecard, CSM, renewal and timeline, rolling up to the company. New hierarchy and relationship fields become SEGMENT-001 rule inputs before shipping. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#account-001).

**Acceptance.**
1. Through the account door and API, build a parent with two child accounts and 40 users, assign stakeholders and owners, add two product-line relationships with different CSMs to one account, and read the parent; rollups equal the sum of children, each relationship keeps its own health and CSM and rolls up to its company, a contact appears on both accounts it belongs to and a member cannot reassign ownership.

#### ACCOUNT-002 — Unified customer timeline

*Tier:* Core

**Requirement.** Each account and contact has one chronological timeline of emails, meetings, calls, notes, support tickets, invoices and payments, usage milestones, survey responses, playbook steps, tasks, approvals and renewal events. Every entry links to its source record and system and can be filtered by kind, person and source. Notes support @mentions and attachments.

**Acceptance.**
1. Connect a CRM, a billing source, a support source and an inbox in a test workspace, generate one record of each kind, and open the account timeline; every entry appears once, in order, with a working source link, and filters return only the chosen kinds.

#### ACCOUNT-003 — Workspaces, lists and saved views

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Each CSM has a home showing today's tasks, alerts, renewals and meetings for their book. Account and user lists support filters on any field or metric, chosen columns, sorting, bulk actions (assign, enroll in a playbook, add to segment), and personal or shared saved views. A manager can see any CSM's book. An explicitly named manager sees the same target-person projection for a direct report in one of their teams; owner/admin can inspect any book, and another ordinary CSM cannot. Calendar meetings are labelled unavailable, not empty. Views store definitions rather than copies or access grants; only their creator edits them, and explicit sharing makes the definition available to current staff. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#account-003).

**Acceptance.**
1. As a CSM, open the home, then save a filtered view of at-risk accounts renewing in 90 days, share it, bulk-assign three accounts and enroll them in a playbook; the home lists exactly that CSM's tasks due today, open alerts, renewals within 90 days and today's customer meetings, a manager opening that CSM's home sees the same list, a second CSM sees the shared view, and the assignments and enrollments are recorded once each.

#### ACCOUNT-004 — Custom fields, calculated fields and field history

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-DATA-003

**Requirement.** Admins add typed custom fields to accounts, users, contacts and opportunities, and calculated fields with a plain formula language (arithmetic, conditions, rollups, date differences) that previews against real accounts before saving and explains each result. Every field change keeps who, when, old and new value and source. Custom objects (ACCOUNT-006) use the same field types, formulas and history. New custom and calculated fields become typed SEGMENT-001 rule inputs before shipping. USAGE-001 carries separate contact/user definitions and values, explicit account memberships, previews against ten real accounts and customer records, calculations over the full customer-person portfolio, source-owned old/new history and typed related-person SEGMENT-001 inputs. The same person must satisfy an all-rule’s conditions for one related kind, including the currency and amount. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#account-004).

**Acceptance.**
1. Add a picklist, a currency field and a formula field "seats used ÷ seats purchased", preview it on ten accounts, save, change an input and read the field history; the formula updates, its explanation shows the inputs and the history records both changes with actor and source.

#### ACCOUNT-005 — Search

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** One search finds accounts, contacts, users, timeline entries, tasks, plans and opportunities by name, domain, email, external ID and text, respecting the reader's permissions. It matches a literal substring, folds ASCII case only, and pages live records by kind and native ID; percent and underscore are not wildcards. It grants the existing account/customer read authority only and preserves the full acceptance below as remaining work.

**Acceptance.**
1. Seed 5,000 accounts, search by a contact email, a Salesforce ID and a phrase from an email body; each result appears within one second and a restricted read-only user does not see accounts outside their scope.

#### ACCOUNT-006 — Custom objects

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-001, BASE-DATA-003

**Requirement.** Admins define custom objects for the records a CS team keeps beside accounts, such as product instances, implementations, license entitlements, usage rollups, or Salesforce objects such as CPQ subscriptions and Assets. Each object has typed fields: text, number, currency (BILLING-004), date, picklist, multi-select and boolean, plus lookups to account, relationship, user, contact, opportunity or another custom object. Each object also has a required external ID, and field history as in ACCOUNT-004. Account and relationship pages show each object's records in a section the admin configures, and the timeline records their creation and changes. Custom-object fields work wherever a standard field does: calculated fields and rollups (ACCOUNT-004), health measures (HEALTH-001), signals (SIGNAL-001), segments (SEGMENT-001), playbook triggers and branches (PLAY-001), lists and saved views (ACCOUNT-003), reports and dashboards (REPORT-002), search (ACCOUNT-005), and the API with bulk upsert by external ID (API-001). Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#account-006).

**Acceptance.**
1. An admin creates a "Product instance" object with a lookup to account and three typed fields (environment picklist, active seats, last deploy date).
2. They load 200 records from an S3 file (USAGE-004) and 50 from a Salesforce custom object through a CRM-001 custom job.
3. Every record lands on the right account with no duplicate by external ID.
4. A health measure "share of instances deployed in the last 30 days" and a report of active seats by account return values that match an independent calculation from the source data.
5. A CSM outside an account's scope gets none of its rows through the UI, API, search or export.
6. Deleting the object while the measure uses it is refused, naming the scorecard.
7. A Gainsight export with one custom object migrates (MIGRATE-001) with record counts and field types matching.

### Connected data

#### CONNECT-001 — Connector framework, freshness and reconnection

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-OPS-004, BASE-AUDIT-001

**Requirement.** Every connector authenticates with OAuth or a scoped key held encrypted (SECURE-002), syncs on webhooks where the provider offers them and on a schedule otherwise, and records per-run counts, cursor, errors and last success. A connections page shows each source's freshness; a disconnected or failing source notifies its owner and admins, rechecks itself, and lowers the confidence of every health score, alert and forecast that depends on it. Nothing is presented as current when its source is stale. Every connector's observations meet DATA-001: they carry the connector's source system, source reference and observed time, pass the same validation and go stale after the connector's own threshold. Scheduled file sources (USAGE-004) have an expected arrival window: a file that is late, missing or rejected counts as a failed run. Every connector connection, credential change, reconnection and disconnection records an AUDIT-001 entry (actor kind and id, time, action, opaque subject) before this clause ships.

**Acceptance.**
1. Connect a provider sandbox, run a sync, then revoke the grant and let a run fail; the connection shows the failure and last success, the owner receives a reconnection notice, affected accounts show reduced confidence naming the source, and reconnecting resumes from the cursor without duplicates.
2. Repeat DATA-001's acceptance through the connector: its observations name the connector as their source system, invalid provider records are refused, and stale evidence follows the connector's threshold.

#### IDENTITY-001 — Identity reconciliation and source authority

*Tier:* Core

**Requirement.** Accounts, contacts and users are matched across systems by external IDs (Salesforce, HubSpot, Stripe, Zendesk, Intercom, Segment group IDs), domain and email, with a review queue for ambiguous matches and an undoable merge. Admins choose, per field, which system is authoritative; writes from a non-authoritative source are recorded but do not overwrite. This includes revenue: an admin chooses whether CRM-contracted ARR (BILLING-005) or billed ARR (BILLING-001, BILLING-002, BILLING-006, BILLING-007) leads, per account segment, and differences between them go to BILLING-003's reconciliation queue.

**Acceptance.**
1. Sync overlapping accounts from Salesforce, Stripe and Zendesk where one company appears under two domains; exact ID matches link automatically, the ambiguous pair waits in review, a reviewed merge combines timelines, and undo restores both; an ARR field set to billing-authoritative ignores a conflicting CRM value and shows both.

#### CRM-001 — Salesforce two-way sync

*Tier:* Core

**Requirement.** Accounts, contacts, users, opportunities (including renewal and expansion opportunities), owners and mapped custom fields sync from Salesforce. Through the same connection Buoy also reads Cases (SUPPORT-004), and opportunity products, Contracts and Salesforce CPQ Subscription and Asset records as a revenue source (BILLING-005). Admin-defined custom sync jobs sync any other Salesforce standard or custom object into a Buoy custom object (ACCOUNT-006), with a field mapping, an external-ID key and a schedule. Buoy writes back health score, health color, CSM, lifecycle stage, renewal risk and selected fields to mapped Salesforce fields. It also writes the CS touches an admin chooses by kind (CSM emails, meetings, calls, business reviews and completed tasks) to Salesforce as Activities (Task or Event records) on the account and contact, so account executives see them in Salesforce; each is written once and updated if it changes in Buoy. Field mapping, sync direction per field, conflict handling and API-limit pacing are visible and editable. A Buoy Lightning Web Component on Salesforce account, opportunity and case pages shows health with its reasons, CSM, renewal date, open risks and recent timeline within the viewer's ROLE-001 scope. Taking over fields an incumbent wrote is CRM-004.

**Acceptance.**
1. Against a Salesforce developer org, map fields, sync 1,000 accounts and their opportunities, change an account in each system, run a writeback, run a custom job from a custom object, and log a meeting in Buoy.
2. Salesforce shows Buoy's health score and CSM, and the Buoy component on the account page shows the same health and CSM.
3. The conflicting edit follows the authority rule.
4. The custom object's records arrive in their ACCOUNT-006 object on the right accounts.
5. The meeting appears once as a Salesforce Event on the account.
6. The sync log shows API usage under the configured limit.

#### CRM-002 — HubSpot two-way sync

*Tier:* Core

**Requirement.** Companies, contacts, deals, owners and custom properties sync from HubSpot, with the same writeback of health, CSM, stage and renewal risk to HubSpot properties, per-field direction and conflict rules as CRM-001. Through the same connection Buoy reads Service Hub tickets (SUPPORT-004) and deal line items as a revenue source (BILLING-005). Custom sync jobs bring HubSpot custom objects into Buoy custom objects (ACCOUNT-006), and chosen CS touches are written to HubSpot as engagements (notes, meetings, calls and tasks) on the company and contact.

**Acceptance.**
1. Against a HubSpot developer account, sync companies, contacts and deals, change a property in each system, write back health, run a custom-object job and log a Buoy meeting.
2. HubSpot shows the Buoy properties, and the conflict follows the authority rule.
3. Deal stage changes appear on the Buoy timeline.
4. The custom object's records arrive in their ACCOUNT-006 object, and the meeting appears once as a HubSpot meeting engagement on the company.

#### CRM-003 — Orbit native link

*Tier:* Core

**Requirement.** Buoy receives Orbit's post-sale handoff (Orbit INTEGRATE-008): account and contact identity, purchased products, commercial commitments, sales evidence references and the receiving owner, under a stable handoff ID that Buoy accepts or refuses with an actionable reason and reconciles on replay. Permitted account context (health, CSM, renewal date, expansion signals) flows back to Orbit. CS-qualified expansion leads become Orbit deals (RENEW-002).

**Acceptance.**
1. Win a USD deal in Orbit, approve the handoff, and open the new Buoy account with its commitments and owner; replay the handoff and get one account; raise an expansion signal and see the Orbit deal; revoke the link and see a visible failure on both sides.

#### CRM-004 — Salesforce field handover at cutover

*Tier:* Core

**Requirement.** A buyer leaving Gainsight (or ChurnZero, Totango, Planhat or Vitally) keeps the Salesforce reports, dashboards, list views and flows that read the fields the incumbent was writing, such as health score, health color, CSM, lifecycle stage and renewal risk. A cutover plan lists each such field, its current writer (from Salesforce field history), the Buoy value mapped to it with any scale or picklist translation (for example a 0 to 100 score to the incumbent's color labels), and the Salesforce reports and dashboards that reference it (from the Salesforce Analytics API). During the parallel run (MIGRATE-006) Buoy writes only to shadow fields; at cutover an admin switches each field to Buoy writes in one reviewed step and can switch a field back.

**Acceptance.**
1. In a Salesforce developer org with three fields Gainsight populated and a report and a dashboard that use them, run the cutover plan, switch two fields and run a writeback; the plan lists all three fields with the report and dashboard, Buoy's values arrive in the two switched fields on the mapped scale, the report and dashboard return values for every account, and the field left on its old writer is untouched.

#### BILLING-001 — Stripe billing connector

*Tier:* Core

**Requirement.** Stripe customers, subscriptions, subscription items, prices, invoices, payments, refunds, credit notes, failed payments and plan changes sync by webhook with periodic reconciliation. Buoy computes per-account MRR and ARR from active subscriptions (BILLING-003) and shows failed and overdue payments as risk signals. Buoy reads; it never charges, refunds or changes a subscription. Per-unit, transformed, volume and graduated tier prices retain exact source rules and native minor units. Active repeating and permanent discounts reduce recurring revenue in source stack order; once discounts and uncommitted metered usage remain source facts without adding recurring revenue. Buoy states that convention rather than inferring configurable Stripe Dashboard MRR settings. Malformed pricing and fixed-discount allocation across mixed intervals unsupported by the pinned API fail the complete read visibly and retain prior evidence with reduced confidence. It never invents a recurring figure or overwrites a person-confirmed contract. BILLING-003 retains financial movement and reconciliation, BILLING-004 retains USD conversion, and IDENTITY-001 retains full cross-system matching/source authority.

**Acceptance.**
1. In Stripe test mode, create customers with monthly and annual subscriptions, an upgrade, a downgrade, a failed payment and a cancellation; Buoy's ARR per account equals the Stripe-derived figure, the failed payment raises a risk signal on the right account, and no write call reaches Stripe.

#### BILLING-002 — Chargebee, Nectar and QuickBooks Online revenue sources

*Tier:* Core

**Requirement.** Chargebee and Nectar subscriptions, invoices and payments sync with the same model and guarantees as BILLING-001. Recurring-service companies that bill by invoice can use QuickBooks Online recurring invoices and payments (or Pantry) as the revenue source.

**Acceptance.**
1. Connect a Chargebee test site, a Nectar installation and a QuickBooks Online sandbox, each with renewals, a downgrade and an overdue invoice; each account's ARR and overdue balance match the source, with the source named on every figure.

#### BILLING-003 — Subscription financial model

*Tier:* Core

**Requirement.** Each account has contracted ARR and MRR, billed revenue, products and seats purchased, entitlements, contract start and end, billing frequency, and a monthly ARR history classified as new, expansion, contraction, churn and reactivation. Revenue comes from a billing connector (BILLING-001, BILLING-002, BILLING-006), from CRM contract records (BILLING-005), or from a warehouse or file feed of billing records (BILLING-007). An account with none of these uses confirmed contract terms entered by a person, labeled as such. When two sources disagree, IDENTITY-001 decides which leads. Every figure links to the billing records that produced it, and mismatches between contract and billing appear in a reconciliation queue. Amounts keep their billing currency (BILLING-004). Sourced ARR/MRR becomes SEGMENT-001 rule input; repeat its original “ARR over $50,000 and health below 60” entry/exit/playbook/report acceptance with HEALTH-001 before shipping. Confirmed terms and Stripe histories stay separately labelled. Owner and admin reconciliation records an explanation for a specific source pair without changing either source or selecting a new authority; changed sources reopen the queue. IDENTITY-001 retains later cross-source authority, and the future BILLING-002 and BILLING-005 to BILLING-007 feeds inherit the complete monthly source-link and reconciliation acceptance. Per RL-101, explaining an exact source pair closes only human review, retains actor, time, reason and both source versions, and leaves the quantified monetary variance outstanding. IDENTITY-001 alone determines source precedence.

**Acceptance.**
1. With BILLING-001 data covering twelve months of upgrades, downgrades and one churn, open an account's revenue tab; each month's movement is classified correctly and links to its invoice or subscription change, and a contract-versus-billing mismatch appears in the queue until a person resolves it.
2. Explain one exact contract/billing source pair: the review reads explained with actor, time, reason and source versions, both differing values and the outstanding monetary variance remain visible and unequal, and a changed source version reopens review (RL-101).

#### BILLING-004 — Multi-currency subscriptions

*Tier:* Core

**Requirement.** Subscriptions, invoices and payments keep their native currency (ISO 4217) and amounts in that currency's minor units, exactly as the billing source states them; Buoy never rewrites them. USD is the reporting currency. Admins maintain a rate table to USD: a fixed corporate (budget) rate per currency per fiscal year by default, or dated daily rates from a named source (European Central Bank reference rates or Open Exchange Rates); every rate has an effective period, its author or source and an audit entry (AUDIT-001). ARR, MRR, the forecast (RENEW-004) and NRR/GRR (REPORT-001) convert at the stated rate, show the native amount beside the USD figure, round half up to the cent and name the rate table used. ARR movement is classified at constant currency: new, expansion, contraction, churn and reactivation are measured with the same rate for both periods, and the difference caused by rate changes is reported as its own FX movement, never as expansion or contraction. Native and converted revenue fields become explicit-unit/currency SEGMENT-001 rule inputs before shipping. Provider fractions convert before half-up USD-cent rounding. Rate publishes retain immutable author, time and version history, audit the edit and restate reporting without changing native contracts, subscriptions, invoices or payments. Missing rates stay unavailable; USD is intrinsically 1. Recorded daily rates do not claim independently verified origin.

**Acceptance.**
1. In a Stripe test account with USD, EUR, GBP and CAD subscriptions over two quarters, including a EUR upgrade, a GBP downgrade and a rate change between the quarters, open the revenue tabs and the NRR report; native amounts show beside USD ARR, each USD figure equals the native amount times the stated rate rounded to the cent, NRR matches an independent calculation at the same rates, the rate change appears only as FX movement, and editing the rate table restates the USD figures with the edit audited.

#### BILLING-005 — Salesforce and HubSpot revenue sources, including Salesforce CPQ

*Tier:* Core

**Requirement.** For sales-led buyers whose ARR lives in the CRM, an admin makes Salesforce a revenue source through CRM-001's connection. Closed-won opportunities with their Opportunity Products (product, quantity, unit price, schedule and service dates), Contracts, and Salesforce CPQ Subscription and Asset records (product, quantity, net price, start and end dates, and renewal and amendment links) map to BILLING-003's contracted ARR, products, seats and contract terms for each account. The mapping is reviewed and versioned. It states which opportunity types and record types count, how a multi-year or ramped deal annualizes, and which field holds ARR when the buyer stores ARR directly. Monthly ARR movement is classified from these records. A first contract or new-business opportunity is new. An upsell opportunity or an amendment that adds quantity or products is expansion. A downgrade amendment or a renewal at lower value is contraction. A contract that ends unrenewed past its configured grace period is churn, and a returning account is reactivation. HubSpot deals with line items serve the same role through CRM-002. Every figure links to the opportunity, contract, subscription or deal that produced it, and the currency follows BILLING-004. Where a billing source is also connected, IDENTITY-001 decides whether CRM-contracted ARR or billed ARR leads, and differences go to BILLING-003's reconciliation queue. Buoy reads these records and never edits a closed opportunity, contract or subscription.

**Acceptance.**
1. In a Salesforce developer org with CPQ installed, load twelve months of contracts for 40 accounts.
2. Include new business, upsell amendments, a downgrade amendment, a ramped three-year deal and two churned contracts.
3. Each account's ARR and each month's movement classification match an independent calculation from an export of the same opportunities and subscriptions, and each figure links to its Salesforce record.
4. REPORT-001's NRR for the period matches the independent calculation to the cent.
5. Then connect Stripe and make billing authoritative: a deliberate ARR difference on one account appears in the reconciliation queue with both values.
6. Repeat the ARR check for 10 HubSpot deals with line items.

#### BILLING-006 — Zuora billing connector

*Tier:* Core

**Requirement.** Zuora sync covers accounts, subscriptions with their rate plans and charges (recurring, usage-based and one-time, with quantities, prices and tiers), amendments and orders, invoices, payments, credit memos and the product catalog. It carries the guarantees of BILLING-001: event callouts with periodic reconciliation, a read-only API role, and no write to Zuora. Recurring charges give MRR and ARR under BILLING-003, amounts keep their billing currency (BILLING-004), and overdue invoices and failed payments become risk signals.

**Acceptance.**
1. In a Zuora sandbox, create subscriptions for three accounts with a renewal, a downgrade amendment, an upgrade to a new rate plan and an overdue invoice.
2. Each account's ARR, monthly movement and overdue balance match Zuora.
3. The overdue invoice raises a risk signal on the right account.
4. The connector's API role holds read permissions only.

#### BILLING-007 — Subscription and invoice feeds from a warehouse or file

*Tier:* Core

**Requirement.** Buyers who bill from NetSuite, Sage Intacct, Maxio or an in-house system feed BILLING-003 from a warehouse query (USAGE-002) or a scheduled file source (USAGE-004). A reviewed, versioned mapping turns subscription or contract lines (account external ID, product, quantity, amount, currency, start and end date) and invoice and payment lines (number, date, due date, amount and balance) into billing records. The feed runs under USAGE-004's whole-file validation and freshness rules. Its rows carry their file or query as their source, produce ARR, movement and overdue signals exactly as connector data does, and reconcile in REPORT-001. The owner guide documents the NetSuite saved-search columns the mapping expects.

**Acceptance.**
1. Drop a NetSuite-style subscription-line and invoice CSV export for 30 accounts into an S3 source, and load the same rows into a Snowflake table.
2. In both cases each account's ARR and overdue balance match the file, and REPORT-001's NRR reconciles to the file total to the cent, with drill-down to the file rows.
3. Re-delivering the file creates no duplicates.
4. A file with an unknown currency code is rejected whole, and the previous figures remain.

#### SUPPORT-001 — Zendesk connector

*Tier:* Core

**Requirement.** Zendesk organizations, users, tickets, priorities, statuses, SLA breaches, satisfaction ratings and tags sync to accounts and contacts. Ticket volume, open urgent tickets, breached SLAs, CSAT and time to resolution become health measures and timeline entries; a CSM can open the ticket in Zendesk from Buoy. Buoy's account context flows back into Zendesk (SUPPORT-003). Support run inside Salesforce or HubSpot is SUPPORT-004, and Freshdesk and ServiceNow are SUPPORT-005. This future source kind inherits AI-002 cited proposals, exact selected-line custody, human review, discard and erasure before it ships.

**Acceptance.**
1. In a Zendesk sandbox, create urgent, breached and solved tickets with CSAT for two organizations; Buoy shows each on the right account timeline, the health measures update on the next run and the source link opens the ticket.

#### SUPPORT-002 — Intercom and HappyToHelp connectors

*Tier:* Core

**Requirement.** Intercom companies, contacts, conversations, tickets and ratings, and HappyToHelp customers, conversations, outcomes and CSAT, sync with the same measures and timeline entries as SUPPORT-001. HappyToHelp also receives Buoy's account context (health, tier, CSM, renewal date) for its agents, and Intercom receives it as in SUPPORT-003. This future source kind inherits AI-002 cited proposals, exact selected-line custody, human review, discard and erasure before it ships.

**Acceptance.**
1. With an Intercom test workspace and a HappyToHelp installation, open and resolve conversations for two accounts; Buoy shows them with ratings and HappyToHelp shows the Buoy health and CSM on the customer.

#### SUPPORT-003 — Customer-success context inside Zendesk and Intercom

*Tier:* Core

**Requirement.** Support agents see Buoy's account context where they work. A Buoy app in the Zendesk Support ticket sidebar and a Buoy app in the Intercom inbox show, for the ticket's organization or company, the health color and score with its top reasons, tier, lifecycle stage, CSM, ARR band, renewal date, open risk signals and a link to the Buoy account. Buoy also writes the same facts to mapped Zendesk organization fields and Intercom company attributes, so views, triggers, SLAs and routing can use them. Both update within 15 minutes of a change in Buoy. A support agent sees what ROLE-001's read-only support profile allows: ARR only as a band, and no contract, discount or forecast field. This future source kind inherits AI-002 cited proposals, exact selected-line custody, human review, discard and erasure before it ships.

**Acceptance.**
1. In a Zendesk sandbox and an Intercom test workspace, open a ticket and a conversation from a red, high-ARR account renewing next month; the sidebar shows Buoy's health with its reasons, the CSM, ARR band and renewal date, and the mapped organization field holds the same health; change the account's score in Buoy and both update within 15 minutes; signed in as a support agent, the app shows no exact ARR, contract or discount field; and a Zendesk view filtered on the Buoy health field lists the account.

#### SUPPORT-004 — Support cases and tickets from Salesforce and HubSpot

*Tier:* Core

**Requirement.** For buyers who run support in Salesforce Service Cloud or HubSpot Service Hub, Buoy reads support through the CRM-001 and CRM-002 connections, with no separate help desk. From Salesforce it syncs Cases: account and contact, owner, priority, status, origin, escalation flag, case history, entitlement milestones with their target and completion times and violations, closed date, and CSAT from a mapped survey field or Salesforce Feedback Management responses. From HubSpot it syncs tickets: associated company and contacts, owner, pipeline and stage, priority, SLA due times and breaches for first response and close, closed date, and customer feedback survey responses. Changes arrive by Salesforce Change Data Capture and HubSpot webhooks, with CONNECT-001's scheduled reconciliation, and reach Buoy within 15 minutes. Admins choose which Salesforce record types and queues, or which HubSpot pipelines, count as customer support. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#support-004).

**Acceptance.**
1. Connect no help desk.
2. In a Salesforce developer org with Service Cloud, create urgent, escalated, milestone-violated and closed cases with CSAT for two accounts.
3. In a HubSpot developer account, create the same as Service Hub tickets for two companies.
4. Each case and ticket appears once on the right Buoy timeline, and its source link opens the case or ticket.
5. The support health measures update within 15 minutes.
6. Five new cases for one account in a day fire a ticket-spike signal, and the milestone violation fires an SLA-breach signal.
7. A case of an excluded record type is ignored.
8. After the account's health changes in Buoy, the mapped Case field and the HubSpot ticket property hold the new health within 15 minutes. Signed in to Salesforce as a support user, the case-page component shows no exact ARR.

#### SUPPORT-005 — Freshdesk and ServiceNow connectors

*Tier:* Core

**Requirement.** Buoy syncs two more help desks. From Freshdesk: companies, contacts, tickets, priorities, statuses, SLA policies and breaches, and satisfaction ratings. From ServiceNow Customer Service Management: accounts, contacts, cases, priorities, states, SLA records and survey results. Both produce the same measures, signals, timeline entries and source links as SUPPORT-001. Buoy's account context goes back to mapped Freshdesk company fields and ServiceNow account fields, under SUPPORT-003's content and ROLE-001 limits. This future source kind inherits AI-002 cited proposals, exact selected-line custody, human review, discard and erasure before it ships.

**Acceptance.**
1. In a Freshdesk trial account and a ServiceNow personal developer instance, create urgent, breached and resolved tickets or cases with ratings for two companies.
2. Each appears on the right Buoy timeline with a working source link.
3. The support measures update on the next run.
4. The mapped company or account field shows Buoy's health.

#### USAGE-001 — Segment and event API ingestion

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003, BASE-SECRET-001, BASE-DATA-003

**Requirement.** Product events arrive from Segment (track, identify, group) and from Buoy's own authenticated event API and JavaScript and server SDKs, deduplicated by message ID and mapped to users and accounts by user and group IDs. Unmapped events wait in a review queue rather than being dropped. Each source has separate server-only revocable ingestion credentials with creator, type scope and last use recorded; revocation is checked in the intake transaction and stops intake within one minute. Browser SDKs send only through the buyer's authenticated product relay, which supplies validated product membership server-side; raw ingestion credentials never belong in customer product pages or browser SDKs. User/group/message IDs are exact and source-namespaced; unknown or conflicting membership waits for explicit administrator-reviewed mappings, never staff linkage, guessed attribution or implicit merging. Contact and product-user records satisfy every ACCOUNT-004 type, formula, real-account preview, explanation, history and typed SEGMENT-001 input obligation. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#usage-001).

**Acceptance.**
1. Send 100,000 Segment events across 50 accounts including duplicates and events for an unknown group; Buoy counts each event once, attributes them to the right users and accounts, and lists the unknown group for mapping.

#### USAGE-002 — Warehouse sync with Snowflake, BigQuery, Redshift and Databricks

*Tier:* Core

**Requirement.** Admins connect Snowflake, BigQuery, Amazon Redshift or Databricks SQL with a read-only role. They schedule SQL queries that return account, user, usage or custom metrics, custom-object records (ACCOUNT-006) or billing records (BILLING-007), keyed by an external ID. Results load incrementally with row counts and failures shown. Buoy can also export its own accounts, health history, tasks and renewals to the warehouse.

**Acceptance.**
1. Against a Snowflake trial, a BigQuery sandbox, a Redshift Serverless trial and a Databricks SQL warehouse, schedule a daily usage query and an export; the metric appears per account with its run history, a broken query shows its error without erasing yesterday's values, and the exported tables contain current health and renewals.

#### USAGE-003 — Amplitude, Mixpanel and Pendo connectors

*Tier:* Core

**Requirement.** Product analytics cohorts, events, page and feature usage and user properties from Amplitude, Mixpanel and Pendo map to Buoy users and accounts with the guarantees of USAGE-001.

**Acceptance.**
1. Connect an Amplitude, a Mixpanel and a Pendo test project, sync a feature event and a cohort from each, and see them attributed to the right accounts.

#### USAGE-004 — Scheduled file sources from Amazon S3, SFTP and Google Sheets

*Tier:* Core

**Requirement.** Admins connect recurring file sources for usage and custom data: an Amazon S3 bucket prefix (read and move under a scoped IAM role), an SFTP folder or a Google Sheet. Each source has a schedule, an expected arrival window, a file name pattern and a column mapping reviewed against the first file and versioned. Rows key to accounts, users or custom objects (ACCOUNT-006) by external ID, and a billing feed loads billing records (BILLING-007); unknown IDs wait in USAGE-001's review queue. A source runs in incremental mode (upsert by key and date) or replace mode (the file is the full snapshot for its date). Each file is validated whole before it loads: a malformed file (missing or extra columns, unparseable values beyond the configured row-error limit, a truncated upload) is rejected with a row-level error report, moved to the error folder and leaves earlier values untouched; a loaded file moves to the archive folder. A late, missing or rejected file raises CONNECT-001's freshness and failure alerts and lowers the confidence of the scores that depend on it.

**Acceptance.**
1. Connect an S3 bucket that receives a nightly usage CSV for 50 accounts keyed by Salesforce ID; the first file loads per account and moves to the archive folder; the next night's file with a missing column is rejected to the error folder with its error report and yesterday's values remain; skip a night and the freshness alert reaches the source owner; and a Google Sheet custom-data source in replace mode overwrites only its own fields.

#### ADOPT-001 — Adoption and license metrics

*Tier:* Core

**Requirement.** From usage data Buoy computes daily, weekly and monthly active users, feature and module adoption (defined by admins as event sets), depth and breadth of use, license utilization against seats purchased, trend versus the previous period, and time to first value. Each metric is available per user, account and segment and can drive health, alerts, playbooks and reports. The current numeric slice uses trailing inclusive UTC-day windows of 1, 7 and 30 days, each compared with its immediately preceding equal window; active people have reviewed track/event activity, distinct by customer person across sources. Event-set adoption divides adopting monthly active people by monthly active people; depth divides 30-day events by monthly active people, breadth divides used sets by configured sets, and utilization divides monthly active people by purchased seats (unavailable with missing seats or zero total seats). Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#adopt-001).

**Acceptance.**
1. With 90 days of synthetic events for 30 accounts, define two features and a seat count; Buoy's active-user, adoption and utilization figures match an independent calculation from the same events, and a 30% drop in weekly active users is flagged as a trend.

#### PRODUCT-001 — Product issues and feature requests linked to accounts

*Tier:* Core

**Requirement.** CSMs link an account to engineering issues in Jira, Linear or Vector and to feature requests in Penny or Productboard, from Buoy or from the support ticket. Each issue shows the linked accounts and their combined ARR and renewal dates; status changes flow back to the account timeline, and when an issue ships the owning CSMs get a task to tell their customers.

**Acceptance.**
1. Link three accounts to one Jira issue and one to a Penny request, then move the issue to done; the issue shows the three accounts' ARR, each timeline records the status change, and each CSM receives the follow-up task once.

### Health, segments and signals

#### HEALTH-001 — Configurable, explainable health scores

*Tier:* Core

**Requirement.** Admins build scorecards from weighted measures (usage, adoption, support, billing, survey, engagement, CSM sentiment and any custom or calculated field) with thresholds per measure, overall bands and different weights per segment. Missing data is treated explicitly per measure (excluded and reweighted, or scored as unknown) and the result says so. Scores recalculate at least hourly and on source change, keep history, and every score explains which measures moved it and from which source. A scorecard change previews against current and historical accounts before it is published, and is versioned. Every scorecard publish records an AUDIT-001 entry (actor kind and id, time, action, opaque subject) before this clause ships. Numeric scores become SEGMENT-001 rule inputs; repeat its original “ARR over $50,000 and health below 60” entry/exit/playbook/report acceptance with BILLING-003, and prove segment-specific scorecard weights before shipping. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#health-001).

**Acceptance.**
1. Build a scorecard with five measures and segment-specific weights, preview it, publish it, then change a source value and remove a source; the changed account rescores within five minutes of the source change, an unchanged account shows a recalculation timestamp no older than an hour, every account shows a score with its measure breakdown and sources, history shows the change of version, and the missing source is reweighted or shown as unknown exactly as configured.

#### HEALTH-002 — CSM sentiment and manual measures

*Tier:* Core

**Requirement.** A CSM can record a sentiment rating with a reason that feeds the scorecard, expires after a set period and is visible as a person's judgment rather than data. A rating is red, amber or green with a reason and lasts 1 to 90 whole days (30 by default), chosen when it is recorded. Any signed-in person may record one: the owner, an admin, or a member, who acts for the CSM until ROLE-001 adds that role (and ROLE-001's record scope then limits it); an agent-recorded equivalent is identified as the agent’s own assessment, carries standard and is decided by the company’s policy; it never becomes a person’s sentiment. A rating counts through its expiry date, a UTC calendar date like the rest of health, and is missing from the next day. The newest rating replaces the current one and earlier ratings stay in history; erasing the account removes them. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#health-002).

**Acceptance.**
1. Record a red sentiment with a reason, observe the score change and explanation, then advance past expiry; the measure becomes missing and the explanation says it expired.
2. Advance by reading health on the expiry date and on the day after it; the rating still counts on its expiry date.
3. Under the held company policy, an agent credential cannot record a person’s rating; agent-authored assessments carry standard and follow company policy.

#### SIGNAL-001 — Risk and opportunity alerts

*Tier:* Core

**Requirement.** Admins define signals from any field, metric, event or change: usage drop, champion or sponsor left, ticket spike, SLA breach, failed payment, detractor survey response, renewal approaching without engagement, license utilization above a threshold, new department adoption or a positive survey. Signals are deduplicated, routed to the account owner and chosen channels (in-app, email, Slack, Teams), can be snoozed or dismissed with a reason, and can start playbooks. Native adoption-alert dismissal belongs to its signed-in recipient: a reason and explicit future UTC deadline within 365 days suppress that rule/account/recipient through recovery and re-entry until expiry. The retained inbox evidence shows the reason and window; health and other recipients continue. Pending or queued matching mail is withdrawn; attempted mail cannot be recalled. SIGNAL-001’s future signal sources and CHAT-001 actions inherit these recipient, window, custody and audit semantics.

**Acceptance.**
1. Configure a usage-drop risk and a 90% utilization upsell signal, generate both, and dismiss one with a reason; each fires once per account, reaches the owner in-app and in Slack, the dismissed one does not re-fire inside its window and the upsell signal can open an expansion opportunity.

#### SEGMENT-001 — Segments, tiers and lifecycle stages

*Tier:* Core

**Requirement.** Dynamic segments defined by rules over any field, metric or relationship update automatically and record entry and exit times; static lists are also available. Accounts carry an owner/admin-defined service tier (seeded with, for example, high-touch, scaled and digital) and a lifecycle stage (onboarding, adoption, expansion, renewal or churned) set by rule or by hand. Segments drive scorecard weights, playbooks, journeys, permissions and reports. Today's complete boundary is the existing account, renewal, native billing/support snapshot, health band/evidence, sentiment, CSM, territory and task-count fields, ACCOUNT-004 custom/calculated fields on accounts and USAGE-001 customer contacts/users, static lists, segment-filtered account reports and CSV, and TEAM-001 assignment rules. Related customer fields use people.contact and people.user paths with their existing typed representation; all conditions for one related kind must be satisfied by the same person, including currency and amount, while any-rules need one matching related condition. Customer value or explicit membership changes reevaluate these rules before a successful write returns. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#segment-001).

**Acceptance.**
1. Define “USD invoice total over $50,000 and health at-risk”, change an account so it enters, exits at the inclusive threshold and re-enters, and open the segment report and CSV; counts match the rule, currencies never mix, every interval is timestamped and the entry playbook produces one proposal and one approved task per approved entry.
2. Repeated reads and hourly runs add no duplicate; stale account/configuration or exited-entry approval is refused.
3. Define a custom service tier, use it in rules and manual classification, refuse removal while used and refuse a member tier-list edit.
4. Exercise static lists, typed all/any/missing rules, manual and rule tier/stage with precedence and clearing, imports, sentiment/expiry and TEAM-001 segment allocation, member reads and mutation refusal, erasure, and the real management/approval/report forms at 1440 and 390.

### Lifecycle work

#### PLAY-001 — Automated playbooks

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AUDIT-001 · *Rules:* D-1

**Requirement.** Playbooks start on a signal, segment entry, lifecycle stage change, a date relative to renewal, contract start or onboarding milestone, a webhook, or by hand. Steps create tasks, send or draft emails (EMAIL-001), post to Slack or Teams, wait for a time or condition, branch on data, update fields, start another playbook, call a webhook (or a Crank flow) or pause for approval (APPROVAL-001). Each playbook has entry and exit criteria, re-enrollment limits, owners and per-step due dates, and stops when its exit criteria are met. Every playbook publish records an AUDIT-001 entry (actor kind and id, time, action, opaque subject) before this clause ships. Every new playbook kind consumes SEGMENT-001 entry/lifecycle triggers and inherits deduplicated entry acceptance before shipping. Automated playbook definitions, enrollments and every new step kind inherit PLAY-004 outcome/window/cohort/report acceptance before shipping. ROLE-001 governs design, publication and execution, including team-scoped CS-manager publication; APPROVAL-001 binds reviewed revisions. Execution follows D-1 (RL-103).

**Acceptance.**
1. Build a playbook triggered by health falling below 50 with a task, a wait, a branch on whether usage recovered, an approval-gated email and a Slack post; push three accounts through both branches and a fourth that recovers mid-way; steps run in order, the recovered account exits, no account enrolls twice inside the limit and every step is on the timeline.

#### PLAY-002 — Tasks, reminders and escalation

*Tier:* Core · *Cites:* BASE-MAIL-001

**Requirement.** Tasks (Gainsight calls them CTAs) have an owner, due date, priority, type and linked account, plan or opportunity. Owners get reminders before and on the due date; overdue tasks escalate to the owner's manager after a configured delay; tasks move to the new owner when an account is reassigned or the owner is away. Completing a task records an outcome reason and evidence. Priority is low, medium (the default), high or urgent; type is risk (the default), onboarding, adoption, renewal, expansion or general. A task's owner is the one named when it is prepared, else the account's owner at approval, else the approving person. Until ROLE-001 and TEAM-001 add CS managers and teams, the owner or an admin sets each account's owner, each person's manager, away periods with their named cover, the reminder and escalation delays (1 to 30 whole days each, default 1) and the installation's time zone for task days (an IANA name; UTC until one is set); members cannot, including for themselves. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#play-002).

**Acceptance.**
1. Create tasks due tomorrow and yesterday, reassign an account, mark a CSM away with a named cover, and complete one with an outcome; reminders arrive in-app and by email, the overdue task escalates to the manager, the reassigned task moves, the away CSM's due tasks move to the cover for the away period and return after it, and the completed task stores outcome and evidence.

#### PLAY-003 — Automation run history and failure alerts

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-OPS-004 · *Rules:* D-1

**Requirement.** Every playbook, journey and connector run is logged with its inputs, step results and errors; admins set failure thresholds and are notified in-app, by email and in Slack when they are crossed, and failed steps can be retried after a fix without repeating completed ones. ROLE-001 governs analysis and history. Human external-work reports are labelled unverified, distinct from actual webhook execution, alert delivery and provider retries (RL-104).

**Acceptance.**
1. Break a webhook step, run a playbook for ten accounts, cross the threshold, fix the step and retry; admins are notified once, the log shows the failures, and retry completes only the failed steps. Manual reports remain labelled unverified; uncertain external results are resolved before retry, completed effects are not duplicated, and history access follows ROLE-001 (RL-104).

#### PLAY-004 — Outcome tracking for playbooks

*Tier:* Core

**Requirement.** Each playbook records which enrolled accounts reached its intended outcome (health recovered, milestone reached, renewal closed) within a window, with completion rates, time to outcome and comparison to unenrolled accounts in the same segment. The outcome must be unsatisfied at baseline; accounts must currently belong to the chosen segment. This single start operation freezes both the enrolled accounts and the other unsatisfied members of the same segment as the comparison group. Later segment changes do not rewrite either cohort. The window starts at tracking creation and includes its deadline; an outcome is the first satisfied evidence observed on a request, after a source/action change or on the hourly run, not an inferred transition time. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#play-004).

**Acceptance.**
1. Run 40 approved playbooks with a defined healthy outcome and 40 same-segment controls, let 20 enrolled accounts and five controls recover, and open the report and CSV; the outcome rates are 50% and 12.5%, the two account lists match, each first-observed elapsed time and the mean match an independent timestamp calculation.
2. Assert unsatisfied baseline, approval/role boundaries, exact UTC window, idempotent start, frozen cohorts after segment edits, unchanged first evidence after repeated observation, the new-approved-renewal outcome, window-missed and late-recovery refusal, no invented completion, and erasure.
3. Use the real setup form and read its rate, timing, evidence, comparison and CSV end states at 1440 and 390.

#### ONBOARD-001 — Onboarding projects

*Tier:* Core

**Requirement.** Templates for onboarding and implementation projects hold phases, milestones and tasks for both internal team members and customer contacts, with dependencies, relative due dates, owners and target go-live. A project starts automatically from a template chosen by product or segment. Triggers are a new account, an Orbit handoff, or a closed-won expansion or cross-sell opportunity on an existing account (from Orbit, Salesforce or HubSpot) that adds a product. A person can also start one by hand. Each project tracks percent complete, time to value and slippage, flags overdue customer-side tasks and rolls status up to the account and onboarding reports. Milestone outcomes inherit PLAY-004 outcome definitions, UTC windows, frozen comparison cohorts and report/time-to-outcome acceptance before shipping.

**Acceptance.**
1. Start a project from a template on an Orbit handoff, complete internal tasks, leave a customer task overdue and shift a dependency.
2. Dates recalculate, the project shows at risk with the overdue customer task named, and the onboarding report shows time to value per account.
3. Then close-won a Salesforce cross-sell opportunity for a new product on an existing account: a second project starts once from that product's template, beside the first.

#### PLAN-001 — Shared success plans and goals

*Tier:* Core · *Cites:* BASE-ROLE-001

**Requirement.** Success plans record the customer's business objectives, the measures that prove them (linked to usage, survey or custom metrics, or a confirmed customer statement), milestones and owners on both sides. Plans can be shared with customer contacts (PORTAL-001) and are reviewed at business reviews; goal attainment feeds health and renewal readiness. Plan milestone outcomes inherit PLAY-004 outcome definitions, UTC windows, frozen comparison cohorts and report and time-to-outcome acceptance before shipping. Attainment can regress when current evidence changes; unavailable evidence remains unavailable. Customer-statement objectives always await authenticated customer confirmation. The goal health measure is the percentage of current objectives achieved, including unconfirmed statements in the denominator; it is unavailable with no objectives or any unavailable metric. Draft ownership transfers with the outgoing account CSM and preserves separately owned plans. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#plan-001). ROLE-001 governs account-scoped plan authors and field access, including retained review artifacts; PORTAL-001 governs customer access. Authenticated customers alone confirm their own statements. Restored assignments remain inert until local authorization (RL-102).

**Acceptance.**
1. Create a plan with two objectives, one tied to a usage metric and one confirmed by the customer, share it with the champion, and let the metric reach its target; the first objective shows achieved from data, the second waits for the customer's confirmation and health shows the goal measure.
2. An authorized team CS manager and own-book CSM read and edit their permitted plans and retained review artifacts; staff cannot confirm a customer statement, which its authenticated customer confirms through PORTAL-001; restored assignments confer no authority (RL-102).

#### PORTAL-001 — Customer collaboration portal

*Tier:* Core

**Requirement.** Invited customer contacts sign in by email link (or their company SSO) to a portal scoped to their own account, where they see and update their onboarding tasks and success plan, comment, upload files and confirm outcomes. Portal users never see internal notes, health scores or other customers.

**Acceptance.**
1. Invite a champion, complete a customer task and comment from the portal, then attempt to reach another account's portal URL and an internal note; the task and comment appear on the internal timeline and both cross-boundary reads are refused.

#### REVIEW-001 — Business review preparation and decks

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-003, BASE-DATA-006

**Requirement.** For a QBR or EBR Buoy assembles the account's outcomes, adoption, support, survey and renewal facts into an editable deck from a template, exportable to PDF, PowerPoint and Google Slides, with every chart linked to its data. A person’s customer disclosure follows that person’s exact-version review; an agent disclosure carries external and commitment, decided by company policy. Reviews and follow-ups are logged. Authorized CSMs prepare, review and export within ROLE-001 account, field and export rights; ERASE-002 and SECURE-002 govern linked-person custody and provider authorization. Local export establishes neither customer delivery nor provider upload (RL-106). A person’s disclosure binds exact current-version review; equivalent agent disclosure carries external and commitment, which company policy decides.

**Acceptance.**
1. Generate a QBR deck for an account with 90 days of data, edit a slide, export to PPTX, PDF and Google Slides and log the meeting; figures match the account's reports and the follow-up tasks appear on the timeline.
2. An authorized account CSM prepares and exports a deck within current field/export rights; customer disclosure or provider upload binds exact current-version human review, or the company’s external and commitment policy for an agent call. Linked-person decks follow erasure and holds; each internal follow-up uses its named current command authority (RL-106).

### Communication

#### EMAIL-001 — Two-way email through Gmail and Microsoft 365

*Tier:* Core · *Rules:* D-3

**Requirement.** CSMs connect their Google Workspace or Microsoft 365 mailbox. Emails with known contacts log to the account timeline (with per-user exclusion of private threads); CSMs send from Buoy through their own mailbox with templates and merge fields, and replies thread back. Shared team templates and snippets are versioned, and each sent message records the template version it used. Personal mailboxes carry one-to-one mail; one-to-many sends go through EMAIL-003. One-to-one sends from Buoy can carry open and click tracking, set by an admin per template and by each user. Opens and clicks are recorded on the contact and account timeline, and an admin can turn tracking off for chosen contacts or domains. Every email Buoy sends to a customer records an AUDIT-001 entry (actor kind and id, time, action, opaque subject) before this clause ships. This future source kind inherits AI-002 cited proposals, exact selected-line custody, human review, discard and erasure before it ships.

**Acceptance.**
1. Connect a Google Workspace and a Microsoft 365 test mailbox, send a templated, tracked email from Buoy, open it and click its link as the customer, reply from the customer address and send a private personal email.
2. The sent and reply messages appear threaded on the timeline, merge fields render, the open and click appear on the timeline, and the private email does not appear.
3. Send to a contact with tracking turned off: the message carries no tracking pixel or rewritten link.
4. Edit the shared template: its version history shows both versions, and the earlier send still names the version it used.

#### EMAIL-002 — Sending controls and consent

*Tier:* Core · *Rules:* D-3

**Requirement.** Automated and one-to-many sends respect recipient-time-zone send windows, per-mailbox and per-day limits, a CAN-SPAM unsubscribe and postal address for non-transactional messages, a suppression list fed by unsubscribes and by provider bounces and complaints (EMAIL-003), and stop-on-reply. Playbook and agent email disclosure carries external, and the company’s policy decides whether it runs, enters review, waits for approval or is refused. Model-generated drafts keep their draft label until their policy-authorized publication; a person’s approval is attributed only after that person acts.

**Acceptance.**
1. Schedule a journey to 200 contacts across four US time zones with a daily cap, unsubscribe one, bounce one and reply from one; sends land inside each window and under the cap, the unsubscribed and bounced contacts receive nothing further, the replier stops and drafts wait for approval where configured.

#### EMAIL-003 — Journey sending provider and domain authentication

*Tier:* Core · *Rules:* D-3

**Requirement.** One-to-many email (journeys, surveys and digital-tier outreach) goes through a sending provider the owner connects with their own account: SendGrid, Amazon SES or Postmark. The owner verifies a sending domain or subdomain (for example mail.example.com): Buoy shows the SPF, DKIM and DMARC records to publish, checks them by DNS lookup, and blocks any journey from that domain, naming the failing check, until SPF passes, DKIM signs aligned with the From domain and a DMARC policy is published. Every one-to-many message carries a List-Unsubscribe header with an HTTPS one-click endpoint and a List-Unsubscribe-Post header (RFC 8058), honored at once. The provider's bounce, complaint and unsubscribe events feed EMAIL-002's suppression list. The complaint rate per sending domain is tracked, and journeys pause when it crosses an owner-set ceiling (0.1% by default, below Google's 0.3% bulk-sender limit). A personal mailbox (EMAIL-001) has a per-day cap set below its Google Workspace or Microsoft 365 sending limit; once a mailbox reaches it, Buoy refuses further one-to-many sends from it and names the provider route instead.

**Acceptance.**
1. Connect a SendGrid account and start a journey on an unverified subdomain; it is blocked with the failing record named.
2. Publish the records, re-check and send to 50 test contacts; received messages carry a DKIM signature aligned with the From domain that verifies, DMARC passes, and the List-Unsubscribe and List-Unsubscribe-Post headers are present and a one-click POST suppresses the contact.
3. A provider complaint event suppresses that contact for every journey, and a one-to-many send through a CSM mailbox past its daily cap is refused with the reason.

#### EMAIL-004 — Gmail and Outlook sidebar

*Tier:* Core

**Requirement.** A Buoy add-on for Gmail (a Google Workspace add-on) and for Outlook (an Office add-in for web, Windows and Mac) shows account context beside the open email. For the sender or recipients it shows the account's health with its reasons, CSM, renewal date, open tasks and signals, and recent timeline, within the reader's ROLE-001 scope. From the sidebar the user can log the email to the timeline, create a task, enroll the account in a playbook, and link the email to a success plan or renewal. An email from an unknown address offers to add the contact to a chosen account rather than guessing one.

**Acceptance.**
1. Install the add-on in a Google Workspace and a Microsoft 365 test tenant, open an email from a customer contact, create a task from it and log it.
2. The sidebar shows the right account's health and CSM, and the task and logged email appear on the timeline linked to each other.
3. An email from an unknown address offers to add the contact and creates no account link until the user picks one.
4. A user outside the account's scope sees no account detail.

#### JOURNEY-001 — Digital customer success journeys

*Tier:* Core · *Rules:* D-3

**Requirement.** For scaled and digital tiers, admins build multi-step journeys to users and contacts: emails, in-app messages (INAPP-001), waits, branches on behavior and survey answers, and handoff to a human task when a branch needs it. Journeys use segments, send email through the EMAIL-003 provider on a verified domain, honor EMAIL-002, report delivery, opens, clicks, replies and goal conversion, and stop when the account's lifecycle changes. Promotional newsletters stay in Mango; journeys are lifecycle communication to existing customers. Every journey send records an AUDIT-001 entry (actor kind and id, time, action, opaque subject) before this clause ships. Journeys consume SEGMENT-001 membership and lifecycle changes and inherit targeting/exit acceptance before shipping.

**Acceptance.**
1. Run an onboarding journey to 500 users with a branch on feature adoption, and change one account to churned mid-journey; branches follow behavior, the churned account exits, the report counts match the delivery log and a branch that needs a human creates a task.

#### INAPP-001 — In-app messages and guides

*Tier:* Core · *Cites:* BASE-PUBLIC-001, BASE-PUBLIC-002, BASE-INPUT-002

**Requirement.** A JavaScript snippet in the buyer's product shows segmented announcements, banners, checklists and walkthroughs to identified users, records views, completions and dismissals as usage, and respects frequency caps. The snippet holds no Buoy authority and talks only to the buyer’s authenticated product relay (`sdk/relay.mjs`), which supplies validated product membership server-side using a separate server-only INAPP-scoped credential. Credentials record creator and last use, are checked transactionally without a cache so revocation stops the next request (within one minute), and their hashes are excluded from installation archives. Targeting resolves only USAGE-001’s exact reviewed source/user/group identities to an existing customer person and current account segment; unmapped or conflicting users receive no targeted content, and their receipts wait in the usage review queue. Views, completions and dismissals append to usage observations and the customer timeline with first-source/message-ID-wins deduplication; a repeated kind on one delivery is also a no-op. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#inapp-001).

**Acceptance.**
1. Install the snippet on a test app, target a walkthrough to one segment and a banner with a frequency cap, and visit as users in and out of the segment; only targeted users see each, caps hold and completions appear on user timelines.

#### MEET-001 — Calendar capture

*Tier:* Core

**Requirement.** Google Calendar and Outlook Calendar events with customer contacts log as meetings on the account timeline, upcoming meetings show on the CSM home with a preparation brief (AI-001), and CSMs can share a Dial or Calendly booking link in emails and journeys.

**Acceptance.**
1. Connect both calendars, create a past and a future meeting with a customer contact and an internal-only meeting; the customer meetings appear on the account, the future one on the home with a brief, and the internal one does not appear.

#### MEET-002 — Call recordings and transcripts

*Tier:* Core

**Requirement.** Recordings and transcripts from Gong, Zoom, Google Meet and Microsoft Teams attach to the meeting on the timeline, and calls placed through Aircall or RingCentral log to the account and contact timeline with their recording, with consent status recorded; summaries, proposed tasks and risk or expansion mentions follow AI-002. This future source kind inherits AI-002 cited proposals, exact selected-line custody, human review, discard and erasure before it ships.

**Acceptance.**
1. Import a Zoom transcript, a Google Meet transcript, a Microsoft Teams transcript and a Gong call for one account, and place an Aircall call to one of its contacts; each attaches to the right meeting or contact, the call logs with its recording, and the summaries cite transcript lines.

#### CHAT-001 — Slack, Microsoft Teams and Nook alerts and actions

*Tier:* Core

**Requirement.** Signals, approvals, overdue tasks and daily digests post to chosen Slack, Teams or Nook channels or direct messages; recipients can acknowledge, snooze, complete a task or approve from the message where their role permits; a command looks up an account's health, owner and renewal. Messages in shared customer channels (Slack Connect) can log to the timeline when an admin enables it. This future source kind inherits AI-002 cited proposals, exact selected-line custody, human review, discard and erasure before it ships.

**Acceptance.**
1. Connect a Slack workspace and a Teams tenant, fire a signal and an approval, approve from Slack as an admin and attempt the same as a member, approve a second item from Teams, post the signal to a Nook channel and acknowledge it there, and run the account lookup; each approval records once with the approver's identity, the member is refused, the Nook acknowledgment appears on the signal and the lookup returns current health.

#### SURVEY-001 — NPS and CSAT relationship surveys

*Tier:* Core

**Requirement.** Buoy sends NPS and CSAT surveys by email and in-app on schedules per contact or after events (onboarding complete, ticket solved), with throttling so no contact is over-surveyed. Responses land on the contact and account timeline, feed health, and start playbooks for detractors and promoters. Custom research surveys are built in Pencil, Typeform or SurveyMonkey and their responses import with the same mapping. Every survey send records an AUDIT-001 entry (actor kind and id, time, action, opaque subject) before this clause ships.

**Acceptance.**
1. Survey 300 contacts with a 90-day throttle, answer as a detractor, a passive and a promoter, and import a Pencil survey; NPS computes correctly by segment, the detractor starts a playbook, the throttle blocks a second send and the Pencil responses appear on the right contacts.

#### NOTIFY-001 — In-app notifications and digests

*Tier:* Core · *Cites:* BASE-MAIL-001, BASE-ROLE-001, BASE-DATA-003

**Requirement.** Each user has an inbox of mentions, assignments, alerts and approvals, and an optional daily or weekly email digest of their book's changes, with per-type preferences. Each active person reads and marks only their own inbox and changes only their own preferences; agent tools read the sponsor’s permitted notices and carry standard for internal mentions or preferences; the company’s policy decides those calls. A person may mention one active teammate in an account note under the account’s existing ROLE-001 read access. The inbox keeps every mention, task assignment, current health alert and proposal approval request. Per-type email is immediate (the default), digest-only or none; the digest is off until the person chooses daily or weekly. PLAY-002 reminders and escalations remain compulsory on their separate schedule and are also listed in the inbox. Current health alerts are recorded on the hourly Cron Trigger when an assigned account’s risk reasons change, once per changed risk state and recipient. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#notify-001).

**Acceptance.**
1. Mention a user, assign a task and fire a signal, then set preferences to digest-only for signals; the inbox shows all three and the next digest includes the signal but no duplicate notification.

### Renewals, expansion and revenue

#### RENEW-001 — Renewal pipeline

*Tier:* Core

**Requirement.** Each contract or subscription generates a renewal opportunity a configured number of days before its end date, carrying expected ARR, the notice deadline (from confirmed terms, as today), owner, stage, forecast category (commit, likely, at risk) and risk reasons. Outcomes are renewed, renewed with expansion, renewed with contraction, churned or deferred, each with a reason code and evidence, recorded through APPROVAL-001. A renewal board and list show every renewal by quarter. Before these record kinds ship, they inherit ACCOUNT-004 in full: the same text, number, currency, date, picklist, multi-select, boolean and calculated field types; arithmetic, conditions, UTC date differences, dependencies and hierarchical or portfolio rollup formulas; no-write previews against ten real accounts and their related records over the full portfolio; per-result input and missing/error explanations; actor, UTC time, old/new value and source history with source-owned refresh and recalculation; and typed SEGMENT-001 inputs with same-person conditions. Customer-person rollups count each distinct person once across memberships. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#renew-001).

**Acceptance.**
1. With twelve subscriptions ending across two quarters, let Buoy create renewals, move stages, record one churn with a reason and one contraction; each renewal appears once at the right lead time, notice dates match terms, outcomes need approval and the ARR change matches billing after the next sync.

#### RENEW-002 — Expansion pipeline and CS-qualified leads

*Tier:* Core

**Requirement.** CSMs and signals open expansion opportunities (upsell, cross-sell, seats, new team) with expected ARR and stage. A qualified lead is handed to the sales system of record (Orbit, Salesforce or HubSpot) as an opportunity with its context, and stage and amount sync back so CS-sourced expansion is credited. Before these record kinds ship, they inherit ACCOUNT-004 in full: the same text, number, currency, date, picklist, multi-select, boolean and calculated field types; arithmetic, conditions, UTC date differences, dependencies and hierarchical or portfolio rollup formulas; no-write previews against ten real accounts and their related records over the full portfolio; per-result input and missing/error explanations; actor, UTC time, old/new value and source history with source-owned refresh and recalculation; and typed SEGMENT-001 inputs with same-person conditions. Customer-person rollups count each distinct person once across memberships. Their public HTTP and native 1440/390 journeys must assert all these points before shipping.

**Acceptance.**
1. Open an expansion from a utilization signal, hand it to Salesforce and to Orbit, then win it in each; both opportunities exist once with Buoy's context, and the closed amounts appear as CS-sourced expansion in Buoy reports.

#### RENEW-003 — CRM renewal opportunity sync

*Tier:* Core

**Requirement.** Renewal opportunities are created in or matched to Salesforce or HubSpot renewal opportunities and kept in sync both ways for stage, amount, close date and owner, under the source-authority rules of IDENTITY-001.

**Acceptance.**
1. Create renewals in Buoy for accounts whose renewal opportunities already exist in Salesforce and HubSpot; Buoy matches rather than duplicates, a stage change in either system appears in the other and a conflicting amount follows the authority rule.

#### RENEW-004 — Renewal forecast

*Tier:* Core

**Requirement.** A forecast by month and quarter, by CSM, team and segment, shows expected, commit and at-risk ARR, best and worst case, in USD at BILLING-004's stated rates, and the change since the last weekly snapshot; managers can override a forecast category with a reason. Closed periods compare forecast with actual. UTC month and quarter reads use each renewal-date rate under BILLING-004, retain native amounts, and expose source and rate references. Expected/best case is open expected ARR plus known closed actuals; commit/worst case is commit ARR plus those closed actuals; at-risk is open at-risk ARR, without probability weighting. A native actual is a separately approved outcome; a Stripe actual requires a later provider observation. The hourly job and owner/admin capture share one immutable snapshot per Monday–Sunday UTC week, retaining original source inputs and rates. Current role/commercial/account scopes and current segment membership filter both sides. Owners/admins and assigned CS managers acting only on active direct-report books override with a reason, person/time and prior/new category history; stale source/profile/team authority or a closed renewal refuses the write. An override invalidates pending outcomes. Closed-period signed/absolute USD error is available only with a pre-close snapshot, the same cohort and complete actual/rate coverage; otherwise it is explicitly unavailable. Current evaluation dates do not reconstruct historical sources. Snapshot movement can include its separately named rate change and never claims causation or guaranteed prediction.

**Acceptance.**
1. Snapshot a quarter's forecast, move three renewals and close them, and open the forecast; it shows the movement since the snapshot, the override with its reason and forecast versus actual for the closed month.

#### RENEW-005 — Renewal paperwork and terms

*Tier:* Core

**Requirement.** Confirmed contract terms (dates, notice period, auto-renew, price uplift, termination rights) can come from Locket, Ironclad or uploaded contracts as well as by hand, each with its evidence. Renewal order forms or quotes produced in Orbit, Salesforce or the buyer's quote tool go out for signature through Inkwell or DocuSign, and the signed status and document link return to the renewal.

**Acceptance.**
1. Import terms from a Locket contract, send a renewal order through Inkwell and through DocuSign sandbox, and sign both; the renewal shows each term with its source, the signed status and the document link.

#### REPORT-001 — NRR, GRR and retention reporting

*Tier:* Core

**Requirement.** Net revenue retention, gross revenue retention and logo retention use stated definitions (starting ARR cohort for the period, plus expansion, minus contraction and churn, excluding new logos) and are reported by month, quarter and trailing twelve months, by segment, CSM, cohort, plan and tier. Every figure drills down to accounts and to the invoices or subscription changes behind them, and reconciles to the billing source; unreconciled differences appear as exceptions, never as adjustments. The same holds whichever source feeds BILLING-003: Stripe, Chargebee, Nectar, QuickBooks Online, Zuora, CRM contract records (BILLING-005) or a warehouse or file feed (BILLING-007). Non-USD subscriptions reconcile to the cent in their native currency, and their USD figures are those native amounts at BILLING-004's stated rates, with FX movement reported on its own line and excluded from expansion and contraction. Retention reports consume SEGMENT-001 membership and inherit filtered count/drilldown parity before shipping. Current reports use the last retained source dated on or before each UTC boundary. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#report-001).

**Acceptance.**
1. With a year of Stripe data, compute NRR and GRR for a quarter and compare with an independent spreadsheet calculation from the same Stripe export; the figures match to the cent, drill-down lists each account's movement, and an injected unmatched invoice appears as an exception.
2. Repeat with a mixed USD, EUR and GBP account set: native amounts reconcile to the cent, the USD figures match the spreadsheet at the stated rates, and FX movement appears separately.

#### REPORT-002 — Dashboards and report builder

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-2

**Requirement.** Prebuilt dashboards cover portfolio health distribution and trend, renewals and forecast, NRR and GRR, onboarding time to value, adoption, NPS, task and playbook completion, CSM book size and engagement coverage (days since last touch and touches per account, by CSM). Users build reports on any object with filters, groupings, charts and calculated columns whose formulas are shown; dashboards are shared by role and delivered on a schedule by email or Slack; every report exports to CSV. Reports and dashboards consume SEGMENT-001 membership and inherit filtered count/export parity before shipping. Explicitly assigned report authors use ROLE-001 object/account/field scope; definition shares never widen viewer rights. Installation-local shares remain inactive after restore, and schedules follow D-2 (RL-105).

**Acceptance.**
1. Build a report of at-risk ARR by CSM, add it to a dashboard, schedule it weekly to Slack and export it; the scheduled post and CSV match the on-screen figures and a read-only viewer can open but not edit the dashboard.
2. An assigned non-admin author builds within permitted objects/accounts/fields; a role-shared viewer receives the definition and only currently authorized computed rows and export fields. Restored shares remain inactive until local authorization; scheduled results use each recipient’s current scope and consent (RL-105).

### Team, roles and administration

#### ROLE-001 — Roles and permissions

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AGENT-005

**Requirement.** Staff roles are owner, admin, CS manager, CSM, three read-only profiles (sales; support; finance and executive) and scoped agent. Each has a record scope (all accounts, team, own book or a segment) and field-level rules for commercial fields (ARR, MRR, price, discount, contract value and forecast). The role matrix below defines human entitlements; agent calls additionally carry computed classes decided by company policy. Admins can define custom roles from the same permission rows, each with its own record scope and field rules, and grant named approval rights (concessions up to a USD limit, renewal outcomes) to individual people. Customer portal users are a separate class (PORTAL-001), and agents are further bound by GOVERN-001. Custom-object records (ACCOUNT-006) take the record scope of the account or relationship they look up to, and custom fields marked commercial take the commercial-field rules.  Segment-scoped roles consume SEGMENT-001 membership and inherit in/out-of-segment access acceptance before shipping. Custom-role definitions restore as inert configuration; destination identities, scope, limits and named approval rights activate only after a current destination owner/admin reviews the intended local person and grants those rights (RL-107).

| Permission | Owner | Admin | CS manager | CSM | Read-only: sales | Read-only: support | Read-only: finance and executive | Agent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Accounts readable | All | All | All | Own book and accounts shared with them | Accounts they own or are on in the CRM | All | All | Company policy within sponsor rights |
| Open another CSM's home and book view | Yes | Yes | Yes | No | No | No | Yes, read-only | Company policy within sponsor rights |
| Edit accounts, contacts, tasks and plans | All | All | Team | Own book | No | No | No | Company policy within sponsor rights |
| Publish scorecards and signals | Yes | Yes | No, draft only | No | No | No | No | Company policy within sponsor rights |
| Publish playbooks and journeys | Yes | Yes | For their team's segments | No, draft only | No | No | No | Company policy within sponsor rights |
| Export data and reports | Yes | Yes | Team | Reports on own book | No | No | Reports only | Company policy within sponsor rights |
| See commercial fields | Yes | Yes | Yes | Own book | ARR band and renewal date | ARR band and renewal date | Yes | Company policy within sponsor rights |
| Edit commercial fields | Yes | Yes | Team, audited | No | No | No | No | Company policy within sponsor rights |
| Approve concessions (discount, credit, extension) | Yes | Yes | If granted, up to its USD limit | If granted, up to its USD limit | No | No | No | Company policy within sponsor rights |
| Approve renewal outcomes | Yes | Yes | Team | If granted | No | No | No | Company policy within sponsor rights |
| Manage connectors and credentials | Yes | Yes | No | No | No | No | No | Company policy within sponsor rights |
| Manage AI settings and agents | Yes | Yes | No | No | No | No | No | Company policy within sponsor rights |
| Invite users and assign roles | Yes | Yes, except owner | No | No | No | No | No | Company policy within sponsor rights |
| Read the audit log | Yes | Yes | No | No | No | No | No | Company policy within sponsor rights |
| Erase an account or contact | Yes | No | No | No | No | No | No | Company policy within sponsor rights |

**Acceptance.**
1. As each default role and one custom role, through the UI and the API, attempt every row of the ROLE-001 role matrix in CONTRACT.md on accounts inside and outside scope: read an account and a custom-object record on it, open another CSM's home and book view, edit an account, publish a scorecard, a signal, a playbook and a journey, export a report and the data, read and edit a commercial field, approve a concession and a renewal outcome, manage a connector, change AI settings, invite a user, read the audit log and erase an account.
2. Each succeeds or is refused exactly as the matrix states, every refusal is server-side, and the read-only support profile sees ARR only as a band.
3. Restore custom role definitions: no person assignment or named approval right becomes active until the destination owner/admin reviews and grants the intended local person, scope and limits (RL-107).

#### ROLE-002 — Single sign-on and provisioning

*Tier:* Core · *Cites:* BASE-SIGNIN-001, BASE-ACCESS-002 · *Register:* R-5

**Requirement.** Staff sign in with Google Workspace, Microsoft Entra ID, Okta or Auth over OIDC or SAML, with optional enforcement. SCIM provisions and deprovisions users and maps groups to roles; deprovisioning revokes sessions and agent tokens they issued.

**Acceptance.**
1. Configure Okta with SAML and SCIM, sign in, change a user's group, then deprovision them; their role follows the group, their session ends and their agent tokens are revoked.

#### TEAM-001 — Books of business and reassignment

*Tier:* Core

**Requirement.** Accounts are assigned to CSMs by rule (segment, territory, ARR band, round-robin) or by hand, with pods and teams, capacity targets per CSM and a reassignment flow that moves open tasks, plans and journeys and posts a handover note to the timeline. Teams and pods do not grant access; ROLE-001 adds scoped manager and CSM authority before shipping those roles. Rule runs are explicit preview/apply operations, considering unassigned accounts in stable account-id order; territory names match exactly, a blank territory matches all, and the first matching rule selects the team. The eligible active CSM with the lowest assigned-account count divided by capacity is chosen, ties broken by stable person id. Rule allocation needs a configured target and never allocates at or over it; a missing rule or insufficient capacity refuses the whole reviewed run. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#team-001).

**Acceptance.**
1. Assign 300 accounts by rule across four CSMs with capacity targets, then reassign one CSM's book; counts respect targets, every open task and plan moves and each account shows the handover note.

#### AUDIT-001 — Durable audit log

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-OPS-005

**Requirement.** Buoy’s audit covers sign-ins, role changes, data exports, erasures, approvals, connector changes, scorecard and playbook publishes, external sends and agent actions. Account actions use an opaque subject alias; erased accounts leave no personal name in their retained actions. Archive snapshots state which export action falls in the next archive. Source-specific event fields, custody and search ordering are specified in [domain rules](docs/contract/domain-rules.md#audit-001).

**Acceptance.**
1. Perform each action kind, erase an account and its contact, then read and export the audit; every action is listed, entries for the erased account remain without its name, and the export matches the screen.

#### SECURE-002 — Connector credential custody

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-DATA-004

**Requirement.** OAuth tokens and keys for every connector are encrypted at rest, scoped to the least access the connector needs, visible to admins by name and scope only, revocable in one action, excluded from archives and never sent to models or agents.

**Acceptance.**
1. Connect Salesforce, Stripe and Slack, export an archive, read the connections page as an admin and an agent, and revoke one; no secret appears in the archive, page or agent response, and the revoked connector stops on its next run.

#### ERASE-002 — Contact-level privacy requests

*Tier:* Core · *Cites:* BASE-DATA-003, BASE-DATA-006, BASE-DATA-001

**Requirement.** For a CCPA or CPRA or contractual request, an owner can erase or export one contact or end user across Buoy (timeline, survey responses, usage events, emails) with a receipt, while the account remains. The receipt lists connected systems that still hold that person's data so the owner can action them there. Every contact erasure and contact export records an AUDIT-001 entry (actor kind and id, time, action, opaque subject) that survives the erasure without the contact's personal details, before this clause ships. Current owner-only requests require the current customer revision and exact name confirmation. The current implementation exports or removes the customer across all explicit account memberships, typed values and history, received surveys, reviewed source-user usage across group variants, in-app deliveries and receipts and per-person licenses; surviving aggregates recalculate before success. Export returns versioned JSON without retaining the exported personal contents. Receipts and audits retain a random opaque subject, actor kind and id, UTC time, action, counts and external-system names only. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#erase-002).

**Acceptance.**
1. Erase a contact with emails, a survey response and usage events, then read the account, reports and audit; nothing names the contact, aggregates stay correct, and the receipt lists Salesforce and Zendesk as external holders.

#### API-001 — Public API and webhooks

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-001, BASE-OPS-003, BASE-AUDIT-001

**Requirement.** A documented, versioned REST API (OpenAPI) with scoped tokens covers accounts, contacts, users, events, metrics, tasks, plans, opportunities, timeline entries and custom-object definitions and records (ACCOUNT-006, with bulk upsert by external ID), with pagination, idempotency keys and rate limits. Outbound signed webhooks fire on health changes, signals, playbook steps, renewal changes and survey responses, with retries and a delivery log. Zapier, Make and Crank use the same API.

**Acceptance.**
1. With a scoped token, create and update an account and post events, replay with the same idempotency key, exceed the rate limit, and subscribe a webhook to health changes; writes happen once, the limit returns 429 with retry timing and each webhook delivery is signed and logged.
2. Version 1 account reads and writes use owner-issued server-only tokens with explicit account IDs and operation scopes, bounded expiry and per-token UTC-minute reservations.
3. Account writes, successful replay receipts and opaque account audits commit atomically; updates require the current revision.
4. An identical replay returns its original account ID and revision without repeating the write.
5. Revocation or an issuing-owner identity change ends authority; archive restoration restores no integration token, minute reservation or replay receipt.

#### MIGRATE-001 — Gainsight CS migration

*Tier:* Core

**Requirement.** Buoy accepts Gainsight companies, relationships, people, scorecard configuration and measures, Account Scorecard History (MIGRATE-007), CTAs and tasks, playbooks, success plans, timeline activities, NPS responses, renewal data, and custom objects from Data Management with their field types, lookups and records (into ACCOUNT-006 objects) from Gainsight's exports and API, maps them to Buoy objects with a reviewed plan (IMPORT-001) and reports what could not be mapped. It runs in parallel with Gainsight until cutover through delta re-imports (MIGRATE-006), and at cutover Buoy takes over the Salesforce fields Gainsight wrote (CRM-004).

**Acceptance.**
1. Import a Gainsight sample export with 500 companies and their objects; the preview shows counts per object and unmapped fields, apply creates matching records, a sample of 20 accounts reconciles field by field, a custom object arrives with its record count and field types matching the export, scorecard history arrives as health history, a delta re-import of a changed export updates without duplicating, and undo removes the import.

#### MIGRATE-002 — ChurnZero migration

*Tier:* Core

**Requirement.** Accounts, contacts, ChurnScores and their factors, tasks, plays, success plans, journeys, events and NPS are inputs from ChurnZero exports and API under the same reviewed plan and reconciliation as MIGRATE-001.

**Acceptance.**
1. Import a ChurnZero sample export, reconcile 20 accounts and their health factors field by field, and confirm journeys arrive as paused Buoy journeys for review.

#### MIGRATE-003 — Totango migration

*Tier:* Core

**Requirement.** Accounts, users, health profiles, SuccessFlows, tasks, touchpoints, segments and success plays are inputs from Totango exports and API under the same guarantees.

**Acceptance.**
1. Import a Totango sample export, reconcile 20 accounts, and confirm SuccessFlows arrive as paused playbooks with their steps mapped or listed as unmapped.

#### MIGRATE-004 — Planhat migration

*Tier:* Core

**Requirement.** Companies, end users, health profiles, workflows and tasks, conversations, licenses and revenue, NPS, custom fields, and Planhat's assets, projects and other custom objects (into ACCOUNT-006 objects with their records) are inputs from Planhat's API and exports under the same guarantees.

**Acceptance.**
1. Import a Planhat sample export, reconcile 20 accounts including license ARR, and confirm custom fields arrive with their types and its assets arrive as a custom object with matching record counts.

#### MIGRATE-005 — Vitally, Velaris and spreadsheet migration

*Tier:* Core

**Requirement.** Vitally and Velaris accounts, users, health, projects, tasks, notes and NPS are inputs from their exports and APIs, and any CSV or Google Sheets book of business imports through a guided column mapper, under the same guarantees.

**Acceptance.**
1. Import a Vitally sample export and a 2,000-row CSV with messy dates and currencies; the mapper flags bad rows without importing them and the rest reconcile.

#### MIGRATE-006 — Parallel run and delta re-import

*Tier:* Core

**Requirement.** Until cutover, the buyer re-imports from the incumbent (export file or API) as often as needed, for every migration in MIGRATE-001 to MIGRATE-005. Each re-import is a delta under IMPORT-001: it matches records to the previous import by the incumbent's IDs, updates changed records, adds new ones and lists records deleted in the incumbent for review rather than deleting them. A field a person or connector changed in Buoy since the previous import is never overwritten silently: the preview lists it as a conflict to keep or replace. Setting a cutover date closes the parallel run and records which objects and fields Buoy now owns.

**Acceptance.**
1. Import a Gainsight export of 500 companies and edit two of them in Buoy; re-import an export in which 20 other companies changed, the two edited companies also changed, 5 companies are new and 3 were deleted; the preview shows 20 updates, 2 conflicts, 5 creates and 3 proposed deletions; apply leaves 505 companies with no duplicate, the two Buoy edits survive where the reviewer chose keep, and undo of the delta restores the state before it.

#### MIGRATE-007 — Health history carried over

*Tier:* Core

**Requirement.** Each incumbent migration brings score history, not only scorecard configuration: Gainsight Account Scorecard History (weekly or monthly snapshots of overall and per-measure scores), ChurnZero ChurnScore history, Totango health history, and Planhat, Vitally and Velaris health history arrive as Buoy health history for each account, labeled with the source scorecard, period and incumbent and mapped to Buoy measures where a measure maps. Imported history is read-only, appears on health trend charts and business review decks continuous with Buoy's own scores (the scorecard change is marked at cutover), and is the history BOUNDARY-003's accuracy comparison and AGENT-008's back-test use.

**Acceptance.**
1. Import 52 weekly snapshots of Gainsight Account Scorecard History for 50 companies, then let Buoy score them for two weeks; each account's trend shows 54 points with the scorecard change marked at cutover, per-measure history appears where measures were mapped, 10 sampled accounts match the export week by week, and an AGENT-008 back-test over the last twelve months reads the imported weeks.

#### MOBILE-001 — Mobile apps

*Tier:* Core · *Register:* R-3, R-4

**Requirement.** Native iOS and Android apps give CSMs their home, account lookup with health and timeline, tasks, approvals, alerts by push notification and voice or text notes after a meeting; recent accounts are readable offline and changes made offline sync with conflict notice. The web app remains fully usable at phone width (STYLE-001).

**Acceptance.**
1. On iOS and Android test devices, receive a push alert, approve a renewal outcome as an admin, dictate a meeting note offline and reconnect; the approval records once, the note syncs to the timeline and a conflicting edit shows a notice.

#### A11Y-001 — Accessibility

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001 · *Register:* R-1, R-2

**Requirement.** Buoy applies BASE-ACCESSIBILITY-001 to the account workspace, renewal runway, plan and playbook work, imports, reports, customer portal and native clients. Charts have text tables and health has text labels. The runway’s accessible table includes invoice, health reasons, renewal and notice dates, missing or stale evidence and projected changes. The human screen-reader pass and VPAT are field proof.

**Acceptance.**
1. Run axe and a keyboard-only pass over the home, account, playbook builder, report and portal screens; no serious violations, every chart has a text table and every health color has a text label.
2. Until the named future screens ship, run every current screen at 1440 and 390 pixels, reflow to 320 pixels, and use the keyboard for sign-in, setup, runway expansion, dialog open/close and focus return, validation recovery, preparation, approval, completion and report export.
3. Assert visible, unobscured focus, labeled fields, health text and the runway table’s values against the public account data.

#### SCALE-001 — Scale for a growing book

*Tier:* Core

**Requirement.** One installation handles 10,000 accounts, 500,000 end users and 50 million usage events a month with hourly health recalculation, account pages under two seconds and reports under ten. Today's 500-account guard is lifted only when this holds.

**Acceptance.**
1. Load the stated volumes into a test installation and measure health recalculation, account page and report timings, and archive export and restore; all meet the targets and no import or archive truncates silently.

### AI assistance

#### AI-001 — Cited account summaries and questions

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AGENT-003 · *Rules:* D-3

**Requirement.** A CSM can ask about an account or the portfolio ("why is Harbour at risk?", "which renewals next quarter have no executive contact?") and get an answer that cites the timeline entries, metrics and records it used, says what it could not see, and respects the asker's permissions. Meeting preparation briefs use the same method.

**Acceptance.**
1. Ask five scripted questions over a seeded portfolio as a CSM and as a read-only user; every claim has a working citation, missing data is named, and the read-only user's answer excludes out-of-scope accounts.

#### AI-002 — Conversation and meeting summaries with proposed work

*Tier:* Core · *Cites:* BASE-DATA-003, BASE-AGENT-007 · *Rules:* D-3

**Requirement.** Emails, meetings, transcripts, chats and tickets are summarized with cited lines, and proposed tasks, plan updates, risk mentions and expansion mentions carry standard, adding commitment for binding outcomes and external for outside disclosure; the company’s policy decides whether they are applied, reviewed, held or refused.

**Acceptance.**
1. Process a transcript with a commitment, a competitor mention and an expansion request; three proposals appear with citations, accepting one creates the task and discarding one leaves no record but the audit.

#### AI-003 — Sentiment and risk from communications

*Tier:* Core · *Rules:* D-3

**Requirement.** Buoy scores sentiment and detects risk themes (frustration, competitor, budget, champion change) in customer communications as an explainable health measure that cites the messages behind it and can be disabled per data class.

**Acceptance.**
1. Process a month of synthetic emails and tickets for ten accounts with known sentiment; the measure's ranking of the ten accounts has a Spearman rank correlation of at least 0.8 with the labeled ranking and its band matches the label for at least nine of ten accounts, each score cites messages and disabling the measure removes it from health with a visible note.

#### AI-004 — Owner-selected models and data controls

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-DATA-004, BASE-AGENT-011 · *Register:* R-11

**Requirement.** The owner chooses the model provider (Anthropic, OpenAI or a compatible endpoint) and which data classes (emails, transcripts, tickets, usage, revenue) may be sent, sees per-feature usage cost in USD, and can turn AI features off entirely; nothing is used for provider training under the configured terms. Model configuration carries security and changing provider resources can add accounts or gated; model reads inherit sensitive when regulated personal records are included. Company policy decides agent calls. Provider no-training terms are an explicitly unverified owner attestation, not verified provider practice.

**Acceptance.**
1. Configure Anthropic, exclude transcripts, and run AI-001 and AI-002; requests use the chosen model, no transcript text leaves the installation, cost is shown per feature, and turning AI off hides AI features and stops requests.

#### AI-005 — Cited generative answers

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AGENT-003

**Requirement.** Free-form generated account and portfolio answers and meeting briefs cite each generated claim to the timeline entry, metric or record that supports it, identify missing sources and respect the asker’s current record and commercial-field authority. This preserves the generative work separated from AI-001 by ct on 25 October 2026. The current generated door uses permission-projected native account records, renewal fields, health bands and permitted commercial and support snapshots. Every generated claim carries exact source quotations and server-built links; a citation read rechecks current authority and refuses changed evidence. Missing connected sources remain explicit, and generated prose is labeled for human review rather than provider verification.

**Acceptance.**
1. Ask the five AI-001 scripted questions as a CSM and a read-only user; each generated claim has a working supporting-record citation, missing data is named and out-of-scope records are absent.

#### AI-006 — Feature-specific consent for scheduled model work

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-011

**Requirement.** Scheduled model work names its feature, permitted data classes, provider and cost policy, with revocable feature-specific authorization. A person’s per-request consent does not authorize a schedule. Agent schedule changes carry standard and security, adding sensitive for regulated records or external for outside disclosure; the company’s policy decides those calls. Changed model or cost policy invalidates the schedule’s exact authorization; restored archives confer none.

**Acceptance.**
1. With no standing authorization, scheduled work makes no model request; explicitly authorize a named schedule, revoke it and prove later work sends nothing.

### Honest boundaries

#### BOUNDARY-001 — Not a billing processor

*Tier:* Core · *Cites:* BASE-DATA-004

**Requirement.** Buoy reads billing and never charges cards, collects ACH, runs dunning, calculates or remits sales tax or changes subscriptions. Buyers do that in Nectar, Stripe Billing, Chargebee, Zuora, QuickBooks Online or their ERP such as NetSuite, which stay authoritative for invoices and cash; Buoy reconciles to them (REPORT-001) and verifies approved changes reached them (AGENT-003). Both restricted `rk_test_` and full `sk_test_` keys are accepted: read-only transport is enforced, while least-access key scope is advised, not enforced or provider-verified. SECURE-002 retains actual least-access credential checks. Each clause that adds a billing or revenue source (BILLING-001, BILLING-002, BILLING-005, BILLING-006, BILLING-007, RENEW-003, and CRM-001 and CRM-002 for revenue objects) requests read-only scopes and adds its scope and transport checks to this acceptance before it ships. Transport details are specified in [domain rules](docs/contract/domain-rules.md).

**Acceptance.**
1. Inspect the connector scopes requested from Stripe, Chargebee and Zuora, the Salesforce revenue-object permissions, and the API surface; only read scopes are requested and no route moves money.
2. For the current native no-money boundary, the product-door journey reads the route list, runs every write route in it, and checks that no route path charges, refunds, pays out, collects, taxes or changes a subscription and that the native journey reaches only the sign-in mail provider.
3. The current CONNECT-001 test-mode customer inventory additionally asserts every outbound Stripe request is GET to its customer-list endpoint; no subscription or money-changing request is made.

#### BOUNDARY-002 — Not the sales CRM, help desk, product analytics or marketing email platform

*Tier:* Core

**Requirement.** Buoy does not run new-business pipeline, support queues, event analytics dashboards or promotional newsletters. Buyers use Orbit, Salesforce or HubSpot; HappyToHelp, Zendesk, Intercom, Freshdesk, ServiceNow, Salesforce Service Cloud or HubSpot Service Hub; Amplitude, Mixpanel or their warehouse; Mango or Mailchimp, through the connectors above.

**Acceptance.**
1. From a fresh installation, follow the owner guide's setup for Orbit, HappyToHelp, Mango, Salesforce, HubSpot, Zendesk, Intercom, Amplitude and Mixpanel against each product's sandbox or a test installation; each connection passes its CONNECT-001 test sync and puts at least one record on the right Buoy account, and the route list exposes no route that creates a new-business deal, a support queue, a product-analytics chart or a newsletter campaign.

#### BOUNDARY-003 — No guaranteed prediction

*Tier:* Core

**Requirement.** Health scores, forecasts and AI risk signals are explainable judgments over the data present, not guaranteed churn predictions or proof of causation. Missing data stays visible, forecasts compare with actual renewals (RENEW-004), and people decide interventions and commitments. Each current health door carries its evidence day, reasons, missing/stale source coverage and non-prediction/non-causation interpretation; date reads evaluate the current snapshots on the requested UTC date and do not claim historical observations. The runway, account and segment reports show the reasons and labels even when the first-use checklist is hidden. Outcome reports retain their frozen cohort and first-observed evidence, and separately label current inputs with the current revision and UTC day; current gaps never rewrite an earlier observed result. Their HTTP and CSV reads retain the same interpretation and source gaps. HEALTH-001, RENEW-004, AI-001, AI-003 and REPORT-002 each add inputs, missing sources and accuracy against actual outcomes for every closed prediction period before shipping a new score/history, forecast, AI risk signal or report kind.

**Acceptance.**
1. Read any health score, forecast and AI risk signal; each shows its inputs, missing sources and, for closed periods, its accuracy against actual outcomes.
2. For current kinds, read every health HTTP door, the runway, account and segment reports, and an outcome report before and after its observation window closes.
3. Assert current/unknown/stale/sentiment/expired health against the supplied evidence, inputs and source gaps in HTTP/UI/CSV, non-prediction/non-causation labels, and preserved first-observed evidence when current sources later disappear.
4. Repeat all four current UI screens at 1440 and 390 pixels.

#### BOUNDARY-004 — No bulk-mail network or consent bypass

*Tier:* Core

**Requirement.** Buoy sends one-to-one mail through the buyer's own Google or Microsoft mailboxes and one-to-many mail through the buyer's own SendGrid, Amazon SES or Postmark account on the buyer's authenticated domain (EMAIL-003), under their terms and US CAN-SPAM rules; it does not operate a sending network, buy lists or send to unsubscribed contacts, and agent commercial-term changes carry money and commitment, decided by the company’s policy. EMAIL-001, EMAIL-002, EMAIL-003, JOURNEY-001 and SURVEY-001 add the suppressed-contact and unverified-domain refusals, recorded the same way, before they send; Agent commercial changes carry money and commitment, which the company’s policy decides under GOVERN-001. Transport details are specified in [domain rules](docs/contract/domain-rules.md).

**Acceptance.**
1. Under the held company policy, attempt a journey send to a suppressed contact, a journey from an unverified domain and an agent discount; all three are refused with their reason and recorded.
2. Under the held company policy, until a send path ships, the product-door journey attempts an agent discount on a renewal preparation, an unknown discount command and an agent account edit: each is refused with its reason, no term changes, the owner's audit read lists each as a refused-agent action with its subject and reason (a member cannot read it), and every message the installation sent is single-recipient internal team mail (sign-in links, NOTIFY-001 notices and PLAY-002 reminders), never a customer campaign.

#### BOUNDARY-005 — Certifications are the deployment's

*Tier:* Core · *Cites:* BASE-INSTALL-001, BASE-DATA-004 · *Register:* R-6

**Requirement.** SOC 2 or similar attestations cover the buyer's deployment and are prepared with Evidence or their auditor; a provider's network, terms and data-processing agreements still apply to each connector. The providers guide (`docs/providers.md`) lists every provider an installation can talk to, with what each receives and returns and the terms and data-processing agreement that govern it. The guide also describes incoming Segment observations under USAGE-001 and INAPP-001's buyer-operated authenticated product relay: the relay requests content from Buoy and sends view/completion/dismissal receipts back. It is not a third-party provider or an outbound Buoy provider call; neither incoming observations nor stored receipts claim provider verification, hosted delivery or legal acceptance. Technical calculations, custody and dependency rules are specified in [domain rules](docs/contract/domain-rules.md#boundary-005).

**Acceptance.**
1. The owner guides list each connector's data flows and the provider terms that govern them.
2. The site check derives current connector provider origins (Stripe and Totango account search), the mail providers the installation accepts and the OpenID presets from code, with Cloudflare and Segment explicitly named, then requires a section in the built guide for each, with when it is used, what it sends and receives, and a link to its terms.
3. The buyer-operated in-app relay has its own When/Sends/Receives/Terms guide section describing server-only authenticated requests, exact reviewed source/user/group mapping, campaign content and view/completion/dismissal receipts, buyer and source external copies and deployment responsibilities; it is not a third-party provider and has no fabricated provider terms or outbound Buoy call.

### Agent surface

**Specialist: customer success operator.** It keeps customer evidence joined, follows risks and onboarding work to observed outcomes, and prepares renewal and expansion work for the account team.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company’s policy decides every call.

**How Buoy computes each class.**

- **standard:** reversible internal records, drafts, reports, scores, tasks and schedule definitions; facts name item counts and accounts.
- **external:** a recipient, share, publication, connector writeback or send exposes customer context outside the business; facts name recipients and known, new or public counterparties. Moving context into an already externally visible plan also adds external.
- **money:** a commercial-term edit changes an amount the company charges or pays; facts name native amount, currency and counterparty. Buoy does not process payments.
- **commitment:** a confirmed renewal outcome, concession, plan sign-off or commercial offer binds the business; facts name the exact version, value and counterparty.
- **accounts:** a connector action creates an outside service account or paid resource; facts name the provider.
- **gated:** a provider requires its own person-held consent, hosted checkout, identity verification or terms step; facts name provider and required step.
- **access:** staffing, account ownership, record sharing or grants change authority; facts name affected people and whether authority widens or narrows.
- **security:** connector credentials, identity enforcement or protective/model data settings change; facts name the setting.
- **destructive:** an irreversible erasure or identity merge removes records; facts name item counts and retained/held exceptions.
- **sensitive:** selected fields contain regulated personal, bank or identification data; facts name record counts and data kind, rather than treating every commercial field as regulated.
- **live:** enabling, pausing or publishing a running playbook, connector, score or outreach schedule changes service behavior; facts name the running service and version.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `buoy.approval.revision_bound_human_approval` | Revision-bound human approval | APPROVAL-001 | standard or commitment (+ money) | not implemented as MCP |
| `buoy.erase.owner_erasure_with_tombstones` | Owner erasure with tombstones | ERASE-001 | destructive (+ sensitive) | not implemented as MCP |
| `buoy.account.account_hierarchy_people_and_ownership` | Account hierarchy, people and ownership | ACCOUNT-001 | standard (+ access or sensitive) | not implemented as MCP |
| `buoy.account.unified_customer_timeline` | Unified customer timeline | ACCOUNT-002 | standard (+ access or sensitive) | not implemented as MCP |
| `buoy.account.workspaces_lists_and_saved_views` | Workspaces, lists and saved views | ACCOUNT-003 | standard (+ access or sensitive) | not implemented as MCP |
| `buoy.account.custom_fields_calculated_fields_and_field_history` | Custom fields, calculated fields and field history | ACCOUNT-004 | standard (+ access or sensitive) | not implemented as MCP |
| `buoy.account.search` | Search | ACCOUNT-005 | standard (+ access or sensitive) | not implemented as MCP |
| `buoy.account.custom_objects` | Custom objects | ACCOUNT-006 | standard (+ access or sensitive) | not implemented as MCP |
| `buoy.connect.connector_framework_freshness_and_reconnection` | Connector framework, freshness and reconnection | CONNECT-001 | security (+ accounts or gated or live) | not implemented as MCP |
| `buoy.identity.identity_reconciliation_and_source_authority` | Identity reconciliation and source authority | IDENTITY-001 | standard | not implemented as MCP |
| `buoy.crm.salesforce_two_way_sync` | Salesforce two-way sync | CRM-001 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.crm.hubspot_two_way_sync` | HubSpot two-way sync | CRM-002 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.crm.orbit_native_link` | Orbit native link | CRM-003 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.crm.salesforce_field_handover_at_cutover` | Salesforce field handover at cutover | CRM-004 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.billing.stripe_billing_connector` | Stripe billing connector | BILLING-001 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.billing.chargebee_nectar_and_quickbooks_online_revenue_sources` | Chargebee, Nectar and QuickBooks Online revenue sources | BILLING-002 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.billing.subscription_financial_model` | Subscription financial model | BILLING-003 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.billing.multi_currency_subscriptions` | Multi-currency subscriptions | BILLING-004 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.billing.salesforce_and_hubspot_revenue_sources_including_salesforce_cpq` | Salesforce and HubSpot revenue sources, including Salesforce CPQ | BILLING-005 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.billing.zuora_billing_connector` | Zuora billing connector | BILLING-006 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.billing.subscription_and_invoice_feeds_from_a_warehouse_or_file` | Subscription and invoice feeds from a warehouse or file | BILLING-007 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.support.zendesk_connector` | Zendesk connector | SUPPORT-001 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.support.intercom_and_happytohelp_connectors` | Intercom and HappyToHelp connectors | SUPPORT-002 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.support.customer_success_context_inside_zendesk_and_intercom` | Customer-success context inside Zendesk and Intercom | SUPPORT-003 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.support.support_cases_and_tickets_from_salesforce_and_hubspot` | Support cases and tickets from Salesforce and HubSpot | SUPPORT-004 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.support.freshdesk_and_servicenow_connectors` | Freshdesk and ServiceNow connectors | SUPPORT-005 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.usage.segment_and_event_api_ingestion` | Segment and event API ingestion | USAGE-001 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.usage.warehouse_sync_with_snowflake_bigquery_redshift_and_databricks` | Warehouse sync with Snowflake, BigQuery, Redshift and Databricks | USAGE-002 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.usage.amplitude_mixpanel_and_pendo_connectors` | Amplitude, Mixpanel and Pendo connectors | USAGE-003 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.usage.scheduled_file_sources_from_amazon_s3_sftp_and_google_sheets` | Scheduled file sources from Amazon S3, SFTP and Google Sheets | USAGE-004 | standard or external (+ sensitive or gated) | not implemented as MCP |
| `buoy.adopt.adoption_and_license_metrics` | Adoption and license metrics | ADOPT-001 | standard | not implemented as MCP |
| `buoy.product.product_issues_and_feature_requests_linked_to_accounts` | Product issues and feature requests linked to accounts | PRODUCT-001 | standard | not implemented as MCP |
| `buoy.health.configurable_explainable_health_scores` | Configurable, explainable health scores | HEALTH-001 | standard (+ live) | not implemented as MCP |
| `buoy.health.csm_sentiment_and_manual_measures` | CSM sentiment and manual measures | HEALTH-002 | standard (+ live) | not implemented as MCP |
| `buoy.signal.risk_and_opportunity_alerts` | Risk and opportunity alerts | SIGNAL-001 | standard (+ live) | not implemented as MCP |
| `buoy.segment.segments_tiers_and_lifecycle_stages` | Segments, tiers and lifecycle stages | SEGMENT-001 | standard (+ live) | not implemented as MCP |
| `buoy.play.automated_playbooks` | Automated playbooks | PLAY-001 | standard or external (+ live) | playbook.prepare |
| `buoy.play.tasks_reminders_and_escalation` | Tasks, reminders and escalation | PLAY-002 | standard or external (+ live) | not implemented as MCP |
| `buoy.play.automation_run_history_and_failure_alerts` | Automation run history and failure alerts | PLAY-003 | standard or external (+ live) | not implemented as MCP |
| `buoy.play.outcome_tracking_for_playbooks` | Outcome tracking for playbooks | PLAY-004 | standard or external (+ live) | not implemented as MCP |
| `buoy.onboard.onboarding_projects` | Onboarding projects | ONBOARD-001 | standard | not implemented as MCP |
| `buoy.plan.shared_success_plans_and_goals` | Shared success plans and goals | PLAN-001 | standard (+ access or sensitive) | not implemented as MCP |
| `buoy.portal.customer_collaboration_portal` | Customer collaboration portal | PORTAL-001 | standard | not implemented as MCP |
| `buoy.review.business_review_preparation_and_decks` | Business review preparation and decks | REVIEW-001 | standard or external (+ sensitive) | not implemented as MCP |
| `buoy.email.two_way_email_through_gmail_and_microsoft_365` | Two-way email through Gmail and Microsoft 365 | EMAIL-001 | standard or external (+ live) | not implemented as MCP |
| `buoy.email.sending_controls_and_consent` | Sending controls and consent | EMAIL-002 | standard or external (+ live) | not implemented as MCP |
| `buoy.email.journey_sending_provider_and_domain_authentication` | Journey sending provider and domain authentication | EMAIL-003 | standard or external (+ live) | not implemented as MCP |
| `buoy.email.gmail_and_outlook_sidebar` | Gmail and Outlook sidebar | EMAIL-004 | standard or external (+ live) | not implemented as MCP |
| `buoy.journey.digital_customer_success_journeys` | Digital customer success journeys | JOURNEY-001 | standard or external (+ live) | not implemented as MCP |
| `buoy.inapp.in_app_messages_and_guides` | In-app messages and guides | INAPP-001 | standard or external (+ live) | not implemented as MCP |
| `buoy.meet.calendar_capture` | Calendar capture | MEET-001 | standard | not implemented as MCP |
| `buoy.meet.call_recordings_and_transcripts` | Call recordings and transcripts | MEET-002 | standard | not implemented as MCP |
| `buoy.chat.slack_microsoft_teams_and_nook_alerts_and_actions` | Slack, Microsoft Teams and Nook alerts and actions | CHAT-001 | standard or external (+ live) | not implemented as MCP |
| `buoy.survey.nps_and_csat_relationship_surveys` | NPS and CSAT relationship surveys | SURVEY-001 | standard or external (+ live) | not implemented as MCP |
| `buoy.notify.in_app_notifications_and_digests` | In-app notifications and digests | NOTIFY-001 | standard | not implemented as MCP |
| `buoy.renew.renewal_pipeline` | Renewal pipeline | RENEW-001 | standard or commitment (+ money or external) | renewal.prepare |
| `buoy.renew.expansion_pipeline_and_cs_qualified_leads` | Expansion pipeline and CS-qualified leads | RENEW-002 | standard or commitment (+ money or external) | not implemented as MCP |
| `buoy.renew.crm_renewal_opportunity_sync` | CRM renewal opportunity sync | RENEW-003 | standard or commitment (+ money or external) | not implemented as MCP |
| `buoy.renew.renewal_forecast` | Renewal forecast | RENEW-004 | standard or commitment (+ money or external) | not implemented as MCP |
| `buoy.renew.renewal_paperwork_and_terms` | Renewal paperwork and terms | RENEW-005 | standard or commitment (+ money or external) | not implemented as MCP |
| `buoy.report.nrr_grr_and_retention_reporting` | NRR, GRR and retention reporting | REPORT-001 | standard or external (+ sensitive) | not implemented as MCP |
| `buoy.report.dashboards_and_report_builder` | Dashboards and report builder | REPORT-002 | standard or external (+ sensitive) | not implemented as MCP |
| `buoy.role.roles_and_permissions` | Roles and permissions | ROLE-001 | access | not implemented as MCP |
| `buoy.role.single_sign_on_and_provisioning` | Single sign-on and provisioning | ROLE-002 | security · access (+ gated) | not implemented as MCP |
| `buoy.team.books_of_business_and_reassignment` | Books of business and reassignment | TEAM-001 | standard (+ access or sensitive) | not implemented as MCP |
| `buoy.audit.durable_audit_log` | Durable audit log | AUDIT-001 | standard | not implemented as MCP |
| `buoy.secure.connector_credential_custody` | Connector credential custody | SECURE-002 | security (+ accounts or gated) | not implemented as MCP |
| `buoy.erase.contact_level_privacy_requests` | Contact-level privacy requests | ERASE-002 | destructive (+ sensitive) | not implemented as MCP |
| `buoy.api.public_api_and_webhooks` | Public API and webhooks | API-001 | access · security (+ external) | not implemented as MCP |
| `buoy.migrate.gainsight_cs_migration` | Gainsight CS migration | MIGRATE-001 | standard | not implemented as MCP |
| `buoy.migrate.churnzero_migration` | ChurnZero migration | MIGRATE-002 | standard | not implemented as MCP |
| `buoy.migrate.totango_migration` | Totango migration | MIGRATE-003 | standard | not implemented as MCP |
| `buoy.migrate.planhat_migration` | Planhat migration | MIGRATE-004 | standard | not implemented as MCP |
| `buoy.migrate.vitally_velaris_and_spreadsheet_migration` | Vitally, Velaris and spreadsheet migration | MIGRATE-005 | standard | not implemented as MCP |
| `buoy.migrate.parallel_run_and_delta_re_import` | Parallel run and delta re-import | MIGRATE-006 | standard | not implemented as MCP |
| `buoy.migrate.health_history_carried_over` | Health history carried over | MIGRATE-007 | standard | not implemented as MCP |
| `buoy.ai.cited_account_summaries_and_questions` | Cited account summaries and questions | AI-001 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.ai.conversation_and_meeting_summaries_with_proposed_work` | Conversation and meeting summaries with proposed work | AI-002 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.ai.sentiment_and_risk_from_communications` | Sentiment and risk from communications | AI-003 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.ai.owner_selected_models_and_data_controls` | Owner-selected models and data controls | AI-004 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.ai.cited_generative_answers` | Cited generative answers | AI-005 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.ai.feature_specific_consent_for_scheduled_model_work` | Feature-specific consent for scheduled model work | AI-006 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.govern.agent_authority_and_action_ledger` | Agent authority and action ledger | GOVERN-001 | access · security | named local command grants |
| `buoy.agent.verified_risk_resolution` | Verified risk resolution | AGENT-001 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.agent.retention_interventions_measured_against_comparable_accounts` | Retention interventions measured against comparable accounts | AGENT-002 | standard or external (+ sensitive or commitment or money or live) | experiment.prepare; experiment.report |
| `buoy.agent.evidence_backed_renewal_readiness` | Evidence-backed renewal readiness | AGENT-003 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.agent.portfolio_wide_causes_of_risk` | Portfolio-wide causes of risk | AGENT-004 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.agent.scaled_tier_digital_csm` | Scaled-tier digital CSM | AGENT-005 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.agent.onboarding_follow_through` | Onboarding follow-through | AGENT-006 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.agent.data_trust_upkeep` | Data trust upkeep | AGENT-007 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |
| `buoy.agent.plain_language_configuration` | Plain-language configuration | AGENT-008 | standard or external (+ sensitive or commitment or money or live) | not implemented as MCP |

**Resources.** `buoy://accounts/{id}`, `buoy://people/{id}`, `buoy://observations/{id}`, `buoy://tasks/{id}`, `buoy://plans/{id}`, `buoy://playbooks/{id}`, `buoy://runs/{id}`, `buoy://renewals/{id}`, `buoy://reports/{id}`, `buoy://reviews/{id}`, `buoy://surveys/{id}`, `buoy://connectors/{id}` `buoy://audit/{id}`, `buoy://objects/{id}`, `buoy://object-records/{id}`, `buoy://opportunities/{id}`, `buoy://segments/{id}`, `buoy://scorecards/{id}`, `buoy://signals/{id}`, `buoy://outcomes/{id}`, `buoy://experiments/{id}`, `buoy://journeys/{id}`, `buoy://campaigns/{id}`, `buoy://messages/{id}`, `buoy://meetings/{id}`, `buoy://model-drafts/{id}` and `buoy://role-definitions/{id}`.

**Events.** `account.changed`, `person.changed`, `observation.received`, `health.changed`, `signal.fired`, `task.changed`, `plan.changed`, `playbook.run.changed`, `renewal.changed`, `report.changed`, `review.changed`, `connector.changed`, `object-record.changed`, `opportunity.changed`, `segment.changed`, `scorecard.published`, `outcome.observed`, `experiment.changed`, `journey.changed`, `campaign.changed`, `message.receipt`, `meeting.changed`, `model-draft.changed` and `role-definition.changed` carry the corresponding resource URI. Message and connector receipts distinguish observed provider results from human reports.

**Prompts.** Resolve account risk (AGENT-001); compare an intervention (AGENT-002); prepare a renewal (AGENT-003); find portfolio causes (AGENT-004); run scaled success (AGENT-005); follow onboarding (AGENT-006); repair data trust (AGENT-007); configure and back-test (AGENT-008).

**Not tools, and why.** HTTP-001: transport door; DATA-001: observation validation is part of each data/import door; IMPORT-001: single reviewed import door; RESTORE-001: installation archive operation; SITE-001: public reading screen; STYLE-001: presentation on a person’s screen; MOBILE-001: device-only native client and offline synchronization; A11Y-001: accessibility of a person’s screens; SCALE-001: installation capacity fact; BOUNDARY-001: installation scope: no billing processor; BOUNDARY-002: installation scope: connected sibling products; BOUNDARY-003: interpretation of displayed evidence; BOUNDARY-004: installation sending-network and suppression boundary; BOUNDARY-005: installation and deployment certification fact. All other Core jobs are in the table.

**Limits.** Capacity follows SCALE-001; request, body and byte limits are documented in the agent guide. Business thresholds and provider spend caps are the company’s policy.

**Handoffs.** Listens for Orbit won-deal handoffs, HappyToHelp support outcomes, Nectar billing changes, Penny feature decisions, Vector issue releases and Auth lifecycle changes. Emits account-risk evidence, customer-work tasks, renewal readiness and CS-qualified expansion for the receiving specialist; untrusted record prose does not select a handoff.

#### SURFACE-001 — Complete customer-success registry

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** Buoy’s registry covers the Core jobs and exceptions in this table. Existing local bearer commands are an interim slice, not an MCP completion claim.

**Acceptance.**
1. The published registry and documentation map every Core clause to the tool or non-tool reason in this table, including custom objects, incumbent migrations, commercial work and native-device exceptions.
2. An account task created through its native action and its MCP tool has equal account, owner, evidence and event type on the same fixture.

#### SURFACE-002 — Internal work and outside exposure

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-007

**Requirement.** Buoy classifies customer-record work by the visibility it creates, including already-shared plans.

**Acceptance.**
1. An internal reversible task or draft carries standard with item and account facts.
2. A message, connector writeback or plan change newly visible to a customer carries external with exact recipients and known/new/public counterparty; the equivalent internal-only edit does not.

#### SURFACE-003 — Commercial facts and binding decisions

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008

**Requirement.** Renewal and concession tools distinguish a pricing change from a binding decision and preserve source authority.

**Acceptance.**
1. A changed renewal amount or concession carries money with amount, native currency and counterparty, without processing a payment.
2. A binding renewal outcome, commercial offer or plan sign-off carries commitment with its exact version and counterparty; a draft alone remains standard.
3. Company policy decides both classes when one call changes price and commits terms; BILLING-003 continues to show outstanding source variance.

#### SURFACE-004 — Customer access and protective settings

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-005, BASE-AGENT-006

**Requirement.** Account ownership and sharing use Buoy’s current scopes; connector and identity settings have distinct protective facts.

**Acceptance.**
1. A changed CSM, role, portal share or grant carries access with the people and widening/narrowing direction.
2. A credential rotation, identity-enforcement change or model-data protection change carries security with its setting.

#### SURFACE-005 — Irreversible and regulated customer data

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-DATA-006

**Requirement.** Erasure and identity-merge tools account for retained holds and distinguish regulated personal data from ordinary commercial fields.

**Acceptance.**
1. An irreversible account/person erasure or identity merge carries destructive with the item count and the product’s actual hold outcome.
2. A read or disclosure including regulated identity or bank records carries sensitive with record count and kind; excluding those fields leaves the class absent.

#### SURFACE-006 — Provider setup and running automation

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Buoy identifies provider-owned setup steps and the running services a tool changes.

**Acceptance.**
1. Creating an outside connector account or paid resource carries accounts with the provider.
2. A provider consent, hosted checkout or identity-verification step carries gated with the provider and exact person-held step, including when the provider reports it during a call.
3. Changing an enabled playbook, connector, health or outreach schedule carries live with the service and version; saving an inert draft alone does not.

#### SURFACE-007 — Source-linked customer resources

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003

**Requirement.** The customer-success resource set includes the records behind health, commercial facts and observed outcomes.

**Acceptance.**
1. Every resource template listed in this section is discoverable, including custom-object records, opportunities, segments, scorecards, signals, observational outcomes, experiments, outreach, meetings, model drafts and role definitions.
2. A sourced health or revenue read links to the exact retained observation; missing inputs and unresolved monetary variance remain explicit.

#### SURFACE-008 — Outcome events and specialist handoffs

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-010

**Requirement.** Buoy’s events keep evidence changes distinct from proposals, manual reports and observed provider outcomes.

**Acceptance.**
1. One changed customer source emits the account/observation resource and causes the corresponding health and risk events.
2. A signed renewal handoff and an external provider result retain their source identifiers; replay yields the same outcome rather than a second commercial action.
3. An unverified human report cannot become a provider execution, delivered alert or verified risk resolution.

#### SURFACE-009 — A seeded week through MCP

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-013 · *Register:* R-7, R-8, R-9, R-10

**Requirement.** A stranger customer-success specialist works a seeded week from the installation URL under all-autonomous and held company policies, with the provider and customer steps represented by their official-schema fakes.

**Acceptance.**
1. Under the all-autonomous company policy, join the seeded CRM/billing/support/usage changes, explain the at-risk account, create the three-owner remedy, track recovery and prepare the renewal entirely through MCP; no call waits or is refused by policy.
2. Under the held company policy (standard review and every other declared class approval), repeat the same week; each decision matches that policy and the named test person performs its required browser approvals.
3. An unchanged source mismatch remains quantified after explained review, the customer’s own confirmation remains distinct from the specialist’s act, and a risk closes only on its required recovered usage and customer evidence.
4. Run both policy journeys with native action parity and observable account, task, revenue and outcome end states at 1440 and 390.

## Push further

### Push further: agents that carry the job

#### GOVERN-001 — Agent authority and action ledger

*Tier:* Core · *Cites:* BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-007, BASE-AGENT-009, BASE-AGENT-011

**Requirement.** Buoy grants access by named command family and customer-data class: account terms, billing snapshots, support snapshots and CSM sentiment. Its action ledger distinguishes metered agent operations from internal notification-provider fees and displays that distinction beside the budget and ledger. Preparation snapshots the data classes it consumes; excluded classes cannot leak through derived health, segments or outlook. Commercial-term changes carry money and commitment; outside sends carry external; grant management carries access, protective settings carry security, and the company’s policy decides their disposition. Technical command accounting and grant migration are specified in [domain rules](docs/contract/domain-rules.md#govern-001).

**Acceptance.**
1. Under the held company policy, issue a prepare-only agent and a send-within-policy agent, have each attempt preparation, approval, an in-policy email, an out-of-policy email and a discount; only allowed actions occur, approvals and the discount are refused, the ledger records every attempt, and the kill switch stops both mid-run.
2. The USD budget and ledger measure metered agent operations, currently USD0.
3. Automatic NOTIFY-001/PLAY-002 internal team notifications continue through the owner’s existing mail provider and preferences; provider fees are not measured or included in this budget.
4. The UI/API/docs label this “No metered agent charge; internal notification mail may use your provider” beside the budget and ledger.
5. Until a paid, send or update scope exists, the GOVERN-001 HTTP and browser journeys issue two different local command grants, check expiry bounds/defaults, refused invalid policies, selected-field reads without derived leaks, denied preparation with missing classes, concurrent minute exhaustion and Retry-After, owner-only settings, revocation/owner-version invalidation, and pause/resume stopping both mid-run without work.
6. Every valid-token attempt has a distinct succeeded/refused outcome; ledger reads contain no payload or credential and show actual metered USD0.
7. The owner form chooses the actual grant, displays the token once, then pauses/resumes/revokes it at 1440 and 390.
8. Every message a preparation induces is the single-recipient internal approval notice, never a customer send or billing/model action.

#### AGENT-001 — Verified risk resolution

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-007

**Requirement.** For an at-risk account the agent tests whether the underlying problem is really unresolved by checking support tickets and their linked engineering issues (Jira, Linear, Vector), product usage of the affected feature, billing state and the latest customer messages. It proposes one accountable remedy with owners in support, product and commercial teams, follows each owner's step to completion, and only marks the risk resolved when the customer's data or own words confirm the outcome (usage restored, ticket confirmed fixed, customer reply). Unconfirmed benefit stays unconfirmed.

**Acceptance.**
1. Seed an account whose urgent ticket is marked solved but whose feature usage is still zero and whose engineering issue is open; the agent reports the problem as unresolved with citations, proposes a remedy with three owners, chases overdue steps, and marks it resolved only after usage recovers and the customer confirms; under the held company policy the CSM approves the standard remedy and each external message before it is sent.

#### AGENT-002 — Retention interventions measured against comparable accounts

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-007

**Requirement.** The agent proposes a small intervention for a segment (for example an onboarding call for accounts that stall at a milestone), and under the company’s policy for the standard experiment and its success metric (CS leadership approves in the held run), assigns comparable holdout accounts by segment, baseline health, ARR and tenure, runs the intervention through playbooks and reports the difference in outcome and renewal with its uncertainty, sample size and known biases. It never changes pricing or disadvantages a customer, and never claims a health increase proves retained revenue. Customer tenure comes from an existing typed customer-since field with recorded source evidence, never installation age. Matching uses exact segment, health band and score when available, native ARR and currency, and whole UTC-day tenure; missing factors refuse matching. The approved healthy or renewed success metric and both observational windows are frozen before enrollment. Reports expose matching and source revisions, provisional observed rates, sample sizes, the intervention-minus-holdout difference and a descriptive 95 percent Newcombe interval from Wilson score bounds, with unmeasured confounding, incomplete observation and independence assumptions stated. ROLE-001 inherits scoped authority before extending this door. See `docs/experiments.md` for replay, custody and precise units.

**Acceptance.**
1. Under the held company policy, on a seeded history with a known effect, approve an experiment; the agent's holdout matches on the stated factors, the reported effect falls within the seeded range with an interval, and an experiment that would withhold a contracted service is refused.

#### AGENT-003 — Evidence-backed renewal readiness

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-007

**Requirement.** From 120 days before each renewal the agent reads terms, notice dates, billing, success-plan goals, stakeholder engagement and open risks; identifies missing renewal authority (no economic buyer contact, champion departed), unresolved obligations and unconfirmed goals; prepares a joint timeline with the customer; and after the company’s money and commitment policy permits commercial steps verifies that they reached the CRM and billing system. Terms, amounts and negotiation positions carry commitment and money, which the company’s policy decides; direct payment processing remains outside Buoy’s scope.

**Acceptance.**
1. Seed renewals with a departed champion, an unconfirmed goal and an uplift not yet in Stripe; the agent flags each with citations, prepares the timeline carrying standard, with commercial changes carrying money and commitment under the company’s policy and reports the Stripe mismatch until the subscription matches the approved terms.

#### AGENT-004 — Portfolio-wide causes of risk

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-007

**Requirement.** Across the accounts the requester may read, the agent clusters complaints, stalled onboarding milestones, support defects and churn reasons into shared causes, quantifies the ARR exposed, routes a proposed systemic fix to the product owner in Vector, Jira or Linear and the feature request to Penny, and after release checks which affected customers actually benefited. No customer's confidential detail appears in another customer's view or message.

**Acceptance.**
1. Seed 200 accounts where 30 share a defect; the agent reports the cluster with its ARR and citations, files one linked issue under the company’s external policy (after approval in the held run), and after the issue closes reports which of the 30 recovered; a CSM scoped to ten accounts sees only their own accounts in the cluster.

#### AGENT-005 — Scaled-tier digital CSM

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-007

**Requirement.** For digital and scaled accounts the agent monitors health, usage and lifecycle events, sends approved-template outreach within EMAIL-002 policy, answers customer replies that match approved knowledge, books meetings through Dial links when a human is needed, and escalates to a named CSM with a cited summary when risk, a commercial question or an unknown arises.

**Acceptance.**
1. Run the agent over 300 scaled accounts for a simulated month with replies of each kind; in-policy outreach is sent, a pricing question and a cancellation threat escalate with summaries, no reply invents a commitment, and every message is in the ledger.

#### AGENT-006 — Onboarding follow-through

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-007

**Requirement.** The agent watches onboarding projects, reminds customer and internal owners of overdue tasks in their own channel (email, portal, Slack Connect) within policy, proposes rescheduled dates when a dependency slips, and tells the CSM when go-live is genuinely at risk.

**Acceptance.**
1. Seed a project with an overdue customer task and a slipped dependency; reminders go to the right people within policy, date changes carry standard and the company’s policy decides them (the held policy waits for CSM approval), and the at-risk alert cites the blocking tasks.

#### AGENT-007 — Data trust upkeep

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-007

**Requirement.** The agent watches connectors and joins: it proposes identity merges, flags accounts whose CRM, billing and support data disagree (ARR mismatch, a churned subscription with an active CRM status, users mapped to the wrong account), names stale sources behind health scores and opens fix tasks for the source owner. Identity merges carry destructive and access; source-authority changes carry access and commitment. The company’s policy decides agent calls in those classes.

**Acceptance.**
1. Seed a duplicated company, an ARR mismatch and a mis-mapped Segment group; the agent proposes each fix with evidence, applies each fix according to the company’s policy for standard, access, destructive or commitment as computed (the held policy uses admin approval), and the affected health scores update with the change noted.
2. ROLE-001 governs current account- and commercial-field-scoped evidence reads and preparation for CS managers, CSMs and authorized CS operations staff.
3. Segment native-ID hints and retained source-owner claims remain visibly unverified, never identity authority.
4. An exact mapping correction binds the source claim, both account identities and independently reviewed target membership; under the held company policy a person inspects and approves those facts, while company policy decides agent access-class calls.
5. Changed evidence, membership, source or current authority invalidates the prepared mapping.
6. An applied correction retains source provenance, updates both affected health scores and records the change without rewriting source observations.
7. Duplicate, ARR and stale-source fix tasks preserve company records and every source value; task creation is neither an identity merge nor revenue-authority selection or source repair. Linked trust evidence follows ERASE-002 export, redaction, holds and erasure; import undo refuses dependent trust work through either account.

#### AGENT-008 — Plain-language configuration

*Tier:* Core · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-007

**Requirement.** An admin describes a scorecard, segment, playbook or report in plain language; the agent builds a draft, back-tests scorecards and signals against the last twelve months (how often they would have fired, how many churned accounts they would have caught), shows the draft and test, and classifies publication as standard, adding external or live when publication starts outside messages or changes running automation; the company’s policy decides publication.

**Acceptance.**
1. Ask for "flag accounts whose weekly active users fall 30% and who have an open urgent ticket"; the draft signal back-tests on seeded history with fire counts and churn capture shown, and publication carries standard, adding external or live for messages or running automation; the company’s policy decides it, and the held policy waits for the admin.
2. Under the held company policy, owner and admin sessions prepare scorecard, signal, segment, playbook and report drafts using AI-004 provider-bound credentials, explicit request consent, model policy, budget and Pause checks.
3. Only the description and schema reach the model; historical customer observations stay local.
4. Signals combine a weekly active-person drop with open urgent tickets.
5. Their twelve-month test uses reviewed usage and dated support history, with exact matching account weeks and distinct churn capture; scorecards replay retained native inputs with durable ordering for equal timestamps.
6. Missing history stays visible and is never filled from current data.
7. Publication under the held company policy requires approval of the exact draft and reviewed source fingerprint, then uses native validation and atomic publication; replay creates no second definition.
8. Internal owner signal alerts use inbox preferences and can be paused with an audit. Account erasure withdraws dependent drafts; archives exclude pending person-approval authority. MIGRATE-007 owns imported-history coverage.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | Human screen-reader pass | A11Y-001 | not run | | |
| R-2 | Deployment-specific VPAT | A11Y-001 | not run | | |
| R-3 | iOS App Store approval | MOBILE-001 | not run | | |
| R-4 | Google Play approval | MOBILE-001 | not run | | |
| R-5 | Real Google, Microsoft and Okta tenant acceptance; run-auth and provider sandboxes remain acceptance | ROLE-002 | not run | | |
| R-6 | Buyer deployment certification and auditor attestation | BOUNDARY-005 | not run | | |
| R-7 | Claude MCP client receipt | SURFACE-009 | not run | | |
| R-8 | ChatGPT MCP client receipt | SURFACE-009 | not run | | |
| R-9 | Codex MCP client receipt | SURFACE-009 | not run | | |
| R-10 | Copilot MCP client receipt | SURFACE-009 | not run | | |
| R-11 | Provider no-training practice attestation beyond the owner-recorded unverified terms | AI-004 | not run | | |

## Boundaries

- [Orbit](https://github.com/just-every/run-orbit) is the sales CRM that wins the deal and hands the account over (its INTEGRATE-008); [HappyToHelp](https://github.com/just-every/run-happytohelp) is the help desk; [Nectar](https://github.com/just-every/run-nectar) is subscription billing; [Pencil](https://github.com/just-every/run-pencil) owns general forms and research surveys; [Penny](https://github.com/just-every/run-penny) owns the product feedback board; [Vector](https://github.com/just-every/run-vector) owns issue tracking; [Mango](https://github.com/just-every/run-mango) owns marketing email; [Dial](https://github.com/just-every/run-dial) owns booking links; [Inkwell](https://github.com/just-every/run-inkwell) and [Locket](https://github.com/just-every/run-locket) own signature and contract records; [Nook](https://github.com/just-every/run-nook) is team chat; [Auth](https://github.com/just-every/run-auth) is the workforce identity provider; [Crank](https://github.com/just-every/run-crank) is general workflow automation. Each such seam below is a Buoy integration obligation, not a merged product. No gap in implementation, provider approval or partner agreement reduces this destination; it is recorded as a clause and built.
- Provider sandboxes, official-schema fakes, run-auth and seeded scale remain acceptance. A fixture does not establish real provider acceptance, client certification or deployment attestation.
- Buoy reads billing; it neither processes payments nor operates a bulk-mail sending network.

## Homepage claims

| # | Claim | Clauses |
| --- | --- | --- |
| 1 | Spot the risk. Save the renewal. | HEALTH-001, SIGNAL-001, RENEW-001 |
| 2 | Joins CRM, billing, support and usage data for every account. | ACCOUNT-002, CRM-001, CRM-002, BILLING-001, SUPPORT-001, USAGE-001 |
| 3 | Explains account health, runs playbooks and reconciles renewals to billing. | HEALTH-001, PLAY-001, RENEW-001, REPORT-001 |
| 4 | 100% free and open source alternative to Gainsight, ChurnZero and Totango; MIT licensed. | BOUNDARY-005 |
| 5 | Account health recovers when the account’s evidence recovers. | HEALTH-001, AGENT-001 |
| 6 | Every point in the configured weighted scorecard is explained with its source and freshness. | HEALTH-001, DATA-001 |
| 7 | Risk alerts reach Slack; Salesforce and Zendesk show the same health. | SIGNAL-001, CHAT-001, CRM-001, SUPPORT-003 |
| 8 | The agent checks support, usage, engineering issues, billing and email before calling a problem fixed. | AGENT-001, PRODUCT-001, ACCOUNT-002 |
| 9 | A remedy has three owners, overdue steps are chased and the risk closes on customer data and words. | AGENT-001, PLAY-002 |
| 10 | A released fix creates tell-your-customer tasks for the linked CSMs. | PRODUCT-001 |
| 11 | Champion-change playbooks find existing contacts, book introductions and capture meeting commitments. | PLAY-001, MEET-001, MEET-002, AI-002 |
| 12 | In-app onboarding walkthroughs target identified users and record completion. | INAPP-001, JOURNEY-001 |
| 13 | Onboarding projects track customer and internal tasks, dependencies and go-live risk. | ONBOARD-001, PORTAL-001 |
| 14 | Plain-English portfolio questions return accounts, citations and missing evidence, then draft introductions. | AI-001, AI-005, EMAIL-001 |
| 15 | Six Q4 renewals with no executive contact can be found across the permitted portfolio. | AI-001, ACCOUNT-001, RENEW-001 |
| 16 | Utilization growth opens an expansion; an unhappy NPS reply starts a playbook. | ADOPT-001, SIGNAL-001, RENEW-002, SURVEY-001, PLAY-001 |
| 17 | NPS is computed by segment and detractors reach the responsible CSM. | SURVEY-001, NOTIFY-001 |
| 18 | A DocuSign renewal is linked to Salesforce and Stripe, with no silent mismatch. | RENEW-005, RENEW-003, AGENT-003 |
| 19 | Retention figures reconcile to Stripe to the cent and expose exceptions. | REPORT-001 |
| 20 | Quarterly NRR and GRR retain their starting cohort, movement and source rows. | REPORT-001, BILLING-003 |
| 21 | The renewal runway shows owners, stages, risks and notice dates. | RENEW-001, ACCOUNT-003 |
| 22 | QBR decks summarize account evidence with editable slides and linked source figures. | REVIEW-001 |
| 23 | Success plans and customer outcomes feed the review and renewal work. | PLAN-001, PORTAL-001, REVIEW-001 |
| 24 | Buoy takes over incumbent-written Salesforce fields on their existing scales without blanking reports and dashboards. | CRM-004, MIGRATE-006 |
| 25 | Move-in carries companies, 52 weeks of health, contacts, tasks, playbooks, success plans, NPS, activities and custom objects. | MIGRATE-001, MIGRATE-007, ACCOUNT-006 |
| 26 | Also moves in from ChurnZero, Totango, Planhat, Vitally and Velaris. | MIGRATE-002, MIGRATE-003, MIGRATE-004, MIGRATE-005 |
| 27 | Run Buoy on your own computer, with source and data under your control. | BOUNDARY-005, RESTORE-001 |
| 28 | Illustrated Cascade renewal is signed six weeks early with retained terms and source evidence. | RENEW-001, RENEW-005, AGENT-003 |

## Status

Judged from the code and tests at commit `e89d4a74a47b5368483be8dc56a5ed6caa524db7` (28 October 2026). IMPORT-001 proof is at `18d87e4bd5433b97d01db3684e7fa0b6342cf18a`; the submitted candidate is Git commit `HEAD`, reported with its exact Verify SHA.

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 6 | 2 | 0 | 8 |
| Target and push further | 19 | 40 | 47 | 106 |
| All | 25 | 42 | 47 | 114 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `HTTP-001` | Authenticated product HTTP | published | partial | `src/buoy/access.ts`; `src/buoy/api.ts`; `src/buoy/core.ts`; `src/buoy/work.ts`; `docs/agents.md`; `tests/flows.test.mjs` | Not asserted by the cited baseline evidence: Every product route has the named actor matrix; the cited file exercises a route inventory but does not assert this whole matrix; No-Origin bearer preparation succeeds and its saved proposal identifies the agent; Foreign-Origin bearer preparation succeeds and its saved audit identifies the agent; Valid bearer plus cookie keeps only bearer scope; Invalid bearer plus cookie cannot authorize cross-origin writes; Expired bearer plus cookie cannot authorize cross-origin writes; Revoked bearer plus cookie cannot authorize cross-origin writes. Asserted: Signed-out data read is refused; Cross-origin browser account write is refused; Member account edit is refused; Member person-approval is refused; Held-policy bearer person-approval is refused; Held-policy bearer account edit is refused; Unsupported bearer command is refused with a reason. |
| `DATA-001` | Provenanced, validated observations | published | done | `src/buoy/health.ts`; `src/buoy/settings.ts`; `src/buoy/currencies.ts`; `src/buoy/imports/validation.ts`; `migrations/core/0018_buoy_settings.sql`; `src/buoy/ui/account.ts`; `tests/flows.test.mjs` |  |
| `APPROVAL-001` | Revision-bound human approval | published | done | `src/buoy/work.ts`; `tests/flows.test.mjs` |  |
| `IMPORT-001` | Reviewed move-in custody | published | done | `tests/import-door-journey.mjs` — importDoorJourney, invoked by the HTTP-001 IMPORT-001 operator and Business door authority journey in `tests/flows.test.mjs`: (1) original-byte upload and unchanged native planning; (2) wrong fingerprint refusal, exact reviewed apply, same-job replay, native reconciliation and undo; (3) native edit and dependent-work undo refusals; (4) every native action under anonymous, member, revoked-session and cross-origin conditions, all eight disabled and revoked Business actions, action-bound grants and unchanged public reads; (5) both provisioning variants, durable disable and permanent key revocation; (6) importErasure in `tests/import-door-erasure.mjs`, complete retained job and journal reads, upload and snapshot withdrawal, catch-up and Business archive replay refusal. `tests/portable.mjs` — real installation archive journey, restarted custody and restored native source replay refusal. `tests/a11y-import.mjs` — importJourney, owner review, apply, reconciliation and undo at 1440 and 390 through the shipped page. | |
| `ERASE-001` | Owner erasure with tombstones | published | done | `src/buoy/imports/index.ts`; `src/buoy/api.ts`; `tests/flows.test.mjs` — IMPORT-001 ERASE-001 door undo preserves dependent work and owner erasure withdraws door custody; `tests/import-door-journey.mjs` — accountErasureJourney (complete state, job, journal, history, status and paginated audit reads; unrelated records and opaque evidence; refused member erasure and confirmation; tombstone and inert replay); `tests/portable.mjs`; `migrations/core/0044_buoy_scorecard_source_custody.sql`; `tests/scorecard-custody-journey.mjs` |  |
| `RESTORE-001` | Portable installation archives | published | partial | `scripts/installer/local.mjs`; `tests/portable.mjs` | SCALE-001 archive volumes are unproven; usable installations remain capped at 500 accounts. |
| `SITE-001` | Public run site | published | done | `tests/site.mjs` — Run-site journey: Cloudflare static-asset crawl reaches the homepage, run instructions and docs, checks public links and fragments, and returns 404 for an unknown path; Owner-guide content: every emitted Markdown article has its own visible headings, paragraphs, list items, commands, inline code and links at 1440 pixels. Release captures cover every guide at 1440 and 390 pixels. |  |
| `STYLE-001` | One theme at every width | published | done | `public/rer-theme.css`; `public/fonts/fonts.css`; `public/brand/mark.svg`; `public/favicon-32.svg`; `src/site/`; `public/buoy.css`; `public/buoy-runway.css`; `src/buoy/ui/`; `tests/style.mjs` |  |
| `ACCOUNT-001` | Account hierarchy, people and ownership | target | done | `src/buoy/hierarchy.ts`; `src/buoy/scorecards/assignments.ts`; `src/buoy/fields/`; `src/buoy/activity.ts`; `src/buoy/ui/hierarchy.ts`; `migrations/core/0050_buoy_hierarchy.sql`; `tests/hierarchy-journey.mjs`; `tests/flows.test.mjs`; `src/buoy/hierarchy-approval.ts`; `tests/hierarchy-browser.mjs`; `tests/record-browser.mjs`; `tests/record-portability.mjs`; `tests/portable.mjs` |  |
| `ACCOUNT-002` | Unified customer timeline | target | partial | `src/buoy/ui/account.ts`; `src/buoy/core.ts`; `src/buoy/usage/read.ts`; `src/buoy/inapp/`; `tests/usage-journey.mjs`; `tests/inapp-journey.mjs`; `tests/inapp-browser.mjs`; `src/buoy/activity.ts`; `tests/hierarchy-journey.mjs` | Connected CRM/billing/support/inbox/calendar account/contact timelines, notes with mentions/attachments and the original multi-source acceptance remain unproved. Native source/person/kind filtering now exists for attributed current records; this is not a connected timeline. |
| `ACCOUNT-003` | Workspaces, lists and saved views | target | partial | `src/buoy/workspace.ts`; `src/buoy/ui/workspace.ts`; `migrations/core/0048_buoy_workspaces.sql`; `tests/workspace-journey.mjs`; `tests/flows.test.mjs`; `tests/workspace-browser.mjs`; `tests/record-browser.mjs`; `tests/record-portability.mjs`; `tests/portable.mjs` | Current native account/user filters, columns, sorting, personal/shared live definitions, reviewed idempotent assignment/one-step and multi-step enrollment/static-segment actions and CSM/manager home now ship. Calendar meetings remain unavailable under MEET-001; future ROLE-001 CSM permissions and PLAY-001 new step kinds retain their obligations. |
| `ACCOUNT-004` | Custom fields, calculated fields and field history | target | done | `tests/flows.test.mjs` — "ACCOUNT-004 typed fields, formulas, preview, history and segments", via `tests/field-journey.mjs`: typed fields; ten-account no-write preview and input explanations; saved calculations; exact persisted seats 20 to 30, utilization 0.5 to 0.75 and conditional 50 to 75 history with the current actor, source and valid UTC instant; unchanged state after stale-write refusal; typed segment inputs and erasure. `tests/fields-browser.mjs` — native typed-field, preview, calculation and history forms at 1440 and 390. `tests/flows.test.mjs` — "USAGE-001 ACCOUNT-004 SEGMENT-001 complete contact and user carrier", via `tests/customer-people-journey.mjs`, and `tests/customer-people-browser.mjs`: inherited customer field types, formulas, full-portfolio previews, source-owned history and same-person typed segments. |  |
| `ACCOUNT-005` | Search | target | partial | `src/buoy/search.ts`; `src/buoy/api.ts`; `docs/search.md`; `tests/search-journey.mjs`; `tests/flows.test.mjs`; `src/buoy/ui/search.ts`; `tests/record-browser.mjs` | Connected email-body search, plans and custom objects, connected Salesforce identities, ROLE-001 scoped read-only and commercial-field permissions, and the original 5,000-account/one-second acceptance remain unimplemented or unproven. The installation remains capped at 500 accounts. |
| `ACCOUNT-006` | Custom objects | target | missing |  | No custom objects, custom-object sections, lookups or custom sync jobs. |
| `CONNECT-001` | Connector framework, freshness and reconnection | target | partial | `tests/connections.mjs`; `tests/billing-journey.mjs`; `tests/connections-browser.mjs`; `tests/billing-browser.mjs`; `tests/renewal-journey.mjs`; `tests/billing-sandbox.mjs`; `tests/portable.mjs`; `tests/billing-portability.mjs` | BLOCKED: actual provider-side grant revocation and restoration proof requires a disposable Stripe test credential and Dashboard authority, neither held by this run. Invalid-key provider responses and local disconnection do not prove provider revocation. Key scope remains unverified. USAGE-004 retains file arrival-window acceptance; future provider clauses inherit the complete connected validation, provenance, freshness, confidence, notice and audit acceptance before shipping. |
| `IDENTITY-001` | Identity reconciliation and source authority | target | missing |  | No cross-system matching, review queue, merge or source authority. |
| `CRM-001` | Salesforce two-way sync | target | missing |  | No Salesforce sync, writeback, Activity writeback, custom jobs or Lightning component. |
| `CRM-002` | HubSpot two-way sync | target | missing |  | No HubSpot sync, writeback, engagement writeback or custom-object jobs. |
| `CRM-003` | Orbit native link | target | missing |  | No Orbit handoff receipt or context return. |
| `CRM-004` | Salesforce field handover at cutover | target | missing |  | No Salesforce cutover plan, shadow fields or field takeover. |
| `BILLING-001` | Stripe billing connector | target | done | `src/buoy/billing/`; `src/buoy/billing-evidence.ts`; `tests/billing-journey.mjs`; `tests/billing-pricing.mjs`; `tests/billing-browser.mjs`; `tests/billing-sandbox.mjs`; `tests/portable.mjs` |  |
| `BILLING-002` | Chargebee, Nectar and QuickBooks Online revenue sources | target | missing |  | No Chargebee, Nectar or QuickBooks Online connector. |
| `BILLING-003` | Subscription financial model | target | partial | `tests/billing-journey.mjs`; `tests/revenue-health-journey.mjs`; `tests/provider-reporting.mjs`; `tests/reporting-sandbox.mjs`; `tests/provider-reporting-browser.mjs`; `tests/revenue-health-browser.mjs`; `tests/portable.mjs`; `tests/record-portability.mjs` | Policy ruling pending, not an external block: the conservative adopted default lets only owners and admins record an audited review note for a source pair. It retains both values, selects no new authority, and keeps the financial variance visible in retention reports until the amounts agree. ct must approve whether that review-note meaning satisfies person-resolved reconciliation before this clause becomes done. Monthly boundaries use retained UTC reads, never reconstructed earlier observations; missing history stays unavailable. Confirmed terms retain their existing precedence, with separately labelled Stripe history. A resolution records an explanation for the exact retained source pair, keeps both sources and changes no authority; a new source version becomes pending again. Detailed provider history and resolution controls retain owner and admin authority. IDENTITY-001 owns later cross-source authority. BILLING-002 and BILLING-005 to BILLING-007 inherit monthly movements, actual source links and the approved person-resolved reconciliation semantics before their feeds ship. Supplied ruling is adopted without a status change; delegated/complete acceptance and proof remain required. |
| `BILLING-004` | Multi-currency subscriptions | target | done | `tests/provider-reporting.mjs`; `tests/billing-journey.mjs`; `tests/reporting-journey.mjs`; `tests/forecast-journey.mjs`; `tests/reporting-sandbox.mjs`; `tests/provider-reporting-browser.mjs`; `tests/reporting-browser.mjs`; `tests/record-portability.mjs`; `tests/portable.mjs` |  |
| `BILLING-005` | Salesforce and HubSpot revenue sources, including Salesforce CPQ | target | missing |  | No revenue from opportunity products, Contracts, CPQ subscriptions or HubSpot line items. |
| `BILLING-006` | Zuora billing connector | target | missing |  | No Zuora connector. |
| `BILLING-007` | Subscription and invoice feeds from a warehouse or file | target | missing |  | No warehouse or file billing feed. |
| `SUPPORT-001` | Zendesk connector | target | missing |  | No Zendesk connector. |
| `SUPPORT-002` | Intercom and HappyToHelp connectors | target | missing |  | No Intercom or HappyToHelp connector. |
| `SUPPORT-003` | Customer-success context inside Zendesk and Intercom | target | missing |  | No Zendesk sidebar app, Intercom inbox app or field writeback. |
| `SUPPORT-004` | Support cases and tickets from Salesforce and HubSpot | target | missing |  | No Salesforce Case or HubSpot ticket sync, measures or writeback. |
| `SUPPORT-005` | Freshdesk and ServiceNow connectors | target | missing |  | No Freshdesk or ServiceNow connector. |
| `USAGE-001` | Segment and event API ingestion | target | done | `src/buoy/usage/`; `src/buoy/ui/usage.ts`; `migrations/core/0032_buoy_usage.sql`; `sdk/usage.mjs`; `sdk/relay.mjs`; `public/buoy-usage.js`; `tests/usage-journey.mjs`; `src/buoy/people/`; `src/buoy/usage/mappings.ts`; `migrations/core/0034_buoy_people.sql`; `migrations/core/0035_buoy_usage_mappings.sql`; `tests/customer-people-journey.mjs`; `tests/customer-people-browser.mjs`; `tests/usage-browser.mjs`; `tests/portable.mjs`; `docs/usage.md`; `docs/people.md` |  |
| `USAGE-002` | Warehouse sync with Snowflake, BigQuery, Redshift and Databricks | target | missing |  | No Snowflake, BigQuery, Redshift or Databricks sync or export. |
| `USAGE-003` | Amplitude, Mixpanel and Pendo connectors | target | missing |  | No Amplitude, Mixpanel or Pendo connector. |
| `USAGE-004` | Scheduled file sources from Amazon S3, SFTP and Google Sheets | target | missing |  | No S3, SFTP or Google Sheets file source, archive or error folders. |
| `ADOPT-001` | Adoption and license metrics | target | done | `src/buoy/adoption/`; `src/buoy/ui/adoption.ts`; `migrations/core/0036_buoy_adoption.sql`; `docs/adoption.md`; `tests/adoption.mjs`; `tests/adoption-browser.mjs`; `src/buoy/adoption/segment-inputs.ts`; `tests/adoption-segment-journey.mjs`; `tests/adoption-segment-browser.mjs`; `migrations/core/0038_buoy_person_licenses.sql`; `src/buoy/adoption/licenses.ts`; `src/buoy/ui/adoption-licenses.ts`; `tests/adoption-license-journey.mjs`; `tests/adoption-license-browser.mjs`; `tests/portable.mjs`; `src/buoy/adoption/consumers.ts`; `src/buoy/adoption/consumers-model.ts`; `src/buoy/adoption/consumers-alerts.ts`; `src/buoy/ui/adoption-consumers.ts`; `migrations/core/0039_buoy_adoption_consumers.sql`; `tests/adoption-consumer-journey.mjs`; `tests/adoption-consumer-browser.mjs`; `tests/adoption-consumers.mjs`; `tests/adoption-aggregate-journey.mjs`; `tests/adoption-aggregate-browser.mjs` |  |
| `PRODUCT-001` | Product issues and feature requests linked to accounts | target | missing |  | No issue or feature-request links. |
| `HEALTH-001` | Configurable, explainable health scores | target | done | `src/buoy/scorecards/`; `src/buoy/scorecard-health.ts`; `src/buoy/ui/scorecards.ts`; `migrations/core/0041_buoy_scorecards.sql`; `tests/health-scorecard-journey.mjs`; `tests/health-scorecard-browser.mjs`; `tests/portable.mjs`; `tests/revenue-health-journey.mjs`; `tests/revenue-health-browser.mjs`; `tests/survey-scorecard-journey.mjs`; `tests/related-health-journey.mjs`; `tests/survey-scorecard-browser.mjs`; `tests/scorecard-custody-journey.mjs` |  |
| `HEALTH-002` | CSM sentiment and manual measures | target | partial | `src/buoy/sentiment.ts`; `src/buoy/health.ts`; `migrations/core/0017_buoy_sentiment.sql`; `src/buoy/ui/account.ts`; `tests/flows.test.mjs` | Not asserted by the cited baseline evidence: Agent-authored equivalent is classified standard and decided by actual company policy. Asserted: Person sentiment changes health; Reason identifies person and judgment; Expiry makes sentiment missing; Sentiment counts on expiry date; Held-policy agent rating is refused. |
| `SIGNAL-001` | Risk and opportunity alerts | target | partial | `src/buoy/health.ts`; `src/buoy/adoption/consumers-alerts.ts`; `src/buoy/ui/adoption-consumers.ts`; `tests/adoption-consumer-journey.mjs`; `tests/adoption-aggregate-journey.mjs`; `tests/adoption-consumer-browser.mjs`; `tests/adoption-aggregate-browser.mjs`; `src/buoy/adoption/dismissals.ts`; `src/buoy/ui/signal-dismissal.ts`; `migrations/core/0045_buoy_signal_dismissals.sql`; `tests/signal-dismissal-journey.mjs`; `tests/flows.test.mjs`; `tests/portable.mjs` | Signals over all other fields/events and changes, chosen Slack/Teams channels, separate snooze controls and expansion-opportunity creation remain absent. The full usage-drop/utilization upsell acceptance is not met. |
| `SEGMENT-001` | Segments, tiers and lifecycle stages | target | partial | `src/buoy/segments/rules.ts`; `src/buoy/segments/snapshot.ts`; `src/buoy/segments/index.ts`; `src/buoy/ui/segments.ts`; `src/buoy/team-plan.ts`; `src/buoy/work.ts`; `migrations/core/0025_buoy_segments.sql`; `migrations/core/0027_buoy_tiers.sql`; `docs/segments.md`; `tests/segment-journey.mjs`; `tests/flows.test.mjs`; `tests/segments.mjs`; `src/buoy/people/model.ts`; `tests/customer-people-journey.mjs`; `tests/customer-people-browser.mjs` | Not asserted by the cited baseline evidence: CSV membership and count reconcile across every row; the cited assertions match one account name rather than the complete result. Asserted: Initial entry has timestamp and correct account; Exactly one approved task is created; Inclusive threshold exits and is timestamped; Different currencies do not mix; Reentry has a new distinct proposal; Report has exact selected account and risk count; CSV includes selected account; Reads and Cron do not duplicate entries; Stale account revision refuses approval; Stale configuration refuses approval; Exited-entry approval is refused after exit; Used custom tier cannot be removed; Member cannot edit tier list; Custom tier is returned after manual classification; Static-list membership; Typed any rules; Missing rules; Manual tier/stage clearing; Import membership refresh; Sentiment expiry membership; Team allocation from segment; Erasure removes membership; Member mutation is refused; Native form end states at 1440; Native form end states at 390. |
| `PLAY-001` | Automated playbooks | target | partial | `src/buoy/play/`; `src/buoy/ui/playbooks.ts`; `migrations/core/0052_buoy_playbooks.sql`; `tests/play-journey.mjs`; `tests/flows.test.mjs`; `tests/play-browser.mjs`; `tests/record-browser.mjs`; `tests/portable.mjs` | Automatic email/Slack/Teams/webhook/Crank delivery, email drafts, onboarding/general event triggers remain required. The exact health-below-50, usage-recovery, approval-gated send and Slack-post acceptance is not fully proved. Receipt recording never claims provider verification. Full inherited PLAY-004 acceptance for every automated step remains unproved. Supplied ruling is adopted without a status change; delegated/complete acceptance and proof remain required. |
| `PLAY-002` | Tasks, reminders and escalation | target | done | `src/buoy/tasks.ts`; `src/buoy/reminders.ts`; `src/buoy/work.ts`; `src/buoy/settings.ts`; `src/server.ts`; `migrations/core/0022_buoy_task_owners.sql`; `wrangler.jsonc`; `deploy.json`; `docs/playbooks.md`; `tests/flows.test.mjs` |  |
| `PLAY-003` | Automation run history and failure alerts | target | partial | `src/buoy/play/engine.ts`; `tests/play-journey.mjs`; `tests/flows.test.mjs`; `tests/play-browser.mjs`; `tests/record-browser.mjs`; `tests/portable.mjs` | Real webhook transport failure/retry, Slack threshold delivery, unified journey/connector logs and connector retry/threshold integration remain unproved. External-work receipts are manual reports, not executed webhook calls. Supplied ruling is adopted without a status change; delegated/complete acceptance and proof remain required. |
| `PLAY-004` | Outcome tracking for playbooks | target | partial | `src/buoy/outcomes/index.ts`; `src/buoy/outcomes/observe.ts`; `src/buoy/outcomes/report.ts`; `src/buoy/ui/outcomes.ts`; `migrations/core/0026_buoy_outcomes.sql`; `docs/outcomes.md`; `tests/outcome-journey.mjs`; `tests/flows.test.mjs`; `tests/outcomes.mjs` | Not asserted by the cited baseline evidence: Native report timing equals the independently calculated elapsed time at 1440 and 390; a nonnegative API mean does not assert displayed timing; The browser CSV end state reconciles every cohort, rate and timing field rather than matching one account name. Asserted: Enrolled and control cohorts each contain forty accounts; Correct enrolled list; Correct control list; Recovery rates are fifty and twelve-and-a-half percent; First-observed elapsed times match timestamps; Mean elapsed time equals independent mean; CSV has eighty records and twenty-five reached outcomes; Already-satisfied baseline is refused; Member outcome start is refused; Window is exactly two days; Replay returns same outcome window; Segment edit preserves frozen cohorts; Repeated observation preserves first evidence; Renewal outcome uses approved decision evidence; At-deadline observation counts; Window-missed outcomes are read back; Late recovery does not count; Reports never complete tasks; Erasure removes enrolled evidence; Rate/timing and comparison form end states at 1440; Evidence is shown at 1440; CSV read-back at 1440; Rate/timing and comparison form end states at 390; Evidence is shown at 390; CSV read-back at 390. |
| `ONBOARD-001` | Onboarding projects | target | missing |  | No onboarding projects or expansion-triggered starts. |
| `PLAN-001` | Shared success plans and goals | target | partial | `tests/plan-journey.mjs`; `tests/portal-journey.mjs` (portalJourney and portalWithdrawalJourney); `tests/plan-outcome-journey.mjs` (planOutcomeJourney); `tests/plan-browser.mjs`; `tests/portal-browser.mjs`; `tests/flows.test.mjs`; `tests/record-browser.mjs`; `tests/portable.mjs` | Customer sharing, revision-bound authenticated statements, selected task completion, comments and objective milestone observations are implemented under the candidate’s conservative owner-only sharing default. Delegated CS manager and CSM plan editing and retained review access remain unproved. Complete inherited PLAY-004 rendered timing and CSV reconciliation proof remains owed. Restored staff assignments confer no authority. |
| `PORTAL-001` | Customer collaboration portal | target | partial | `tests/portal-journey.mjs` (portalJourney and portalWithdrawalJourney); `tests/portal-browser.mjs` (portalBrowser through the plans browser suite); `tests/portable.mjs` | Owner-issued email invitations, recipient-only reviewed plan access, selected tasks, comments and customer confirmation are implemented. File uploads, company SSO, onboarding-project tasks and general customer plan editing remain unbuilt. Native invitation proof substitutes the mail-provider edge; live received-message proof and approval of the candidate’s conservative sharing default remain pending. |
| `REVIEW-001` | Business review preparation and decks | target | partial | `src/buoy/reviews/`; `src/buoy/ui/reviews.ts`; `src/buoy/activity.ts`; `migrations/core/0062_buoy_reviews.sql`; `migrations/core/0063_buoy_review_holds.sql`; `docs/reviews.md`; `tests/review-journey.mjs`; `tests/record-browser.mjs`; `tests/record-portability.mjs`; `tests/portable.mjs` | Direct Google Slides export needs an authorized Google product connection. Connected-source completeness, historical adoption/support review windows and a Unicode PDF font remain. Supplied ruling is adopted without a status change; delegated/complete acceptance and proof remain required. |
| `EMAIL-001` | Two-way email through Gmail and Microsoft 365 | target | missing |  | No mailbox connection, sending, threading or one-to-one tracking. |
| `EMAIL-002` | Sending controls and consent | target | missing |  | No send windows, caps, unsubscribe or suppression. |
| `EMAIL-003` | Journey sending provider and domain authentication | target | missing |  | No sending provider, domain verification, one-click unsubscribe or complaint handling. |
| `EMAIL-004` | Gmail and Outlook sidebar | target | missing |  | No Gmail add-on or Outlook add-in. |
| `JOURNEY-001` | Digital customer success journeys | target | missing |  | No journeys. |
| `INAPP-001` | In-app messages and guides | target | done | `src/buoy/inapp/`; `src/buoy/ui/inapp.ts`; `migrations/core/0037_buoy_inapp.sql`; `sdk/inapp.mjs`; `sdk/relay.mjs`; `public/buoy-inapp.js`; `docs/inapp.md`; `tests/inapp-journey.mjs`; `tests/flows.test.mjs`; `tests/inapp-browser.mjs`; `tests/portable.mjs` |  |
| `MEET-001` | Calendar capture | target | missing |  | No calendar capture or meeting briefs. |
| `MEET-002` | Call recordings and transcripts | target | missing |  | No recording, transcript or dialer import. |
| `CHAT-001` | Slack, Microsoft Teams and Nook alerts and actions | target | missing |  | No Slack, Teams or Nook integration. |
| `SURVEY-001` | NPS and CSAT relationship surveys | target | partial | `src/buoy/surveys/`; `src/buoy/ui/surveys.ts`; `migrations/core/0043_buoy_survey_responses.sql`; `tests/survey-scorecard-journey.mjs`; `tests/survey-scorecard-browser.mjs`; `tests/portable.mjs` | Survey authoring/delivery by email/in-app, scheduling/event triggers, the 300-contact 90-day send throttle, detractor/promoter playbooks and mapped Pencil/Typeform/SurveyMonkey imports remain absent. Staff-recorded observations do not claim provider delivery. |
| `NOTIFY-001` | In-app notifications and digests | target | done | `src/buoy/notify.ts`; `src/buoy/notify-mail.ts`; `src/buoy/ui/notifications.ts`; `src/buoy/api.ts`; `src/server.ts`; `migrations/core/0023_buoy_inbox.sql`; `docs/providers.md`; `tests/flows.test.mjs`; `tests/notifications.mjs` |  |
| `RENEW-001` | Renewal pipeline | target | partial | `src/buoy/renewals/`; `src/buoy/ui/renewals.ts`; `migrations/core/0047_buoy_renewals.sql`; `tests/renewal-journey.mjs`; `tests/flows.test.mjs`; `tests/renewal-browser.mjs`; `tests/record-browser.mjs`; `tests/record-portability.mjs`; `tests/portable.mjs`; `src/buoy/renewals/billing.ts`; `tests/billing-portability.mjs`; `tests/renewal-sandbox.mjs` | Not asserted by the cited baseline evidence: Each stage movement and required outcome approval, including churn reason, is asserted on the stated provider scenario. Asserted: No renewal is generated before the lead window; Each twelve-contract renewal is created once across quarters; Notice deadline matches terms; Expected ARR matches source contract; Twelve provider subscriptions become twelve unique renewals; Provider end and notice dates match; Billing actual independently reconciles churn and contraction; Billing source link points to retained snapshot. |
| `RENEW-002` | Expansion pipeline and CS-qualified leads | target | missing |  | No expansion pipeline or lead handoff. |
| `RENEW-003` | CRM renewal opportunity sync | target | missing |  | No CRM renewal opportunity sync. |
| `RENEW-004` | Renewal forecast | target | done | `src/buoy/renewals/forecast.ts`; `src/buoy/ui/forecast.ts`; `migrations/core/0060_buoy_forecast_snapshots.sql`; `docs/renewals.md`; `tests/forecast-journey.mjs`; `tests/record-browser.mjs`; `tests/renewal-journey.mjs`; `tests/record-portability.mjs`; `tests/billing-portability.mjs`; `tests/portable.mjs` |  |
| `RENEW-005` | Renewal paperwork and terms | target | partial | `src/buoy/imports/validation.ts`; `tests/flows.test.mjs` | Contract imports and signature round-trips are absent. |
| `REPORT-001` | NRR, GRR and retention reporting | target | done | `tests/provider-reporting.mjs`; `tests/reporting-sandbox.mjs`; `tests/provider-reporting-browser.mjs`; `tests/reporting-journey.mjs`; `tests/roles-reports.mjs`; `tests/reporting-browser.mjs`; `tests/record-portability.mjs`; `tests/portable.mjs` |  |
| `REPORT-002` | Dashboards and report builder | target | partial | `src/buoy/reports/`; `src/buoy/ui/reports.ts`; `migrations/core/0061_buoy_reports.sql`; `docs/reports.md`; `tests/dashboard-journey.mjs`; `tests/record-browser.mjs` | Other object kinds, the full prebuilt dashboard catalog and historical trend/engagement/onboarding measures, and scheduled email/Slack parity remain. Supplied ruling is adopted without a status change; delegated/complete acceptance and proof remain required. |
| `ROLE-001` | Roles and permissions | target | partial | `src/buoy/roles/`; `src/buoy/ui/roles.ts`; `src/buoy/ui/scoped.ts`; `tests/roles-journey.mjs`; `tests/roles-browser.mjs`; `tests/roles-workspace.mjs`; `tests/roles-account-edit.mjs`; `tests/roles-reports.mjs`; `tests/roles-renewal-approval.mjs` | Full UI/API matrix remains unproved: linked/custom-object records, commercial-field edits, publishing, complete-data exports, concession approval execution, scoped agents and inherited surfaces remain. Sales CRM scope awaits CRM identities. Supplied ruling is adopted without a status change; delegated/complete acceptance and proof remain required. |
| `ROLE-002` | Single sign-on and provisioning | target | partial | `src/modules/operator-auth/identity/oidc/presets.mjs` | No Buoy test exercises SSO; SAML and SCIM are absent. |
| `TEAM-001` | Books of business and reassignment | target | partial | `src/buoy/team.ts`; `src/buoy/team-plan.ts`; `src/buoy/tasks.ts`; `src/buoy/ui/team.ts`; `src/buoy/ui/team-actions.ts`; `src/buoy/ui/account.ts`; `migrations/core/0024_buoy_teams.sql`; `docs/books.md`; `tests/team-journey.mjs`; `tests/flows.test.mjs`; `tests/teams.mjs` | Not asserted by the cited baseline evidence: Every open plan moves with the book; the cited team journey covers tasks but no plan fixture. Asserted: Three hundred accounts are previewed; Four CSMs receive seventy-five accounts each; Recorded owner counts match capacity allocation; All open tasks move; Each moved account has actor/time/handover note. |
| `AUDIT-001` | Durable audit log | target | partial | `src/buoy/core.ts`; `src/buoy/audit.ts`; `src/buoy/audit-records.ts`; `src/buoy/access-audit.ts`; `migrations/core/0020_buoy_durable_events.sql`; `migrations/core/0021_buoy_audit_doors.sql`; `src/buoy/ui/audit.ts`; `src/auth.server.ts`; `tests/portable.mjs`; `tests/flows.test.mjs`; `src/buoy/connectors/index.ts`; `src/buoy/adoption/consumers.ts`; `tests/connections.mjs`; `tests/adoption-consumer-journey.mjs`; `tests/health-scorecard-journey.mjs`; `tests/survey-scorecard-journey.mjs`; `tests/revenue-health-journey.mjs` | Not asserted by the cited baseline evidence: Every external-send audit action is asserted through an executed external send; Erased-contact audit survival is asserted for the named contact scenario; Export and screen reconcile the complete action set across all pages. Asserted: Sign-ins have actor, time and anonymous subject; Role changes preserve action detail and actor; Approvals remain exactly once; Erased-account actions remain without account or actor display name. |
| `SECURE-002` | Connector credential custody | target | partial | `src/buoy/connectors/vault.ts`; `src/buoy/connectors/index.ts`; `src/buoy/connectors/sync.ts`; `src/buoy/connectors/stripe.ts`; `scripts/installer/local.mjs`; `tests/connections.mjs`; `tests/connections-browser.mjs`; `tests/portable.mjs` | Salesforce and Slack connectors and their full multi-provider custody acceptance remain absent. Stripe test-key syntax and GET-only use do not verify provider-side least-privilege grants; local disconnect does not claim provider-side key revocation. |
| `ERASE-002` | Contact-level privacy requests | target | partial | `src/buoy/privacy.ts`; `migrations/core/0046_buoy_person_privacy.sql`; `src/buoy/ui/privacy.ts`; `tests/erase-journey.mjs`; `tests/flows.test.mjs`; `tests/privacy-browser.mjs`; `tests/record-browser.mjs`; `src/buoy/privacy/`; `migrations/core/0051_buoy_privacy_requests.sql`; `tests/portable.mjs`; `src/buoy/privacy/native-text.ts`; `migrations/core/0064_buoy_privacy_hold_versions.sql` | Not yet built or proved: reviewed redaction of other retained source snapshots and other free text outside the listed usage and native narrative fields; email and timeline connector records; connected Salesforce and Zendesk discovery and deletion notices; the ROLE-001 scoped privacy role; granular record holds. Later linked versions are captured under whole-customer holds; coverage beyond the tested customer fields and account evidence remains unproved. Recorded external holders remain unverified. Legacy SHA fences are wrapped on first privacy or intake access; archives made before that access can still contain legacy digests. Earlier archives and downloads remain separately owned. |
| `API-001` | Public API and webhooks | target | partial | `src/buoy/integration/index.ts`; `src/buoy/integration/openapi.ts`; `docs/integration-api.md`; `tests/flows.test.mjs`; `tests/integration-journey.mjs`; `tests/portable.mjs` | ct approved the account foundation with riders on 26 October 2026 at 2890e26a05ac289fce7d13508efb4f3f9a59dd06. Remaining: version 1 events with reviewed user and group attribution; admin issuance bounded by the issuer's record scope and commercial-field rules, and separate read and write scopes for every remaining record kind; the native credentials screen presenting the proven owner inventory of labels, issuer, creation, last use, expiry flags and stop reasons, including named withdrawals before account erasure; contacts, users, metrics, tasks, plans, opportunities, timeline entries, and custom-object definitions and records with bulk external-ID upsert; outbound signed webhooks with retries and a delivery log after their own ruling; Zapier, Make and Crank use of this API, with OpenAPI coverage of every record kind. All-accounts grants, secret-free owner inventory and credential issuance and first-revocation audit assertions now run through integrationJourney; the native account browser mode is loaded by the settings-browser Verify suite. |
| `MIGRATE-001` | Gainsight CS migration | target | missing |  | IMPORT-001 accepts Buoy's own account JSON only; no Gainsight mapping, including custom objects. |
| `MIGRATE-002` | ChurnZero migration | target | partial | `tests/migrate-journey.mjs` — ChurnZero accounts reconcile twenty explicit mappings and protect reviewed custody; paused journey drafts retain every definition element without execution authority; existing Imports screen reviews migration bundles; `tests/churnzero-api-journey.mjs` — churnzeroApiJourney; `tests/churnzero-export-journey.mjs` — churnzeroExportJourney; `tests/churnzero-journey.mjs`; `tests/churnzero-portability.mjs` — seedChurnzeroArchive and assertChurnzeroRestored; `./fixtures/move-in/churnzero/README.md` | CSV, structured JSON exports and read-only OData account API preparation retain exact source bytes and digests, reviewed fingerprint approval, idempotent replay, field-by-field reconciliation and strict undo. Twenty-account mappings retain ChurnScore factors and paused native review drafts with documented journey and milestone structure, source identities, durations, progress thresholds, internal task and customer achievement templates and explicit unmapped source elements. Additional source collections remain explicitly unmapped with their record counts; they create no native contacts, work or sends. Source CSV and tenant-customized JSON schemas remain unverified and fixtures are synthetic. Remaining: native contacts, vendor scorecard definitions, operational tasks, plays, success plans, complete journey conditions and assignment semantics, events, NPS and API intake for those record kinds. A live ChurnZero tenant and its custom schema have not been verified; synthetic network edges prove the implemented account protocol only. Native paused review drafts are inert and are not complete executable journeys. Conservative default: owner-reviewed custody grants no execution, sharing or send authority; scoped delegation and provider boundaries remain unproved under the standing ct rule. The original full sample-export requirement remains unproved. |
| `MIGRATE-003` | Totango migration | target | partial | `tests/migrate-journey.mjs`; `tests/totango-api-journey.mjs` | Account mapping from segment CSV and documented account search API pages ships. Native users, health profiles, SuccessFlows arriving as paused playbooks with every step mapped or explicitly unmapped, tasks, touchpoints, segments, success plays and API intake for those other kinds remain. Totango flow categories have no ordered steps; no automation is inferred from a category label. A genuine SuccessPlay definition and native paused representation are still required. The original full sample-export acceptance is not met. VENDOR-SCHEMA: no genuine SuccessPlay definition artifact with documented semantics and available associations is supplied. DEFINITION-MAPPING: native paused definitions and definition reconciliation remain unbuilt; reference files are custody only and every element remains unmapped. PAUSED-INERTNESS and DEFINITION-CUSTODY: native definition trigger and schedule evaluation, durable native reconciliation, strict definition undo after edits or dependent work, reload and archive-restoration proof remain. OTHER-NATIVE-MAPPINGS and FULL-MIGRATION remain as listed above, including inherited delta, health history, privacy, audit and restore coverage. |
| `MIGRATE-004` | Planhat migration | target | missing |  | No Planhat mapping, including assets and custom objects. |
| `MIGRATE-005` | Vitally, Velaris and spreadsheet migration | target | partial | `src/buoy/migrate/source.ts`; `src/buoy/migrate/cli.mjs`; `docs/migrations.md`; `tests/migrate-journey.mjs` | Fixture-oriented Vitally and Velaris account bundles and a guided terminal CSV column mapper ship through the owner door. Native users, health, projects, tasks, notes and NPS mapping, incumbent APIs, direct Google Sheets access and the full original sample-export acceptance remain. The 2000-row preview includes 1997 rejected dates and three valid rows; it does not prove reconciliation of a full valid 2000-account book. The installation remains capped at 500 accounts. |
| `MIGRATE-006` | Parallel run and delta re-import | target | missing |  | No delta re-import, conflict preview or cutover record. |
| `MIGRATE-007` | Health history carried over | target | missing |  | No health history import. |
| `MOBILE-001` | Mobile apps | target | partial | `src/buoy/ui/`; `public/buoy.css` | Native apps, push and offline use are absent. |
| `A11Y-001` | Accessibility | target | partial | `src/buoy/ui/runway.ts`; `src/buoy/ui/work.ts`; `src/buoy/ui/browser.ts`; `src/buoy/ui/html.ts`; `tests/a11y.mjs`; `tests/a11y-auth.mjs`; `tests/a11y-import.mjs`; `tests/a11y-governance.mjs`; `tests/a11y-checks.mjs`; `tests/symbolic-labels.mjs`; `tests/a11y-contrast.mjs`; `tests/runway-keyboard.mjs`; `tests/fields-browser.mjs`; `tests/customer-people-browser.mjs`; `tests/usage-browser.mjs`; `tests/connections-browser.mjs`; `tests/adoption-browser.mjs`; `tests/adoption-license-browser.mjs`; `tests/adoption-segment-browser.mjs`; `tests/adoption-consumer-browser.mjs`; `tests/adoption-aggregate-browser.mjs`; `tests/inapp-browser.mjs`; `tests/health-scorecard-browser.mjs`; `tests/revenue-health-browser.mjs`; `tests/survey-scorecard-browser.mjs` | Not asserted by the cited baseline evidence: Playbook-builder, portal and future report screens complete the named keyboard and axe journey; Complete named sign-in/setup/expansion/dialog/recovery/preparation/approval/completion/export keyboard outcome set is asserted per width; Every runway table value is compared to public account data, beyond table count. Asserted: Every rendered chart has text alternative; Health color has a text label; Current keyboard/focus scenario assertions; Runway has every displayed account in semantic text table. |
| `SCALE-001` | Scale for a growing book | target | missing |  | `tests/scale-journey.mjs` now attempts the actual 10000-account/500000-user/50-million-event public Worker and archive journey outside push Verify. Run 20261022T214617142128Z-heavy-slot-0e8958d1 at 3c4e44ea044e245d7b2d196469561659ad14613e passed reviewed import/reconciliation, then D1 refused the directory load with BUOY_ACCOUNT_LIMIT / SQLITE_CONSTRAINT. Later outside-Verify run 20261022T221817625242Z-heavy-slot-70ce74e9 at 5c993c0bbd9bbf039b419f5057b00496709caf60 loaded 100000 actual retained events: D1 logical size grew 2433024 to 87977984 bytes, projecting 42774913024 bytes at 50 million, beyond the single-binding 10 GB limit. The full load was refused, with no reduced-volume pass. The 500-account guard remains; full volumes, hourly health, page/report timings and complete archive restore remain unproved. |
| `AI-001` | Cited account summaries and questions | target | done | `tests/flows.test.mjs`; `tests/ai-journey.mjs`; `tests/ai-browser.mjs`; `tests/ai-question-browser.mjs` |  |
| `AI-002` | Conversation and meeting summaries with proposed work | target | done | `tests/flows.test.mjs`; `tests/ai-journey.mjs`; `tests/portable.mjs`; `tests/ai-browser.mjs` |  |
| `AI-003` | Sentiment and risk from communications | target | partial | `tests/communication-journey.mjs`; `tests/flows.test.mjs`; `tests/communication-browser.mjs`; `tests/fixtures/communication-month.json`; `tests/communication-model.mjs` | Real-model risk-theme detection, Spearman correlation and nine-of-ten band accuracy remain unproved. Held model credential presence is confirmed, but provider test or sandbox account scope is not established; no model call or model-score result is claimed. |
| `AI-004` | Owner-selected models and data controls | target | done | `tests/flows.test.mjs`; `tests/ai-journey.mjs`; `tests/ai-browser.mjs`; `tests/portable.mjs` |  |
| `AI-005` | Cited generative answers | target | done | `src/buoy/ai/answers.ts`; `tests/flows.test.mjs`; `tests/ai-journey.mjs`; `tests/ai-browser.mjs`; `tests/ai-question-browser.mjs` |  |
| `AI-006` | Feature-specific consent for scheduled model work | target | done | `src/buoy/ai/schedules.ts`; `tests/flows.test.mjs`; `tests/ai-journey.mjs`; `tests/portable.mjs` |  |
| `BOUNDARY-001` | Not a billing processor | target | partial | `src/buoy/api.ts`; `tests/mail-runtime.mjs`; `tests/flows.test.mjs`; `tests/billing-journey.mjs`; `tests/billing-pricing.mjs`; `tests/billing-sandbox.mjs`; `tests/connections.mjs`; `tests/connections-browser.mjs` | Not asserted by the cited baseline evidence: Chargebee read-only scopes are inspected; Zuora read-only scopes are inspected; Salesforce revenue-object read permissions are inspected. Asserted: Route inventory has no money-moving paths; Every write route in inventory is exercised; Native outbound set contains only sign-in mail provider; Every current Stripe inventory request is GET. |
| `BOUNDARY-002` | Not the sales CRM, help desk, product analytics or marketing email platform | target | partial | `src/buoy/api.ts` | The sibling and incumbent connectors and owner setup guides it relies on are missing. |
| `BOUNDARY-003` | No guaranteed prediction | target | partial | `src/buoy/health.ts`; `src/buoy/segments/index.ts`; `src/buoy/outcomes/report.ts`; `src/buoy/ui/`; `tests/boundary.mjs`; `tests/health-scorecard-journey.mjs`; `tests/survey-scorecard-browser.mjs`; `tests/scorecard-custody-journey.mjs` | Not asserted by the cited baseline evidence: Every forecast and AI risk signal has closed-period accuracy against outcomes. Asserted: Current health has inputs, reasons and non-prediction interpretation; Current state and date-health doors agree; Segment assessments agree with current health; Closed outcome read equals retained report; Missing evidence is explicit; Stale evidence is explicit; Person sentiment is cited; Expired sentiment is named missing; CSV distinguishes source gaps; First-observed outcome survives disappearance of current sources; Current missing sources stay separate from old reached outcome; CSV names nonprediction and noncausation; Screen interpretation at 1440; Current health reasons at 1440; Closed outcome and current missing inputs at 1440; Reflow at 1440; Screen interpretation at 390; Current health reasons at 390; Closed outcome and current missing inputs at 390; Reflow at 390. |
| `BOUNDARY-004` | No bulk-mail network or consent bypass | target | partial | `src/buoy/audit.ts`; `src/buoy/access.ts`; `src/buoy/api.ts`; `migrations/core/0019_buoy_audit.sql`; `docs/agents.md`; `tests/flows.test.mjs` | Not asserted by the cited baseline evidence: Suppressed journey send is refused and audited; Unverified-domain journey send is refused and audited. Asserted: Held-policy agent discount refusal has reason; Held-policy preparation discount is refused with reason; Unknown discount command is refused with reason; Agent account edit is refused with reason; Term revision and proposals remain unchanged; Member cannot read action audit; All three refusals retain subject, reason and time; Every sent message has a single internal team recipient. |
| `BOUNDARY-005` | Certifications are the deployment's | target | done | `tests/site.mjs` — Run-site journey: code-derived connector, model, mail and OpenID provider inventory has data-flow sections and real terms links; Buyer-operated relay guide: independently checks server authentication, exact reviewed mapping, campaign content, all three receipt kinds, external copies, deployment responsibility and no fabricated provider or outbound call. `docs/providers.md`; `src/site/docs.ts`. |  |
| `GOVERN-001` | Agent authority and action ledger | push-further | partial | `src/buoy/access.ts`; `src/buoy/core.ts`; `src/buoy/api.ts`; `src/buoy/agent-policy/`; `src/buoy/ui/agents.ts`; `migrations/core/0031_buoy_agent_policy.sql`; `tests/governance.mjs`; `tests/governance-browser.mjs` | Not asserted by the cited baseline evidence: A send-within-policy grant executes a permitted email; A send-within-policy grant refuses an out-of-policy email; Provider notification fees are excluded from the metered-operation ledger, rather than inferred from zero spend; Budget/ledger label. Asserted: Prepare-only grant can prepare; Held-policy person-approval is refused; Held-policy discount is refused; Pause stops both grants; Metered agent spend is zero; Ledger redaction and outcome distinction; Preparation mail has single internal recipient; Expiry bounds are asserted; Invalid policy inputs are refused; Excluded classes do not leak through derived fields; Missing preparation classes are refused; Concurrent minute cap is enforced; Retry-After reaches next UTC minute; Pause creates no work; Revoked credential is refused; One-time token is shown at 1440; Actual form-selected grant is returned at 1440; Reload hides token at 1440; Pause stops token at 1440; Resume restores grant at 1440; Revoke invalidates token at 1440; One-time token is shown at 390; Actual form-selected grant is returned at 390; Reload hides token at 390; Pause stops token at 390; Resume restores grant at 390; Revoke invalidates token at 390. |
| `AGENT-001` | Verified risk resolution | push-further | partial | `src/buoy/work.ts`; `tests/flows.test.mjs` | Cross-source verification, multi-owner remedies and customer-confirmed outcomes are absent. |
| `AGENT-002` | Retention interventions measured against comparable accounts | push-further | done | `src/buoy/experiments/index.ts`; `migrations/core/0066_buoy_experiments.sql`; `docs/experiments.md`; `tests/flows.test.mjs`; `tests/outcome-journey.mjs` |  |
| `AGENT-003` | Evidence-backed renewal readiness | push-further | partial | `src/buoy/health.ts`; `src/buoy/work.ts`; `tests/flows.test.mjs` | Readiness checks, joint timelines and CRM and billing verification are absent. |
| `AGENT-004` | Portfolio-wide causes of risk | push-further | missing |  | No portfolio clustering. |
| `AGENT-005` | Scaled-tier digital CSM | push-further | missing |  | No scaled-tier agent. |
| `AGENT-006` | Onboarding follow-through | push-further | missing |  | No onboarding follow-through agent. |
| `AGENT-007` | Data trust upkeep | push-further | partial | `tests/flows.test.mjs`; `tests/trust-journey.mjs`; `tests/trust-browser.mjs` | Still unproved: separately scoped CS staff evidence reads and preparation with current revocation and account and commercial-field limits; scheduled connector watching; complete CRM, billing and support disagreement and stale-source coverage; duplicate resolution by approved undoable identity merge; approved per-field source authority and actual ARR source corrections; incorrect Segment-group detection beyond explicit native-ID hints and independent verification of the claimed target membership; complete fingerprint invalidation, atomic approved correction, both numerical health updates and visible change notes; and complete data-trust custody, erasure and inactive restore. A source hint, owned fix task or retained billing snapshot is not verified identity, resolved disagreement or fresh provider acceptance. A live Stripe test-mode receipt for this trust journey remains unestablished. Scheduled and model authority and future agent access require their own explicit authorization and proof. The complete original acceptance sentence remains owed; no scope is carved out. |
| `AGENT-008` | Plain-language configuration | push-further | partial | `tests/flows.test.mjs`; `tests/configuration-journey.mjs`; `tests/configuration-browser.mjs`; `tests/portable.mjs`; `tests/configuration-portability.mjs` | Not asserted by the cited baseline evidence: Configuration calls enforce provider-bound credential selection, metered budget and Pause before effects; the cited configuration bodies do not assert this complete guard set. Asserted: Signal definition has exact weekly-drop and urgent-ticket predicates; Preparation and backtest publish no signal; Twelve-month fire count matches seeded expectation; Distinct churn capture matches expected denominator; Exact-fingerprint approval is required in held slice; Publication returns one definition; Scorecard draft; Segment draft; Playbook draft; Report draft; Complete outgoing body contains only description/schema/instructions; Weekly drop and urgent-ticket conjunction has independent account-week matches; Backtest spans exact twelve-month window; Fire count and churn capture are independently expected; Equal-timestamp retained-scorecard ordering is asserted on the exact historical source image; Missing history remains visibly missing; Wrong exact fingerprint is refused; Replay returns same definition; Exactly one definition is published; Pause has one audit action; Paused fresh-day signal suppresses new notices; Active control still produces new fresh-day notices; Account erasure withdraws every dependent configuration draft; Restored archive excludes pending person-approval authority for every draft kind; Request consent refusal makes no model request; Changed model policy invalidates publication; Disabled model hides configuration preparation; An explicitly skipped historical week remains absent; Usable current inputs do not fabricate history for the history-free account; Missing account-week count equals exact independently expected 107; Scorecard replay keeps one native version; Segment/report/playbook replay preserves the complete definition set. |
| `SURFACE-001` | Complete customer-success registry | target | missing |  | MCP registry, server classifiers and the two-policy specialist conformance journey are not implemented. |
| `SURFACE-002` | Internal work and outside exposure | target | missing |  | MCP registry, server classifiers and the two-policy specialist conformance journey are not implemented. |
| `SURFACE-003` | Commercial facts and binding decisions | target | missing |  | MCP registry, server classifiers and the two-policy specialist conformance journey are not implemented. |
| `SURFACE-004` | Customer access and protective settings | target | missing |  | MCP registry, server classifiers and the two-policy specialist conformance journey are not implemented. |
| `SURFACE-005` | Irreversible and regulated customer data | target | missing |  | MCP registry, server classifiers and the two-policy specialist conformance journey are not implemented. |
| `SURFACE-006` | Provider setup and running automation | target | missing |  | MCP registry, server classifiers and the two-policy specialist conformance journey are not implemented. |
| `SURFACE-007` | Source-linked customer resources | target | missing |  | MCP registry, server classifiers and the two-policy specialist conformance journey are not implemented. |
| `SURFACE-008` | Outcome events and specialist handoffs | target | missing |  | MCP registry, server classifiers and the two-policy specialist conformance journey are not implemented. |
| `SURFACE-009` | A seeded week through MCP | target | missing |  | MCP registry, server classifiers and the two-policy specialist conformance journey are not implemented. |
