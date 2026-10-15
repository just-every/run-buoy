# Buoy contract

- HTTP-001: Base handles identity and setup; Hono owns authenticated product HTTP handlers. Every data handler checks current identity, role and write origin. Agent credentials have only read/preparation commands.
- DATA-001: Accounts hold referenced billing and support observations and confirmed renewal terms. Integer invoice balances cannot go negative; dates and observations are validated. Missing/stale evidence is visible.
- APPROVAL-001: Proposals snapshot the current account. Approval checks the same revision in an atomic D1 batch, records a person and time, and creates one task or decision. Completion requires separate evidence. Source updates preserve earlier decisions.
- IMPORT-001: Base import-kit binds apply to reviewed source and destination state. Journal and strict undo survive restart. Undo refuses edited accounts or dependent work.
- ERASE-001: Owner erasure atomically removes the account and its native/import custody; permanent target/source tombstones prevent replay in that installation. External copies are outside this boundary.
- RESTORE-001: Local RER archives carry domain and import custody into an empty destination. New owner authentication is required; credentials/outbox/settings are excluded. Corrupt and populated restores fail.

- SITE-001: The static run site contains the product homepage, `/run`, Markdown owner guides and a 404. It reads no installation data and links only public routes. Installed `/` keeps the shared Lobby. Run-site deployment stays gated off until its release gate.
- STYLE-001: The site, auth, setup and product share self-hosted Spectral/Red Hat Text and the paper, ink and signal tokens. Real forms, role boundaries, checklist content and evidence remain available at desktop and phone widths.

No external message sending, billing collection, analytics ingestion or prediction is implemented. A first-release candidate is not hosted-provider or independent release acceptance.
