# Changelog

## 2026-10-19

- Tasks have an owner, priority and type. An owner or admin sets each account's owner (reassigning moves the previous owner's open tasks), each person's manager, away periods with a named cover, the reminder and escalation delays and the time zone for task days. An hourly Cron Trigger records a reminder before and on each due date and one escalation of an overdue task to the owner's manager, in the app under Your reminders and by email through the owner's mail provider, with the provider's reported outcome. Completing a task records an outcome reason with its evidence (PLAY-002).
- The app takes the owner-picked look: Renewals is the renewal runway, with accounts as lanes on one time axis, each lane a ribbon in the band of its health today, solid to today and dashed at the same weight ahead, with a marker (its reason on hover, focus and for screen readers) on each day its evidence turns stale or a judgment expires, notice ticks at each account's own term, renewal flags, the gradient today rule, and one account opened in place with its dated evidence, the finding, the approval and its open work. The account page, Imports, Backups, sign-in and setup share the top bar, Inter type, hairline cards and quiet fields; the left rail, Spectral and Red Hat Text are gone.
- The state API returns each account's health outlook (today's band and each later day its evidence turns stale or a judgment expires), from the same rules as the health-on-a-date read.
- The demo is Tidewell Software's eleven-account runway, with Cascade Freight at risk and an approval its agent prepared, on the homepage's own 2026–27 dates (Cascade Freight renews Thu Dec 31, 2026, notice Mon Nov 30).
- Buoy writes US dates in its own text: CSM sentiment counts through "Wed Nov 18, 2026", not an ISO date. Title facts keep their "·" separators off the start and end of a line.

## 2026-10-16

- Moved the hosted demo to RER 0.2.30's native Worker Loader host: each visitor gets their own isolate and SQLite copy instead of a container. Refreshed every vendored Base copy from `rer-v0.2.30`, adopted Base's `run-demo.yml`, removed the container-era observer and `instanceType`, and stopped marking the header name twice now that Base's theme frame marks it.
- Built the picked still-water Buoy homepage, with Run Buoy leading to the local-run instructions.
- Added eight owner documentation pages compiled from repository Markdown and a disabled run-site deployment workflow for run-buoy.com.
- Carried the shared paper, ink, Spectral and Red Hat Text theme through sign-in, setup, the installed Lobby and all product screens. Replaced the previous fonts, green palette and brand art.
- Preserved the complete first-use checklist, source fields, approvals, import custody, native sign-in and archive flows.
- Updated the published rer dependency to 0.2.19 and added one HTTP journey for public site navigation, linked assets, guide fragments and 404 handling.

## 2026-10-28 — Contract structure and baseline receipts

The contract was converted without promoting status. Historical implementation and proof notes follow; they are not new completion judgements.

### MIGRATE-001

Target capability; not currently available.

### MIGRATE-002

Partial account CSV mapping ships through the reviewed owner import door; a full migration is not currently available.

### MIGRATE-003

Partial account mapping ships through the reviewed owner import door; a full migration is not currently available.

### MIGRATE-004

Target capability; not currently available.

### MIGRATE-005

Target capability; not currently available.

### HTTP-001 baseline evidence

`src/buoy/access.ts`; `src/buoy/api.ts`; `src/buoy/core.ts`; `src/buoy/work.ts`; `docs/agents.md`; `tests/flows.test.mjs` (native sign-in, unauthenticated data refusal and CSRF; members cannot change accounts or approve; agents prepare decisions, cannot approve; revoked tokens stop): cookie writes check Origin and Fetch Metadata; valid bearer tokens bypass Origin only on the scoped command endpoint; preparations retain agent identity in proposals and events

### DATA-001 baseline evidence

`src/buoy/health.ts`; `src/buoy/settings.ts`; `src/buoy/currencies.ts`; `src/buoy/imports/validation.ts`; `migrations/core/0018_buoy_settings.sql`; `src/buoy/ui/account.ts`; `tests/flows.test.mjs` (billing evidence, renewal date and honest unknown health; DATA-001 observations are validated in any ISO 4217 currency and staleness is set per source): negative money, impossible dates, unsupported fields and non-ISO currencies are refused; KWD and JPY amounts follow their ISO exponents; stale billing and support snapshots are named beside their values with manual source system and threshold; owner thresholds per source kind change what is stale while members are refused; a refresh leaves earlier work on its earlier revision. This is the manual billing/support snapshot acceptance; USAGE-001 and INAPP-001 own reviewed usage/receipt provenance, instants, thresholds and revisions, ADOPT-001 owns manual seat/license evidence and derived calculations, and CONNECT-001 retains the connected-source repeat; Stripe customer-ID staging attributes no account

### APPROVAL-001 baseline evidence

`src/buoy/work.ts`; `tests/flows.test.mjs` (approval is durable and idempotent; a source refresh invalidates prepared approvals)

### IMPORT-001 baseline evidence

`src/buoy/imports/door.ts`; `src/buoy/imports/index.ts`; `src/buoy/imports/targets.ts`; `public/import-door.js`; `tests/flows.test.mjs` (IMPORT-001 and ERASE-001 named HTTP journeys); `tests/import-door-journey.mjs`; `tests/portable.mjs`: one operator/Business door, original-byte custody, reviewed apply/reconcile/undo, current authority, provisioning and durable key revocation, native edit/dependent protection and erasure withdrawal

### ERASE-001 baseline evidence

`src/buoy/imports/index.ts`; `src/buoy/api.ts`; `tests/flows.test.mjs` (owner erasure redacts imported custody); `tests/portable.mjs` (restored tombstone) ; `migrations/core/0044_buoy_scorecard_source_custody.sql`; `tests/scorecard-custody-journey.mjs` (scorecardCustody): retained derived score snapshots withdraw with account/person source erasure and current results recalculate

### RESTORE-001 baseline evidence

`scripts/installer/local.mjs`; `tests/portable.mjs`: local archives restore domain data, import custody and tombstones into an empty installation, exclude agent tokens and refuse damaged or populated restores

### SITE-001 baseline evidence

`src/site/run.json`; `docs/`; `tests/site.mjs`

### STYLE-001 baseline evidence

`public/rer-theme.css`; `public/fonts/fonts.css`; `public/brand/mark.svg`; `public/favicon-32.svg`; `src/site/`: `public/buoy.css`; `public/buoy-runway.css`; `src/buoy/ui/`: the run site, Lobby, sign-in, setup and every app screen use the brand tokens, faces and mark; the app's Renewals screen is the owner-picked renewal runway; `tests/style.mjs` (STYLE-001 browser journey): the homepage, run instructions, docs, sign-in, setup, the account list, an account and the import screen at 1440 and 390 pixels load every face from the installation, use the one theme file, set text and headings in Inter and commands in IBM Plex Mono, show the mark, including sign-in, keep every control on screen with no page scroll or clipped text, label every field and keep every submit usable; the sign-in form submits at 390 pixels; the favicon carries tuned 16 and 32 pixel frames on the site and the app

### STYLE-001 baseline note

—

### ACCOUNT-001 baseline evidence

`src/buoy/hierarchy.ts`; `src/buoy/scorecards/assignments.ts`; `src/buoy/fields/`; `src/buoy/activity.ts`; `src/buoy/ui/hierarchy.ts`; `migrations/core/0050_buoy_hierarchy.sql`; `tests/hierarchy-journey.mjs` (ACCOUNT-001 complete native hierarchy and product relationships in `tests/flows.test.mjs`): parent/two children/40 users, same-customer stakeholder roles, distinct product CSMs/scorecards/renewals/native activity, source-linked ARR/health/distinct-user rollups; every inherited field type, arithmetic/conditions/UTC dates/dependencies/hierarchical and full-portfolio formulas, ten-real-account no-write preview, explanations/source-owned actor/time/old-new history, typed same-person segments, authority, cycle refusal and scoped erasure; `src/buoy/hierarchy-approval.ts`; `tests/hierarchy-journey.mjs` (same named journey): parent native-source changes and segment re-entry invalidate stale approvals, fresh unchanged-source approval produces one task; `tests/hierarchy-browser.mjs` (hierarchyBrowser through `tests/record-browser.mjs` with hierarchy): every hierarchy/relationship/field/segment form, refusal/recovery, independent owners/cards/renewals/activity, source history and true keyboard scrolling at 1440/390 with axe, keyboard and 320 reflow; `tests/record-portability.mjs` (assertRecordPortability through the AUDIT-001 archive journey in `tests/portable.mjs`): hierarchy, distinct people, fields, immutable product card, shared view and approved expanded outcome restore exactly

### ACCOUNT-002 baseline evidence

`src/buoy/ui/account.ts`; `src/buoy/core.ts`: the account page lists proposals, tasks and decisions, and the durable audit records actions; `src/buoy/usage/read.ts`; `src/buoy/inapp/`; `tests/usage-journey.mjs`; `tests/inapp-journey.mjs`; `tests/inapp-browser.mjs`: attributed usage observations and in-app views, completions and dismissals on customer timelines  `src/buoy/activity.ts`; `tests/hierarchy-journey.mjs` (ACCOUNT-001 complete native hierarchy and product relationships): native account/relationship sources, source/person/kind filters, exact chronological pagination and working native source/history links; connected timeline remains unproved.

### ACCOUNT-003 baseline evidence

`src/buoy/workspace.ts`; `src/buoy/ui/workspace.ts`; `migrations/core/0048_buoy_workspaces.sql`; `tests/workspace-journey.mjs` (ACCOUNT-003 current workspace, live views and reviewed bulk operations in `tests/flows.test.mjs`): current account/user typed filters, chosen columns/sort, personal/shared creator-owned definitions, target CSM/same-team named-manager tasks/alerts/renewals, denied peer access, capacity/stale/replay-safe atomic bulk assignment/enrollment/static membership and explicit person-linked view erasure; the same workspaceJourney asserts changed-version refusal, three pinned run IDs, replay, whole-batch active-run refusal and separate task/next-step approvals; `tests/workspace-browser.mjs` (workspaceBrowser through `tests/record-browser.mjs` with workspace): home parity, shared native views, bulk refusal/recovery and end states at 1440/390 with axe, keyboard and 320 reflow; `tests/record-portability.mjs` (assertRecordPortability through `tests/portable.mjs`): shared view/record parity and fresh-owner replay isolation

### ACCOUNT-004 baseline evidence

`src/buoy/fields/`; `src/buoy/ui/fields.ts`; `src/buoy/segments/`; `migrations/core/0030_buoy_fields.sql`; `docs/fields.md`; `tests/field-journey.mjs` (ACCOUNT-004 through public HTTP and existing flows); `tests/fields-browser.mjs` (ACCOUNT-004 real forms/end states and A11Y-001 at 1440/390): all current types, safe formulas and dependencies, ten-account no-write preview, explanations, native/manual recalculation, old/new actor/time/source history, segment inputs and erasure

### ACCOUNT-004 baseline note

USAGE-001 contacts/users: `src/buoy/people/`; `src/buoy/ui/customer-people.ts`; `tests/customer-people-journey.mjs`; `tests/customer-people-browser.mjs` prove every inherited type/formula/history/preview/typed-segment point. ACCOUNT-001/006 and RENEW-001/002 retain the obligation for their future record kinds.

### ACCOUNT-005 baseline evidence

`src/buoy/search.ts`; `src/buoy/api.ts`; `docs/search.md`; `tests/search-journey.mjs` (ACCOUNT-005 through `tests/flows.test.mjs`): one staff-session HTTP query finds current native accounts, customer contacts/users, approved tasks, renewal opportunities and native timeline entries by name/native ID, custom text values (including recorded email/domain/external IDs), account references and task outcome/evidence; literal matching, shared-person deduplication, bounded stable pages, live refresh/erasure and existing owner/admin/member versus anonymous/agent boundaries are asserted; `src/buoy/ui/search.ts`; `tests/search-journey.mjs` (searchBrowser via `tests/record-browser.mjs`): native entry, contact-email and renewal deep links, paging, exact matching timeline-entry links, escaped/empty queries and error recovery at 1440/390 with axe, contrast, keyboard and 320 reflow

### CONNECT-001 baseline evidence

`tests/connections.mjs`: actual read instants, cursor resume and deduplication, last-success preservation, failure and disconnection notices, current notice authority, reconnect, scheduled reconciliation, audit and secret redaction; `tests/billing-journey.mjs` (billingJourney): reviewed exact account attribution, raw signed webhook reconciliation, connected source validation, threshold changes, immutable source revisions and original connected inputs retained by earlier work, owner and admin failure notices, reduced health and segment confidence, reconnect and credential races; `tests/connections-browser.mjs`: native connection, failure, inbox notice and read state, reconnect and disconnect at 1440 and 390; `tests/billing-browser.mjs` (billingBrowser): account source state, configurable threshold and source recovery at both widths; `tests/renewal-journey.mjs` (providerRenewalJourney): failed or disconnected provider forecast confidence; `tests/billing-sandbox.mjs`: existing held-key real provider webhook qualification cited under BILLING-001; `tests/portable.mjs` with `tests/billing-portability.mjs`: immutable source history, excluded credentials and fresh restored authority

### BILLING-001 baseline evidence

`src/buoy/billing/`; `src/buoy/billing-evidence.ts`; `tests/billing-journey.mjs` (billingJourney): reviewed exact attribution, complete paginated subscriptions/items/prices/invoices/payment intents/refunds/credit notes, independent monthly/annual ARR/MRR, upgrade/downgrade/cancel, signed duplicate/unordered webhook reconciliation, failed-payment/overdue account risk, source freshness/confidence, health/segment propagation, erasure and GET-only transport; `tests/billing-pricing.mjs` (pricingJourney): volume/graduated tiers, flat boundaries, quantity transforms, ordered scoped recurring discounts, decimals and metered facts; `tests/billing-browser.mjs` (billingBrowser through billing-journey): reviewed binding, source failure/reconnect, signed-secret custody, subscription-change details and native account evidence at 1440/390; `tests/billing-sandbox.mjs` (held-key qualification passed 2026-10-22T21:54:22.598Z on a29a488968eb064837e771cb3b09d05c10fb5127 through the local heavy slot): real monthly ARR 90000, annual ARR 120002, signed upgrade 198000/downgrade 54000, exact failed/overdue 8500 only on its account, refund 200/credit 100, cancellation ARR 0, periodic reconciliation and 71 product GETs/zero writes; `tests/portable.mjs` (AUDIT-001 archive journey with billing-portability): complete current/history/change source preservation, excluded credentials, reconnect confidence and fresh authority

### BILLING-003 baseline evidence

`tests/billing-journey.mjs` (billingJourney): exact native recurring sources, invoice and payment records, product and purchased-quantity source records, billing frequencies, source revisions and connected risk; `tests/revenue-health-journey.mjs` (revenueHealth): confirmed products, units, entitlements, service terms, exact ARR and MRR, source history, authority and the original currency-scoped ARR over USD 50000 and health below 60 segment flow; `tests/provider-reporting.mjs` (providerMonthlyJourney through `tests/billing-journey.mjs`): twelve exact native months, all five movement types, actual retained invoice and subscription-change links, the original sourced ARR and health entry and exit and reentry, approved playbook and CSV, owner and admin human reconciliation, unchanged native sources, stale-source and duplicate-resolution refusal and erasure; `tests/reporting-sandbox.mjs` with --monthly (26 October 2026 held-key Stripe test-mode run: 844 provider GET requests, zero Buoy provider writes; two test clocks and four currencies; Worker clock aligned to test-clock instants; no provider-verified rate origin or credential scope): twelve actual Stripe test-clock invoice months and independent native amounts for every month, EUR expansion, GBP contraction, CAD churn, real source links and an actual contract mismatch resolved through the native form while Stripe sources remain immutable; `tests/provider-reporting-browser.mjs` (monthlyRevenueBrowser): source-linked monthly history, pending and resolved mismatch forms and end states at 1440 and 390 with inherited accessibility and 320 reflow; `tests/revenue-health-browser.mjs` (revenueHealthBrowser): original native confirmed terms, refusal, recovery and numeric health segment; `tests/portable.mjs` with `tests/record-portability.mjs`: underlying retained financial sources and terms restore

### BILLING-004 baseline evidence

`tests/provider-reporting.mjs` (providerReportingJourney through `tests/billing-journey.mjs`): exact native and USD provider ARR and MRR, historical read selection, constant-rate NRR and GRR, separate FX, explicit USD-cent segment inputs, audited restatement preserving every native subscription, invoice and payment, and missing-source and rate exceptions; `tests/reporting-journey.mjs` (reportingJourney): ISO exponents, half-up cents, corporate fiscal years, recorded named daily rates, authority, immutable rate history and native-currency predicates; `tests/forecast-journey.mjs` (forecastJourney): native and USD forecasts and retained rate versions; `tests/reporting-sandbox.mjs` (held-key qualification, 26 October 2026 held-key run: Stripe test clocks and test Worker read instants aligned across the retained year; 844 GET requests and zero Buoy provider writes; independent NRR 532813 of 498013, GRR 466813 of 498013 and FX 33601 USD cents): twelve actual Stripe test-clock invoice months for USD, EUR, GBP and CAD, EUR upgrade, GBP downgrade, independent native and USD cents, constant-currency NRR and GRR, isolated FX, provider forecast and audited native-preserving rate edit, with every Buoy provider request GET; `tests/provider-reporting-browser.mjs` (providerReportingBrowser through reporting-sandbox): source-linked account revenue, report and exact retained invoice at 1440 and 390; `tests/reporting-browser.mjs` (reportingBrowser): native rate editor, refusal, recovery, history and inherited accessibility at both widths; `tests/record-portability.mjs` (recordPortabilityImage through `tests/portable.mjs`): retained rate and report restoration

### BILLING-004 baseline note

Daily rates are manually recorded with the named source, author and period; neither their origin nor provider key scope is independently verified. Other revenue-source clauses inherit this currency acceptance when they ship.

### USAGE-001 baseline evidence

`src/buoy/usage/`; `src/buoy/ui/usage.ts`; `migrations/core/0032_buoy_usage.sql`; `sdk/usage.mjs`; `sdk/relay.mjs`; `public/buoy-usage.js`; `tests/usage-journey.mjs` (USAGE-001 public HTTP through existing flows: 100000 deliveries across 50 reviewed accounts and contact/users, retained/new attribution, unknown/conflicting exact claims, source deduplication, provenance, revisions, erasure, authorization, scope and revocation); `src/buoy/people/`; `src/buoy/usage/mappings.ts`; `migrations/core/0034_buoy_people.sql`; `migrations/core/0035_buoy_usage_mappings.sql`; `tests/customer-people-journey.mjs`; `tests/customer-people-browser.mjs` (USAGE-001 ACCOUNT-004 complete customer carrier and A11Y-001 at 1440/390); `tests/usage-browser.mjs` (USAGE-001 real relay, mapping preview/approval, attributed account end states and A11Y-001 at 1440/390); `tests/portable.mjs` (USAGE-001 customer records, fields, calculations, history, mappings and events restored; ingestion authority excluded); `docs/usage.md`; `docs/people.md`

### USAGE-001 baseline note

Every original attribution point and the inherited contact/user field obligations are asserted through public HTTP, native forms and archive restore. Provider delivery, identity verification and hosted operation are not inferred from local intake.

### ADOPT-001 baseline evidence

`src/buoy/adoption/`; `src/buoy/ui/adoption.ts`; `migrations/core/0036_buoy_adoption.sql`; `docs/adoption.md`; `tests/adoption.mjs` (ADOPT-001 public HTTP: 90 days, 30 accounts, 300 reviewed people and independent activity/adoption/utilization calculation); `tests/adoption-browser.mjs` (ADOPT-001 native event-set/seats forms, filters, report/CSV parity, refusal/recovery and inherited A11Y-001 at 1440/390): daily/weekly/monthly active users, feature/module event sets, depth/breadth, purchased-seat utilization, previous periods, first observed value and 30% weekly decline; `src/buoy/adoption/segment-inputs.ts`; `tests/adoption-segment-journey.mjs`; `tests/adoption-segment-browser.mjs`: typed metric/report parity, same-person rules, entry/exit/reentry, stale refusal, native segment forms and one approved task; `migrations/core/0038_buoy_person_licenses.sql`; `src/buoy/adoption/licenses.ts`; `src/buoy/ui/adoption-licenses.ts`; `tests/adoption-license-journey.mjs`; `tests/adoption-license-browser.mjs`; `tests/portable.mjs` assert per-person licensed/unlicensed/missing/inactive utilization, UTC freshness, evidence/history, membership changes, report/CSV/segment parity, native refusal/recovery, authority, erasure and archive restore ; `src/buoy/adoption/consumers.ts`; `src/buoy/adoption/consumers-model.ts`; `src/buoy/adoption/consumers-alerts.ts`; `src/buoy/ui/adoption-consumers.ts`; `migrations/core/0039_buoy_adoption_consumers.sql`; `tests/adoption-consumer-journey.mjs`; `tests/adoption-consumer-browser.mjs` assert numeric report parity, configurable account/related-person health, explicit missing evidence, current-owner alerts and recovery deduplication, recipient preference/reassignment, configuration revision/authority, human-approved playbook and native 1440/390 refusal/recovery/A11Y; `tests/adoption-consumers.mjs` runs independent 30-account, 90-day account/person and aggregate consumer fixtures in separate Verify jobs; `tests/adoption-aggregate-journey.mjs` (adoptionAggregateAlerts, aggregateHealth) proves every exposed aggregate metric/report value, current-member owner alerts, missing peer denominators, episode recovery, two-layer health selection, direct/transitive/save-edit cycle refusal with named chains, selecting-segment evidence, downstream entry/exit/reentry playbooks, exactly one approved task and stale peer-evidence refusal; `tests/adoption-aggregate-browser.mjs` (adoptionAggregateBrowser, run through `tests/adoption-browser.mjs`) proves native configuration/refusal/recovery, account/runway/segment/outcome health evidence, owner inbox, entry approval, missing/disabled end states and inherited A11Y-001 at 1440/390 with 320 reflow; `tests/portable.mjs` asserts measure/source-evidence and effective segment aggregate health/alert restore

### HEALTH-001 baseline evidence

`src/buoy/scorecards/`; `src/buoy/scorecard-health.ts`; `src/buoy/ui/scorecards.ts`; `migrations/core/0041_buoy_scorecards.sql`; `tests/health-scorecard-journey.mjs` (healthScorecards): five real numeric input classes, independent segment-weighted calculation, no-write draft/current/retained previews, version/source history, changed/removed source recalculation, missing unknown/excluded/all-missing semantics, hourly timestamp, immutable version references, numeric score segments, direct/transitive/save-edit dependency refusal, authority/stale publication and publish audit; `tests/health-scorecard-browser.mjs` (healthScorecardBrowser): five-measure native configuration, preview, refusal/recovery, publish, retained history, account/runway and missing-source breakdowns at 1440/390 with axe/keyboard/320 reflow; `tests/portable.mjs` (AUDIT-001 archive journey): scorecard versions, retained inputs/results and publish audits restore ; `tests/revenue-health-journey.mjs` (revenueHealth) and `tests/revenue-health-browser.mjs` (revenueHealthBrowser): original sourced USD ARR over $50,000 and numeric health below 60 entry/exit/reentry, approved task, refusal and report/CSV repeat using BILLING-003 person-confirmed recurring terms ; `tests/survey-scorecard-journey.mjs` (surveyScorecards): independent NPS/CSAT and source-driven rescoring, authority/replay/window/current membership, every account custom type and explicit mappings with retained raw history; `tests/related-health-journey.mjs` (relatedHealth): every contact/user custom field kind, per-person normalization, mean/min/max/sum, missing records, typed currency refusal, current membership and source changes; `tests/survey-scorecard-browser.mjs` (surveyScorecardBrowser): received-response forms, refusal/recovery, account/person sources, mapped related five-measure preview/publish and observational outcome HTTP/UI/CSV at 1440/390 with axe, keyboard and 320 reflow; `tests/scorecard-custody-journey.mjs` (scorecardCustody): portfolio/departed-person erasure withdraws retained copies, current scores recalculate and Business import applies its score before responding; `tests/portable.mjs` (AUDIT-001 archive journey): scorecard versions, source/input history, recurring contracts, recorded survey observations and opaque audits restore

### HEALTH-002 baseline evidence

`src/buoy/sentiment.ts`; `src/buoy/health.ts`; `migrations/core/0017_buoy_sentiment.sql`; `src/buoy/ui/account.ts`; `tests/flows.test.mjs` (HEALTH-002 CSM sentiment feeds health as a dated judgment and expires to missing): a member's red rating with a reason turns a healthy account at risk with the judgment labeled as a person's, lets a playbook be prepared, counts through its expiry date and is named as expired and missing the day after; invalid ratings, over-long periods and agent credentials are refused

### SIGNAL-001 baseline evidence

`src/buoy/health.ts`: overdue billing and urgent tickets are named risk reasons; `src/buoy/adoption/consumers-alerts.ts`; `src/buoy/ui/adoption-consumers.ts`; `tests/adoption-consumer-journey.mjs`; `tests/adoption-aggregate-journey.mjs`; `tests/adoption-consumer-browser.mjs`; `tests/adoption-aggregate-browser.mjs`: configurable adoption thresholds for accounts, related people and selected segment aggregates route deduplicated episodes to current owners via the existing inbox/email preferences; `src/buoy/adoption/dismissals.ts`; `src/buoy/ui/signal-dismissal.ts`; `migrations/core/0045_buoy_signal_dismissals.sql`; `tests/signal-dismissal-journey.mjs` (signalDismissal, through the existing health shard): recipient reason/window, recovery/hourly suppression, real-clock expiry, account/recipient isolation, health independence, pending mail withdrawal and native refusal/recovery at 1440/390 with axe/keyboard/320 reflow; `tests/flows.test.mjs` (ADOPT-001 configuration doors retain ordinary authority and do not call a provider): authority, malformed input, opaque audit and account erasure; `tests/portable.mjs` (AUDIT-001 archive journey): retained dismissal audit, exact alert identities and fresh-owner isolation restore.

### SEGMENT-001 baseline evidence

`src/buoy/segments/rules.ts`; `src/buoy/segments/snapshot.ts`; `src/buoy/segments/index.ts`; `src/buoy/ui/segments.ts`; `src/buoy/team-plan.ts`; `src/buoy/work.ts`; `migrations/core/0025_buoy_segments.sql`; `migrations/core/0027_buoy_tiers.sql`; `docs/segments.md`; `tests/segment-journey.mjs` (SEGMENT-001 public HTTP rules, native/import changes, typed/missing/static membership, classification, intervals, entry proposals/approval, report/CSV, hourly expiry, team allocation and erasure via `tests/flows.test.mjs`); `tests/segments.mjs` (SEGMENT-001 real forms/end states at 1440 and 390); `src/buoy/people/model.ts`; `tests/customer-people-journey.mjs`; `tests/customer-people-browser.mjs` (SEGMENT-001 typed related-person conditions, same-person money/currency, fraction recalculation and native report forms at 1440/390)

### PLAY-001 baseline evidence

`src/buoy/play/`; `src/buoy/ui/playbooks.ts`; `migrations/core/0052_buoy_playbooks.sql`; `tests/play-journey.mjs` (playJourney, registered in `tests/flows.test.mjs`): health-score rule entry, revision-bound task approval/review, durable timed waits, both forward branches, exit during wait, deduplicated intervals/re-enrollment, immutable versions, freeze and timeline; `tests/play-journey.mjs` (playTriggerJourney, playIntakeJourney, playFieldJourney, playChildJourney, playCalendarJourney in `tests/flows.test.mjs`): typed/custom/usage recovery and segment/lifecycle/renewal/contract-start entries, owner-only version/account-scoped server webhook credentials, no read/approval grant, replay, limits and immediate local revocation; reviewed typed field diffs, stale/concurrent approval, preserved unrelated values and recalculation before branching; atomic parent/child start receipts, version pinning and separate child approval; `tests/play-browser.mjs` (playBrowser in `tests/record-browser.mjs`): account publishing/enrollment/review/receipt/retry and run outcome forms at 1440/390; `tests/portable.mjs` (record portability journey): definition/version/run/history restore

### PLAY-002 baseline evidence

`src/buoy/tasks.ts`; `src/buoy/reminders.ts`; `src/buoy/work.ts`; `src/buoy/settings.ts`; `src/server.ts`; `migrations/core/0022_buoy_task_owners.sql`; `wrangler.jsonc`; `deploy.json`; `docs/playbooks.md`; `tests/flows.test.mjs` (PLAY-002 owners, priority and type; reminders in-app and by email; escalation; reassignment; away cover; outcome): tasks due tomorrow, today and yesterday get owners, priority and type; the Cron Trigger door records nothing before 08:00 in the installation time zone, then sends one reminder before and on the due date in-app and by provider email, escalates the overdue task to the named manager only after the set delay and never twice; reassignment moves the previous owner's open tasks; the away cover handles tasks and reminders for the away range and they return the day after; completion stores outcome and evidence; members cannot set owners, managers, cover or timing. PLAN-001, RENEW-001 and RENEW-002 inherit task linking

### PLAY-003 baseline evidence

`src/buoy/play/engine.ts`; `tests/play-journey.mjs` (playJourney in `tests/flows.test.mjs`): ten failed external-work receipts, per-step inputs/results/errors, one admin inbox/email episode, retry only the failed step with no duplicate tasks, erasure; `tests/play-browser.mjs` (playBrowser in `tests/record-browser.mjs`): native refusal/review/receipt/retry at 1440/390; `tests/portable.mjs` (record portability journey): detailed run history and retries restore

### PLAY-004 baseline evidence

`src/buoy/outcomes/index.ts`; `src/buoy/outcomes/observe.ts`; `src/buoy/outcomes/report.ts`; `src/buoy/ui/outcomes.ts`; `migrations/core/0026_buoy_outcomes.sql`; `docs/outcomes.md`; `tests/outcome-journey.mjs` (PLAY-004 public HTTP: 40 approved tasks + 40 controls, healthy and approved-renewal outcomes, rates and timing, baselines, frozen cohorts, replay, deadline, CSV and erasure via `tests/flows.test.mjs`); `tests/outcomes.mjs` (PLAY-004 real setup form and report end states at 1440 and 390). ONBOARD-001, PLAN-001 and PLAY-001 inherit future kinds

### PLAN-001 baseline evidence

`src/buoy/plans/index.ts`; `src/buoy/plans/model.ts`; `src/buoy/ui/plans.ts`; `migrations/core/0056_buoy_success_plans.sql`; `tests/plan-journey.mjs` (planAttainmentJourney in `tests/flows.test.mjs`: two objectives, actual attributed usage, replay, custom metric corrections, goal health and awaiting customer confirmation; planAuthorityJourney: current authority, forbidden confirmation, membership and concurrent stale edits; planCustodyJourney: outgoing-owner handover, separately owned plans, customer export and erasure); `tests/plan-browser.mjs` (planBrowser in `tests/record-browser.mjs`: native draft creation, validation retention, stale refusal and recovery, keyboard and accessibility at 1440 and 390); `tests/portable.mjs` (real archive journey: plan definitions, owners, objectives and version history restore); `tests/plan-journey.mjs` (planAttainmentJourney: same-account task links, observed milestone rates and elapsed time, frozen comparison membership, review facts and renewal readiness; planAuthorityJourney: foreign task and comparison-only report refusal); `tests/plan-browser.mjs` (planBrowser: native milestone selectors and linked task checkboxes, accepted milestone identity preservation through unrelated form edits, review inclusion and renewal goal evidence at 1440 and 390); `tests/portable.mjs` (AUDIT-001 archive journey: same task identities and retained approved-renewal milestone kind, status, rates, UTC window and elapsed time restore exactly)

### REVIEW-001 baseline evidence

`src/buoy/reviews/`; `src/buoy/ui/reviews.ts`; `src/buoy/activity.ts`; `migrations/core/0062_buoy_reviews.sql`; `migrations/core/0063_buoy_review_holds.sql`; `docs/reviews.md`; `tests/review-journey.mjs` (reviewJourney through tests/flows.test.mjs, REVIEW-001 native source-linked decks, local exports and meeting follow-ups): a real 90-day public usage fixture, independently matched revenue/adoption/support/survey/outcome/renewal facts, editable titles/commentary with retained source links, current-revision review gate, real PPTX/PDF contents and links, submitted-account-revision-fenced, replay-safe meeting and approved follow-up task on the timeline, native authority/origin, account/customer erasure and shared-customer hold retention/release. The same journey through `tests/record-browser.mjs` reviews proves native editing, explicit review, keyboard downloads, meeting refusal/recovery and recorded timeline at 1440/390 with axe/320 reflow and icon tooltips. `tests/record-portability.mjs` through `tests/portable.mjs` covers real archive restoration

### INAPP-001 baseline evidence

`src/buoy/inapp/`; `src/buoy/ui/inapp.ts`; `migrations/core/0037_buoy_inapp.sql`; `sdk/inapp.mjs`; `sdk/relay.mjs`; `public/buoy-inapp.js`; `docs/inapp.md`; `tests/inapp-journey.mjs` (INAPP-001 through `tests/flows.test.mjs`: all formats, reviewed segment targeting, concurrent server caps, unknown receipt review, first-message/delivery-kind dedupe, timeline/provenance, scope/revocation and erasure); `tests/inapp-browser.mjs` (INAPP-001 native campaign/credential forms, authenticated buyer relay and snippet, all four formats, targeted/outside/signed-out end states, frequency caps, timelines and A11Y-001 at 1440/390); `tests/portable.mjs` (INAPP-001 campaign/receipt/timeline restore with credential hashes excluded and new-owner cap continuation)

### INAPP-001 baseline note

Local storage and real test-product interaction establish these observations, never provider verification or hosted delivery.

### SURVEY-001 baseline evidence

`src/buoy/surveys/`; `src/buoy/ui/surveys.ts`; `migrations/core/0043_buoy_survey_responses.sql`; `tests/survey-scorecard-journey.mjs` (surveyScorecards); `tests/survey-scorecard-browser.mjs` (surveyScorecardBrowser); `tests/portable.mjs` (AUDIT-001 archive journey): owner/admin records received NPS/CSAT observations with current respondent membership and source identity, immutable/idempotent history, independently calculated current scores, health/segment inputs, account/person evidence, erasure and archive restoration

### NOTIFY-001 baseline evidence

`src/buoy/notify.ts`; `src/buoy/notify-mail.ts`; `src/buoy/ui/notifications.ts`; `src/buoy/api.ts`; `src/server.ts`; `migrations/core/0023_buoy_inbox.sql`; `docs/providers.md`; `tests/flows.test.mjs` (NOTIFY-001 own inbox: all four types, personal access and preferences, daily/weekly and DST timing, current-book changes, duplicate prevention, refused/unconfirmed provider outcomes, erasure); `tests/notifications.mjs` (NOTIFY-001 real inbox forms at 1440 and 390, preferences, mentions and read end states). SIGNAL-001, PLAY-001, JOURNEY-001 and SURVEY-001 inherit future kinds

### RENEW-001 baseline evidence

`src/buoy/renewals/`; `src/buoy/ui/renewals.ts`; `migrations/core/0047_buoy_renewals.sql`; `tests/renewal-journey.mjs` (RENEW-001 native renewal pipeline and inherited field carrier in `tests/flows.test.mjs`): twelve confirmed periods, exact Cron lead boundary/deduplication, confirmed notice dates, stages/quarters, native-currency expected ARR, five revision-bound approved outcomes, linked PLAY-002 work, inherited typed fields/formulas/full-portfolio ten-account preview/source history/SEGMENT-001 and erasure; `tests/renewal-browser.mjs` (renewalBrowser in `tests/record-browser.mjs`): native pipeline and field/approval forms at 1440/390; `tests/record-portability.mjs` (assertRecordPortability through `tests/portable.mjs`): opportunity, source fields and approved expansion restore exactly; `src/buoy/renewals/billing.ts`; `tests/renewal-journey.mjs` (providerRenewalJourney in the existing RENEW-001 native renewal pipeline and inherited field carrier test): twelve Stripe network-edge subscriptions over two quarters, exact lead and notice dates, deduplication, stages, separately approved churn/contraction, a mismatching then matching next provider sync, original source preservation, source history, erasure and GET-only transport; `tests/renewal-browser.mjs` (renewalBrowser calls providerRenewalJourney): provider actual/difference/source and retained mismatch at 1440/390, axe and 320 reflow, all actions visibly named (no icon-only controls); `tests/billing-portability.mjs` (seedBillingPortability/assertBillingArchiveRows/assertBillingPortability through tests/portable.mjs): real archive retains the original opportunity and both mismatch/match observations while withholding provider authority; `tests/renewal-sandbox.mjs` (held-key Stripe test-mode qualification, outside push Verify): real subscriptions across two quarters, confirmed notice terms, distinct opportunities for subscriptions sharing a customer, separately approved churn/contraction, mismatching then matching provider reads, original source preservation and GET-only product transport

### RENEW-004 baseline evidence

`src/buoy/renewals/forecast.ts`; `src/buoy/ui/forecast.ts`; `migrations/core/0060_buoy_forecast_snapshots.sql`; `docs/renewals.md`; `tests/forecast-journey.mjs` (forecastJourney in tests/flows.test.mjs, RENEW-004 retained forecast movement and closed-period accuracy): independent month/quarter and CSM/team/segment totals; native/USD/rate conversion and immutable rate restatement; expected/commit/at-risk/best/worst definitions; once-per-UTC-week Cron/manual snapshot identity; moved and closed renewals, retained sources and stage/category/outcome/amount differences; reasoned actual manager override with stale revision, withdrawn team, independently assigned renewal owner, live account-book transfer and out-of-scope refusal; complete closed-period actual error and explicit unknown for missing rates/actuals/cohorts; audited history and erasure. forecastJourney through `tests/record-browser.mjs` forecast/privacy-renewals proves native override, segment parity, closed accuracy and missing-rate screens at 1440/390 with axe, keyboard, 320 reflow and visibly named controls (no icon-only controls). `tests/renewal-journey.mjs` (providerRenewalJourney) proves verified Stripe actuals, incomplete closed coverage and reconnect gaps without rewriting earlier actuals. `tests/record-portability.mjs` (recordPortabilityImage/assertRecordPortability) and `tests/billing-portability.mjs` (billingPortabilityImage/assertBillingPortability), through `tests/portable.mjs`, prove exact native/provider snapshot inputs, rates, outcomes and original source restoration

### RENEW-005 baseline evidence

`src/buoy/imports/validation.ts`; `tests/flows.test.mjs`: confirmed renewal terms carry a renewal-evidence reference

### REPORT-001 baseline evidence

`tests/provider-reporting.mjs` (providerReportingJourney): independent provider NRR and GRR in native minor units and USD, separate FX, actual retained source references, missing history and rate exceptions; `tests/reporting-sandbox.mjs` (held-key qualification, 26 October 2026 held-key run: Stripe test clocks and test Worker read instants aligned across the retained year; 844 GET requests and zero Buoy provider writes; independent NRR 532813 of 498013, GRR 466813 of 498013 and FX 33601 USD cents): a year of actual Stripe test-clock invoices, two quarters in USD, EUR, GBP and CAD, independent export arithmetic, exact quarter NRR and GRR, isolated rate movement, actual invoice and subscription-change links, and a real unmatched invoice of USD 12345 minor units; `tests/provider-reporting-browser.mjs` (providerReportingBrowser): exact invoice destination and retained source dialog, account revenue and report at 1440 and 390; `tests/reporting-journey.mjs` (reportingJourney): positive starting cohort, new and reactivated exclusions, churn, logo counts, month and quarter and TTM windows, current segment count and drilldown parity, filters, unavailable rates and erasure; `tests/roles-reports.mjs` (roleReportsJourney): scope before totals and exceptions, financial filter isolation, CSV, current authority and export audit; `tests/reporting-browser.mjs` (reportingBrowser): native report refusal and recovery and inherited accessibility at both widths; `tests/record-portability.mjs` (recordPortabilityImage through `tests/portable.mjs`): restoration

### REPORT-001 baseline note

Segment, CSM and tier filters use current membership and assignment. Confirmed terms retain their existing precedence when present; reviewed Stripe reads supply accounts without those terms. IDENTITY-001 retains cross-source authority and conflict policy. BILLING-002 and BILLING-005 to BILLING-007 inherit source-linked reporting before their new feeds ship.

### REPORT-002 baseline evidence

`src/buoy/reports/`; `src/buoy/ui/reports.ts`; `migrations/core/0061_buoy_reports.sql`; `docs/reports.md`; `tests/dashboard-journey.mjs` (dashboardJourney through tests/flows.test.mjs, REPORT-002 saved report calculations and scoped dashboard sharing): independently calculated at-risk native ARR by CSM, live current segment and account-book filters, currency-separated missing-safe totals, explained formulas, CSV/chart/table parity, explicit role-shared dashboard read-only authority, stale/origin/refused field fences and erasure. The same journey through `tests/record-browser.mjs` dashboards proves author refusal/recovery, dashboard and readonly viewer, keyboard CSV export, axe and 320 reflow at 1440/390

### ROLE-001 baseline evidence

`src/buoy/roles/`; `src/buoy/ui/roles.ts`; `src/buoy/ui/scoped.ts`; `tests/roles-journey.mjs` (roleConfigurationJourney, roleReadJourney, roleScopeJourney, roleIsolationJourney): default/custom declarations, audited revision-bound owner/admin assignment, native identity/version fences, all/team/own/live-segment account scopes, exact/band/hidden commercial projection before search matching/paging, shared-book money refusal and scoped notification email; `tests/roles-browser.mjs`: native assignment, stale refusal/recovery, custom role, support band, scoped account/search and unavailable-door refusal at 1440/390; `tests/roles-workspace.mjs` (roleWorkspaceJourney): current own/manager/finance homes, safe task/alert projection, book movement and manager/segment withdrawal; `tests/roles-account-edit.mjs` (roleAccountEditJourney): narrow revision-bound account edits and whole-payload/source preservation; `tests/roles-reports.mjs` (roleReportsJourney): permitted financial detail/totals, scoped filter labels, CSV authority, opaque success audits and live withdrawal; `tests/roles-browser.mjs`: own home, stale edit/recovery, permitted/empty reports and CSV at 1440/390; `tests/roles-renewal-approval.mjs` (roleRenewalApprovalJourney): team manager, explicitly granted own-book CSM and scoped custom-role native renewal decisions, source/team/grant/native-version withdrawal, audited exactly-once effect and authorized replay; `tests/roles-browser.mjs`: reviewed linked ARR, withdrawn grant refusal/recovery and recorded outcome at 1440/390

### ROLE-002 baseline evidence

`src/modules/operator-auth/identity/oidc/presets.mjs`: Base carries OIDC presets for Auth, Google, Microsoft and Okta

### TEAM-001 baseline evidence

`src/buoy/team.ts`; `src/buoy/team-plan.ts`; `src/buoy/tasks.ts`; `src/buoy/ui/team.ts`; `src/buoy/ui/team-actions.ts`; `src/buoy/ui/account.ts`; `migrations/core/0024_buoy_teams.sql`; `docs/books.md`; `tests/team-journey.mjs` (TEAM-001 through public HTTP in `tests/flows.test.mjs`: 300 accounts across four CSMs, targets, territory/round-robin rules, pods/teams, whole-run and manual refusal, stale preview, book handover, open/completed/separately owned tasks, every handover note, lower target and rebalance, erasure); `tests/teams.mjs` (TEAM-001 real team, capacity and rule forms, assignment/handover review, over-target rebalance and account end states at 1440 and 390). SEGMENT-001, BILLING-003, BILLING-004, PLAN-001, JOURNEY-001 and ROLE-001 inherit their absent kinds

### AUDIT-001 baseline evidence

`src/buoy/core.ts`; `src/buoy/audit.ts`; `src/buoy/audit-records.ts`; `src/buoy/access-audit.ts`; `migrations/core/0020_buoy_durable_events.sql`; `migrations/core/0021_buoy_audit_doors.sql`; `src/buoy/ui/audit.ts`; `src/auth.server.ts`; `tests/portable.mjs` (AUDIT-001 archive journey); `tests/flows.test.mjs` (AUDIT-001): bootstrap, email-link and invitation sign-ins recorded by every session insert; invitations, role and status changes and invitation cancellation with actor, person id and change, refused or unchanged ones adding nothing; native account writes, approvals, erasures and agent preparations with actor kind/id, opaque subject and time without display names; account audit survives erasure with matching refusal detail redacted; scoped agent request attempts include reads and invalid bodies; agent credential issue and first revocation without the label; owner/admin search by actor, action, subject and inclusive UTC dates, with pagination; every present action kind (sign-in, invitation, role change, account change, erasure, preparation, approval, agent request and refusal, connector.connected, connector.reconnected, connector.disconnected and adoption-measure publish) restores exactly from the archive, the export itself is recorded and carried by the next archive, and the screen lists the exported entries; CONNECT-001 retains every later connector/credential-change audit duty; HEALTH-001/PLAY-001 publishes, EMAIL-001/JOURNEY-001/SURVEY-001 sends and ERASE-002 contact erasure/export retain the same actor kind/id, UTC time, action, opaque subject, erasure-safe fields, admin search and archive export/restoration acceptance; `src/buoy/connectors/index.ts`; `src/buoy/adoption/consumers.ts`; `tests/connections.mjs`; `tests/adoption-consumer-journey.mjs`: current connector changes record connector.connected, connector.reconnected and connector.disconnected in the same transaction with owner/admin actor kind/id, UTC time and opaque connection-id subject; adoption-measure publishes record actor, time, action and opaque subject ; `tests/health-scorecard-journey.mjs` (healthScorecards), `tests/survey-scorecard-journey.mjs` (surveyScorecards), `tests/revenue-health-journey.mjs` (revenueHealth) and `tests/portable.mjs` (AUDIT-001 archive journey): scorecard publishes, recurring confirmations and recorded survey responses preserve actor/time/opaque subject through real archive restoration

### SECURE-002 baseline evidence

`src/buoy/connectors/vault.ts`; `src/buoy/connectors/index.ts`; `src/buoy/connectors/sync.ts`; `src/buoy/connectors/stripe.ts`; `scripts/installer/local.mjs`; `tests/connections.mjs`; `tests/connections-browser.mjs`; `tests/portable.mjs`: Stripe test-key encryption, secret-free status/forms/errors/audit, owner/admin-only management, agent refusal, one-action local disconnect with in-flight/next-run fences, GET-only customer inventory and archive exclusion are implemented

### ERASE-002 baseline evidence

`src/buoy/privacy.ts`; `migrations/core/0046_buoy_person_privacy.sql`; `src/buoy/ui/privacy.ts`; `tests/erase-journey.mjs` (ERASE-002 owner customer export and erasure, source replay, aggregates and opaque audit in `tests/flows.test.mjs`): owner-only revision and name confirmation, all memberships, current typed/survey/usage/in-app and license custody, survivor aggregates, unrelated data retained, opaque export and erasure audit and source replay refusal; `tests/privacy-browser.mjs` (privacyBrowser in `tests/record-browser.mjs`): native verified-request form, exact name/email preview, selected redaction, hold and release, refusal and recovery, JSON download, erasure and receipts at 1440/390; `src/buoy/privacy/`; `migrations/core/0051_buoy_privacy_requests.sql`; `tests/erase-journey.mjs` (eraseJourney): missing verification, future dates and narrative requester references refused; usage text in a surviving record is previewed and redacted, longer words preserved; held records survive with retained counts, other deletion doors refuse, explicit release invalidates the old preview; `tests/portable.mjs` (AUDIT-001 archive journey): verified request records, opaque receipts, customer absence and keyed replay fences survive real archive restoration; `src/buoy/privacy/native-text.ts` and `tests/erase-journey.mjs` (eraseJourney): explicit export and selected redaction of native proposal, task, decision, sentiment and handover narratives plus live and proposal-retained account evidence references without changing money, quantities or dates, current preview fences, shared held-note refusal and stale approval withdrawal; `migrations/core/0064_buoy_privacy_hold_versions.sql` and `tests/erase-journey.mjs` (eraseJourney): intermediate customer field and account evidence versions survive later edits under hold and explicit release clears them; `tests/portable.mjs` (AUDIT-001 archive journey): held versions and active hold survive archive restoration; `tests/privacy-browser.mjs` (privacyBrowser): native sentiment selection and held-note refusal at 1440 and 390

### API-001 baseline evidence

`src/buoy/integration/index.ts`; `src/buoy/integration/openapi.ts`; `docs/integration-api.md`; `tests/flows.test.mjs` (API-001 scoped account integration with atomic replay and bounded authority); `tests/integration-journey.mjs` (integrationJourney): versioned account OpenAPI, explicit-ID and all-accounts scoped tokens, create and revision-checked update, concurrent identical replay, changed-key refusal, paginated scoped reads, atomic rate reservations and 429 retry timing, expiry and rate issuance bounds, revocation, secret-free owner inventory with last use, expiry warnings and stop reasons; credential issuance and first-revocation audit, erasure and no resurrection. `tests/integration-journey.mjs` (browser mode): resulting native account at 1440 and 390. `tests/portable.mjs`: real archive excludes integration credentials and old tokens cannot authorize the restored installation

### MIGRATE-002 baseline evidence

`tests/migrate-journey.mjs`: “MIGRATE-002 ChurnZero accounts reconcile twenty explicit mappings and protect reviewed custody” proves exact CSV custody, twenty native account identities and field values, read-only ChurnScore and factor observations field by field, invalid-factor refusal, native scorecard preview and explicit publication from mapped factors with missing-source treatment, cross-account field-catalog erasure and schema-valid integration reads, no-write review, fingerprint-bound approval, replay, source isolation, reconciliation, non-owner refusal, strict undo after edits or dependent work and erasure refusal; “MIGRATE-003 and MIGRATE-005 existing Imports screen reviews migration bundles at 1440 and 390” includes ChurnZero review, apply, source-observation readback and native scorecard preview, reload, reconciliation and undo. `./fixtures/move-in/churnzero/README.md` documents the synthetic source and unverified schema. The additional `tests/churnzero-journey.mjs` selected-column journey independently checks exact source bytes, twenty accounts, unknown health, source isolation, replay and strict undo.

### MIGRATE-003 baseline evidence

`tests/migrate-journey.mjs`: “MIGRATE-003 Totango account CSV and API pages reconcile twenty accounts through reviewed owner imports” and `tests/totango-api-journey.mjs` (totangoApiJourney) prove exact CSV and paginated API source custody, explicit field indexes, fixed regional account reads, credential exclusion, total and digest refusal, fingerprint approval, twenty-account field reconciliation and undo; `tests/totango-api-journey.mjs` (totangoReferenceJourney) additionally proves exact reference text and digest custody, every supplied element explicitly unmapped, invalid reference refusal before any account mapping, account approval and replay with zero native definition, task or scheduled effects, real archive restoration and strict restored-account undo; “MIGRATE-003 and MIGRATE-005 existing Imports screen reviews migration bundles at 1440 and 390” proves native review, apply, reload, reconciliation and undo at both widths.

### MIGRATE-005 baseline evidence

`src/buoy/migrate/source.ts`; `src/buoy/migrate/cli.mjs`; `docs/migrations.md`; `tests/migrate-journey.mjs` — versioned export account custody uses the existing reviewed door; CSV mapping rejects bad rows and preserves exact money and source identities; existing Imports screen reviews migration bundles at 1440 and 390

### MOBILE-001 baseline evidence

`src/buoy/ui/`; `public/buoy.css`: server-rendered screens are built for phone widths

### A11Y-001 baseline evidence

`src/buoy/ui/runway.ts`; `src/buoy/ui/work.ts`; `src/buoy/ui/browser.ts`; `src/buoy/ui/html.ts`; `tests/a11y.mjs`; `tests/a11y-auth.mjs`; `tests/a11y-import.mjs`; `tests/a11y-governance.mjs`; `tests/a11y-checks.mjs`; `tests/symbolic-labels.mjs` (explicit glyph/action/account/state/destination proof for axe symbolic-label manual reviews); `tests/a11y-contrast.mjs`; `tests/runway-keyboard.mjs`: named public Worker/browser journeys assert every current screen and auth/import/agent end state at 1440/390, 320 reflow, zero axe violations, computed text contrast over grid/gradient backgrounds, visible unobscured focus, labeled and symbolic controls, sign-in/setup, scrolling/expansion, modal focus/return, validation recovery, preparation/approval/completion and keyboard CSV export; semantic runway values include native-currency invoices, current/missing/stale health, reasons, dates and projected changes; `tests/fields-browser.mjs`; `tests/customer-people-browser.mjs`; `tests/usage-browser.mjs`; `tests/connections-browser.mjs`; `tests/adoption-browser.mjs`; `tests/adoption-license-browser.mjs`; `tests/adoption-segment-browser.mjs`; `tests/adoption-consumer-browser.mjs`; `tests/adoption-aggregate-browser.mjs`; `tests/inapp-browser.mjs`: later shipped native field, customer, usage, provider, adoption and in-app screens inherit the same 1440/390 axe, keyboard, contrast and 320 reflow acceptance ; `tests/health-scorecard-browser.mjs` (healthScorecardBrowser); `tests/revenue-health-browser.mjs` (revenueHealthBrowser); `tests/survey-scorecard-browser.mjs` (surveyScorecardBrowser): new scorecard, recurring-source and recorded-survey forms at 1440/390, keyboard, zero axe violations and 320 reflow; the existing text-alternative assertion includes the configured Watch band

### A11Y-001 baseline note

PORTAL-001, MOBILE-001, PLAY-001 and REPORT-002 inherit this acceptance before their new screens ship.

### AI-001 baseline evidence

`tests/flows.test.mjs` (AI-001 scoped extractive questions and working citations), implemented by `tests/ai-journey.mjs` (aiQuestionJourney): all five questions under CSM, support, sales and finance; exact permission projection before provider transmission and in selected claims, full commercial values versus bands, independently expected risk, next-quarter renewal, meeting-brief and explicitly unavailable answers; removing the question from either generation instruction fails the loaded journey, working citations, named unavailable and excluded sources, invalid-index, consent and agent refusal. `tests/ai-browser.mjs`: exact visible extractive facts and provider captures for all four profiles, account citations clicked to their rendered destinations, and all five independently expected answers through the native form at 1440 and 390, implemented by `tests/ai-question-browser.mjs` (scriptedQuestionBrowser).

### AI-001 baseline note

Outside the ct-approved extractive boundary: connected timeline and metric explanations, executive-contact content and complete connected meeting preparation remain unproved; generative supporting-record answers belong to AI-005. No paid agent scope.

### AI-002 baseline evidence

`tests/flows.test.mjs` (AI-002 cited conversation proposals require reviewed acceptance), implemented by `tests/ai-journey.mjs` (aiConversationJourney): owner and administrator authority, exact selected kind, line and original line number, unique selected and unselected sentinels, no work before review, exactly one accepted task, suggestion and duplicate refusal, discard with opaque audit, account erasure through accepted work. `tests/portable.mjs`: exact persisted and restored selections, installation-wide absence of full transcripts and unselected, discarded and erased text, opaque discard receipts, erased accepted native work. `tests/ai-browser.mjs`: exact rendered kinds and cited lines, acceptance and asserted discard end state at 1440 and 390.

### AI-002 baseline note

Outside the ct-approved explicit transcript door: email, meeting, chat and ticket intake and accepted plan updates remain unproved. Broader linked-person redaction and granular holds inherit ERASE-002 before broader source intake ships; current proof covers selected-line custody, discard and whole-account erasure only.

### AI-003 baseline evidence

`tests/communication-journey.mjs` (communicationJourney), registered in `tests/flows.test.mjs` (AI-003 cited communication health, class disablement and guarded model effects): person-recorded emails and tickets, validated message quotations, risk themes, native and weighted health, source change invalidation, per-class exclusion, visible disablement, owner and administrator authority, linked-person and account erasure, budget, rate, kill switch and in-flight policy fences; `tests/communication-browser.mjs`: native message entry, cited score, source destination, account health and disabled end states at 1440 and 390; `tests/fixtures/communication-month.json`: independently labelled ten-account month; `tests/communication-model.mjs`: capped real-model public-door benchmark, not yet run.

### AI-004 baseline evidence

`tests/flows.test.mjs` (AI-004 model choice, excluded transcripts, budget and disablement), implemented by `tests/ai-journey.mjs` (aiControlJourney): default off, owner-only settings, exact persisted unverified terms reference, enabling without attestation or reference refused, question and transcript consent refusal, provider-bound credential and model, excluded transcripts make no request, measured per-feature costs, budget and minute reservations, kill switch, held uncertain cost and disablement. `tests/ai-browser.mjs`: native settings after question, generated-answer and conversation calls with exact feature names, charged and held amounts, persisted reference and cost basis, exclusion refusal and hidden disabled forms at 1440 and 390. `tests/portable.mjs`: restored AI off and no restored standing authority.

### AI-004 baseline note

Outside the ct-approved current control boundary: successful compatible-endpoint transport and complete per-class connected source coverage remain unproved. Provider training practices are not verified. AI-006 owns separate scheduled authorization; no agent AI authority.

### AI-005 baseline evidence

`src/buoy/ai/answers.ts`; `tests/flows.test.mjs` (AI-005 generated claims cite current permitted source records), implemented by `tests/ai-journey.mjs` (aiGeneratedJourney): five scripted questions with independently expected substantive answers or explicit unavailable sources for CSM and read-only support; every generated claim quotes a working source record; unavailable sources named; scope and commercial bands projected before transmission and citation reads; invalid index, quotation and uncited claim refusal; in-flight scope change refusal; a source mutation under unchanged reader authority makes the old citation return 409 and a fresh citation return 200. `tests/ai-browser.mjs`: generated meeting briefs and supporting records for owner, CSM and support, plus all five native question answers via `tests/ai-question-browser.mjs` (scriptedQuestionBrowser), at 1440 and 390 with axe, keyboard and 320 reflow.

### AI-006 baseline evidence

`src/buoy/ai/schedules.ts`; `tests/flows.test.mjs` (AI-006 standing scheduled consent and revocation), implemented by `tests/ai-journey.mjs` (aiScheduleJourney): no authorization makes no request; explicit named feature and full policy snapshot; owner-only grants; actual hourly Worker execution; concurrent slot replay sends once; auditable revocation prevents later requests; policy changes require fresh consent; native owner deactivation and reactivation preserve the schedule but invalidate its owner version, with zero new provider request, request receipt, cost reservation or daily slot reservation; opaque linked request receipt; account erasure removes the schedule. `tests/portable.mjs`: public archive restore excludes standing authorization.

### BOUNDARY-001 baseline evidence

`src/buoy/api.ts`; `tests/mail-runtime.mjs`; `tests/flows.test.mjs` (BOUNDARY-001 no route moves money: every write route ran and only the sign-in mail edge was called): the route list read from the router has no money route, every write route in it runs in this native journey and its only outbound call is the sign-in mail provider. Provider-edge `tests/billing-journey.mjs` (billingJourney) and `tests/billing-pricing.mjs` (pricingJourney) assert inventory and reviewed billing reconciliation use GET to fixed customer, subscription/item, expanded price/coupon, invoice, payment-intent, charge/refund and credit-note paths, refuse live records and never mutate money or subscriptions. Buoy accepts bounded opaque test credentials and refuses known live prefixes; actual provider-side least-access scope remains advised, not certified. SECURE-002 retains least-access checks and BILLING-001, BILLING-002, BILLING-005, BILLING-006, BILLING-007, RENEW-003, CRM-001 and CRM-002 retain read-only scope and transport acceptance before shipping; `tests/billing-sandbox.mjs` held-key qualification at 2026-10-22T21:54:22.598Z also proves 71 actual product GETs and zero product writes; `tests/connections.mjs`; `tests/connections-browser.mjs` (BOUNDARY-001 GET-only Stripe customer-list transport)

### BOUNDARY-002 baseline evidence

`src/buoy/api.ts`: no route creates a deal, support queue, analytics chart or newsletter

### BOUNDARY-003 baseline evidence

`src/buoy/health.ts`; `src/buoy/segments/index.ts`; `src/buoy/outcomes/report.ts`; `src/buoy/ui/`; `tests/boundary.mjs` (BOUNDARY-003 named public HTTP/browser journey): every current health door, inputs and gaps, dated current-snapshot evaluation, segment/outcome HTTP/UI/CSV labels, closed observational results preserved despite later missing inputs, four screens at 1440/390; HEALTH-001, RENEW-004, AI-001/AI-003 and REPORT-002 inherit closed-period accuracy ; `tests/health-scorecard-journey.mjs` (healthScorecards), `tests/survey-scorecard-browser.mjs` (surveyScorecardBrowser) and `tests/scorecard-custody-journey.mjs` (scorecardCustody): weighted values, sources/missing treatments, retained/current separation, non-prediction interpretation and observational outcome HTTP/UI/CSV at 1440/390

### BOUNDARY-004 baseline evidence

`src/buoy/audit.ts`; `src/buoy/access.ts`; `src/buoy/api.ts`; `migrations/core/0019_buoy_audit.sql`; `docs/agents.md`; `tests/flows.test.mjs` (BOUNDARY-004 agent commercial changes are refused with their reason and recorded; mail is single-recipient team mail): an agent discount, an unknown discount command and an agent account edit are refused with their reason, change no term and are listed as agent.refused in the owner/admin audit read; no one-to-many send exists and every message sent is single-recipient internal team mail (NOTIFY-001 and PLAY-002 also assert one recipient per notice and reminder). EMAIL-001, EMAIL-002, EMAIL-003, JOURNEY-001 and SURVEY-001 inherit the suppression and domain refusals

### BOUNDARY-005 baseline evidence

`docs/providers.md`; `src/site/docs.ts`; `tests/site.mjs` (BOUNDARY-005 checks on the built providers guide): the guide states that attestations are the deployment's and lists Stripe test-mode inventory and reviewed billing/price/coupon reads, incoming Segment, Cloudflare, every accepted sign-in mail provider and every OpenID preset with when it is used, what it sends and receives and linked terms. The check derives current connector origins, accepted mail choices and OpenID presets from code, with Cloudflare/Segment explicitly named; each listed provider needs a section. The guide also documents the buyer-operated in-app relay's authenticated inbound requests, content/receipt direction and buyer and source external-copy and deployment responsibilities without third-party-provider or legal-acceptance claims; every named future provider clause retains complete data-flow, terms/DPA, attestation and derivation acceptance

### GOVERN-001 baseline evidence

`src/buoy/access.ts`; `src/buoy/core.ts`; `src/buoy/api.ts`; `src/buoy/agent-policy/`; `src/buoy/ui/agents.ts`; `migrations/core/0031_buoy_agent_policy.sql`; `tests/governance.mjs`; `tests/governance-browser.mjs` (GOVERN-001 named public HTTP and owner-form journeys): command/data grants, expiry bounds, atomic minute limits and Retry-After, metered USD budget/cost boundary, internal-notice parity, durable attempts/outcomes/refusals, owner switch and atomic preparation authority, revocation and owner-version invalidation, one-time credential and real pause/resume/revoke forms at 1440/390; future paid/send/update clauses inherit acceptance

### AGENT-001 baseline evidence

`src/buoy/work.ts`; `tests/flows.test.mjs` (completed work needs evidence): playbook completion needs evidence

### AGENT-002 baseline evidence

`src/buoy/experiments/index.ts`; `migrations/core/0066_buoy_experiments.sql`; `docs/experiments.md`; `tests/flows.test.mjs` (AGENT-002 approved matched interventions and independently seeded effects), implemented by `tests/outcome-journey.mjs` (experimentJourney): leadership approval and stale-source refusal before native pinned playbook work; frozen exact segment, baseline health, ARR and customer-tenure pairs; independent seeded health and renewal effects of 0.50 with intervals, sample sizes and supporting records; approval and observation replay; service-withholding and pricing refusal; governed opt-in agent commands and erasure. Existing outcome screens proved at 1440 and 390.

### AGENT-003 baseline evidence

`src/buoy/health.ts`; `src/buoy/work.ts`; `tests/flows.test.mjs` (agents prepare decisions): an agent can list renewals and prepare a renewal decision from confirmed terms

### AGENT-007 baseline evidence

`tests/flows.test.mjs` (AGENT-007 evidence review, admin-only correction and immediate health refresh), implemented by `tests/trust-journey.mjs` (trustJourney): exact duplicate pair, independent ARR values and source references, stale billing source, preparation without effects, an explicit Segment source claim and a proposed correction with retained message evidence, admin approval and member refusal, atomic receipt and replay, stale-evidence refusal, both numerical health scores and correction notes, owned fix tasks, retained ARR variance and erasure of either-side mapping evidence; trustPrivacyJourney (AGENT-007 person evidence export, reviewed redaction, holds and erasure) proves copied-person export, preview, held retention and versions, reviewed narrative redaction, changed-preview refusal and complete linked-trust erasure; trustUndoJourney (AGENT-007 import undo preserves dependent trust work on either account) proves refusal and preserved pending work on both account links; `tests/trust-browser.mjs`: native review, refusal retention, approved correction and account health at 1440 and 390, wired into the settings-browser Verify suite.

### AGENT-008 baseline evidence

`tests/flows.test.mjs` (AGENT-008 plain-language signal drafts, historical evidence and approval; AGENT-008 native configuration kinds and retained scorecard back-testing), implemented by `tests/configuration-journey.mjs` (configurationJourney, configurationKindsJourney, assertBacktest): all five native draft kinds, twelve-month weekly signal history with 54 exact fires and one of two churned accounts caught, 52 retained scorecard points with 26 exact risk matches, equal-timestamp ordering, latest-observation replacement at the UTC week boundary, an explicitly absent week, a current-only account without retained history and exactly 107 missing account weeks, admin publication only after fingerprint-bound approval, complete outgoing model-body allowlist, replay without additional native definitions for every kind, full route authority, model policy changes, internal notifications, paused fresh-day suppression beside an active control, discard and erasure. `tests/configuration-browser.mjs`: all five draft and native publication end states with identifiers, exact counts, reload, pause, disabled model, keyboard, axe, contrast and reflow, with 1440 and 390 captures; loaded by the push Verify AI browser suite. `tests/portable.mjs`: real archive restoration with `tests/configuration-portability.mjs` (seedConfigurationPortability, assertConfigurationBacktest, assertConfigurationArchive) selects conflicting equal-timestamp calculations before and after restoration, preserves dated support and calculation ordering, proves usable current values cannot fill absent history, excludes pending approval authority and retains approved definitions.

Today billing and support snapshots are manual, typed in on the account page or moved in from a file under IMPORT-001: their source system is recorded as manual, and their source reference names the record they were copied from.

Current homes use the person’s current assigned book, open tasks handled by that person and due on the installation calendar date, unread active/not-dismissed alerts, and account renewal dates through both endpoints of the next 90 days.

Today every existing account, contact and product-user field capability conforms: owner/admin-defined text, number, currency, date, picklist, multi-select, boolean and calculated fields, account-value editing and history, real-account preview and typed SEGMENT-001 inputs.

The current partial implementation is a native screen and staff-session HTTP search over native accounts, customer contacts/users, approved tasks, current renewal opportunities and native timeline entries, including their current custom/calculated text values and recorded domain/email/external-ID text.

The current connector reads test-mode sources through exact reviewed customer-to-account bindings, retains complete validated observations and subscription before/after images, verifies raw signed webhooks and periodically re-reads current provider data.

Current native monthly history uses retained UTC observations and preserves unknown historical boundaries.

Current reporting projects separately retained confirmed terms and reviewed Stripe subscription reads at explicit corporate fiscal-year or manually recorded named-source daily rates.

Today every existing manual or segment-entry task playbook can be tracked: an owner/admin defines healthy evidence or a new approved renewed decision, sets a 1–365 whole UTC-day window and attaches one existing approved task per enrolled account.

Current internal drafts record objectives, due dates and one owner on each side; metric objectives compare the current finite numeric source value with an inclusive at-least or at-most target.

Today every account assignment door conforms for today’s records: owner/admin-managed teams and named pods, whole-account capacity targets, ordered first-match territory rules and capacity-aware round-robin, manual assignments and reviewed book handovers.

Today CONNECT-001 calls Stripe only for a test-mode customer-ID inventory: GET to the fixed customer-list endpoint, with live keys and live records refused, no account or billing synchronization and no money or subscription mutation.

Today the shipped assessments are rule-based health over manual billing/support snapshots, optional CSM sentiment and configured adoption thresholds (ADOPT-001), and observational segment and playbook-outcome reports.

Today Buoy has no journey, campaign or other one-to-many send: it sends only single-recipient internal team mail (sign-in links, NOTIFY-001 notices and PLAY-002 reminders), never a customer campaign, through the owner's sign-in mail provider (BOUNDARY-005).

Today those providers are Cloudflare, the one sign-in mail provider the owner picks (Resend, SendGrid or Cloudflare Email), the optional OpenID sign-in providers (Auth, Google, Microsoft, Okta or a company provider) and Stripe for CONNECT-001's test-mode GET-only customer-ID inventory.

The current native intervention is an optional additional check-in through a pinned manual task playbook; every contracted service remains unchanged.

Existing owner and administrator approval authority acts for CS leadership.
