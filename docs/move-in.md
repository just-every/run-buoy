# Move in

Bring your own account snapshots into Buoy. Preview the exact JSON upload, review its dry run, then apply those reviewed records.

## Prepare the account JSON

The **Account, billing and support JSON v1** kit accepts one object with an `accounts` array of 1–50 accounts. An installation holds at most 500 accounts. API request bodies are limited to 256 KB.

Each account requires `id`, `name`, `renewalDate`, `noticeDays`, `renewalEvidence`, `billing` and `support`. Stable, case-sensitive IDs contain 1–64 letters, digits, underscores or hyphens. Dates use real `YYYY-MM-DD` calendar dates. Notice days are a whole number from 0 to 3650.

This is an explicitly synthetic shape example, for a deliberate trial only. Replace it with your own records for real use:

```json
{
  "accounts": [
    {
      "id": "synthetic-harbor",
      "name": "Synthetic Harbor Studio",
      "renewalDate": "2027-01-15",
      "noticeDays": 30,
      "renewalEvidence": "Synthetic contract HBR-2026 section 4; manual example only",
      "billing": {
        "observedAt": "2026-10-15",
        "reference": "Synthetic invoice HBR-1001; manual example only",
        "currency": "USD",
        "totalMinor": 120000,
        "creditsMinor": 10000,
        "allocatedMinor": 30000,
        "dueDate": "2026-10-01"
      },
      "support": {
        "observedAt": "2026-10-15",
        "reference": "Synthetic support export; manual example only",
        "openTickets": 3,
        "urgentTickets": 1
      }
    }
  ]
}
```

Money uses nonnegative integer minor units in USD, CAD, EUR, GBP, AUD or NZD. Credits plus allocated payments cannot exceed the total. Observation dates cannot be in the future. Ticket counts are nonnegative whole numbers; urgent tickets cannot exceed open tickets.

Use `null` for either observation when it is absent. Missing billing or support means unknown, not zero, paid or healthy. Imports do not fetch evidence from providers. Do not include credentials or executable connector settings in the upload.

## Preview and apply

1. As an owner or admin, open **Imports** in your installed Buoy.
2. Paste your JSON into **Account snapshot JSON** and select **Preview import**.
3. Read **Dry-run review**. Check the input, unique, duplicate and other reported counts, diagnostics and **Import review details**. Preview has not imported any accounts.
4. Select **Apply reviewed import** only after reviewing the exact source.
5. Check **Import journal** for the completed job and return to **Accounts** to inspect the imported evidence.

The reviewed fingerprint binds confirmation to that upload, including IDs and evidence. Changing the source requires another preview. Imports create new accounts; conflicting existing accounts are refused rather than overwritten. Use [source refresh](/docs/accounts#refresh-sources) for an existing account.

## Understand custody and resuming

The journal retains normalized source, mapping and custody. It does not preserve the original upload’s byte formatting; this limitation appears in the preview diagnostics.

For API use, apply with the preview’s fingerprint and a stable operation key, alongside the same accounts. Repeating that operation key with the same reviewed source resumes or returns the same durable job. Another upload cannot reuse that key. If an API job is `applying` or `undoing`, repeat the same apply or undo call until it completes. See the repository’s [move-in kit](https://github.com/just-every/run-buoy/blob/main/fixtures/move-in/README.md).

## Undo an import

Open its record in **Import journal** and select **Undo this import**. Undo succeeds only while its account records have not changed or gained dependent proposals, tasks, decisions or events.

Buoy refuses undo when later work exists; it does not discard those changes. Review the account and its history rather than repeatedly applying the upload. Owner [account erasure](/docs/accounts#delete-an-account) is a separate action with different retention consequences.
