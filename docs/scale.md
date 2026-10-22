# Scale journey

SCALE-001 remains unproved. The 500-account installation guard stays in place
until the full journey passes on the exact candidate commit. The new journey
adds evidence collection; it does not raise any product limit.

Run the **Scale** workflow manually with a full 40-character `sha`. It checks
out that exact commit, builds the real Worker, then runs:

```sh
node tests/scale-journey.mjs
```

This workflow is independent of push Verify. On the shared Mac, the builder
must first obtain its session's heavy slot and commit the candidate. Resolve
`heavy-slot.py` from the fleet tooling installation, then run from the checkout:

```sh
python3 -I "$FLEET_TOOLS/heavy-slot.py" --remote never -- node tests/scale-journey.mjs
```

The emitted Worker must already have been built from that same commit. No
provider credentials, provider-shaped fixture keys, mock application, smaller
volume success mode or hidden retry is used. SQL-generated fixtures load the
actual persisted D1 schema through Wrangler's public local D1 command. This
avoids fifty million JavaScript event objects and measures real indexes,
foreign keys and retained event payloads. Each SQL statement loads at most
10,000 events. Fixtures use `synthetic-buoy-<n>` identities and observations
spread over thirty days, with fifty distinct current users per account.
The initial account is created by the reviewed Business import door and its
reconciliation must name that exact record. The direct fixture load does not
prove bulk account or person import.

The required dataset is 10,000 accounts, 500,000 users, 500,000 current
memberships/reviewed claims and 50 million actual retained events. A published
billing health scorecard exists before loading. The journey calls the native
hourly Cron and checks every account's recalculation time. It measures fully
consumed account HTML for the first, middle and last accounts three times,
portfolio adoption JSON and native report HTML, and a real 500-event intake
plus duplicate replay. Every account page must finish below two seconds;
each report below ten; recalculation below its hourly interval.

Public `rer export` and `rer import` run with source and destination Workers
stopped. The archive is read line by line; account, user, membership, mapping
and event counts must all match. Restored D1 counts, payload byte totals,
message identity sums and observation bounds must equal the source. Archive
parts, manifest counts and closing checksums use the published RER format
reader rather than a separate assumed format. The
restored Worker must serve account pages within target and return the last
new intake payload unchanged. Scratch installations and owned Workers are
removed in `finally`; archive credentials never enter the workflow artifact.

## Storage constraint and bounded failure

Cloudflare D1 has a hard 10 GB database limit. The present installation has one
D1 binding and duplicates event metadata inside the retained raw payload, with
three event indexes. Before attempting the complete monthly event load, the
journey writes 100,000 actual indexed events and reports the observed growth
per event and projected full database size. It fails explicitly when that
projection exceeds 10 GB; it never labels the pilot a passing scale result.
It also requires free disk space for the source, exported archive and restored
copy before proceeding. Full-volume export and restore durations are measured
without inventing a separate timing target absent from SCALE-001.

This local Worker/D1 journey cannot establish hosted Cloudflare latency.
The D1 limit is applied explicitly because local SQLite can accept data sizes
that the installed service cannot. A passing local result would still need a
stated deployment environment for a hosted-performance claim.

## Source findings to resolve

Current shared paths prevent a full-volume claim:

- `accounts.ts` limits native account creation to 500; `people/records.ts`
  limits customer people to 10,000.
- `people/snapshot.ts` puts every customer record and membership in one JSON
  result row. D1 limits a single string/row to 2 MB; 500,000 users exceed it.
- Product API middleware refreshes global people, custom fields, scorecards,
  segment membership and outcomes before reads. Account HTML begins by
  loading the whole portfolio, then reads several global projections.
- Usage intake invokes whole-portfolio scorecard recalculation after each
  500-event batch. Scorecard input construction retains large global images
  and repeatedly scans people/accounts.
- Keeping fifty million raw events, duplicate carrier metadata and existing
  indexes in one D1 database requires measured storage proof; it must not be
  assumed to fit.

These shared implementations are owned by the parent integration task.
Pagination, bounded per-account projection and incremental calculation must
preserve authorization, explicit identity attribution, source revision fences,
erasure custody and complete archive restoration. Splitting event storage
also requires changing those same real intake/read/erasure/archive paths;
adding an unused scale-only store would not meet the clause.

References checked 23 October 2026:
[Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/),
[local D1 development](https://developers.cloudflare.com/d1/best-practices/local-development/),
and [D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/).
