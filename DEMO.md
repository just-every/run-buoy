# Buoy demo

After `rer setup`, run `rer demo` and open its private `RER_OPEN` link. Stop
with `rer demo --stop`. Base creates fresh data under `.rer/demo/`, deletes it
on stop, and leaves `.wrangler/state` alone. Every start is signed in as the
owner. The title and nav read **Buoy Demo**, with no bar or outbox.

`src/demo.ts` installs 24 accounts, current billing/support observations,
prepared playbooks, approved open/completed tasks, and renewed/deferred/churned
decisions. Dates are relative to the start. Stable account IDs and proposal lookups make the hook idempotent; it never
fetches. Accounts, proposals, approvals and task completions go through Buoy’s
domain functions, with their real validation, revisions and audit trail. Maya
Patel owns the sample workspace at maya@harbourstudio.example. Harbor Studio
shows completed and open work, an agreed renewal extension and a current draft. The manual move-in fixture provides
the account shape; these expanded examples live only in demo state.

The demo uses the unmodified published RER package and Base runtime modules
from the same release, recorded in `base-copies.json`. `withDemo` is the first
Worker import. Without `RER_DEMO`, ordinary product behavior is unchanged.

## Effects

Buoy stores manually supplied evidence; it has no public URL checker, provider
sync, AI action, webhook or publishing feature. Approving a playbook creates a
local task; approving a renewal records a local decision.

| Path | Demo behavior |
| --- | --- |
| Native sign-in, invitations and step-up mail through `operatorMail` | Base development sender validates and silently suppresses; returns success, no capture |
| Dependency discovery and configured OIDC discovery/JWKS | Real public GET reads through Base’s guard |
| OIDC token exchange, revocation and other external writes | Base guard returns mocked provider success; no configured provider in the sample workspace |

Public HTTP reads remain real under Base v2. Non-HTTP effects, if added later,
must use `demoEffect(real, providerSuccess)`; POST public reads use `fetchDemoRead`.

## Hosted deployment

`.github/workflows/run-demo.yml` reads the `run-demo` environment. Dispatch
`test_only=true` for the separate `demo.test.run-buoy.com` host with Cloudflare’s
published always-passing test keys, and `test_only=true, remove=true` to delete
it. Production dispatch uses the real Turnstile keys. Never automate the real
widget. Each visitor gets their own native Worker Loader isolate with its own
SQLite copy of Buoy's D1 database, a signed owner claim, a 60-minute maximum
lifetime and a 15-minute idle lifetime; expiry erases the copy. Test-host starts
need the private `RER_DEMO_MEASUREMENT_TOKEN` from the same environment, sent as
the `rer_demo_measure` cookie. `deploy-demo.json` carries only the domain, name,
owner email and public settings; no provider mail credential is needed.

The homepage’s demo CTA is admitted only after the production start page
answers successfully. The run site stays static and cookie-free.
