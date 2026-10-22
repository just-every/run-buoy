# Stripe test-mode billing

Open **Connections** to save an encrypted Stripe test credential, then open
`/app/billing`. An invalid opaque bearer value can be saved, but only a successful
Stripe test-mode read verifies it. Known live key prefixes are refused. Every
provider object with a mode flag must be test mode; refund mode is inherited
from its separately verified test charge (Stripe refunds have no mode flag).

Use a restricted test key with **read** access to Customers, Subscriptions,
Subscription Items, Prices, Invoices, Payment Intents, Charges, Refunds and Credit
Notes. Buoy requests no write scope. The transport makes only GET requests to
`https://api.stripe.com`, pins API version `2025-02-24.acacia`, refuses redirects,
and has no caller-selectable provider URL or HTTP method. Saving a full test key
does not establish least privilege: the GET boundary is enforced by Buoy, while
the key's actual scope must be inspected in Stripe. Buoy never creates charges,
issues refunds, collects payments, runs dunning or changes subscriptions.

Review an exact Stripe customer ID against an **existing** native account. A
successful provider customer read, a ten-minute sealed preview, the reviewer,
account revision and credential/settings versions bind the approval. Nothing is
matched by customer name or email. One account has one current Stripe binding;
an already bound customer cannot be assigned to another account in that
connection. Removing a binding withdraws current evidence and preserves earlier
observations. A fresh review is needed before a different mapping is approved.
No provider customer name, email, address, card or provider response body is
retained.

Each reconciliation reads one reviewed customer's complete paginated
subscriptions and subscription items (including prices), invoices, payment
intents, charges/refunds and credit notes. Every collection is bounded at 10,000
records; a larger collection fails visibly rather than publishing a partial
observation. The persisted customer cursor advances only after an atomic,
validated observation. An hourly run resumes it and wraps at the end. Verified
webhook events re-read the affected customer without moving that periodic
cursor; each schedule also drains one pending event after its periodic read. Current data is re-read from Stripe, so late events cannot restore old
subscription payloads. Reconciliation does not create duplicate financial
records; each complete read appends an observation and a native account revision.
Subscription or plan differences retain before/after documents and their source
observation. Earlier proposals retain their original revision and must be
reviewed again after a refresh.

ARR annualizes each licensed recurring unit price multiplied by its quantity.
Monthly intervals multiply by twelve, yearly intervals retain their annual
amount, weekly intervals use 365/7 and daily intervals use 365. An interval count
divides the result. MRR is exact ARR divided by twelve. Decimal minor-unit unit
prices and all intermediate sums use integer fractions, and displayed native
minor units round half up once, after summing. Currencies are never combined.
Active and past-due subscriptions contribute their recurring amount; trialing,
unpaid, paused, incomplete and canceled subscriptions contribute zero. A
period-end cancellation stays recurring until Stripe actually cancels it.
Taxes, invoice proration, one-time items, refunds and credit notes do not inflate
or reduce the recurring subscription price. Tiered, metered, transformed and
discounted subscription pricing is explicitly unsupported: the whole customer
read fails and leaves the prior evidence visible with reduced confidence. It
never substitutes a guessed amount.

An open invoice with a positive remaining amount and an explicitly failed linked
payment intent produces a failed-payment risk. An attempt counter alone does not
prove failure: a processing or partially paid invoice is not labeled failed. An open invoice whose due instant
has passed produces an overdue-invoice risk with its exact remaining amount.
An unsuccessful payment intent with a payment error also produces a failed risk,
without counting its linked open invoice twice. Closed/paid invoices and recovered
payment intents no longer produce those current risks. Every risk belongs only
to its reviewed account and carries its source record ID, currency, minor amount
and observation instant. The native screen links source details, subscription
changes and retained history. Manual billing and person-confirmed recurring
contracts remain separately sourced; binding Stripe does not silently replace
a confirmed contract or claim a field-authority/reconciliation decision.

Every observation names `stripe-test`, its exact customer/run or event source
reference, observed UTC instant and received UTC instant. The observation instant
is the read instant, never the customer's creation date. A source's threshold is
configurable from 1 to 365 whole UTC calendar days, 30 by default. Changing it
changes no observation. `GET /api/buoy/billing?on=YYYY-MM-DD` evaluates the retained
evidence's freshness for that real calendar date. Failures retain the last
success, counts, cursor and redacted error; owner/admin inboxes receive a
reconnection notice. Disconnected, missing-credential, missing, stale and failed
sources remain visibly qualified, and consumers receive reduced confidence that
names Stripe billing.

In Stripe test Workbench, register the installation's HTTPS endpoint
`/api/buoy/billing/CONNECTION_ID/webhook` for customer subscription, invoice,
payment-intent, charge, refund and credit-note events. Save that endpoint's
signing secret on the billing screen. It is encrypted with the installation
vault and excluded from portable archives, like the API credential. Restores
require a destination credential and signing secret; a restored snapshot is
historical evidence until reconnection and a successful read. The public endpoint
verifies HMAC-SHA256 on the raw body and Stripe-Signature timestamp (five-minute
past/future tolerance), requires a test event, and deduplicates by connection and
event ID. Reusing an event ID with different content is refused. Unmapped events
never create accounts or attribute observations. Pending verified events survive
a failed run and are reconciled on the next schedule. No raw webhook body or
signature is retained.

The private public-door API consists of:

- `GET /api/buoy/billing`: source status, reviewed bindings, source evidence and history.
- `POST /api/buoy/billing/:id/bindings/preview`: `{customerId, accountId}`.
- `POST /api/buoy/billing/:id/bindings`: `{token}` from the exact preview.
- `DELETE /api/buoy/billing/bindings/:bindingId`: `{revision}`.
- `PUT /api/buoy/billing/:id/settings`: `{staleDays}`.
- `PUT /api/buoy/billing/:id/webhook-secret`: `{secret}`.
- `POST /api/buoy/billing/:id/sync`: `{}`; read the next reviewed customer.

These doors require a native owner/admin session; writes enforce same-origin
CSRF and recheck active authority inside the database transaction. Agent
credentials and staff members cannot administer billing. Only the signed webhook
ingress is public.

`tests/billing-journey.mjs` drives the built Worker with synthetic records solely
at Stripe's network edge. It covers independent monthly/annual arithmetic,
upgrade/downgrade/cancel, signed/unsigned/tampered/expired/duplicate/unordered
events, source validation, whole-customer atomicity, reviewed attribution,
threshold changes, owner/admin failure notices, reconnect, credential revocation
during a read, scheduled reconciliation and the GET-only boundary. With
`--browser`, the native review/approval, evidence, missing state, source failure,
freshness and credential screens are inspected at 1440 and 390 pixels.

`tests/billing-sandbox.mjs` is a separate held-key qualification, not a push-Verify
fixture. Inject `STRIPE_TEST_KEY` by name using the approved held-key wrapper.
It creates real test-mode subscriptions, upgrade/downgrade/failure/cancellation,
a refund and a credit note under a fixture setup actor. It starts its own narrow
webhook-only relay and ephemeral cloudflared tunnel, registers a real Stripe
endpoint, and proves Stripe-delivered signatures against the returned secret.
All application Stripe calls are separately recorded as GET-only. The script
reports only non-secret counts and arithmetic, then deletes its endpoint/test
clock, archives its prices/product, and stops its exact owned tunnel PID and
Worker. A failed tunnel or missing delivery fails qualification; a locally signed
fabricated event never counts as live provider delivery. Run it only with the
session's heavy slot and held-key authorization. Fixture financial records remain
subject to Stripe's test-data retention.

Provider references: [subscription items](https://docs.stripe.com/api/subscription_items/list),
[prices](https://docs.stripe.com/api/prices/object),
[invoices](https://docs.stripe.com/api/invoices/object?api-version=2025-02-24.acacia),
[credit notes](https://docs.stripe.com/api/credit_notes/list?api-version=2025-02-24.acacia),
[refunds](https://docs.stripe.com/api/refunds/object), and
[raw webhook verification](https://github.com/stripe/stripe-node/blob/master/src/Webhooks.ts).
