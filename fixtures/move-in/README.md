# Manual move-in examples

These files are explicitly synthetic examples for tests or a deliberate manual import. They are never loaded into a running installation automatically. They describe no real customer, invoice or support ticket.

The kit is **Account, billing and support JSON v1**. It accepts one JSON object with an `accounts` array of 1–50 accounts, and an installation holds at most 500 accounts. IDs are stable, case-sensitive identifiers of 1–64 letters, digits, underscores or hyphens. Every account requires `id`, `name`, `renewalDate`, `noticeDays`, `renewalEvidence`, `billing`, and `support`. Dates are real calendar dates in `YYYY-MM-DD` form. Money uses nonnegative integer minor units for supported ISO 4217 currencies (the same validation as native accounts). Credits plus allocated payments cannot exceed the invoice total. Observation dates cannot be in the future. Ticket counts are nonnegative integers, with urgent tickets no greater than open tickets. `noticeDays` is an integer from 0 through 3650.

`accounts-synthetic.json` includes referenced billing and support observations. `accounts-unknown-synthetic.json` deliberately uses `null` for both observations: null means unknown, never zero, paid or healthy. Billing fields describe the exported snapshot; the import does not contact a billing or support provider.

Upload the original bytes through `/api/operator/import/uploads`, then plan through `/api/operator/import/plan`. The owner reviews its returned fingerprint and supplies `{planId, reviewedFingerprint}` to `/api/operator/import/apply`. Repeating that apply resumes or returns its durable job. Read status, reconcile native records and undo through the same door. The signed-in Imports screen uses these exact endpoints. Installation `.rer` archives remain separate.

The door keeps original-byte custody and normalized plans. Credential-removal diagnostics identify redacted fields and cause the original bytes to be withheld and discarded. Never supply real credentials in a fixture. Later snapshots use explicit catch-up: absent records remain native with an explanation, and native edits stay protected. Imports are inert.

Undo is strict: native edits and dependent work refuse removal. Owner erasure removes native rows and dependent work, withdraws import originals and whole door snapshots, and advances the portable restore fence atomically. Permanent hashed target/source tombstones prevent resurrection. The erasure journal inventories retained door custody; installation settings, revoked keys and anonymous history remain.

The production dependency closure is copied verbatim from Base main at `24207c51ea9f4c29631396c879d16ae0b9ff3c59`, tracked in `base-copies.json`. Applied migrations stay intact; the new door and runtime evolution use migrations 0028–0030. Public HTTP journeys in `tests/flows.test.mjs` exercise upload, review, apply, reconcile, undo, owner/Business authority, provisioning, session/key revocation and erasure.
