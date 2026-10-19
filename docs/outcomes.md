# Playbook outcomes

Open **Outcomes** after approving playbook tasks. An owner or administrator defines the outcome and observation window, then attaches one approved task per account from one segment. The outcome must be unsatisfied when tracking starts. The other unsatisfied members of that segment become its comparison group. Both lists are frozen; segment edits do not change them.

Choose **Current evidence becomes healthy** or **New approved renewed decision**. A completed task alone satisfies neither. Health uses the actual evidence-backed band. A renewal needs a newly approved renewed decision, not an unapproved proposal or a historic renewal.

The window is 1–365 whole UTC days from tracking start, including its deadline. The first observation that sees satisfied evidence records its timestamp and account revision or decision citation. The report shows observed time, rather than claiming the exact moment a source changed. Repeated runs preserve that first result, including after regression. Requests, source changes and the hourly run observe results. After the deadline, unresolved accounts show **Missed**; later recovery does not count.

The rate is reached accounts divided by retained accounts in that cohort. Each row shows elapsed UTC hours, with the mean calculated only from reached accounts. **No observed outcomes** means no time has been observed. Hours and percentages display rounded to at most two decimals (nearest, ties away from zero); CSV retains calculation precision. The enrolled and comparison lists, evidence and times also export as CSV.

This is an observational comparison, never a causal estimate: the groups can differ in ways the report does not measure. Erasure removes the account and its evidence from the report and its denominator. Reports follow today's account read policy; members cannot start them, and agent credentials cannot access this door.

Milestone outcomes and automated playbook kinds arrive with ONBOARD-001, PLAN-001 and PLAY-001. They inherit the same definitions, windows, frozen cohorts and reporting before shipping.
