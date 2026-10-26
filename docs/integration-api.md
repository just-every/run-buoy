# Version 1 integration API

The installed origin serves the machine-readable OpenAPI document at
`/api/buoy/v1/openapi.json`. This first increment supports account snapshots.
Events, contacts, users, metrics, tasks, plans, opportunities, timeline entries,
custom objects and outbound webhooks remain unfinished under API-001.

An owner signs in and sends a same-origin JSON `POST /api/buoy/v1/tokens` with
`scopes` (an explicit nonempty selection of `accounts.read` and `accounts.write`),
`accountIds` (1 to 50 explicit native IDs, including intended new IDs),
`requestsPerMinute` (1 to 600), and `expiresDays` (1 to 365).
Only the owner can issue or revoke tokens. There is no implicit wildcard grant.
Account scopes include the account's billing and support snapshots; issue them
only to a trusted server authorized to receive that complete account document.
The token is returned once; only its hash is stored. Keep it in server secret
storage. Do not embed it in a browser or forward an untrusted customer's input
without authorization. Browser Origin and Fetch Metadata are refused; no CORS
access is enabled. Agent and source-intake credentials grant no integration scope.

Send the returned token in the Authorization header using the Bearer scheme.
`GET /api/buoy/v1/accounts?limit=10` returns `items` and `next`; pass `next` as
`after` for the next page. Ordering is lexical by native account ID. Pages read
current data rather than a frozen export. `GET /api/buoy/v1/accounts/{id}` returns
one granted account. Ungranted IDs return 403 without checking their existence.

`POST /api/buoy/v1/accounts` creates one snapshot in the documented Account shape.
`PUT /api/buoy/v1/accounts/{id}` replaces it and requires the current `revision`
from a read. Stale revisions return 409. Native validation, the 500-account
installation ceiling and erasure fences also apply. The account write, revision,
opaque account audit and successful replay receipt commit together. Audit actor
identifies the integration credential; no raw token or request body is logged.
Existing native consumers refresh through the issuing owner's approved path.
These account snapshots are manual evidence, never a provider verification.

Both writes require `Idempotency-Key` (1 to 128 letters, numbers, dots, underscores
or hyphens). A key is local to one token and binds the method, path and canonical
JSON request. Concurrent identical requests return the same ID and revision;
a different request with that key returns 409. Failed validation reserves no key.
Successful receipts remain for the life of the account and token; account erasure
removes them, revokes grants naming that account and removes its ID from those
grants. The native erasure fence prevents recreation even with a fresh grant. A replay returns
the original write reference, not a fresh account snapshot. Consumer refresh may
be retried after interruption without repeating the account write or its audit.

Every authenticated request, including refused requests and replays, consumes
one reservation in that token's fixed UTC-minute window. Over-limit requests
return 429 and `Retry-After` in whole seconds, plus `RateLimit-Limit` and
`RateLimit-Reset`. Reservations commit atomically. The current and previous minute
are retained per token. An installation permits at most 50 active tokens.
Expiry, revocation and the issuing owner's active role and identity version are
checked on every request and fenced in each write transaction. An owner's role
or identity version change invalidates existing tokens.

Revoke with a same-origin owner-session `DELETE /api/buoy/v1/tokens/{id}`.
Integration tokens, rate reservations and replay receipts are excluded from
installation archives: restore cannot reinstate integration authority. Existing
product data and opaque audit history retain their normal custody.

Policy is conservative and pending ct approval: owner-only issuance and
revocation, explicit account IDs and operation scopes, bounded expiry and rate,
server-only use and no new outbound transport. API-001 remains PARTIAL until
that policy is approved and every remaining record and webhook point is proved.
