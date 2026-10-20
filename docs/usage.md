# Product usage intake

Buoy receives Segment track, identify and group messages and native events,
deduplicates them and retains unknown or conflicting claims for administrator review.
[Customer contacts and users](https://github.com/just-every/run-buoy/blob/main/docs/people.md) have typed fields, formulas, previews,
explanations, history and segment inputs. Create their explicit account memberships
before reviewing a source identity. Staff sign-ins are separate and never targets.

## Configure a server source

As owner or administrator, open **Usage**, add a source with its format and source
reference, then issue a credential with the message types that server needs. Copy
the credential once into that server's secret store. It grants intake for that
source and those types only; it grants no account read, staff session or agent
command. The page records creator, type scope, creation and last-use times. Revoke
it on the same page to stop the next intake transaction, within one minute.
Credentials, including their stored hashes, are excluded from installation
archives; restored installations need newly issued credentials. Source settings, customer records, fields, history, reviewed mappings and observations
survive archives.

The receiver accepts a JSON message or `{ "batch": [messages] }` at
`POST /api/buoy/usage/intake/:sourceId`, with the source credential in the HTTP
Authorization Bearer header. Requests are at most 256000 bytes, batches 1–500
messages, and each message at most 16000 bytes. Validation refuses an entire bad
batch. IDs are exact, case-sensitive strings, namespaced by source, without
trimming or email matching. The first payload for a source/message ID wins.
Different user/group claims, including contradictions, remain separate in review;
traits never link to staff identities and no membership is guessed or merged.

Each observation retains source system/reference and event/receipt timestamps.
Sources use a configurable 1–365 whole UTC-day freshness threshold, default 30;
an observation is stale when its UTC day is more than that threshold before
today. The source label uses its latest observation, while event reads label each
observation. Changing configuration never rewrites an earlier payload or reference.
Missing evidence is not zero activity. Intake proves receiver storage, never
Segment identity, certification, hosted delivery or provider verification.

## Server SDK

Use the repository's `sdk/usage.mjs` on your product server. Keep it and the
credential out of browser bundles.

```js
import { BuoyUsage } from './sdk/usage.mjs'
const usage = new BuoyUsage({
  origin: process.env.BUOY_ORIGIN,
  sourceId: process.env.BUOY_SOURCE_ID,
  credential: process.env.BUOY_USAGE_CREDENTIAL,
})
await usage.track({
  messageId: 'event-472', event: 'Report downloaded',
  userId: 'product-user-12', groupId: 'product-company-4',
})
```

The client also supports `identify`, `group`, `event` and `batch`. It supplies a
message ID and timestamp when omitted, refuses redirects, and reports intake
errors without retries. Persist your message ID when retrying a delivery yourself.
Segment sources accept track/identify/group; native sources also accept event.

## Browser SDK through authenticated relay

Serve `public/buoy-usage.js` in your own product and use only a same-origin relay
path. There is no browser ingestion credential:

```js
import { BuoyUsage } from '/buoy-usage.js'
const usage = new BuoyUsage({ relay: '/product-usage' })
await usage.track({ event: 'Report downloaded' })
```

Install `sdk/relay.mjs` on your product backend. `createUsageRelay` returns a standard Fetch request handler. Pass the server SDK
as its `client` option and your session checker as its `authenticate` option. Your `authenticate(request)` must check your real product session and
return its authorized `{ userId, groupId }` membership (groupId can be omitted for
an ungrouped user), or null for an unauthenticated request. These are product IDs,
not Buoy staff sessions. Mount the handler at your browser client's relay path.
The helper requires a same-origin JSON POST and overwrites supplied identity
claims, including context IDs, with that trusted membership. A missing session is
refused; authentication failure never falls back to browser-supplied IDs. Do not
replace the callback with permissive identity or cookie-presence checks.

The receiver itself refuses Origin and browser site/destination/user metadata;
server Fetch's `Sec-Fetch-Mode` alone is allowed. The browser module refuses raw
intake URLs and credential options. The server relay holds the secret and forwards
using a fresh server request. A receipt reports received, accepted, duplicate and stored counts. Storage does not
claim delivery. Read the reviewed attribution separately.

## Review and attribute identities

Owner/admin management uses the installation's existing session and exact Origin:

All paths below are under `/api/buoy`:

- `GET /usage`: sources, credential metadata and first 200 pending claim groups; any limit is labelled.
- `POST /usage/sources`: add name, kind (segment/native), reference and staleDays.
- `PUT /usage/sources/:id`: edit source configuration.
- `POST /usage/sources/:id/credentials`: issue label and allowed type scope, returning the secret once.
- `DELETE /usage/credentials/:id`: revoke intake authority.
- `GET /usage/events`: paginated original observations, per-event freshness and reviewed attribution.
- `POST /usage/mappings/preview`: review an exact sourceId/userId/groupId claim with accountId and personId (null for a group-only claim); returns the target, retained event count and fingerprint without writing.
- `POST /usage/mappings`: approve that exact input and fingerprint. Changed targets, membership or retained evidence require another preview.
- `GET /accounts/:id/usage`: staff-readable account evidence with source/reference, observation and receipt instants, count and freshness.

Event filters are sourceId, userId, groupId, messageId, accountId and personId; `limit` is 1–200 and
`cursor` continues the returned page. Rows are review or attributed. Members and agents cannot manage this queue;
staff read account-level usage under the existing account read rules. On **Usage**,
choose an account and an explicitly linked customer person for a pending claim,
preview it, inspect its exact IDs and target, then approve it. This assigns retained
and future observations with that exact combination. The same source user cannot
map to different people and the same source group cannot map to different accounts.
Different source/user/group combinations require separate review, even when another
combination is already known. No mapping creates or changes a person or membership.
Removing membership puts its observations back in review; explicit membership must
hold for attribution. New attributed observations advance the account revision;
duplicates retain the first payload without refreshing it. Account pages distinguish
missing usage from current/stale evidence. Account erasure removes its reviewed
mappings and their attributed raw observations. Original copies remain with the
source/relay; Buoy does not erase those external copies.
