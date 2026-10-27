# Synthetic ChurnZero account CSV

This twenty-account file contains synthetic data only. It is a selected-column account CSV for exercising explicit mapping, not a verified ChurnZero export schema or an export from a live provider account.

ChurnZero's [account data audit guide](https://churnzero.com/blog/7-point-audit-checklist-for-customer-success-software/) names Account External Id and Next Renewal Date among important account attributes. This fixture adds explicit account name and customer-supplied contract notice and reference columns; those contract terms must actually exist in the owner's source and are never inferred. The mapping uses the exact selected headers. A byte-order mark and CRLF line endings exercise lossless preparation.

ChurnScore and Health Factor are deliberately unmapped for every row. Neither an exported score nor a label supplies native health configuration, factor weights, observations or history. Contacts, tasks, plays, plans, journeys, events, NPS and provider API acquisition are not represented or proven. No paused journey migration is claimed.
