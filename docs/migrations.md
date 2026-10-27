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

## Totango definition source files for review

Keep supplied SuccessPlay definitions, SuccessFlow categories and definition schemas alongside the account source while preparing a migration. Add `--references reference-files.json` to either Totango preparation command above. The manifest is a Buoy preparation format, not a Totango export schema:

```json
[
  {"name":"successplay.json","kind":"successplay-definitions","path":"original-successplay.json"},
  {"name":"categories.json","kind":"successflow-categories","path":"original-categories.json"},
  {"name":"schema.json","kind":"definition-schema","path":"original-schema.json"}
]
```

Paths resolve relative to the manifest. Supply only files you actually have; a category file cannot substitute for a definition. Names must be unique, begin with a letter or digit and contain only letters, digits, dots, underscores or dashes, up to 100 characters. Each original must be a UTF-8 JSON object or array. Preparation preserves its exact text, byte-order mark and line endings with a digest, and refuses credentials before writing the bundle. The existing 2 MB bundle bound includes these files. At most ten files and 1,000 total JSON elements, including containers, fit one review, with nesting up to 32 levels. Duplicate object keys and duplicate file names are refused rather than silently losing source elements.

The existing Imports screen lists every reference element as unmapped with its file name, escaped JSON pointer and reason. Inspect the original private files before approving the bundle's fingerprint. A modified reference digest refuses the entire plan, including its account rows. Approval imports the reviewed accounts only. References create no playbook definitions, operational tasks, schedules, sends or execution authority. Replay, status, reconciliation and strict undo remain the existing account-import operations; reconciliation does not claim native definition parity.

Source files are custody inputs only. Their shapes are not certified vendor schemas, and supplied schema files are not automatically trusted or fetched. A genuine SuccessPlay definition with documented semantics and its available SuccessFlow associations is still required before native paused-definition mapping can ship. Every supplied property and container remains explicitly unmapped in this increment; no trigger, ordering, assignment, action or missing behavior is inferred. Native definition mapping, paused-state restoration and the other MIGRATE-003 inputs remain incomplete.

Installation archives preserve the account migration and opaque reference custody: exact source bundle bytes and reference digests, the reviewed approval fingerprint, import history and native reconciliation. After restoration, the fresh installation owner can replay the reviewed bundle without a second import and undo unchanged accounts. Later account edits or dependent work refuse strict undo without removing other accounts. Published scorecards and calculated fields can create such dependent work after import; inspect reconciliation before choosing undo. Scheduling restored reference custody creates no playbook, task or execution authority. These guarantees do not establish migrated SuccessPlay definitions; those still need a genuine source artifact and documented semantics.

## ChurnZero account CSV

ChurnZero documents [Live Exports](https://support.churnzero.com/hc/en-us/articles/16422781859341-Work-With-Live-Exports) as reports driven by segments in Google Sheets or Excel 365. Save the chosen account report locally as CSV, then prepare it with the same explicit-header mapper. Buoy does not access the spreadsheet or connect to ChurnZero during preparation:

```sh
node src/buoy/migrate/cli.mjs --source churnzero --input accounts.csv --output reviewed.json --columns '{"id":"Account External ID","name":"Account Name","renewalDate":"Renewal Date","noticeDays":"Notice Days","renewalEvidence":"Contract Reference","invoiceTotal":"Invoice Amount","invoiceCurrency":"Currency","invoiceObservedAt":"Invoice Observed","invoiceDueDate":"Invoice Due"}'
```

These headers document the supported synthetic example in `./fixtures/move-in/churnzero/accounts.csv`; they are not a certified vendor schema. No genuine ChurnZero export or versioned schema has been verified. Supply exact headers from the source artifact, or omit `--columns` to use the terminal guide. Account external identity and contract evidence must be present; missing dates and terms are never inferred. The documented destination fields and validation above apply unchanged.

ChurnZero has its own source namespace and deterministic account identities, separate from generic CSV and every other incumbent. The bundle retains exact original UTF-8 bytes and their digest. The existing owner Imports screen reviews it without writing, names each unsupported column, applies only the reviewed fingerprint, survives reload, reconciles native accounts and supports strict undo. A later native edit or dependent work refuses undo. Source erasure withdraws custody and prevents replay.

Optionally map `churnScore` and `churnScoreFactors` together to the exact score header and factor header. For the synthetic example, add `"churnScore":"ChurnScore","churnScoreFactors":"ChurnScore Factors"` to the column mapping. The factor cell must be a JSON object with 1 to 200 exact factor names and numeric observations or `null` for unavailable. Empty score text means unavailable; zero is retained as zero. Duplicate factor names, arrays, text-valued factors, nonfinite numbers and partially selected mappings reject the affected account rather than discard a factor. For factors exported as separate columns, set `churnScoreFactors` to an explicit object such as `{"usage":"Usage input","engagement":"Engagement input"}`. Each factor names its exact source header; decimal text is validated and empty cells remain unavailable. No JSON factor cell is required in this form. A source column cannot map to two destinations. Reconciliation retains each chosen factor name and its source header. Unselected columns remain explicitly unmapped.

The native account retains a read-only `migrationHealth` observation with the source identity, original score, factor values and mapped header names. Read it through the existing account API or **Account source details** on the account page. The reviewed plan, native reconciliation and strict undo include the entire observation. Later account edits preserve it; account erasure removes it and withdraws its source custody. Source observations have no implied scale, observation date, weights, bands or rules and do not replace Buoy's published health scorecard. The observations also appear as **Imported ChurnZero ChurnScore** and named factor inputs in the existing weighted-health editor. A person chooses bounds, direction, weights and missing-source treatment, previews the native results, then explicitly publishes an immutable scorecard version. Preview writes nothing. Missing values remain unknown under the selected missing-source policy, and undated source evidence is labelled untracked. Importing alone never publishes a scoring rule. This mapping contract does not certify the vendor's export schema.

Contacts and journey labels remain explicitly unmapped. No contact, operational task, play, success plan, event, NPS response or native journey is created. Retaining a journey label does not make a paused Buoy journey. Vendor scorecard-definition mapping, journey definition mapping and paused inertness, the remaining original inputs and ChurnZero API intake remain MIGRATE-002 gaps. Preparation makes no provider request and creates no execution or sending authority.
