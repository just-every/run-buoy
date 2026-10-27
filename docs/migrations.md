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

Upload `reviewed.json` in Imports. Inspect counts, every rejected row, every unmapped field and collection, and the exact fingerprint. Explicit approval applies valid account rows only. Source IDs are trimmed text or exact integers rendered as decimal text, stable and namespaced by source; the native ID is a deterministic digest of source and original ID. Imports are inert. Reconciliation reads actual native accounts; strict undo refuses later native edits and dependent work. History and reload retain the selected source namespace. Business grants retain their existing Buoy JSON source and quota; these migration mappings are owner-session only.

The parser accepts up to 2,000 CSV data rows, 2,100 total source records and a 2 MB bundle. The existing installation limit is still 500 accounts. A full 2,000-valid-account migration is unproved and unsupported at that bound; split files alone does not increase installation capacity. Conflicts in a later catch-up remain protected by the existing door. Reviewer-selected replacement, deletion proposals, cutover ownership and full delta undo acceptance remain MIGRATE-006 work.

## Totango account segment CSV

Use Totango's **Download CSV** on an account segment. The download contains the segment's selected column headers; there is no fixed account CSV schema. Include the required account identity and contract columns, then map their exact names explicitly. Custom attributes can supply contract evidence; Buoy never invents missing renewal terms. See [Totango's export documentation](https://support.totango.com/hc/en-us/articles/10233417253652-Export-segment-data).

```sh
node src/buoy/migrate/cli.mjs --source totango --input accounts.csv --output reviewed.json --columns '{"id":"Account ID","name":"Account Name","renewalDate":"Contract Renewal Date","noticeDays":"Notice Days","renewalEvidence":"Contract Reference","invoiceTotal":"Invoice Total","invoiceCurrency":"Invoice Currency","invoiceObservedAt":"Invoice Observed","invoiceDueDate":"Invoice Due","supportObservedAt":"Support Observed","supportReference":"Support Reference","openTickets":"Open Tickets","urgentTickets":"Urgent Tickets"}'
```

Without `--columns`, the same terminal guide asks for exact headers. Totango imports have a separate source namespace from generic CSV, even for identical account IDs. Exact source bytes, unmapped columns, review, fingerprint approval, native reconciliation and guarded undo use the existing owner import door. Reloading Imports preserves Totango history and its source namespace. A Health Profile column is retained and explicitly unmapped; it never configures native health.

The synthetic twenty-account fixture is documented in `./fixtures/move-in/totango/README.md`. This is partial MIGRATE-003 work: native users, health profiles, SuccessFlows as paused playbooks with mapped or explicitly unmapped steps, tasks, touchpoints, segments, success plays and API intake beyond accounts remain unimplemented. It does not claim a full Totango migration.

Optional support columns are `supportObservedAt`, `supportReference`, `openTickets` and `urgentTickets`. Supply all four or leave all empty. Counts must be exact nonnegative whole numbers; urgent tickets cannot exceed open tickets. The observation uses the same real-date and not-in-the-future checks as native entry. These are manually attributed source snapshots, not connected tickets or support history. Health profiles are not inferred from them.

## Totango account API acquisition

The preparation command can also read an account segment through Totango's documented [account search API](https://support.totango.com/hc/en-us/articles/204174135-Search-API-accounts-and-users). Export the segment's query from Totango and save its `terms`, `fields`, and optional `count`, `sort_by`, `sort_order` and `scope` in a private JSON file. Omit `offset`; preparation walks every page and refuses changing totals, incomplete pages and more than 2,000 accounts. Requests are paced below Totango's documented token rate. There is no automatic retry.

Every selected field needs a unique `field_display_name`. Map the destination `id` to `name` and destination `name` to `display_name`; other column mappings name those exact selected-field labels. Include explicit source attributes for the required renewal date, notice days and contract evidence. API dates and amounts pass the same strict native validation as CSV values; missing contract terms are never inferred.

Set `BUOY_TOTANGO_APP_TOKEN` through your private environment configuration, then run:

```sh
node src/buoy/migrate/cli.mjs --source totango --api-query account-query.json --region us --columns '{"id":"name","name":"display_name","renewalDate":"Renewal","noticeDays":"Notice","renewalEvidence":"Evidence"}' --output reviewed.json
```

`--columns` accepts the same JSON object syntax as the CSV command. Choose `us` for `https://api.totango.com` or `eu` for `https://api-eu1.totango.com`. The only provider operation is a read-only POST to `/api/v1/search/accounts`, authenticated with the private `app-token` header. Redirects are refused. Totango receives the selected query and credential; Buoy receives account identities, display names, selected field values and pagination totals. The token and request headers never enter the bundle. Provider terms: [Totango terms](https://www.totango.com/legal/terms-of-service).

The bundle retains the token-free query, region, retrieval time, exact UTF-8 response text and digest for every page. Upload it in the same owner-only Imports screen, review the fingerprint and unmapped fields, then explicitly apply. No native write occurs during acquisition. Native reconciliation and undo use the same Totango source identity as CSV imports. This closes account API intake only; it does not map users or automate a complete migration.

Totango's documented [flows](https://support.totango.com/hc/en-us/articles/212116426-Understand-flows) are activity categories. Its [flow lookup](https://support.totango.com/hc/en-us/articles/115000597266-Touchpoints-API) supplies category metadata without ordered steps. These must not be invented as ordered playbooks. SuccessPlay definition migration, its paused native representation and per-step mapping remain unbuilt; an account or task's flow name never activates automation.


## SuccessPlay definition prerequisite

MIGRATE-003 remains partial. The [SuccessPlay API](https://support.totango.com/hc/en-us/articles/19685213236116-SuccessPlay-API) triggers an existing active manual play; it does not document a definition-read response. Never call that execution endpoint to obtain migration data. The [creation guide](https://support.totango.com/hc/en-us/articles/360033300652-Create-SuccessPlays) explains triggers, ordered actions, task assignment and schedules, but does not supply a versioned export schema. These guides describe behavior, not a definition artifact that Buoy can map.

Before definition mapping can ship, supply an authorized, sanitized definition export and its documented schema or version, with available SuccessFlow associations. Keep source identity, trigger criteria, ordered actions, task timing and assignment, post-completion actions, references and unsupported elements distinguishable. Remove credentials at the source; do not upload execution tokens or webhook authentication material. Missing fields stay unavailable, and unsupported elements need source references and explicit reasons. The current preparation command accepts account CSV or account-search bundles only; it cannot import these definitions yet.

The required future representation is paused configuration. Import review and approval will authorize data migration only. Import, replay, reload, trigger and schedule evaluation, and archive restoration must create no sends, operational tasks or execution authority. Definition custody, exact reconciliation and strict undo need their own proof through the existing Imports door; the twenty-account journey is account evidence only. The synchronized ct clarification and all six named Gaps remain in CONTRACT.md and ACCEPTANCE.md.
