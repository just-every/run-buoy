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

Money uses nonnegative integer minor units of an ISO 4217 currency at its exponent (see [Accounts](/docs/accounts)). Credits plus allocated payments cannot exceed the total. Observation dates cannot be in the future. Ticket counts are nonnegative whole numbers; urgent tickets cannot exceed open tickets.

Use `null` for either observation when it is absent. Missing billing or support means unknown, not zero, paid or healthy. Imports do not fetch evidence from providers. Do not include credentials or executable connector settings in the upload.

## Upload, review and apply

1. As the owner, open **Imports** in your installed Buoy (`/app/imports`, also `/app/import`).
2. Choose the original **Account snapshot JSON** file and select **Upload and review**.
3. Read the counts, differences, rejections, credential-removal diagnostics and reviewed fingerprint. Planning changes no accounts.
4. Check the review confirmation and select **Apply reviewed import**.
5. Select **Reconcile native records**, then return to **Accounts** to inspect the actual evidence.

The exact reviewed fingerprint binds apply to this plan. Repeated apply resumes or returns its same durable job. The screen also offers **Continue import** when work remains. Imported accounts are inert: importing does not send mail, approve work or grant access.

For a later export from the same source, select **Update an earlier import from the same source** before planning. Review additions, replacements, unchanged records and records gone from the source. Gone records remain in Buoy with an explanation. Native edits are protected from replacement. After erasure withdrew a baseline snapshot, leave that box unchecked to begin a new baseline; erased IDs still cannot return.

## Custody and shared authority

The shared Base door retains original uploaded bytes, normalized source and reviewed plan custody. If the kit removes credentials from a record, the review lists each removal and the original bytes are withheld and discarded. The screen needs JavaScript for same-origin uploads; only this import page allows same-origin static scripts and connections under its content security policy.

The owner can use imports even when **Business imports** is off. Business requests additionally need signed, action-bound grants, explicit enablement and a current non-revoked signing key. A self-hosted installation starts with Business disabled. A Business-provisioned installation opens it after owner claim only when its provisioning setting is exactly `RER_IMPORT_DOOR=on`; later owner paths heal incomplete provisioning but never override a saved disable. Key revocation is permanent, including across disable/re-enable.

Local and Business approvals appear in one history, labelled **approved by** or **approved via Business by**. Earlier imports remain in **Earlier import journal**; the owner can read and undo earlier admin jobs. Account editing permissions are unchanged.

## Undo an import

Open its history entry and select **Undo import**. Undo is strict: account edits and dependent proposals, tasks or decisions prevent removal. Owner undo works while Business is disabled. Undo a newer import before an earlier import whose records it superseded.

Owner [account erasure](/docs/accounts#delete-an-account) is separate. It removes the account and dependent work, withdraws retained upload and snapshot bytes, and advances the archive restore checkpoint in the same transaction. Its journal inventories the withdrawn custody. It preserves anonymous approval/history bookkeeping, installation settings and revoked keys; erasure cannot resurrect a record through a later import or older archive.
