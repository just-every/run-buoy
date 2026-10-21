# In-app campaigns

Owners and administrators manage **In-app** at `/app/inapp`. Create a campaign
for a product source and an account segment, choose announcement, banner,
checklist or walkthrough, then enter its title, body and optional steps. Enter
checklist and walkthrough steps one per line. All authored content is plain text;
HTML and scripts are displayed as text. Set the maximum views and rolling window
in whole UTC hours (1–8760), then choose whether to enable the campaign. Existing
campaigns can be enabled or disabled; create a new campaign for different content.

Your product serves the browser renderer and authenticated server relay. Campaign
storage in Buoy does not establish hosted delivery or prove that anyone viewed it.
The browser snippet grants no authority and contains no Buoy credential.

## Review identity before targeting

First configure a source on [Usage](usage.md) and create explicit account
memberships for [customer people](people.md). Review the exact source/user/group
mapping on `/app/usage`; staff sign-ins are separate from customer identities.
The mapped person must still belong to the mapped account, and the account must
currently belong to the campaign's segment. Unknown, conflicting, unreviewed or
no-longer-authorized identities receive no targeted content.

The buyer must implement authentication against the product's real session and
validate its current authorized account membership on every relay request. Return
that trusted product `{ userId, groupId }` from `authenticate(request)`, or `null`
for an unauthenticated request. `groupId` is optional for an ungrouped identity.
Never derive membership from browser-supplied IDs, a cookie's presence or a
permissive callback. Buoy's reviewed mapping does not replace product session
authentication. The relay overwrites browser identity claims with the validated
server identity; an authentication failure does not fall back to submitted IDs.

## Issue a dedicated server credential

On **In-app**, issue a labelled credential for the source and copy the secret once
into your product server's secret store. The secret is shown only in that issuance
response and must not be cached, logged or placed in a browser bundle. The page
lists creator, creation, last-use and revocation metadata and lets you revoke an
active credential.

In-app credentials have only the `inapp` scope. They are separate from usage
ingestion credentials, staff sessions and agent credentials. Neither a usage
credential nor an in-app browser snippet authorizes in-app server requests.
Credentials and their stored hashes are excluded from installation archives;
issue new credentials after restoring an installation.

## Connect the product server

Use `createInappClient` from `sdk/inapp.mjs` and `createInappRelay` from
`sdk/relay.mjs`. Both run only on your product server. For example, connect the
relay to your existing product authentication module:

```js
import { createInappClient } from './sdk/inapp.mjs'
import { createInappRelay } from './sdk/relay.mjs'
import { authenticateProductMembership } from './product-auth.mjs'

const client = createInappClient({
  origin: process.env.BUOY_ORIGIN,
  sourceId: process.env.BUOY_SOURCE_ID,
  credential: process.env.BUOY_INAPP_CREDENTIAL,
})

export const inappRelay = createInappRelay({
  client,
  authenticate: authenticateProductMembership,
})
```

`authenticateProductMembership` represents your existing, fully implemented
session and membership validator. Mount `inappRelay`, a standard Fetch request
handler, at a same-origin product path such as `/product-inapp`. It requires JSON
POST requests with the product's exact Origin. Keep the dedicated credential on
that server; the relay creates the upstream authenticated server request.

The server client exposes `deliver({ userId, groupId? })` and
`receipt({ userId, groupId?, campaignId, deliveryId?, messageId, kind })`. Delivery
returns `{ messages }` with plain-text content and a `deliveryId` reservation for
each eligible campaign. Receipt kinds are `view`, `completion` and `dismissal`.
Use a unique message ID for each real observation and preserve that ID when
resubmitting the same observation. The SDK reports failures and does not retry or
fabricate successful results. Custom renderers must preserve the returned delivery
ID and submit only observations they actually make.

## Mount the browser renderer

Serve `public/buoy-inapp.js` from your product and provide a real container:

```html
<div id="product-messages" aria-label="Product messages"></div>
<script type="module">
  import { createBuoyInapp } from '/buoy-inapp.js'
  const inapp = createBuoyInapp({
    relay: '/product-inapp',
    container: document.getElementById('product-messages'),
  })
  await inapp.refresh()
</script>
```

The renderer accepts only `{ relay, container }`; it does not accept credentials
or identity options. The relay must be a same-origin product path, not a raw Buoy
API URL. Call `refresh()` when the authenticated product surface should request
eligible messages. The renderer inserts plain text using DOM text APIs. Checklists
require checking the steps before completion; walkthroughs advance through their
authored steps. Completion and dismissal use explicit controls.

## Caps and observed receipts

Frequency limits apply per reviewed customer person and campaign, across their
requests, over the configured rolling UTC-hour window. Server-observed `view`
receipts count against `maxViews`. Pending five-minute delivery reservations also
occupy cap slots, so concurrent fetches cannot independently consume the same
remaining allowance. An unused reservation expires without creating a view.
A fetch or a stored campaign is never automatically counted as a rendered view.

The browser renderer records a view after inserting the campaign in the product
container. Completion and dismissal receipts follow the person's corresponding
action; neither is inferred from a fetch or the passage of time. Either completion
or dismissal ends that campaign for that person, including after a later frequency
window begins. Do not emit receipts for content that was never rendered or actions
that never occurred. Receipts record these observations; they do not prove reading,
attention, product adoption or any business outcome.

Open `/app/customer-people` for customer timelines and recorded campaign
observations. Receipt storage is evidence of intake, not a claim of independently
verified or hosted delivery.

## Management API

Management uses the installation's owner/admin session and exact Origin for
writes. Paths below are under `/api/buoy/inapp`:

- `GET /api/buoy/inapp`: campaign definitions, sources, segments and credential metadata.
- `POST /campaigns`: sourceId, segmentId, kind, title, body, steps, positive integer maxViews, windowHours (1–8760), and enabled.
- `PUT /campaigns/:id`: `{ "enabled": true }` or `{ "enabled": false }` only.
- `POST /credentials`: sourceId and label; returns credential metadata and the secret once.
- `DELETE /credentials/:id`: revoke that credential.

Server delivery uses `POST /api/buoy/inapp/deliver/:sourceId`; observations use
`POST /api/buoy/inapp/receipts/:sourceId`. These require the dedicated in-app Bearer
credential and trusted product identity from your server. Use the relay and SDKs
above to keep this authority out of the browser.
