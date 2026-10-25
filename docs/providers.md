# Providers and data flows

Buoy can run on your own Cloudflare account or through Run Edit Run Managed hosting. A self-hosted installation talks directly to the providers you configure with credentials you hold. Managed installations can send team mail through the Run Edit Run relay described below. This guide lists every provider an installation can talk to today, what each one receives and returns, and the terms that govern it.

## Certifications are your deployment's

SOC 2 or similar attestations cover your deployment, not the Buoy source code. Prepare them with Evidence or your auditor. Each provider's network, terms and data-processing agreement still apply to the data it handles, so include the providers you enable in that scope.

Local sign-in on your computer talks to none of the sign-in providers. Sign-in links appear in the local outbox instead of being sent.

## Hosting

### Cloudflare

- **When:** always, for a deployed installation.
- **Sends:** everything Buoy stores (accounts, evidence, proposals, tasks, decisions, sentiment, the import journal and sign-in sessions) lives in your D1 database, and your Worker serves every page and API request.
- **Receives:** requests from your team and agents, and your static assets.
- **Terms:** [Cloudflare terms](https://www.cloudflare.com/terms/), [Developer Platform service-specific terms](https://www.cloudflare.com/service-specific-terms-developer-platform/) and the [Cloudflare customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/).

## Sign-in mail

A deployed installation sends sign-in links, task reminders and escalations, and notification mail and optional digests to your own team, through the one mail provider you choose with `MAIL_PROVIDER`. Buoy sends no customer messages.

For native unassigned staff, notification mail contains the title, account name, note or risk reason and a signed-in account link. Digests include queued notices and counts of recorded changes in the recipient’s current book; reminders name the task, account and due date. Assigned ROLE-001 profiles instead receive only an account name they can currently read, a generic account update and its signed-in account link. Original task titles, notes, risk explanations, source text and exact commercial values are omitted from their subjects and bodies. Outside-scope or invalidated assignments receive no account notice or reminder email. Aggregate digests are excluded for assigned profiles until their permissions are ported. Sign-in messages still carry the ordinary one-time sign-in link.

Each person's saved mail preferences apply to the notice types that are available to them. Erasing an account in Buoy does not delete mail the provider or recipient already holds.

### rer

- **When:** `MAIL_PROVIDER=rer` in a Managed installation, with the platform-provided `MAIL_RELAY_URL` and private `MAIL_API_KEY`.
- **Sends:** an authenticated HTTPS request to the configured Run Edit Run relay containing one recipient address, the subject and plain-text message, and optional HTML. Sign-in messages contain a one-time link; team notices, reminders and eligible digests follow the recipient-specific content rules above. The relay owns the sender and installation identity. Buoy does not submit attachments or additional recipients through this provider.
- **Receives:** relay acceptance with a message ID, or a rejected, rate-limited or uncertain result. Acceptance does not prove delivery to the recipient. The relay and recipient can retain external copies; erasure in Buoy does not delete them.
- **Terms:** the [Run Edit Run service terms](https://runeditrun.com/terms) govern Managed relay use. Review the terms and data-processing arrangements for your deployment; this guide makes no provider certification or legal-acceptance claim.

### Resend

- **When:** `MAIL_PROVIDER=resend`.
- **Sends:** the recipient's email address, your sender address and the sign-in message with its one-time link; internal notices, reminders and eligible digests use the recipient-specific content rules above. An assigned profile's account email contains only its currently readable account name, a generic update and signed-in account link.
- **Receives:** the provider's message ID.
- **Terms:** [Resend terms of service](https://resend.com/legal/terms-of-service) and [Resend DPA](https://resend.com/legal/dpa).

### SendGrid

- **When:** `MAIL_PROVIDER=sendgrid`.
- **Sends:** the recipient's email address, your sender address and the sign-in message with its one-time link; internal notices, reminders and eligible digests use the recipient-specific content rules above. An assigned profile's account email contains only its currently readable account name, a generic update and signed-in account link.
- **Receives:** the provider's acceptance of the message.
- **Terms:** [Twilio terms of service](https://www.twilio.com/en-us/legal/tos) and [Twilio data protection addendum](https://www.twilio.com/en-us/legal/data-protection-addendum).

### Cloudflare Email

- **When:** `MAIL_PROVIDER=cloudflare`, through your Cloudflare account's email sending API.
- **Sends:** the recipient's email address, your sender address and the sign-in message with its one-time link; internal notices, reminders and eligible digests use the recipient-specific content rules above. An assigned profile's account email contains only its currently readable account name, a generic update and signed-in account link.
- **Receives:** the provider's message ID.
- **Terms:** [Cloudflare terms](https://www.cloudflare.com/terms/) and the [Cloudflare customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/).

## Optional sign-in providers

When the owner links an OpenID sign-in provider during setup, people can sign in through it instead of an email link. Buoy sends the provider a sign-in request with your installation's client identity, its callback address and the `openid email` scopes (Auth also asks for `profile`). It receives an ID token naming the person's subject and email. No account, evidence or work data goes to a sign-in provider.

### Auth

- **When:** you link your own Auth installation.
- **Sends:** the sign-in request described above.
- **Receives:** an ID token with the person's subject, email and name.
- **Terms:** Auth is self-hosted on your account, so your own Cloudflare terms above apply.

### Google

- **When:** you configure Google sign-in.
- **Sends:** the sign-in request described above.
- **Receives:** an ID token with the person's subject and email.
- **Terms:** [Google APIs terms of service](https://developers.google.com/terms) and the [Google privacy policy](https://policies.google.com/privacy).

### Microsoft

- **When:** you configure Microsoft Entra ID sign-in.
- **Sends:** the sign-in request described above.
- **Receives:** an ID token with the person's subject and email.
- **Terms:** [Microsoft Product Terms](https://www.microsoft.com/licensing/terms/), which include Microsoft's data protection addendum.

### Okta

- **When:** you configure Okta sign-in.
- **Sends:** the sign-in request described above.
- **Receives:** an ID token with the person's subject and email.
- **Terms:** [Okta legal terms](https://www.okta.com/legal/) and [Okta trust and compliance](https://www.okta.com/trustandcompliance/).

### Company

- **When:** you configure another OpenID provider your company runs.
- **Sends:** the sign-in request described above.
- **Receives:** an ID token with the person's subject and email.
- **Terms:** your own agreement with that provider governs it.

## Not connected yet

Stripe test-mode inventory and billing reads are described below. Buoy makes no outbound calls to other billing, CRM, support, product-usage, mailbox, calendar, chat or survey providers yet. Optional model requests are described below and require owner configuration and explicit consent. Incoming product observations are described below. Manual or file-based billing and support evidence remains separate from the Stripe source. Each connector adds its section to this guide, with its data flows and terms, before it ships.

## Incoming product observations

### Segment

- **When:** your Segment server source or authenticated product relay sends track, identify or group observations to the configured receiver. There is no outbound Segment request or provider verification.
- **Sends:** the source sends message IDs, product user/group claims, event names, timestamps, properties and traits to your Worker and D1. Unknown or conflicting claims remain in review. An administrator explicitly reviews mappings to existing customer contacts/users and their account memberships; retained and future exact claims then attribute to those records. Intake itself creates no customer records or staff links.
- **Receives:** the sender receives received, accepted, duplicate and stored counts or an error; a storage receipt does not claim provider identity or delivery. Browser clients send only to the buyer's authenticated product relay; its server holds the intake secret.
- **Terms:** [Twilio Segment terms](https://segment.com/legal/terms/) and [Twilio data protection addendum](https://www.twilio.com/en-us/legal/data-protection-addendum). Source and relay copies remain external holders.

### In-app relay

- **When:** you deploy the INAPP-001 snippet and relay on your own product. The browser sends same-origin JSON POST actions to your product server; that server authenticates the real product session and current account membership and uses a separate server-only in-app credential to request Buoy delivery or submit receipts. The browser holds no Buoy credential. Targeting requires the exact administrator-reviewed source/user/group mapping to an existing customer person and current account membership/segment; unknown or conflicting identities receive no targeted content.
- **Sends:** your product relay sends validated user/group identity claims to Buoy, replacing browser-supplied identities. Receipt requests also carry campaign ID, delivery ID when mapped, exact message ID and view, completion or dismissal kind. Buoy stores receipt observations with source provenance and instants in your Worker/D1, attributes only through the reviewed mapping and advances the mapped account revision. Buoy makes no outbound call to the relay or a new third-party provider.
- **Receives:** the relay receives eligible announcement, banner, checklist or walkthrough content (plain-text title, body and steps), campaign and delivery IDs, and returns that content to the product browser. Receipt submissions receive stored/accepted/duplicate counts or an error. A reservation is not a view, and a stored receipt is not proof of hosted delivery, provider verification or verified attention.
- **Terms:** this is your buyer-operated server, not a third-party provider with separate provider terms. Your own hosting and product/source agreements apply, including the [Cloudflare terms](https://www.cloudflare.com/terms/) and [Cloudflare customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) for the Buoy deployment. You operate, authenticate and secure the relay and browser deployment, keep the credential server-side, and manage copies retained by your product, relay or source as external holders; erasure in Buoy does not delete those copies. This guide records data flows and responsibilities, not legal acceptance or certification.

## Stripe test-mode inventory and billing

### Stripe

- **When:** a native owner or administrator adds a test-mode connection at `/app/connections`, runs inventory or billing reconciliation, or scheduled reconciliation runs. Billing requires a reviewed binding from an exact Stripe customer ID to an existing Buoy account. The preview checks the customer at Stripe and binds the review to the account revision, connection/settings versions, actor and expiry. Intake creates no account or contact, and customer names or email addresses are never used to guess a binding. Use a restricted test key with read access to the supported records; the transport enforces GET-only access, while the credential's provider-side least-access scope is not independently certified.
- **Sends:** fixed-origin requests to `https://api.stripe.com`, pinned to `Stripe-Version: 2025-02-24.acacia`, with the server-held credential, source IDs, page limits and cursors. Allowed reads cover the customer list and individual customers, subscriptions, subscription items, expanded recurring price tiers/currency options and coupon details, invoices, payment intents, charges, refunds and credit notes. Callers cannot supply a provider URL, HTTP method, expansion or search expression, and redirects are not followed. Buoy sends no account name, contact email, card data or native task text to Stripe. It makes no request that changes a subscription, issues a refund or credit, collects a payment or moves money.
- **Receives:** inventory retains customer IDs and creation instants. Reviewed billing reconciliation retains normalized source references, subscription status and periods, price/product IDs, quantity transforms, tier rules, recurring discount/coupon/promotion references and selected currency amounts, invoice balances and due instants, payment statuses/amounts, refund and credit-note references/amounts, source-derived ARR/MRR by native currency, and failed-payment/overdue evidence. Run counts, cursors, observation/receipt instants, source references and sanitized failure states explain freshness and confidence. Stripe responses can contain additional fields, but Buoy's retained projection excludes customer/contact names, email addresses, card/payment-method data, arbitrary provider free text and raw response bodies. Charges are read to attribute their refund collections; complete charge payloads are not retained. Unsupported pricing or inconsistent attribution refuses the observation rather than publishing a partial result.
- **Incoming webhooks:** Stripe sends test-mode events to `/api/buoy/billing/:connectionId/webhook`. Buoy verifies the raw-body HMAC-SHA-256 signature and timestamp tolerance against the separately configured endpoint signing secret before accepting an event. It retains only event ID/type, payload digest, received/processed instants, reviewed customer reference and processing status, never the raw body. Duplicate IDs with changed content are refused. Supported events for a bound customer trigger a fresh GET reconciliation of its present Stripe state; late or reordered event payloads never become authoritative billing snapshots. Unsupported or unbound events are ignored. Failed reconciliation remains pending for the scheduled source read.
- **Credential custody and restore:** API and webhook-signing credentials are encrypted with AES-GCM under domain-separated keys derived from the installation session secret, with their connection context authenticated. Both credential tables are excluded from archives. Forms, status reads, audit and run errors never echo their values. Archives retain normalized source snapshots and history, bindings, run metadata and event receipts; restoring those records does not restore provider or webhook authority. Snapshots remain retained evidence with reconnect-required/reduced-confidence labels until fresh credentials are configured; reconnect and reconcile for a new observation, and configure the endpoint signing secret again for webhooks. Session-secret rotation also requires reconnecting. Disconnect deletes local API credential ciphertext and stops intake/reconciliation; it does not revoke the key or remove data at Stripe. Records held by Stripe and previously sent mail remain external copies after a Buoy erasure.
- **Terms:** [Stripe Services Agreement](https://stripe.com/legal/ssa), [Stripe Data Processing Agreement](https://stripe.com/legal/dpa), [customer-list API](https://docs.stripe.com/api/customers/list) and [webhook signature verification](https://docs.stripe.com/webhooks/signature).

This is a test-mode source, with supported normalized records and explicit failure/freshness boundaries. It does not establish live-mode acceptance, a verified least-access credential, a provider certification or the later subscription-financial/reconciliation and multi-provider billing clauses.

## Optional model providers

AI is off until the owner enables it in Settings, confirms no-training terms and chooses permitted data classes. Each request requires explicit consent. Account questions include permitted account names, renewal dates and health bands; the five class switches govern additional source content. Turning AI off prevents all of these requests. Source facts follow the current staff profile before transmission; excluded transcript processing is refused locally. Model credentials belong in separate deployment secrets `AI_ANTHROPIC_API_KEY`, `AI_OPENAI_API_KEY` and `AI_COMPATIBLE_API_KEY`, never in the browser. Selecting a provider uses only that provider’s credential; a missing credential is refused before any request. Costs use measured provider tokens and owner-recorded model tariffs, rounded up to USD cents, not provider invoices; uncertain responses retain the budget reservation and are never retried automatically.

### Anthropic

When: The owner selects Anthropic and enables assistance.

Sends: The selected model, question and permission-filtered account facts; transcript lines only when transcripts are permitted and explicitly submitted. No provider credential is returned to the browser.

Receives: Structured record selections or line-cited proposals. Buoy renders source facts and requires a person to accept task creation.

Terms: Review [Anthropic commercial terms](https://www.anthropic.com/legal/commercial-terms) and the provider data-processing agreement. The recorded no-training confirmation is the owner's attestation. Settings always labels it unverified; Buoy does not verify provider training practices.

### OpenAI

When: The owner selects OpenAI and enables assistance.

Sends: The same permitted, scoped source facts and selected model through the chat completions endpoint.

Receives: Structured selections and proposals under the same validation and approval rules.

Terms: Review [OpenAI business terms](https://openai.com/policies/business-terms/) and the provider data-processing agreement. The owner must confirm the terms applicable to this deployment before enabling requests.

### Compatible endpoint

When: The deployment operator privately configures an approved HTTPS `AI_COMPATIBLE_URL`, and the owner selects compatible mode and confirms its terms. Request inputs cannot set an endpoint.

Sends: The same permission-filtered selected facts and model, with the deployment credential. Redirects are refused.

Receives: A compatible chat completions response. No provider certification is inferred.

Terms: The operator must record the actual provider's no-training terms and agreement; a generic compatibility protocol has no provider terms of its own. External copies follow that provider's custody. Account erasure removes local proposals but cannot retract already submitted provider data.
