# Source provenance

Buoy was composed from committed [Base](https://github.com/runeditrun/base) main `fc0e1041efa55771142bbb57c4ab4743147e264d` using its foundation generator and edition assembler. `composition.lock.json` retains the original foundation inventory. Product files are edition-owned adaptations; that initial inventory is provenance, not a claim that edited files still match the template. CLI conversion used Base's package-mode exporter and pins the published RER 0.2.22.

Base runtime copies provide authentication, mail, dependency/owner claim, shared frames, fonts and theme. `src/modules/import-kit` is the unchanged production D1 dependency closure copied from the same Base revision; `src/buoy/imports` adapts its default-seed people example. Numbered migrations preserve the generated foundation schema and add Buoy and import custody.

Copied/adapted MIT sibling patterns:

- [Orbit approved outreach](https://github.com/just-every/run-orbit/blob/38cef87571a413802dbaa7aa6afbab332d8cd778/src/core/features/outreach/approval-repository.ts): exact-revision, current-authority and idempotency guards, adapted in `src/buoy/work.ts`. Its records repository's source-change invalidation is represented by account revisions.
- [Nectar receivables](https://github.com/just-every/run-nectar/blob/c76a60ccffa39cc1a207b52c152bda16d6d7b1df/src/nectar/receivables.ts): invoice minus credits minus allocated payments, adapted in `src/buoy/health.ts` with validation in `imports/validation.ts`.
- [Nectar subscriptions](https://github.com/just-every/run-nectar/blob/c76a60ccffa39cc1a207b52c152bda16d6d7b1df/src/nectar/subscriptions.ts): prepared snapshots and current revision approval, adapted in `work.ts`.
- [Locket renewal obligations](https://github.com/just-every/run-locket/blob/82478229f356d017bda62b4944b584138ef9671c/src/locket/obligations.ts): confirmed date/notice evidence and person-recorded renewal decision, adapted in `health.ts`, `accounts.ts` and `work.ts`. Billing periods never imply renewal terms.

Run Coaster, Beam and Pier main README/OPERATIONS/package-mode examples informed the CLI and archive wiring. No sibling repository was modified. Support snapshot rules are Buoy's own implementation. Source retains the Run Edit Run MIT copyright; the self-hosted Spectral and Red Hat Text fonts retain their SIL Open Font Licenses.

The exact published RER 0.2.22 package supplies bounded, nonblocking macOS listener ownership inspection. No local RER patches are applied.

Demo adoption refreshes every vendored runtime module together from Base tag `rer-v0.2.22` (`1ce15dd8cbb7c8cf2d83ebfde2b4a8a130ff9d74`). `base-copies.json` is maintained with Base’s supported `record-base` and `refresh-base` commands and records the exact copied production bytes. Applied migrations remain unchanged; owner sign-in uses additive migration 0016. Buoy’s mail facade follows that tag’s demo/development suppression. The import-kit remains its production D1 dependency closure.
