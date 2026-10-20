# Product usage intake

USAGE-001 is **partial**. Buoy receives Segment track, identify and group messages
and native events, deduplicates them and retains them for administrator review.
Every observation is currently unassigned. Contact/user records, mapping approvals
and account attribution remain unavailable until their ACCOUNT-004 typed fields,
formulas, real-account preview, explanations, history and segment inputs ship.
No raw identity claim becomes a lighter contact or user record.

## Configure a server source

As owner or administrator, open **Usage**, add a source with its format and source
reference, then issue a credential with the message types that server needs. Copy
the credential once into that server's secret store. It grants intake for that
source and those types only; it grants no account read, staff session or agent
command. The page records creator, type scope, creation and last-use times. Revoke
it on the same page to stop the next intake transaction, within one minute.
Credentials, including their stored hashes, are excluded from installation
archives; restored installations need newly issued credentials. Source settings
and queued observations survive archives.

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

Install `sdk/relay.mjs` on your product backend. `createUsageRelay({ client,
authenticate })` returns a standard Fetch request handler. Pass the server SDK as
`client`. Your `authenticate(request)` must check your real product session and
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
using a fresh server request. A receipt reports received/accepted/duplicate/review
counts, without claiming attribution or delivery.

## Inspect the pending queue

Owner/admin management uses the installation's existing session and exact Origin:

| Door under `/api/buoy` | Purpose |
| --- | --- |
| `GET /usage` | Sources, credential metadata and first 200 pending claim groups; any limit is labelled |
| `POST /usage/sources` | Add name, kind (`segment`/`native`), reference and staleDays |
| `PUT /usage/sources/:id` | Edit the source configuration |
| `POST /usage/sources/:id/credentials` | Issue label and allowed type scope, returning the secret once |
| `DELETE /usage/credentials/:id` | Revoke intake authority |
| `GET /usage/events` | Paginated original observations and per-event freshness |

Event filters are sourceId, userId, groupId and messageId; `limit` is 1–200 and
`cursor` continues the returned page. All rows have review status. Members and
agents cannot read or manage this queue. No contact/user or mapping mutation door
is shipped. Original copies remain with the source/relay; Buoy does not erase them.
