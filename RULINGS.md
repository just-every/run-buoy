# Buoy rulings

### RL-101 — Subscription financial model

Date: 2026-10-28 · Ruled by: ct · Governs: `BILLING-003`.

**Question.** Does an audited explanation resolve a financial mismatch review without making its differing source values agree?

**Proposed/adopted default.** Owner/admin exact-pair review note retains both values, changes no source authority and leaves variance visible; a new source version reopens review.

**Outcome: adopt with rider.** Adopt exact-source-pair explained resolution as closure of the human review only, with actor, time, reason and source versions; continue to label and quantify the unresolved monetary variance and never report the values as reconciled or equal.

**Why.** No common norm established for this note-as-resolution definition: Gainsight merges/transforms datasets, while Harvest separates invoice/payment state and amounts; neither source defines a review note as financial agreement. Separating review completion from factual variance is the safest truthful default.

**Rider.** BILLING-003’s own acceptance must show both states independently—review explained and monetary variance outstanding—and reopen the review on changed sources; IDENTITY-001 alone determines source precedence.

**Place once.** BILLING-003 owns one explained-review/variance acceptance point; other billing feeds cite it.

**Incumbent/source behavior.**

- [Gainsight Data Designer merges and transforms multiple source datasets for analysis; it does not specify that an explanatory note makes divergent financial values agree.](https://support.gainsight.com/gainsight_nxt/Data_Designer/About/Data_Designer_Overview?product=marketing)
- [Harvest permits invoice operations to administrators and managers with invoice rights, with currency and payment state explicit.](https://help.getharvest.com/api-v2/invoices-api/invoices/)

**Engineering/proof distinction.** Remaining retained-history, source-link and exact-SHA acceptance proof must be judged independently; a ruling alone cannot mark person reconciliation done.

Main reference: `CONTRACT.md:77` at `6d320c7a5c3e2b9bb29d41519d6403ef59fdc01f`; current Status Gap was read in full. Route: `round`.

### RL-102 — Shared success plans and goals

Date: 2026-10-28 · Ruled by: ct · Governs: `PLAN-001`.

**Question.** Should all internal plan drafts permanently exclude otherwise authorized CS managers and CSMs?

**Proposed/adopted default.** Only owners/admins read or edit internal drafts; customers cannot be confirmed by staff; restored owner identifiers grant no rights.

**Outcome: replace.** Replace the blanket owner/admin-only target with ROLE-001’s current account-scoped plan read/edit rights, preserving owner/admin as the only implemented door until delegated enforcement is built; authenticated customers alone confirm their own statements.

**Why.** Gainsight allows CSM plan work and controlled internal/external sharing. Buoy’s own ROLE-001 expressly grants team/own-book plan editing; a permanent administrator monopoly would contradict both.

**Rider.** Require current account and field authorization on plan reads, edits and retained review artifacts; PORTAL-001 still owns customer access, and restored assignments remain inert until valid local authorization exists.

**Place once.** PLAN-001 cites ROLE-001 and PORTAL-001; one acceptance point proves delegated author and customer-confirmation separation.

**Incumbent/source behavior.**

- [Gainsight lets CSMs share success plans with internal and external people under admin-configured editing, sharing and security controls.](https://support.gainsight.com/gainsight_nxt/Success_Plans/User_Guides/Share_Success_Plan)

**Engineering/proof distinction.** Customer portal, exact milestone outcome windows and captured-review restoration remain unfinished.

Main reference: `CONTRACT.md:131` at `6d320c7a5c3e2b9bb29d41519d6403ef59fdc01f`; current Status Gap was read in full. Route: `round`.

### RL-103 — Automated playbooks

Date: 2026-10-28 · Ruled by: ct · Governs: `PLAY-001`.

**Question.** Should owner/admin-only publication and manual receipts replace the contract’s delegated team publishing and automatic playbook target?

**Proposed/adopted default.** Owner/admin definition/run authority, exact revision human approvals, manual external-work evidence and no automatic outbound actions.

**Outcome: replace.** Replace the permanent owner/admin-only automation rule with ROLE-001’s design/publish/run scopes, including team-scoped CS-manager publication, and allow only explicitly reviewed standing workflow authority or required exact human approvals to execute external steps.

**Why.** Gainsight separates design/distribute/analyze/admin permissions and supports scheduled programs. Buoy’s own role matrix likewise authorizes CS managers for team publishing; the manual owner/admin slice is an interim implementation limit.

**Rider.** A manual receipt remains a reported human outcome, never provider verification; retain the full trigger/wait/branch/exit/send acceptance and recheck current authority, source revision, recipient permission and suppression before dispatch.

**Place once.** PLAY-001 cites ROLE-001 and APPROVAL-001; put shared execution authorization in one automation door rule.

**Incumbent/source behavior.**

- [Gainsight separates program design, distribution, analysis and administration permissions, including scheduled execution.](https://support.gainsight.com/gainsight_nxt/Journey_Orchestrator_and_Email_Templates/Programs/Journey_Orchestrator_Permissions)

**Engineering/proof distinction.** Automatic provider transport and inherited PLAY-004 outcome proof remain build work; no automatic outbound authority is supplied by this ruling itself.

Main reference: `CONTRACT.md:121` at `6d320c7a5c3e2b9bb29d41519d6403ef59fdc01f`; current Status Gap was read in full. Route: `round`.

### RL-104 — Automation run history and failure alerts

Date: 2026-10-28 · Ruled by: ct · Governs: `PLAY-003`.

**Question.** May current manual external-work reports coexist with a no-outbound interim boundary without claiming executed retries or alerts?

**Proposed/adopted default.** Owner/admin-only evidence history, no automatic outbound transport, manual external-work receipts.

**Outcome: adopt with rider.** Approve the bounded history of explicit human external-work reports, labelled as unverified reports, without treating them as executed webhook calls, delivered alerts or successful provider retries.

**Why.** Gainsight’s program analysis permission is distinct from distribution and administration. No common norm treats a manual report as execution evidence; truthfully bounded reporting is the safe interim default.

**Rider.** Before this clause is complete, authorize analysis/history access according to ROLE-001, execute the actual configured failure notification and retry only failed work without duplicating completed effects; resolve uncertain external results before another send.

**Place once.** PLAY-003 owns one run-history/retry acceptance point and cites the PLAY-001 automation door rule.

**Incumbent/source behavior.**

- [Gainsight separates program design, distribution, analysis and administration permissions, including scheduled execution.](https://support.gainsight.com/gainsight_nxt/Journey_Orchestrator_and_Email_Templates/Programs/Journey_Orchestrator_Permissions)
- [Zapier lets users choose whether trigger errors notify never, repeatedly, always or through a configured Manager workflow.](https://help.zapier.com/hc/en-us/articles/15666606859661-Customize-your-trigger-error-notifications)

**Engineering/proof distinction.** Webhook failure/retry, Slack threshold delivery and unified journey/connector logs remain engineering/proof gaps.

Main reference: `CONTRACT.md:125` at `6d320c7a5c3e2b9bb29d41519d6403ef59fdc01f`; current Status Gap was read in full. Route: `round`.

### RL-105 — Dashboards and report builder

Date: 2026-10-28 · Ruled by: ct · Governs: `REPORT-002`.

**Question.** Should report authors remain permanently restricted to owners/admins despite authorized self-service reporting?

**Proposed/adopted default.** Owner/admin authors; explicit role shares expose definitions only and never widen current record/commercial rights or restore authority.

**Outcome: replace.** Replace permanent owner/admin-only authorship with explicitly assigned report/dashboard author rights under ROLE-001, scoped to permitted objects/accounts/fields; role shares expose definitions while every computed result and export retains the viewer’s current data scope.

**Why.** Gainsight permits non-admin report builders on assigned objects and private dashboards. Blanket owner/admin authorship does not satisfy Buoy’s user report-builder target.

**Rider.** Keep shares installation-local and inactive after restore until current authorization; schedules must use the recipient’s current scope and consent, and wider object/catalog/scheduled-delivery acceptance remains required.

**Place once.** REPORT-002 owns author/viewer acceptance and cites ROLE-001 plus the schedule door rule once.

**Incumbent/source behavior.**

- [Gainsight permits authorized non-admin report builders to create and share reports on assigned objects and private dashboards.](https://support.gainsight.com/gainsight_nxt/Reports_and_Dashboards/Admin_Guides/Configure_Self-Service_Analytics)

Main reference: `CONTRACT.md:175` at `6d320c7a5c3e2b9bb29d41519d6403ef59fdc01f`; current Status Gap was read in full. Route: `round`.

### RL-106 — Business review preparation and decks

Date: 2026-10-28 · Ruled by: ct · Governs: `REVIEW-001`.

**Question.** Should QBR preparation and export permanently exclude permitted account CSMs?

**Proposed/adopted default.** Owner/admin-only local generation/review/export and approved internal follow-ups; no customer send; linked-person decks follow erasure.

**Outcome: replace.** Replace permanent owner/admin-only review preparation with ROLE-001 account/field/export rights, permitting authorized CSMs to prepare, review and export their account’s deck; require exact current-version human review before customer disclosure or provider upload.

**Why.** Gainsight CSMs export customer decks and authorize Google Slides access separately. Buoy can keep its current owner/admin door while building delegated roles, but that restriction cannot become the final product rule.

**Rider.** Captured decks remain scoped and erasable with linked-person records and applicable holds; exporting locally is not customer delivery or Google Slides upload, and each internal follow-up needs its named current command authority.

**Place once.** REVIEW-001 owns review/export acceptance and cites ROLE-001, erasure and provider custody once.

**Incumbent/source behavior.**

- [Gainsight CSMs export customer review presentations from admin templates; Google Slides export requires a revocable Google authorization.](https://support.gainsight.com/gainsight_nxt/07360/User_Guides/Export_Success_Snapshot_Presentations)

**Engineering/proof distinction.** An authorized Google connection, complete historical source coverage and Unicode PDF rendering remain external/proof and engineering work.

Main reference: `CONTRACT.md:135` at `6d320c7a5c3e2b9bb29d41519d6403ef59fdc01f`; current Status Gap was read in full. Route: `round`.

### RL-107 — Roles and permissions

Date: 2026-10-28 · Ruled by: ct · Governs: `ROLE-001`.

**Question.** May archives restore custom role definitions while leaving person assignments and named approvals inactive?

**Proposed/adopted default.** Restore custom definitions, exclude executable person assignments/named grants and require fresh owner/admin reassignment.

**Outcome: adopt.** Adopt portable custom-role definitions as inert configuration: destination roles, identity assignments and named approval rights activate only after a current destination owner/admin explicitly reviews the intended local person, scope and limits.

**Why.** Gainsight’s permission bundles assign actual functional rights. No common cross-install restoration norm is documented here; preserving definitions without importing authority is the safest default and respects the seed’s identity boundary.

**Incumbent/source behavior.**

- [Gainsight assigns functional permissions through permission bundles, including program and success-plan rights.](https://support.gainsight.com/gainsight_nxt/01Onboarding_and_Implementation/Onboarding_for_Gainsight_NXT/Login_and_Permissions/04Permission_Bundles?mt-learningpath=stdeditioncustomeronboarding)

**Engineering/proof distinction.** The complete UI/API matrix, commercial edit scopes and CRM identity mapping remain implementation proof; this ruling changes no staff-role entitlement.

Main reference: `CONTRACT.md:179` at `6d320c7a5c3e2b9bb29d41519d6403ef59fdc01f`; current Status Gap was read in full. Route: `round`.

### RL-1 — AI-001 native proof boundary

Date: 2026-10-25 · Ruled by: ct · Governs: `AI-001`.

the current completion boundary is extractive account facts selected by a model, with fixed working account citations and explicit unavailable sources. Free-form generated claims and supporting record-level citations remain in AI-005. Every existing CSM and read-only profile is projected before transmission and rendering; meeting briefs use this same extractive door. No agent paid scope is granted.

The supplied risk-and-policy standard governs the target agent surface; this historical native slice supplies no disposition for an agent class.

### RL-2 — AI-002 native proof boundary

Date: 2026-10-25 · Ruled by: ct · Governs: `AI-002`.

the current native door is explicit owner or administrator transcript preparation. Only the exact selected lines and their original line numbers are retained as cited proposals; the full transcript is not stored. A person can accept a task once; plan, risk and expansion items remain suggestions, with no corresponding update executed. Discard deletes the selected-line proposal and retains only an opaque audit receipt. Account erasure cascades through proposals and accepted native work. Broader linked-person redaction and granular holds inherit ERASE-002 before broader source intake ships. EMAIL-001, MEET-002, CHAT-001 and SUPPORT-001 to SUPPORT-005 inherit cited proposals, selected-line custody, review, discard and erasure before adding their source kinds.

The supplied risk-and-policy standard governs the target agent surface; this historical native slice supplies no disposition for an agent class.

### RL-3 — AI-004 native proof boundary

Date: 2026-10-25 · Ruled by: ct · Governs: `AI-004`.

only the owner configures models and data classes, and AI starts off. Interactive calls require explicit per-request consent. AI-006 now supplies separate feature-specific owner authorization for scheduled questions; no agent AI work is authorized. No-training terms are an owner-recorded attestation always rendered unverified, never a claim that Buoy verified provider practice. Costs are measured tokens at owner-recorded tariffs, rounded upward to USD cents, with uncertain calls retaining their reservation. Standing consent is governed by AI-006; per-request consent never grants it.

The supplied risk-and-policy standard governs the target agent surface; this historical native slice supplies no disposition for an agent class.

### RL-4 — Native data-trust review

Date: 2026-10-27 · Ruled by: ct · Governs: `AGENT-007`.

CT scope ruling, 27 October 2026: APPROVE WITH RIDERS for explicit native data-trust review only.

Current native owners and admins alone may prepare, read and decide the bounded review; current role and record authority is rechecked at each door and before effects.

Segment native-ID hints and retained source-owner claims remain visibly unverified, never identity authority.

A human must inspect the exact source claim, both account identities and independently reviewed target membership before approving a mapping correction; approval authorizes only that fingerprint-bound mapping.

Changed evidence, membership, source or current authority requires fresh preparation and approval.

An approved correction retains source provenance, updates both affected health scores and records the change without rewriting source observations.

Duplicate, ARR and stale-source approvals create owned fix tasks while preserving company records and every source value; task creation is neither an identity merge nor revenue-authority selection or source repair. No scheduled watch, model request, automatic correction, merge, revenue mutation or outbound effect is authorized by this default. Admin-only upkeep is too narrow as the permanent operating model for the contracted CS team: ROLE-001 must provide separately scoped evidence reads and preparation for CS managers, CSMs and authorized CS operations staff, respecting account and commercial-field limits; mapping decisions, merges and source-authority changes retain explicit admin approval. Future scoped agents require their own GOVERN-001 grants and cannot approve themselves. Complete watching, source disagreement detection, approved fixes and evidenced health updates remain owed. This ruling supersedes the pending review-policy label, changes no original acceptance sentence or status, and accepts no implementation completion or production readiness. **Current native door (27 October 2026).** An explicit owner or admin review prepares deterministic findings from exact normalized company names, current confirmed-contract and reviewed Stripe ARR pairs, and stale health sources. The latest stored Segment group observation can also propose a correction when its explicit `buoyAccountId` trait differs from the current mapping, the target exists and any user has reviewed membership there; the source claim is retained and labelled unverified, never treated as identity authority. A proposed Segment correction retains an explicit source-owner reference, the exact source claim and both account identities. Admin approval applies only that fingerprint-bound mapping and refreshes both health scores with a visible correction note; changed evidence is refused. Duplicate, ARR and stale-source approvals create one owned fix task, preserving both companies and every source value; they do not merge identities or choose revenue authority. Current-door policy follows the CT scope ruling above. Linked trust evidence joins person privacy export and preview, exact reviewed narrative redaction, whole-customer holds with retained versions, and person erasure; import undo refuses trust work linked through either account.

The native owner/admin slice remains implementation history; target CS preparation follows ROLE-001, and agent mapping, merge and source-authority calls carry access, destructive or commitment as computed and are decided by company policy.


### RL-108 — Portal sharing authority

Date: 2026-10-27 · Ruled by: ct · Governs: `PLAN-001`, `PORTAL-001`.

**Outcome: approve with riders.** The following ruling was issued at 06:16:58 UTC in ct policy batch 21. It approves authority policy and makes no implementation completion claim.

> Only a current native owner explicitly invites the named customer owner, whose native email confirmation must precede sharing one exact reviewed plan revision. Customer-only sessions authorize only that recipient's shared projection; grants last 1 to 365 days and bind the recipient version and issuing-owner version. A plan edit, recipient or issuer authority change, membership withdrawal, expiry or revocation stops access on the next request, including an already open session; archive restore restores no grant, invitation authority or session. The owner explicitly selects each customer task. Only that authenticated recipient may confirm a customer statement on the exact shared revision; staff cannot confirm for the customer. Invitations require a separate explicit send action; sharing, confirmation, comments and task actions cause no automatic sends. Internal notes, health scores, other accounts and unselected tasks remain private. Owner-only sharing is the initial authority policy; owner-only internal plan work is insufficient for day-one customer success operations. Account-scoped CSM preparation, maintenance, task ownership, handover and review must follow under current staff authority, while the owner retains publication authority until separately reviewed scoped delegation exists. Provider delivery, file uploads, company SSO and legal acceptance are not established by native confirmation. This ruling accepts authority policy only; PLAN-001 remains partial.

**Engineering distinction.** Native company SSO protocol tests establish the application side of a linked provider. Real Google, Microsoft and Okta tenant interoperability stays with ROLE-002 and its field proof. Native uploads and customer edits need their own custody and authorization journeys.
