# Books, teams and handovers

Open **Team** as the owner or an administrator. Each CSM's book counts their accounts across every team. Set a capacity in whole accounts, create teams and optional pods, and add active people to each team. Teams and pods organize allocation; they do not grant account access. A person without a target is labelled **No capacity target set** and can still receive a manual account assignment. Rules require a capacity target.

Add rules in the order they should match. A territory name matches exactly; leave it blank to match any territory. The first matching rule selects a team. Capacity-aware round-robin assigns an unassigned account to the eligible CSM with the lowest fraction of their capacity filled, breaking ties by stable person id. Accounts are considered in stable account-id order. A person at or over target receives nothing new. Segment rules and ARR-band rules arrive with SEGMENT-001 and BILLING-003/BILLING-004 respectively; invoice balances are not ARR.

Choose **Preview assignment** to review the proposed owners and task counts, then **Apply reviewed assignment**. A missing match or insufficient capacity blocks the whole run. If accounts, tasks, people or settings changed after review, preview again. Rules run only when you explicitly review and apply them.

To hand over a book, select the outgoing and new CSM and write a handover note. Preview and apply. All their accounts and open tasks they own on those accounts move together. Completed tasks and tasks separately owned by another person stay. Each account shows the note, previous and new CSM, the person who made the change and its date under **Account handovers**. The account's **Account owner** form also allows manual assignment, enforces a configured capacity and records your note (or an honest generic note if blank).

You can lower a target below the current book. The CSM then shows **over target by N**. Use **Preview rebalance** to review moving the excess through the current rules. With no eligible capacity, it explains the shortfall and changes nothing. Raising someone else's target or changing the eligible team can make room; then preview again.

PLAN-001 and JOURNEY-001 will move their open plans and journeys with these handovers before those kinds ship. ROLE-001 will add scoped manager and CSM roles; until then the owner or administrator manages allocation.

## CSM workspace and live views

Open **CSM workspace** from Accounts. The home shows the selected person’s current
book, open tasks they handle due today in the installation timezone, unread active
alerts and renewal dates through the next 90 days (both endpoints included).
Customer meetings are explicitly unavailable until calendar capture ships.
Owners/admins can inspect any book; a named manager sees the same home for a
direct report who belongs to one of the manager’s teams. An ordinary peer cannot inspect another CSM’s home.

Use **Filter, sort and save a view** for account or product-user lists. The field
catalog shows the current typed fields and metrics. Choose columns and sorting,
then preview without saving or save a personal/shared definition. For example:

```json
{"match":"all","conditions":[{"field":"health.status","op":"eq","value":"at-risk"},{"field":"daysToRenewal","op":"gte","value":0},{"field":"daysToRenewal","op":"lte","value":90}]}
```

Sharing publishes the definition to current staff; it grants no additional record
access and only the creator edits it. Results always read current records. Missing
sort values stay last in either direction, ties use the native ID, and related
multi-values sort as the displayed JSON.

An owner/admin selects records and previews **assign**, **enroll** or **segment**.
Selecting users expands their current account memberships; review every account.
Assignment checks capacity for the whole selection and moves the outgoing CSM’s
open tasks with the handover. Enrollment currently approves one at-risk playbook
action/task per account. Segment membership adds accounts to a chosen static
segment. Review and approval are separate; changed evidence, ownership, people or
capacity requires another preview. Replaying the same operation records no extra
handover, proposal or task. Future scoped CSM permissions and multi-step playbooks
retain their own contract requirements.
