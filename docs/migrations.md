# Reviewed migration account mapping

Migration account bundles use the existing owner-only Imports screen and its shared import door. Preparing a bundle changes no installation data. This is an account mapping foundation; it does not claim a complete incumbent migration.

Prepare an account export:

```sh
node src/buoy/migrate/cli.mjs --source vitally --input vitally.json --output reviewed.json
node src/buoy/migrate/cli.mjs --source velaris --input velaris.json --output reviewed.json
```

These fixture-oriented exports contain an `accounts` array. Each account supplies `id`, `name`, `renewalDate`, `noticeDays` and `renewalEvidence`. An optional `--columns` JSON object maps those destination names to exact top-level source field names. Other source fields and collections are explicitly unmapped in review, retained in source custody and never activated. Users, health, projects, tasks, notes and NPS have no native mapping yet. These commands do not connect to an incumbent API or Google Sheets.

Prepare a CSV downloaded from a spreadsheet:

```sh
node src/buoy/migrate/cli.mjs --source csv --input book.csv --output reviewed.json --date-order day-first
```

The terminal guides the owner through exact header names. For unattended preparation, pass `--columns` with a JSON object, for example:

```sh
node src/buoy/migrate/cli.mjs --source csv --input book.csv --output reviewed.json --columns '{"id":"Customer","name":"Company","renewalDate":"Renewal","noticeDays":"Notice","renewalEvidence":"Evidence"}'
```

Choose `iso` (the default), `day-first` or `month-first`. ISO calendar dates are always accepted. Slash dates require the selected order; no locale is inferred. Impossible dates, malformed row widths, duplicate IDs, missing required values and invalid amounts are rejected. Every occurrence of a duplicate ID is rejected. CSV quoting supports commas, escaped quotes and embedded newlines; malformed quoting refuses the entire bundle. Blank rows are reported rather than silently omitted.

Optional invoice columns are `invoiceTotal`, `invoiceCurrency`, `invoiceObservedAt` and `invoiceDueDate`. Supply all four, or leave all four empty. Amounts are exact decimal text with a dot and no grouping separators or currency symbols. Currency codes are trimmed and uppercased; precision follows the installation's ISO minor-unit table. No rounding or conversion occurs. Credits and allocations start at zero. Invoice observations are source-referenced snapshots, never recurring revenue or health configuration.

The original UTF-8 CSV or incumbent export text, including its byte-order mark and line endings, is embedded losslessly in the JSON bundle with its SHA-256 digest. The server verifies that digest before parsing. The shared door uploads and retains the original JSON bundle bytes and therefore the embedded source text; it does not accept a bare CSV file. Bundle output is a new private file and never overwrites an existing file. Keep source and bundle files private.

Upload `reviewed.json` in Imports. Inspect counts, every rejected row, every unmapped field and collection, and the exact fingerprint. Explicit approval applies valid account rows only. Source IDs are stable and namespaced by source; the native ID is a deterministic digest of source and original ID. Imports are inert. Reconciliation reads actual native accounts; strict undo refuses later native edits and dependent work. History and reload retain the selected source namespace. Business grants retain their existing Buoy JSON source and quota; these migration mappings are owner-session only.

The parser accepts up to 2,000 CSV data rows, 2,100 total source records and a 2 MB bundle. The existing installation limit is still 500 accounts. A full 2,000-valid-account migration is unproved and unsupported at that bound; split files alone does not increase installation capacity. Conflicts in a later catch-up remain protected by the existing door. Reviewer-selected replacement, deletion proposals, cutover ownership and full delta undo acceptance remain MIGRATE-006 work.
