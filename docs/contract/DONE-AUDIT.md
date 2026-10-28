ONTO: `697ed0c63a956fe7640d7a024ce2f45c14cc7a39`. Old reference: `fab68ffc3066c5f4852bc4cf9c158e3fb9c8f8c3`.

| Clause | Point | Outcome | Asserting test | Result |
| --- | --- | --- | --- | --- |
| `HTTP-001` | 1 | Signed-out data read is refused | `tests/flows.test.mjs:41` | asserted |
| `HTTP-001` | 1 | Cross-origin browser account write is refused | `tests/flows.test.mjs:42` | asserted |
| `HTTP-001` | 1 | Member account edit is refused | `tests/flows.test.mjs:65` | asserted |
| `HTTP-001` | 1 | Member person-approval is refused | `tests/flows.test.mjs:67` | asserted |
| `HTTP-001` | 1 | Every product route has the named actor matrix; the cited file exercises a route inventory but does not assert this whole matrix | none | none |
| `HTTP-001` | 2 | No-Origin bearer preparation succeeds and its saved proposal identifies the agent | none | none |
| `HTTP-001` | 2 | Foreign-Origin bearer preparation succeeds and its saved audit identifies the agent | none | none |
| `HTTP-001` | 3 | Held-policy bearer person-approval is refused | `tests/flows.test.mjs:83` | asserted |
| `HTTP-001` | 3 | Held-policy bearer account edit is refused | `tests/flows.test.mjs:196` | asserted |
| `HTTP-001` | 3 | Unsupported bearer command is refused with a reason | `tests/flows.test.mjs:196` | asserted |
| `HTTP-001` | 4 | Valid bearer plus cookie keeps only bearer scope | none | none |
| `HTTP-001` | 4 | Invalid bearer plus cookie cannot authorize cross-origin writes | none | none |
| `HTTP-001` | 4 | Expired bearer plus cookie cannot authorize cross-origin writes | none | none |
| `HTTP-001` | 4 | Revoked bearer plus cookie cannot authorize cross-origin writes | none | none |
| `DATA-001` | 1 | Negative money is rejected | `tests/flows.test.mjs:160` | asserted |
| `DATA-001` | 1 | Impossible observation date is rejected | `tests/flows.test.mjs:160` | asserted |
| `DATA-001` | 1 | Unsupported observation field is rejected | `tests/flows.test.mjs:160` | asserted |
| `DATA-001` | 1 | Missing evidence yields unknown health status; this does not assert the named reasons | `tests/flows.test.mjs:58` | asserted |
| `DATA-001` | 1 | Missing billing evidence is named on the account | none | none |
| `DATA-001` | 1 | Missing support evidence is named on the account | none | none |
| `DATA-001` | 1 | Billing and support staleness is named | `tests/flows.test.mjs:173` | asserted |
| `DATA-001` | 1 | Old preparation retains its exact prior input | `tests/flows.test.mjs:186` | asserted |
| `DATA-001` | 2 | Billing threshold changes stale evidence | `tests/flows.test.mjs:180` | asserted |
| `DATA-001` | 2 | Support threshold changes stale evidence | `tests/flows.test.mjs:181` | asserted |
| `DATA-001` | 3 | Connected repeat is a pointer to CONNECT-001, retained in the Requirement and linked domain rules | none | moved |
| `APPROVAL-001` | 1 | Two approvals create one task | `tests/flows.test.mjs:72` | asserted |
| `APPROVAL-001` | 1 | Completion without evidence is refused | `tests/flows.test.mjs:74` | asserted |
| `APPROVAL-001` | 1 | Completion with evidence is stored | `tests/flows.test.mjs:378` | asserted |
| `APPROVAL-001` | 1 | One renewed decision and its evidence are retained | `tests/flows.test.mjs:86` | asserted |
| `APPROVAL-001` | 1 | Stale approval is refused after source refresh | `tests/flows.test.mjs:94` | asserted |
| `APPROVAL-001` | 1 | Earlier decision retains original renewal date | `tests/flows.test.mjs:95` | asserted |
| `IMPORT-001` | 1 | Planning leaves native records unchanged | `tests/import-door-journey.mjs:31` | asserted |
| `IMPORT-001` | 2 | Wrong reviewed fingerprint is refused | `tests/flows.test.mjs:103` | asserted |
| `IMPORT-001` | 2 | Apply reaches completed state | `tests/flows.test.mjs:105` | asserted |
| `IMPORT-001` | 2 | Replay returns original job | `tests/flows.test.mjs:106` | asserted |
| `IMPORT-001` | 2 | Reconciliation reads present native record | `tests/flows.test.mjs:108` | asserted |
| `IMPORT-001` | 2 | Undo removes imported native account | `tests/flows.test.mjs:110` | asserted |
| `IMPORT-001` | 3 | Native edit refuses undo | `tests/import-door-journey.mjs:78` | asserted |
| `IMPORT-001` | 3 | Dependent work refuses undo | `tests/flows.test.mjs:116` | asserted |
| `IMPORT-001` | 4 | Revoked-session mutation is refused | `tests/import-door-journey.mjs:34` | asserted |
| `IMPORT-001` | 4 | Owner undo works with Business disabled | `tests/import-door-journey.mjs:58` | asserted |
| `IMPORT-001` | 4 | Revoked Business key stays refused | `tests/import-door-journey.mjs:73` | asserted |
| `IMPORT-001` | 4 | Every anonymous/member/cross-origin mutation and disabled Business grant is asserted in the complete actor matrix | none | none |
| `IMPORT-001` | 5 | Explicit disable stays disabled on later owner path | `tests/import-door-journey.mjs:57` | asserted |
| `IMPORT-001` | 5 | Revoked keys remain retained | `tests/import-door-journey.mjs:72` | asserted |
| `IMPORT-001` | 5 | Re-enable does not revive revoked key | `tests/import-door-journey.mjs:73` | asserted |
| `IMPORT-001` | 5 | Only provisioning opt-in opens initially across both claim variants | `tests/import-door-journey.mjs:15` | asserted |
| `IMPORT-001` | 6 | Erased import source name is absent from retained job | `tests/flows.test.mjs:122` | asserted |
| `IMPORT-001` | 6 | Erased import source invoice reference is absent from retained job | `tests/flows.test.mjs:122` | asserted |
| `IMPORT-001` | 6 | Reconciliation reports withdrawal | `tests/flows.test.mjs:124` | asserted |
| `IMPORT-001` | 6 | Same target cannot be recreated | `tests/flows.test.mjs:123` | asserted |
| `IMPORT-001` | 6 | Journal inventories door custody | `tests/import-door-journey.mjs:83` | asserted |
| `IMPORT-001` | 6 | Native replay is refused after erasure for every named source-custody path | none | none |
| `ERASE-001` | 1 | Member erasure is refused | `tests/flows.test.mjs:117` | asserted |
| `ERASE-001` | 1 | Native account is removed | `tests/flows.test.mjs:119` | asserted |
| `ERASE-001` | 1 | Dependent proposal is removed | `tests/flows.test.mjs:119` | asserted |
| `ERASE-001` | 1 | Retained import job omits account name and invoice | `tests/flows.test.mjs:122` | asserted |
| `ERASE-001` | 1 | Same target cannot be recreated | `tests/flows.test.mjs:123` | asserted |
| `ERASE-001` | 1 | Full state, import journal and history contain nothing naming the erased account; a subset/job read is insufficient | none | none |
| `SITE-001` | 1 | Homepage reaches run instructions | `tests/site.mjs:49` | asserted |
| `SITE-001` | 1 | Homepage reaches docs navigation | `tests/site.mjs:50` | asserted |
| `SITE-001` | 1 | Guides are traversed as linked resources | `tests/site.mjs:34` | asserted |
| `SITE-001` | 1 | Unknown path returns 404 | `tests/site.mjs:71` | asserted |
| `STYLE-001` | 1 | installation-hosted fonts across homepage/run/docs/setup/sign-in/account-list/account/import at 1440 | `tests/style.mjs:82` | asserted |
| `STYLE-001` | 1 | selected faces across homepage/run/docs/setup/sign-in/account-list/account/import at 1440 | `tests/style.mjs:85` | asserted |
| `STYLE-001` | 1 | mark across homepage/run/docs/setup/sign-in/account-list/account/import at 1440 | `tests/style.mjs:89` | asserted |
| `STYLE-001` | 1 | controls on screen across homepage/run/docs/setup/sign-in/account-list/account/import at 1440 | `tests/style.mjs:91` | asserted |
| `STYLE-001` | 1 | no clipped text across homepage/run/docs/setup/sign-in/account-list/account/import at 1440 | `tests/style.mjs:92` | asserted |
| `STYLE-001` | 1 | usable form submit across homepage/run/docs/setup/sign-in/account-list/account/import at 1440 | `tests/style.mjs:94` | asserted |
| `STYLE-001` | 1 | installation-hosted fonts across homepage/run/docs/setup/sign-in/account-list/account/import at 390 | `tests/style.mjs:82` | asserted |
| `STYLE-001` | 1 | selected faces across homepage/run/docs/setup/sign-in/account-list/account/import at 390 | `tests/style.mjs:85` | asserted |
| `STYLE-001` | 1 | mark across homepage/run/docs/setup/sign-in/account-list/account/import at 390 | `tests/style.mjs:89` | asserted |
| `STYLE-001` | 1 | controls on screen across homepage/run/docs/setup/sign-in/account-list/account/import at 390 | `tests/style.mjs:91` | asserted |
| `STYLE-001` | 1 | no clipped text across homepage/run/docs/setup/sign-in/account-list/account/import at 390 | `tests/style.mjs:92` | asserted |
| `STYLE-001` | 1 | usable form submit across homepage/run/docs/setup/sign-in/account-list/account/import at 390 | `tests/style.mjs:94` | asserted |
| `STYLE-001` | 1 | Favicons include both 16 and 32 pixel frames | `tests/style.mjs:133` | asserted |
| `ACCOUNT-001` | 1 | Parent has two children | `tests/hierarchy-journey.mjs:22` | asserted |
| `ACCOUNT-001` | 1 | Parent counts 40 distinct users | `tests/hierarchy-journey.mjs:22` | asserted |
| `ACCOUNT-001` | 1 | A contact appears in both memberships | `tests/hierarchy-journey.mjs:23` | asserted |
| `ACCOUNT-001` | 1 | Member cannot reassign relationship hierarchy | `tests/hierarchy-journey.mjs:25` | asserted |
| `ACCOUNT-001` | 1 | Member cannot reassign ownership | `tests/hierarchy-journey.mjs:26` | asserted |
| `ACCOUNT-001` | 1 | Relationships have distinct CSMs | `tests/hierarchy-journey.mjs:44` | asserted |
| `ACCOUNT-001` | 1 | Relationships have independent health scores | `tests/hierarchy-journey.mjs:44` | asserted |
| `ACCOUNT-001` | 1 | Parent ARR equals sum of child rollups | `tests/hierarchy-journey.mjs:48` | asserted |
| `ACCOUNT-001` | 1 | Parent health includes terminal source scores | `tests/hierarchy-journey.mjs:48` | asserted |
| `ACCOUNT-004` | 1 | Ten-account preview is read back | `tests/field-journey.mjs:37` | asserted |
| `ACCOUNT-004` | 1 | Preview formula values equal independent seat division | `tests/field-journey.mjs:38` | asserted |
| `ACCOUNT-004` | 1 | Preview shows both formula inputs | `tests/field-journey.mjs:38` | asserted |
| `ACCOUNT-004` | 1 | Saving calculation produces current formula result | `tests/field-journey.mjs:50` | asserted |
| `ACCOUNT-004` | 1 | Changed input recalculates | `tests/field-journey.mjs:57` | asserted |
| `ACCOUNT-004` | 1 | History records actor, source and time | `tests/field-journey.mjs:59` | asserted |
| `ACCOUNT-004` | 1 | History retains old and new input values | `tests/field-journey.mjs:60` | asserted |
| `ACCOUNT-004` | 1 | History records both old/new formula-result changes as well as input changes; cited body checks existence but not both full formula change tuples | none | none |
| `BILLING-001` | 1 | Monthly ARR equals native price times quantity times twelve | `tests/billing-journey.mjs:81` | asserted |
| `BILLING-001` | 1 | Annual ARR equals native annual total | `tests/billing-journey.mjs:82` | asserted |
| `BILLING-001` | 1 | Upgrade updates ARR | `tests/billing-journey.mjs:132` | asserted |
| `BILLING-001` | 1 | Downgrade updates ARR | `tests/billing-journey.mjs:135` | asserted |
| `BILLING-001` | 1 | Failed payment appears as source risk | `tests/billing-journey.mjs:86` | asserted |
| `BILLING-001` | 1 | Only matching account gets failed-payment health | `tests/billing-journey.mjs:99` | asserted |
| `BILLING-001` | 1 | Other account has no failed-payment or overdue reason | `tests/billing-journey.mjs:101` | asserted |
| `BILLING-001` | 1 | Product Stripe transport uses GET only | `tests/billing-journey.mjs:17` | asserted |
| `BILLING-001` | 1 | Cancellation reaches zero ARR with explicit source read-back | `tests/billing-journey.mjs:168` | asserted |
| `BILLING-004` | 1 | Native USD/EUR/GBP/CAD and independent converted source totals agree | `tests/reporting-sandbox.mjs:55` | asserted |
| `BILLING-004` | 1 | Converted ARR and MRR use stated rate | `tests/reporting-sandbox.mjs:57` | asserted |
| `BILLING-004` | 1 | NRR numerator and denominator match independent calculation | `tests/reporting-sandbox.mjs:59` | asserted |
| `BILLING-004` | 1 | FX movement is separate from constant-currency movement | `tests/reporting-sandbox.mjs:59` | asserted |
| `BILLING-004` | 1 | Rate edit restates only reporting figures | `tests/reporting-sandbox.mjs:67` | asserted |
| `BILLING-004` | 1 | Rate edit has an audit event | `tests/reporting-sandbox.mjs:67` | asserted |
| `BILLING-004` | 1 | Native provider documents remain exactly unchanged | `tests/reporting-sandbox.mjs:68` | asserted |
| `BILLING-004` | 1 | The real provider year and source invoice links are retained | `tests/reporting-sandbox.mjs:56` | asserted |
| `USAGE-001` | 1 | Mapped retained events total 99000 unique events | `tests/usage-journey.mjs:94` | asserted |
| `USAGE-001` | 1 | Per-account counts equal independently expected unique counts | `tests/usage-journey.mjs:97` | asserted |
| `USAGE-001` | 1 | Event attribution names expected account and person | `tests/usage-journey.mjs:99` | asserted |
| `USAGE-001` | 1 | The original volume retains the unknown group in review | `tests/usage-journey.mjs:102` | asserted |
| `ADOPT-001` | 1 | Activity matches independent event calculation | `tests/adoption.mjs:13` | asserted |
| `ADOPT-001` | 1 | Utilization matches independent seat denominator | `tests/adoption.mjs:15` | asserted |
| `ADOPT-001` | 1 | Adoption feature fractions match independent people counts | `tests/adoption.mjs:18` | asserted |
| `ADOPT-001` | 1 | Thirty-percent weekly decline is flagged | `tests/adoption.mjs:16` | asserted |
| `ADOPT-001` | 1 | Thirty accounts and 300 people are present | `tests/adoption.mjs:20` | asserted |
| `HEALTH-001` | 1 | Five input classes and segment-specific weights are present | `tests/health-scorecard-journey.mjs:44` | asserted |
| `HEALTH-001` | 1 | Draft uses segment-specific effective weights | `tests/health-scorecard-journey.mjs:58` | asserted |
| `HEALTH-001` | 1 | Preview has no persistent effects | `tests/health-scorecard-journey.mjs:52` | asserted |
| `HEALTH-001` | 1 | Missing required source becomes unknown | `tests/health-scorecard-journey.mjs:60` | asserted |
| `HEALTH-001` | 1 | Every measure has sources and freshness | `tests/health-scorecard-journey.mjs:62` | asserted |
| `HEALTH-001` | 1 | Republishing preserves previous immutable version | `tests/health-scorecard-journey.mjs:185` | asserted |
| `HEALTH-001` | 1 | Changed source recalculates within the specified bound | `tests/health-scorecard-journey.mjs:117`; `tests/health-scorecard-journey.mjs:118`; `tests/health-scorecard-journey.mjs:120` | asserted |
| `HEALTH-001` | 1 | Unchanged account hourly timestamp is fresh | `tests/health-scorecard-journey.mjs:135` | asserted |
| `HEALTH-001` | 1 | Excluded missing measure is not reweighted as a fabricated zero | `tests/health-scorecard-journey.mjs:71` | asserted |
| `HEALTH-002` | 1 | Person sentiment changes health | `tests/flows.test.mjs:146` | asserted |
| `HEALTH-002` | 1 | Reason identifies person and judgment | `tests/flows.test.mjs:147` | asserted |
| `HEALTH-002` | 1 | Expiry makes sentiment missing | `tests/flows.test.mjs:155` | asserted |
| `HEALTH-002` | 2 | Sentiment counts on expiry date | `tests/flows.test.mjs:152` | asserted |
| `HEALTH-002` | 3 | Held-policy agent rating is refused | `tests/flows.test.mjs:142` | asserted |
| `HEALTH-002` | 3 | Agent-authored equivalent is classified standard and decided by actual company policy | none | none |
| `SEGMENT-001` | 1 | Initial entry has timestamp and correct account | `tests/segment-journey.mjs:24` | asserted |
| `SEGMENT-001` | 1 | Exactly one approved task is created | `tests/segment-journey.mjs:31` | asserted |
| `SEGMENT-001` | 1 | Inclusive threshold exits and is timestamped | `tests/segment-journey.mjs:33` | asserted |
| `SEGMENT-001` | 1 | Different currencies do not mix | `tests/segment-journey.mjs:34` | asserted |
| `SEGMENT-001` | 1 | Reentry has a new distinct proposal | `tests/segment-journey.mjs:35` | asserted |
| `SEGMENT-001` | 1 | Report has exact selected account and risk count | `tests/segment-journey.mjs:42` | asserted |
| `SEGMENT-001` | 1 | CSV includes selected account | `tests/segment-journey.mjs:43` | asserted |
| `SEGMENT-001` | 2 | Reads and Cron do not duplicate entries | `tests/segment-journey.mjs:29` | asserted |
| `SEGMENT-001` | 2 | Stale account revision refuses approval | `tests/segment-journey.mjs:36` | asserted |
| `SEGMENT-001` | 2 | Stale configuration refuses approval | `tests/segment-journey.mjs:40` | asserted |
| `SEGMENT-001` | 2 | Exited-entry approval is refused after exit | `tests/segment-journey.mjs:73` | asserted |
| `SEGMENT-001` | 3 | Used custom tier cannot be removed | `tests/segment-journey.mjs:20` | asserted |
| `SEGMENT-001` | 3 | Member cannot edit tier list | `tests/segment-journey.mjs:16` | asserted |
| `SEGMENT-001` | 3 | Custom tier is returned after manual classification | `tests/segment-journey.mjs:47` | asserted |
| `SEGMENT-001` | 4 | Static-list membership | `tests/segment-journey.mjs:53` | asserted |
| `SEGMENT-001` | 4 | Typed any rules | `tests/segment-journey.mjs:56` | asserted |
| `SEGMENT-001` | 4 | Missing rules | `tests/segment-journey.mjs:56` | asserted |
| `SEGMENT-001` | 4 | Manual tier/stage clearing | `tests/segment-journey.mjs:48` | asserted |
| `SEGMENT-001` | 4 | Import membership refresh | `tests/segment-journey.mjs:82` | asserted |
| `SEGMENT-001` | 4 | Sentiment expiry membership | `tests/segment-journey.mjs:67` | asserted |
| `SEGMENT-001` | 4 | Team allocation from segment | `tests/segment-journey.mjs:77` | asserted |
| `SEGMENT-001` | 4 | Erasure removes membership | `tests/segment-journey.mjs:81` | asserted |
| `SEGMENT-001` | 4 | Member mutation is refused | `tests/segment-journey.mjs:11` | asserted |
| `SEGMENT-001` | 4 | Native form end states at 1440 | `tests/segments.mjs:30` | asserted |
| `SEGMENT-001` | 4 | Native form end states at 390 | `tests/segments.mjs:30` | asserted |
| `SEGMENT-001` | 5 | Numeric sourced ARR/health repeat remains the linked BILLING-003 and HEALTH-001 obligation | none | moved |
| `PLAY-002` | 1 | Before-due and due-today reminders reach inbox | `tests/flows.test.mjs:343` | asserted |
| `PLAY-002` | 1 | Reminder email names each task once | `tests/flows.test.mjs:345` | asserted |
| `PLAY-002` | 1 | Overdue escalation reaches manager once | `tests/flows.test.mjs:350` | asserted |
| `PLAY-002` | 1 | Reassignment moves open tasks and preserves separately owned work | `tests/flows.test.mjs:355` | asserted |
| `PLAY-002` | 1 | Away cover handles tasks through both dates | `tests/flows.test.mjs:364` | asserted |
| `PLAY-002` | 1 | Task handlers return after the away period | `tests/flows.test.mjs:365` | asserted |
| `PLAY-002` | 1 | Completed task stores outcome, evidence and completion | `tests/flows.test.mjs:378` | asserted |
| `PLAY-004` | 1 | Enrolled and control cohorts each contain forty accounts | `tests/outcome-journey.mjs:22` | asserted |
| `PLAY-004` | 1 | Correct enrolled list | `tests/outcome-journey.mjs:24` | asserted |
| `PLAY-004` | 1 | Correct control list | `tests/outcome-journey.mjs:25` | asserted |
| `PLAY-004` | 1 | Recovery rates are fifty and twelve-and-a-half percent | `tests/outcome-journey.mjs:31` | asserted |
| `PLAY-004` | 1 | First-observed elapsed times match timestamps | `tests/outcome-journey.mjs:33` | asserted |
| `PLAY-004` | 1 | Mean elapsed time equals independent mean | `tests/outcome-journey.mjs:34` | asserted |
| `PLAY-004` | 1 | CSV has eighty records and twenty-five reached outcomes | `tests/outcome-journey.mjs:36` | asserted |
| `PLAY-004` | 2 | Already-satisfied baseline is refused | `tests/outcome-journey.mjs:38` | asserted |
| `PLAY-004` | 2 | Member outcome start is refused | `tests/outcome-journey.mjs:16` | asserted |
| `PLAY-004` | 2 | Window is exactly two days | `tests/outcome-journey.mjs:23` | asserted |
| `PLAY-004` | 2 | Replay returns same outcome window | `tests/outcome-journey.mjs:20` | asserted |
| `PLAY-004` | 2 | Segment edit preserves frozen cohorts | `tests/outcome-journey.mjs:41` | asserted |
| `PLAY-004` | 2 | Repeated observation preserves first evidence | `tests/outcome-journey.mjs:35` | asserted |
| `PLAY-004` | 2 | Renewal outcome uses approved decision evidence | `tests/outcome-journey.mjs:46` | asserted |
| `PLAY-004` | 2 | At-deadline observation counts | `tests/outcome-journey.mjs:58` | asserted |
| `PLAY-004` | 2 | Window-missed outcomes are read back | `tests/outcome-journey.mjs:61` | asserted |
| `PLAY-004` | 2 | Late recovery does not count | `tests/outcome-journey.mjs:62` | asserted |
| `PLAY-004` | 2 | Reports never complete tasks | `tests/outcome-journey.mjs:63` | asserted |
| `PLAY-004` | 2 | Erasure removes enrolled evidence | `tests/outcome-journey.mjs:65` | asserted |
| `PLAY-004` | 3 | Rate/timing and comparison form end states at 1440 | `tests/outcomes.mjs:28` | asserted |
| `PLAY-004` | 3 | Evidence is shown at 1440 | `tests/outcomes.mjs:27` | asserted |
| `PLAY-004` | 3 | CSV read-back at 1440 | `tests/outcomes.mjs:29` | asserted |
| `PLAY-004` | 3 | Rate/timing and comparison form end states at 390 | `tests/outcomes.mjs:28` | asserted |
| `PLAY-004` | 3 | Evidence is shown at 390 | `tests/outcomes.mjs:27` | asserted |
| `PLAY-004` | 3 | CSV read-back at 390 | `tests/outcomes.mjs:29` | asserted |
| `INAPP-001` | 1 | Only eligible users see messages | `tests/inapp-journey.mjs:10` | asserted |
| `INAPP-001` | 1 | Caps hold for repeated delivery | `tests/inapp-journey.mjs:34` | asserted |
| `INAPP-001` | 1 | Completion is retained on person timeline | `tests/inapp-journey.mjs:33` | asserted |
| `INAPP-001` | 1 | Walkthrough and banner are rendered on the test product | `tests/inapp-browser.mjs:44` | asserted |
| `NOTIFY-001` | 1 | Inbox has mention, assignment, signal and approval | `tests/flows.test.mjs:414` | asserted |
| `NOTIFY-001` | 1 | Signal is queued under digest preference | `tests/flows.test.mjs:415` | asserted |
| `NOTIFY-001` | 1 | Signal has no immediate email | `tests/flows.test.mjs:416` | asserted |
| `NOTIFY-001` | 1 | One daily digest is sent | `tests/flows.test.mjs:423` | asserted |
| `NOTIFY-001` | 1 | Signal appears once in digest | `tests/flows.test.mjs:424` | asserted |
| `RENEW-001` | 1 | No renewal is generated before the lead window | `tests/renewal-journey.mjs:27` | asserted |
| `RENEW-001` | 1 | Each twelve-contract renewal is created once across quarters | `tests/renewal-journey.mjs:32` | asserted |
| `RENEW-001` | 1 | Notice deadline matches terms | `tests/renewal-journey.mjs:30` | asserted |
| `RENEW-001` | 1 | Expected ARR matches source contract | `tests/renewal-journey.mjs:34` | asserted |
| `RENEW-001` | 1 | Twelve provider subscriptions become twelve unique renewals | `tests/renewal-sandbox.mjs:42` | asserted |
| `RENEW-001` | 1 | Provider end and notice dates match | `tests/renewal-sandbox.mjs:43` | asserted |
| `RENEW-001` | 1 | Billing actual independently reconciles churn and contraction | `tests/renewal-sandbox.mjs:59` | asserted |
| `RENEW-001` | 1 | Billing source link points to retained snapshot | `tests/renewal-sandbox.mjs:60` | asserted |
| `RENEW-001` | 1 | Each stage movement and required outcome approval, including churn reason, is asserted on the stated provider scenario | none | none |
| `RENEW-004` | 1 | Captured baseline remains intact | `tests/forecast-journey.mjs:52` | asserted |
| `RENEW-004` | 1 | Movement reflects all three closed outcomes | `tests/forecast-journey.mjs:81` | asserted |
| `RENEW-004` | 1 | Closed-period actual and accuracy equal independent totals | `tests/forecast-journey.mjs:80` | asserted |
| `RENEW-004` | 1 | Monthly accuracy equals closed-quarter result | `tests/forecast-journey.mjs:82` | asserted |
| `RENEW-004` | 1 | Override reason is retained in field history | `tests/forecast-journey.mjs:90` | asserted |
| `REPORT-001` | 1 | NRR and GRR equal independent period totals | `tests/reporting-sandbox.mjs:59` | asserted |
| `REPORT-001` | 1 | Retained provider invoices cover twelve months and drill-down source links | `tests/reporting-sandbox.mjs:56` | asserted |
| `REPORT-001` | 1 | Each account’s native and converted movement equals expected cents | `tests/reporting-sandbox.mjs:55` | asserted |
| `REPORT-001` | 1 | Injected unmatched invoice is a visible exception | `tests/reporting-sandbox.mjs:60` | asserted |
| `REPORT-001` | 2 | Mixed native and reporting cents match independent rows | `tests/reporting-sandbox.mjs:55` | asserted |
| `REPORT-001` | 2 | Constant-currency NRR/GRR use stated rates | `tests/reporting-sandbox.mjs:59` | asserted |
| `REPORT-001` | 2 | FX is separate from business movement | `tests/reporting-sandbox.mjs:59` | asserted |
| `TEAM-001` | 1 | Three hundred accounts are previewed | `tests/team-journey.mjs:20` | asserted |
| `TEAM-001` | 1 | Four CSMs receive seventy-five accounts each | `tests/team-journey.mjs:21` | asserted |
| `TEAM-001` | 1 | Recorded owner counts match capacity allocation | `tests/team-journey.mjs:25` | asserted |
| `TEAM-001` | 1 | All open tasks move | `tests/team-journey.mjs:46` | asserted |
| `TEAM-001` | 1 | Each moved account has actor/time/handover note | `tests/team-journey.mjs:45` | asserted |
| `TEAM-001` | 1 | Every open plan moves with the book; the cited team journey covers tasks but no plan fixture | none | none |
| `AUDIT-001` | 1 | Sign-ins have actor, time and anonymous subject | `tests/flows.test.mjs:48` | asserted |
| `AUDIT-001` | 1 | Role changes preserve action detail and actor | `tests/flows.test.mjs:282` | asserted |
| `AUDIT-001` | 1 | Approvals remain exactly once | `tests/flows.test.mjs:248` | asserted |
| `AUDIT-001` | 1 | Erased-account actions remain without account or actor display name | `tests/flows.test.mjs:258` | asserted |
| `AUDIT-001` | 1 | Every external-send audit action is asserted through an executed external send | none | none |
| `AUDIT-001` | 1 | Erased-contact audit survival is asserted for the named contact scenario | none | none |
| `AUDIT-001` | 1 | Export and screen reconcile the complete action set across all pages | none | none |
| `A11Y-001` | 1 | Playbook-builder, portal and future report screens complete the named keyboard and axe journey | none | none |
| `A11Y-001` | 1 | Every rendered chart has text alternative | `tests/a11y-checks.mjs:77` | asserted |
| `A11Y-001` | 1 | Health color has a text label | `tests/a11y-checks.mjs:62` | asserted |
| `A11Y-001` | 2 | Current keyboard/focus scenario assertions | `tests/a11y.mjs:75` | asserted |
| `A11Y-001` | 3 | Current keyboard/focus scenario assertions | `tests/a11y.mjs:75` | asserted |
| `A11Y-001` | 2 | Complete named sign-in/setup/expansion/dialog/recovery/preparation/approval/completion/export keyboard outcome set is asserted per width | none | none |
| `A11Y-001` | 3 | Runway has every displayed account in semantic text table | `tests/a11y-checks.mjs:63` | asserted |
| `A11Y-001` | 3 | Every runway table value is compared to public account data, beyond table count | none | none |
| `AI-001` | 1 | Five question-specific substantive answers match expected claims | `tests/ai-journey.mjs:49` | asserted |
| `AI-001` | 1 | Missing executive and excluded sources are named | `tests/ai-journey.mjs:50` | asserted |
| `AI-001` | 1 | Claim citations resolve | `tests/ai-journey.mjs:52` | asserted |
| `AI-001` | 1 | Out-of-scope customer and restricted facts are absent | `tests/ai-journey.mjs:53` | asserted |
| `AI-001` | 2 | Future paid/send/update command accounting is D-3, not a delivered result | none | moved |
| `AI-002` | 1 | Three exact proposals match the expected cited lines | `tests/ai-journey.mjs:81` | asserted |
| `AI-002` | 1 | Retained proposals preserve those exact lines | `tests/ai-journey.mjs:83` | asserted |
| `AI-002` | 1 | Accepted task is the one selected line | `tests/ai-journey.mjs:90` | asserted |
| `AI-002` | 1 | Discard leaves the two other proposals and no extra task | `tests/ai-journey.mjs:94` | asserted |
| `AI-002` | 1 | Discard leaves only opaque audit receipt | `tests/ai-journey.mjs:96` | asserted |
| `AI-002` | 2 | Future paid/send/update command accounting is D-3 | none | moved |
| `AI-004` | 1 | Chosen Anthropic model and endpoint are used | `tests/ai-journey.mjs:116` | asserted |
| `AI-004` | 1 | Excluded transcript is refused before provider call | `tests/ai-journey.mjs:115` | asserted |
| `AI-004` | 1 | No transcript appears in provider traffic | `tests/ai-journey.mjs:120` | asserted |
| `AI-004` | 1 | Question cost is shown | `tests/ai-journey.mjs:117` | asserted |
| `AI-004` | 1 | Conversation cost is shown | `tests/ai-journey.mjs:121` | asserted |
| `AI-004` | 1 | AI disable stops provider calls | `tests/ai-journey.mjs:127` | asserted |
| `AI-004` | 1 | AI disable hides UI features | `tests/ai-journey.mjs:128` | asserted |
| `AI-005` | 1 | Every scripted answer matches independent substantive source facts | `tests/ai-journey.mjs:208` | asserted |
| `AI-005` | 1 | Missing sources are named | `tests/ai-journey.mjs:209` | asserted |
| `AI-005` | 1 | Every generated claim reads the exact supporting record and quote | `tests/ai-journey.mjs:210` | asserted |
| `AI-005` | 1 | Out-of-scope records are absent from answer and provider body | `tests/ai-journey.mjs:211` | asserted |
| `AI-006` | 1 | No authorization makes no provider request | `tests/ai-journey.mjs:138` | asserted |
| `AI-006` | 1 | Named feature and full policy snapshot are retained | `tests/ai-journey.mjs:145` | asserted |
| `AI-006` | 1 | Concurrent authorized schedule makes one request | `tests/ai-journey.mjs:147` | asserted |
| `AI-006` | 1 | Revocation prevents later provider requests | `tests/ai-journey.mjs:150` | asserted |
| `BOUNDARY-001` | 1 | Chargebee read-only scopes are inspected | none | none |
| `BOUNDARY-001` | 1 | Zuora read-only scopes are inspected | none | none |
| `BOUNDARY-001` | 1 | Salesforce revenue-object read permissions are inspected | none | none |
| `BOUNDARY-001` | 1 | Route inventory has no money-moving paths | `tests/flows.test.mjs:543` | asserted |
| `BOUNDARY-001` | 2 | Every write route in inventory is exercised | `tests/flows.test.mjs:546` | asserted |
| `BOUNDARY-001` | 2 | Native outbound set contains only sign-in mail provider | `tests/flows.test.mjs:548` | asserted |
| `BOUNDARY-001` | 3 | Every current Stripe inventory request is GET | `tests/connections.mjs:9` | asserted |
| `BOUNDARY-001` | 4 | Fixture versus real-provider proof is a Boundaries statement | none | moved |
| `BOUNDARY-001` | 5 | Future least-access repeat is a pointer to the governing connector clauses | none | moved |
| `BOUNDARY-003` | 1 | Every forecast and AI risk signal has closed-period accuracy against outcomes | none | none |
| `BOUNDARY-003` | 1 | Current health has inputs, reasons and non-prediction interpretation | `tests/boundary.mjs:23` | asserted |
| `BOUNDARY-003` | 2 | Current state and date-health doors agree | `tests/boundary.mjs:33` | asserted |
| `BOUNDARY-003` | 2 | Segment assessments agree with current health | `tests/boundary.mjs:51` | asserted |
| `BOUNDARY-003` | 2 | Closed outcome read equals retained report | `tests/boundary.mjs:75` | asserted |
| `BOUNDARY-003` | 3 | Missing evidence is explicit | `tests/boundary.mjs:34` | asserted |
| `BOUNDARY-003` | 3 | Stale evidence is explicit | `tests/boundary.mjs:35` | asserted |
| `BOUNDARY-003` | 3 | Person sentiment is cited | `tests/boundary.mjs:41` | asserted |
| `BOUNDARY-003` | 3 | Expired sentiment is named missing | `tests/boundary.mjs:46` | asserted |
| `BOUNDARY-003` | 3 | CSV distinguishes source gaps | `tests/boundary.mjs:54` | asserted |
| `BOUNDARY-003` | 3 | First-observed outcome survives disappearance of current sources | `tests/boundary.mjs:69` | asserted |
| `BOUNDARY-003` | 3 | Current missing sources stay separate from old reached outcome | `tests/boundary.mjs:72` | asserted |
| `BOUNDARY-003` | 3 | CSV names nonprediction and noncausation | `tests/boundary.mjs:77` | asserted |
| `BOUNDARY-003` | 4 | Screen interpretation at 1440 | `tests/boundary.mjs:89` | asserted |
| `BOUNDARY-003` | 4 | Current health reasons at 1440 | `tests/boundary.mjs:93` | asserted |
| `BOUNDARY-003` | 4 | Closed outcome and current missing inputs at 1440 | `tests/boundary.mjs:99` | asserted |
| `BOUNDARY-003` | 4 | Reflow at 1440 | `tests/boundary.mjs:101` | asserted |
| `BOUNDARY-003` | 4 | Screen interpretation at 390 | `tests/boundary.mjs:89` | asserted |
| `BOUNDARY-003` | 4 | Current health reasons at 390 | `tests/boundary.mjs:93` | asserted |
| `BOUNDARY-003` | 4 | Closed outcome and current missing inputs at 390 | `tests/boundary.mjs:99` | asserted |
| `BOUNDARY-003` | 4 | Reflow at 390 | `tests/boundary.mjs:101` | asserted |
| `BOUNDARY-004` | 1 | Suppressed journey send is refused and audited | none | none |
| `BOUNDARY-004` | 1 | Unverified-domain journey send is refused and audited | none | none |
| `BOUNDARY-004` | 1 | Held-policy agent discount refusal has reason | `tests/flows.test.mjs:196` | asserted |
| `BOUNDARY-004` | 2 | Held-policy preparation discount is refused with reason | `tests/flows.test.mjs:196` | asserted |
| `BOUNDARY-004` | 2 | Unknown discount command is refused with reason | `tests/flows.test.mjs:196` | asserted |
| `BOUNDARY-004` | 2 | Agent account edit is refused with reason | `tests/flows.test.mjs:196` | asserted |
| `BOUNDARY-004` | 2 | Term revision and proposals remain unchanged | `tests/flows.test.mjs:198` | asserted |
| `BOUNDARY-004` | 2 | Member cannot read action audit | `tests/flows.test.mjs:199` | asserted |
| `BOUNDARY-004` | 2 | All three refusals retain subject, reason and time | `tests/flows.test.mjs:203` | asserted |
| `BOUNDARY-004` | 2 | Every sent message has a single internal team recipient | `tests/flows.test.mjs:208` | asserted |
| `BOUNDARY-005` | 1 | Every derived provider has a guide section | `tests/site.mjs:67` | asserted |
| `BOUNDARY-005` | 1 | When/Sends/Receives/Terms are present | `tests/site.mjs:68` | asserted |
| `BOUNDARY-005` | 1 | Provider terms have real links | `tests/site.mjs:69` | asserted |
| `BOUNDARY-005` | 2 | Derived connector, mail and identity origins all have guide sections | `tests/site.mjs:67` | asserted |
| `BOUNDARY-005` | 2 | Each section includes data flow fields | `tests/site.mjs:68` | asserted |
| `BOUNDARY-005` | 3 | The buyer-operated in-app relay has independently asserted exact mapping/content/three receipt kinds/external-custody sections | none | none |
| `BOUNDARY-005` | 3 | Relay has no fabricated third-party provider terms or outbound Buoy call | none | none |
| `GOVERN-001` | 1 | A send-within-policy grant executes a permitted email | none | none |
| `GOVERN-001` | 1 | A send-within-policy grant refuses an out-of-policy email | none | none |
| `GOVERN-001` | 1 | Prepare-only grant can prepare | `tests/governance.mjs:32` | asserted |
| `GOVERN-001` | 1 | Held-policy person-approval is refused | `tests/governance.mjs:33` | asserted |
| `GOVERN-001` | 1 | Held-policy discount is refused | `tests/governance.mjs:36` | asserted |
| `GOVERN-001` | 1 | Pause stops both grants | `tests/governance.mjs:48` | asserted |
| `GOVERN-001` | 2 | Metered agent spend is zero | `tests/governance.mjs:55` | asserted |
| `GOVERN-001` | 3 | Provider notification fees are excluded from the metered-operation ledger, rather than inferred from zero spend | none | none |
| `GOVERN-001` | 4 | Budget/ledger label | none | none |
| `GOVERN-001` | 6 | Ledger redaction and outcome distinction | `tests/governance.mjs:58` | asserted |
| `GOVERN-001` | 8 | Preparation mail has single internal recipient | `tests/governance.mjs:62` | asserted |
| `GOVERN-001` | 5 | Expiry bounds are asserted | `tests/governance.mjs:20` | asserted |
| `GOVERN-001` | 5 | Invalid policy inputs are refused | `tests/governance.mjs:16` | asserted |
| `GOVERN-001` | 5 | Excluded classes do not leak through derived fields | `tests/governance.mjs:24` | asserted |
| `GOVERN-001` | 5 | Missing preparation classes are refused | `tests/governance.mjs:28` | asserted |
| `GOVERN-001` | 5 | Concurrent minute cap is enforced | `tests/governance.mjs:44` | asserted |
| `GOVERN-001` | 5 | Retry-After reaches next UTC minute | `tests/governance.mjs:45` | asserted |
| `GOVERN-001` | 5 | Pause creates no work | `tests/governance.mjs:49` | asserted |
| `GOVERN-001` | 5 | Revoked credential is refused | `tests/governance.mjs:53` | asserted |
| `GOVERN-001` | 7 | One-time token is shown at 1440 | `tests/governance-browser.mjs:25` | asserted |
| `GOVERN-001` | 7 | Actual form-selected grant is returned at 1440 | `tests/governance-browser.mjs:28` | asserted |
| `GOVERN-001` | 7 | Reload hides token at 1440 | `tests/governance-browser.mjs:34` | asserted |
| `GOVERN-001` | 7 | Pause stops token at 1440 | `tests/governance-browser.mjs:36` | asserted |
| `GOVERN-001` | 7 | Resume restores grant at 1440 | `tests/governance-browser.mjs:39` | asserted |
| `GOVERN-001` | 7 | Revoke invalidates token at 1440 | `tests/governance-browser.mjs:41` | asserted |
| `GOVERN-001` | 7 | One-time token is shown at 390 | `tests/governance-browser.mjs:25` | asserted |
| `GOVERN-001` | 7 | Actual form-selected grant is returned at 390 | `tests/governance-browser.mjs:28` | asserted |
| `GOVERN-001` | 7 | Reload hides token at 390 | `tests/governance-browser.mjs:34` | asserted |
| `GOVERN-001` | 7 | Pause stops token at 390 | `tests/governance-browser.mjs:36` | asserted |
| `GOVERN-001` | 7 | Resume restores grant at 390 | `tests/governance-browser.mjs:39` | asserted |
| `GOVERN-001` | 7 | Revoke invalidates token at 390 | `tests/governance-browser.mjs:41` | asserted |
| `AGENT-002` | 1 | Withholding contracted service is refused | `tests/outcome-journey.mjs:93` | asserted |
| `AGENT-002` | 1 | Holdout matches segment/baseline health/ARR/tenure | `tests/outcome-journey.mjs:108` | asserted |
| `AGENT-002` | 1 | Effect falls in seeded range | `tests/outcome-journey.mjs:152` | asserted |
| `AGENT-002` | 1 | Effect uncertainty interval is computed | `tests/outcome-journey.mjs:154` | asserted |
| `AGENT-008` | 1 | Signal definition has exact weekly-drop and urgent-ticket predicates | `tests/configuration-journey.mjs:64` | asserted |
| `AGENT-008` | 1 | Preparation and backtest publish no signal | `tests/configuration-journey.mjs:65` | asserted |
| `AGENT-008` | 1 | Twelve-month fire count matches seeded expectation | `tests/configuration-journey.mjs:42` | asserted |
| `AGENT-008` | 1 | Distinct churn capture matches expected denominator | `tests/configuration-journey.mjs:46` | asserted |
| `AGENT-008` | 1 | Exact-fingerprint approval is required in held slice | `tests/configuration-journey.mjs:73` | asserted |
| `AGENT-008` | 1 | Publication returns one definition | `tests/configuration-journey.mjs:76` | asserted |
| `AGENT-008` | 2 | Scorecard draft | `tests/configuration-journey.mjs:142` | asserted |
| `AGENT-008` | 2 | Segment draft | `tests/configuration-journey.mjs:163` | asserted |
| `AGENT-008` | 2 | Playbook draft | `tests/configuration-journey.mjs:163` | asserted |
| `AGENT-008` | 2 | Report draft | `tests/configuration-journey.mjs:163` | asserted |
| `AGENT-008` | 3 | Complete outgoing body contains only description/schema/instructions | `tests/configuration-journey.mjs:69` | asserted |
| `AGENT-008` | 4 | Weekly drop and urgent-ticket conjunction has independent account-week matches | `tests/configuration-journey.mjs:48` | asserted |
| `AGENT-008` | 5 | Backtest spans exact twelve-month window | `tests/configuration-journey.mjs:41` | asserted |
| `AGENT-008` | 5 | Fire count and churn capture are independently expected | `tests/configuration-journey.mjs:42` | asserted |
| `AGENT-008` | 5 | Equal-timestamp retained-scorecard ordering is asserted on the exact historical source image | `tests/configuration-journey.mjs:147` | asserted |
| `AGENT-008` | 6 | Backtest reports nonzero missing weeks | `tests/configuration-journey.mjs:49` | asserted |
| `AGENT-008` | 7 | Wrong exact fingerprint is refused | `tests/configuration-journey.mjs:73` | asserted |
| `AGENT-008` | 7 | Replay returns same definition | `tests/configuration-journey.mjs:75` | asserted |
| `AGENT-008` | 7 | Exactly one definition is published | `tests/configuration-journey.mjs:76` | asserted |
| `AGENT-008` | 8 | Pause has one audit action | `tests/configuration-journey.mjs:94` | asserted |
| `AGENT-008` | 8 | Paused fresh-day signal suppresses new notices | `tests/configuration-journey.mjs:100` | asserted |
| `AGENT-008` | 8 | Active control still produces new fresh-day notices | `tests/configuration-journey.mjs:101` | asserted |
| `AGENT-008` | 8 | Account erasure withdraws every dependent configuration draft | `tests/configuration-journey.mjs:114` | asserted |
| `AGENT-008` | 8 | Restored archive excludes pending person-approval authority for every draft kind | `tests/portable.mjs:292` | asserted |
| `SITE-001` | 1 | Every owner-guide body renders its content; linked-resource HTTP 200 checks do not assert rendered guide content | none | none |
| `SEGMENT-001` | 1 | CSV membership and count reconcile across every row; the cited assertions match one account name rather than the complete result | none | none |
| `PLAY-004` | 3 | Native report timing equals the independently calculated elapsed time at 1440 and 390; a nonnegative API mean does not assert displayed timing | none | none |
| `PLAY-004` | 3 | The browser CSV end state reconciles every cohort, rate and timing field rather than matching one account name | none | none |
| `AGENT-008` | 2 | Configuration calls enforce provider-bound credential selection, metered budget and Pause before effects; the cited configuration bodies do not assert this complete guard set | none | none |
| `AGENT-008` | 2 | Request consent refusal makes no model request | `tests/configuration-journey.mjs:55` | asserted |
| `AGENT-008` | 2 | Changed model policy invalidates publication | `tests/configuration-journey.mjs:108` | asserted |
| `AGENT-008` | 2 | Disabled model hides configuration preparation | `tests/configuration-browser.mjs:52` | asserted |
| `AGENT-008` | 6 | An explicitly skipped historical week remains absent | `tests/configuration-journey.mjs:148` | asserted |
| `AGENT-008` | 6 | Usable current inputs do not fabricate history for the history-free account | `tests/configuration-journey.mjs:149` | asserted |
| `AGENT-008` | 6 | Missing account-week count equals exact independently expected 107 | `tests/configuration-journey.mjs:151` | asserted |
| `AGENT-008` | 7 | Scorecard replay keeps one native version | `tests/configuration-journey.mjs:155` | asserted |
| `AGENT-008` | 7 | Segment/report/playbook replay preserves the complete definition set | `tests/configuration-journey.mjs:172` | asserted |
| `AI-006` | 1 | Only the owner can explicitly authorize the named feature; an admin is refused | `tests/ai-journey.mjs:143` | asserted |
| `AI-006` | 1 | Revocation is auditable as the schedule-revoked action | `tests/ai-journey.mjs:154` | asserted |
