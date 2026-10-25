# Scheduled account reviews

The owner can authorize a named daily account review through the authenticated HTTP API. Interactive requests still need their own consent. Agents and administrators cannot issue standing authorizations.

1. Read `GET /api/buoy/ai` as the owner and review the enabled model settings: provider, model, permitted additional data classes, total budget, maximum request price, token tariffs and minute cap. The no-training terms remain an unverified owner attestation.
2. Send `POST /api/buoy/ai/schedules` with `authorize: true`, `feature: "questions"`, a descriptive `name`, `accountId`, `question`, `hourUtc` (a whole hour from 0 to 23) and `policyRevision` equal to the reviewed settings revision. The response includes the exact authorized policy. Normal session write-origin checks apply.
3. Read `GET /api/buoy/ai/schedules` to find the schedule identifier and revision. Send `DELETE /api/buoy/ai/schedules/IDENTIFIER` with that `revision` to revoke it. Revocation is audited and later scheduled work cannot reserve another request.

Hourly execution considers each authorized schedule at its configured UTC hour. It reserves at most one attempt per UTC date before the provider request. It uses the same permission projection, cost reservation, minute cap and kill switch as interactive account questions. Any model settings change requires a fresh authorization. Owner deactivation, a changed owner version or turning AI off also prevents subsequent requests. No schedule or standing permission restores from an archive.

The current scheduled feature computes an extractive account review and retains only its request cost and opaque completion receipt. Generated output and source text are not stored or sent to a recipient. Inspect the owner’s AI feature costs and audit for its outcome. An uncertain provider call keeps its cost reservation and is never retried automatically in that daily slot. Account erasure deletes its schedule and stored question. Other scheduled features require explicit feature-specific authorization before they ship.

# Generated answers

On AI assistance, select **Generate an answer with supporting records** and explicitly consent to the request. Each generated claim includes source quotations and links to the supporting native account record, renewal field, health band or permitted commercial or support snapshot. Citations recheck current authority; changed evidence requires a new answer. Restricted profiles receive their existing projection, including commercial bands where required. Missing connected sources and excluded data classes remain visible. Generated prose requires human review against those quotations; it is not verified fact or a prediction. Neither prompts nor generated answers are retained by this door.
