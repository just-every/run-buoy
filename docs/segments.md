# Segments, tiers and lifecycle stages

Open **Segments** in the app. An owner or administrator creates a dynamic rule or static account list. Members can read reports; a segment never grants access. Use the supported fields shown below the reports.

For a USD invoice above $50,000 on an at-risk account, choose **All conditions** and enter:

```json
[
  {"field":"billing.currency","op":"eq","value":"USD"},
  {"field":"billing.totalMinor","op":"gt","value":5000000},
  {"field":"health.status","op":"eq","value":"at-risk"}
]
```

These are invoice snapshots, not ARR. Amounts use the stated currency's minor units. Missing values only match `is-missing`; all other comparisons, including `ne`, return false. Text is case-sensitive and dates compare ISO strings. Number comparisons use whole numbers. Choose **Any condition** for OR instead of AND. Static lists take comma-separated existing account IDs.

Membership refreshes after source and configuration changes, on requests, and hourly for changing dates and evidence freshness. Each entry and exit remains in Membership history. Each configured entry task creates one proposal; the owner/admin approves it on the account. Approval checks the account revision, active entry and segment revision. Re-entry can prepare a new proposal. Changing a segment never replays an active interval; an invalid old proposal needs a new legitimate entry. Task offsets count UTC calendar days.

Rule tier and stage use the first matching segment in creation order. Classification rules read source and manual classification first; membership then reads the effective classification. Manual account classifications override rules until **Return to segment rules** is selected. **Explicitly unset** keeps a classification empty. The account's Recorded evidence shows its effective tier, stage and segments.

Each segment report lists its members and health counts; **Download full segment report (CSV)** exports the same accounts. Team assignment rules can select a segment alongside a territory; the existing capacity and reviewed assignment rules still apply. Erasure removes membership history, entry proposals, classifications and static references.

ARR, numeric health scores, custom fields/objects, relationships, scorecard weights, journeys and scoped roles arrive under their own contract clauses. Each must add its segment rule or downstream behavior before shipping. Today the installation supports 50 segments of 32 conditions each and 500 accounts; it refuses larger input.
