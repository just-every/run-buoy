# Providers and data flows

Buoy is self-hosted on your own Cloudflare account. No Buoy service sits between your installation and the providers below: your installation talks to each one directly with credentials you hold. This guide lists every provider an installation can talk to today, what each one receives and returns, and the terms that govern it.

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

A deployed installation sends sign-in links, task reminders and escalations, and notification mail and optional digests to your own team, through the one mail provider you choose with `MAIL_PROVIDER`. Buoy sends no customer messages. Notification mail contains the title, account name, note or risk reason and a signed-in account link. Digests include queued notices and counts of recorded changes in the recipient’s current book. Each person controls their own notification mail and digest preferences. A reminder names the task, its account and its due date; erasing an account in Buoy does not delete reminder mail the provider or the recipient already holds.

### Resend

- **When:** `MAIL_PROVIDER=resend`.
- **Sends:** the recipient's email address, your sender address and the sign-in message with its one-time link; for a task reminder or escalation, the team member's email address, the task title, account name, due date and a link to the account; for notification mail and digests, the notification title, account name, note or risk reason, book-change counts and signed-in links.
- **Receives:** the provider's message ID.
- **Terms:** [Resend terms of service](https://resend.com/legal/terms-of-service) and [Resend DPA](https://resend.com/legal/dpa).

### SendGrid

- **When:** `MAIL_PROVIDER=sendgrid`.
- **Sends:** the recipient's email address, your sender address and the sign-in message with its one-time link; for a task reminder or escalation, the team member's email address, the task title, account name, due date and a link to the account; for notification mail and digests, the notification title, account name, note or risk reason, book-change counts and signed-in links.
- **Receives:** the provider's acceptance of the message.
- **Terms:** [Twilio terms of service](https://www.twilio.com/en-us/legal/tos) and [Twilio data protection addendum](https://www.twilio.com/en-us/legal/data-protection-addendum).

### Cloudflare Email

- **When:** `MAIL_PROVIDER=cloudflare`, through your Cloudflare account's email sending API.
- **Sends:** the recipient's email address, your sender address and the sign-in message with its one-time link; for a task reminder or escalation, the team member's email address, the task title, account name, due date and a link to the account; for notification mail and digests, the notification title, account name, note or risk reason, book-change counts and signed-in links.
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

Except for the Stripe test-mode customer-ID inventory below, Buoy makes no outbound calls to billing, CRM, support, product-usage, mailbox, calendar, chat, survey or model providers yet. Incoming product observations are described below. Billing and support evidence is entered by hand or moved in from a file. Each connector adds its section to this guide, with its data flows and terms, before it ships.

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

## Stripe test-mode inventory

### Stripe

- **When:** an owner or administrator adds a test-mode connection at `/app/connections`, starts a page sync, or its hourly reconciliation runs. Use a restricted test key with customer-read permission.
- **Sends:** a GET request to Stripe’s customer-list API with the server-held credential, page size and saved pagination cursor. No write request reaches Stripe.
- **Receives:** test customer IDs and creation instants. Buoy stores only those source references, run counts, cursor, errors and last-success time; it creates no accounts, contacts, billing observations or identity mappings. The page honestly labels failed, disconnected, never-synced and stale sources. This is a partial CONNECT-001 implementation: webhooks, notices and account-confidence propagation remain unavailable.
- **Credential custody:** AES-GCM ciphertext uses a domain-separated key derived from the installation session secret and the connection ID as authenticated context. The credential table is excluded from archives; restores and session-secret rotation require reconnecting. Keys are never echoed by forms, status reads, audit or run errors. Disconnect deletes local ciphertext; it does not revoke the key at Stripe.
- **Terms:** [Stripe Services Agreement](https://stripe.com/legal/ssa), [Stripe Data Processing Agreement](https://stripe.com/legal/dpa), [customer-list API](https://docs.stripe.com/api/customers/list).
