# Books, teams and handovers

Open **Team** as the owner or an administrator. Each CSM's book counts their accounts across every team. Set a capacity in whole accounts, create teams and optional pods, and add active people to each team. Teams and pods organize allocation; they do not grant account access. A person without a target is labelled **No capacity target set** and can still receive a manual account assignment. Rules require a capacity target.

Add rules in the order they should match. A territory name matches exactly; leave it blank to match any territory. The first matching rule selects a team. Capacity-aware round-robin assigns an unassigned account to the eligible CSM with the lowest fraction of their capacity filled, breaking ties by stable person id. Accounts are considered in stable account-id order. A person at or over target receives nothing new. Segment rules and ARR-band rules arrive with SEGMENT-001 and BILLING-003/BILLING-004 respectively; invoice balances are not ARR.

Choose **Preview assignment** to review the proposed owners and task counts, then **Apply reviewed assignment**. A missing match or insufficient capacity blocks the whole run. If accounts, tasks, people or settings changed after review, preview again. Rules run only when you explicitly review and apply them.

To hand over a book, select the outgoing and new CSM and write a handover note. Preview and apply. All their accounts and open tasks they own on those accounts move together. Completed tasks and tasks separately owned by another person stay. Each account shows the note, previous and new CSM, the person who made the change and its date under **Account handovers**. The account's **Account owner** form also allows manual assignment, enforces a configured capacity and records your note (or an honest generic note if blank).

You can lower a target below the current book. The CSM then shows **over target by N**. Use **Preview rebalance** to review moving the excess through the current rules. With no eligible capacity, it explains the shortfall and changes nothing. Raising someone else's target or changing the eligible team can make room; then preview again.

PLAN-001 and JOURNEY-001 will move their open plans and journeys with these handovers before those kinds ship. ROLE-001 will add scoped manager and CSM roles; until then the owner or administrator manages allocation.
