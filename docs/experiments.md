# Matched retention experiments

An experiment offers an optional additional customer success check-in. It keeps every contracted service and price unchanged. There is no customer message transport, automatic service change or commercial change in this experiment. The agent proposes; an active owner or administrator acts as CS leadership and approves the frozen experiment and success metric. Existing assigned profiles remain denied until ROLE-001 supplies explicit authority for this door.

First record active, person-confirmed recurring terms and a typed custom date field for when each customer relationship began. Field entry requires a source reference through the existing account field door. Installation creation time is never substituted for customer tenure.

Prepare with `POST /api/buoy/experiments`, or the explicitly granted `experiment.prepare` command on `POST /api/buoy/commands`. The input is:

```json
{
  "name": "Optional recovery check-ins",
  "segmentId": "the-existing-segment-id",
  "tenureField": "custom.customer_since",
  "pairs": 16,
  "windowDays": 30,
  "successMetric": "renewed",
  "intervention": "additional-check-in",
  "operationKey": "a-new-operation-key"
}
```

The planner uses current members of the named segment. It requires known, unsatisfied baseline health and no prior renewed decision, active recorded ARR, currency and a nonfuture customer-since date. It matches exact segment membership, health band and numerical score when available, ARR in native minor units and currency, and whole UTC-day customer tenure. Missing factors never become zero. It randomly shuffles within exact strata, assigns one intervention and one holdout per pair, and persists both assignments and source revisions. If there are too few exact matches, it refuses the whole experiment. The report includes eligible, excluded and unmatched counts. Two to fifty pairs and one to 365 whole UTC days are supported. These limits describe current capacity, not a scale acceptance claim.

Read `GET /api/buoy/experiments/ID`, or use the explicitly granted `experiment.report` command with `{"id":"ID"}`. Review every matching factor and the success metric before `POST /api/buoy/experiments/ID/approve` with the returned `revision` and a leadership approval `reference`. Only existing owners and administrators can approve. Agent credentials cannot approve. A changed account revision, segment membership or current matching factor refuses approval; prepare a fresh experiment with a new operation key. Reusing an operation key with identical input returns the same experiment; changed input is refused.

Approval atomically records leadership evidence, freezes both observation windows and creates intervention-only enrollments in a pinned manual playbook. Each generated task separately waits for the existing human playbook approval before it becomes work. The task offers an optional extra check-in and explicitly preserves contracted services. Holdouts receive no experiment task and keep their ordinary service. Replay preserves the original approver, assignments, observation timestamps and work. Other interventions, withholding a service, price fields and unknown input properties are refused.

Both health and renewal are measured even when only one is the approved success metric. PLAY-004 captures first observed healthy evidence and new approved renewed decisions within the inclusive UTC observation window; task completion invents neither. Existing Playbook outcomes screens show the two frozen cohorts, source records and observed rates. The experiment API and agent report add the intervention-minus-holdout rate difference, actual sample sizes and a descriptive 95 percent Newcombe interval based on Wilson score bounds. Values use proportions, so 0.50 means 50 percentage points. Open windows remain provisional; an absent observation is not a verified negative outcome. The report names small samples, selection, missing outcomes, contamination and unmeasured confounding, and states the independent binary observation assumption. Pair dependence and multiple comparisons are not adjusted. No interval is a causal guarantee, and a health increase never proves retained revenue.

New experiment command grants are opt-in. Existing credentials and default new grants retain only their original three commands. Experiment preparation and reading require all four current data classes, inherit credential expiry, revocation, minute reservations, the owner kill switch and durable attempt outcomes, and incur no metered agent charge. No external provider is introduced. API approval and reporting use the existing full owner and administrator account authority; ROLE-001 inherits scoped access before extending this door to other profiles. Existing single-recipient internal notifications keep their ordinary provider behavior.

Account erasure cascades to the experiment baseline, enrollment and outcome evidence. The report labels surviving sample sizes and the possibility that erasure changes estimates. Imports cannot undo an account with experiment dependencies. Installation archives retain experiment definitions and historical assignments as product data; they do not grant restored agent credentials. Earlier downloads remain separately owned.
