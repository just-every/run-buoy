# Playbooks

A playbook records a proposed follow-up action for an at-risk account. A person reviews and approves it before it becomes a task.

## Prepare the action

1. Open an account with **At risk** health and review the named invoice or support evidence.
2. In **Prepare a playbook**, enter the **Task title** and **Task due date**.
3. Select **Prepare playbook**.

Preparation saves a proposal with the account revision, retained source snapshot, preparer and preparation time. It does not create a task or send a message. Owners, admins and members can prepare proposals; a scoped agent can also prepare one through the [agent commands](/docs/agents).

Buoy requires a defined at-risk signal to prepare a playbook. If the account has **Healthy** or **Unknown** health, first review whether the current recorded evidence supports the action.

## Review and approve

An owner or admin opens **Proposals awaiting review and approval history**. Review the action, due date and **Proposal audit**, including its evidence snapshot. Select **Approve and create task** when the proposal is ready.

Approval records who approved and when, then creates one task under **Approved tasks**. Repeating approval for the same approved proposal does not create another task. Separate preparations are separate drafts; review which one you intend to approve.

## Owners, reminders and cover

Each task has an owner, a due date, a priority (low, medium, high or urgent) and a type (risk, onboarding, adoption, renewal, expansion or general). When preparing, you can choose the **Task owner**; otherwise the account owner at approval owns it, and with no account owner, the person who approved it.

An owner or admin sets each account's owner under **Account owner**. Choosing a new owner moves the account's open tasks that the previous owner held; tasks someone else owns stay with them.

Under **Task reminders and cover** on the Renewals page, an owner or admin sets:

- **Remind this many days before** (1 to 30, default 1). The person handling a task gets one reminder within that many days before the due date and one on the due date.
- **Escalate this many days overdue** (1 to 30, default 1). Once a task is still open that many days after its due date, it escalates once to its owner's manager, or to the owner of this installation when no manager is named.
- **Time zone for task dates**, an IANA name such as `America/Chicago`. Due dates, away periods and reminder days are calendar dates there. Leave it blank for UTC.
- **Their manager** for each person, and an **away period** with a **named cover**. On every day from **Away from** through **Away through**, the cover handles the away person's open tasks and receives their reminders. The tasks are back with their owner the day after. Away periods for one person cannot overlap.

Reminders and escalations appear under **Your reminders** for the person they went to, and are sent by email through your [mail provider](/docs/providers). Each one says what the provider reported: accepted, refused or not confirmed, or not sent when no provider is set up. Buoy never reports that an email was delivered or read.

Buoy checks for reminders every hour. Each day's reminders and escalations are recorded and emailed by the first check at or after 8:00 am in the installation's time zone. To see who handles each task on a date, read `GET /api/buoy/tasks?on=YYYY-MM-DD`; without a date it uses today there. Saving reminder timing through the API (`PUT /api/buoy/settings/tasks`) sets all three values, and an absent time zone means UTC.

## Complete the task

Do the follow-up work outside Buoy. Under the open task, enter the **Outcome reason** and **Completion evidence**, such as a reference to meeting notes, and select **Record completion**. An owner or admin records completion; members can read it.

Approval and completion are separate records. Approval does not imply a customer was contacted, and marking a task complete does not record a renewal outcome. Use [Renewal decisions](/docs/renewals) to record that outcome.

## When a proposal becomes stale

A proposal belongs to the account revision at preparation. A source refresh, another approval or task completion changes that revision. Buoy refuses approval of a stale proposal and asks you to prepare from the current evidence. Playbook approval also requires the account still to have an at-risk signal.

Review the current account and prepare a new proposal. Earlier approved work and its audit record remain visible.

## Versioned multi-step work (partial automation)

An owner or administrator opens **Multi-step playbooks** on an account. **Publish a playbook** provides a JSON example. Publish it disabled for review, then publish a new enabled version. Every publish has an opaque audit subject, actor and UTC timestamp. Members and agent tokens cannot manage or read these run logs. This conservative authority default is pending ct approval; it does not extend agent grants or claim ROLE-001's future field/record scopes.

Each definition names an active staff owner, an enrollment trigger, optional entry and exit rules, a re-enrollment interval (1–365 elapsed UTC days) and a failure threshold (1–500 unresolved failed runs). Definitions have at most 32 steps; an installation has at most 50 definitions. Supported triggers are manual, server-only webhook intake, a matching native rule, segment entry, lifecycle stage entry and an exact UTC calendar-day offset before/after renewal or a confirmed recurring contract start. A rule starts an interval on its first matching observation and on each nonmatching-to-matching observation thereafter. Continuous matching does not enroll again. An active run or the re-enrollment interval refuses another enrollment; a refused interval is consumed and is not silently retried later. Rule authoring uses the same current typed account/custom/calculated, related-person/renewal, health, revenue, survey and adoption fields as segments; `GET /api/buoy/playbooks` returns its field catalog. Conditions are evaluated from current evidence, including missing-value behavior, through the same segment evaluator.

The owner/admin enrollment endpoint is `POST /api/buoy/playbooks/:id/enroll` with `accountId` and a unique `operationKey`. Repeating that key for the same playbook/account returns its original run. External webhooks require a separately delegated server-only intake credential; a staff cookie or agent token is not such a grant. A new publish does not rewrite an existing enrollment's definition version, steps, owner or failure threshold. Setting the current definition's `enabled` to false freezes existing runs and refuses even a previously prepared task's approval until enabled again.

Supported steps:

- `task`: creates a proposal, not a task. An owner/admin reviews and approves the current account evidence through the existing proposal form. `dueDays` is 0–365 UTC calendar days from preparation. Repeated approval creates one task. After evidence changes, **Review current inputs** prepares a replacement; the earlier proposal remains in history and cannot be approved.
- `wait`: waits `seconds` of elapsed UTC time (0–31,536,000) and, optionally, a `rules` condition. `timeoutSeconds` makes an unmet condition fail. The first persisted deadline survives later observations. Successful native API mutations and hourly cron advance ready work; source intake and Business-import doors are observed by cron; exact wall-clock wakeup is not promised.
- `branch`: evaluates `rules`, retaining the compared inputs and selected branch. `next` and `otherwise` are zero-based indices strictly after this step. An index equal to the step count finishes the run. Cycles and unsupported fields/operators are refused.
- `fields`: proposes 1–20 explicitly named writable account custom field values. The owner/admin sees old/new values and approves with evidence against the current account revision. Unrelated manual values are retained; typed validation, field history, dependent rollups and the step receipt commit atomically. Derived fields cannot be assigned. Health and segments recalculate before the next step. This is a human-approved change, not autonomous field mutation.
- `approval`: pauses for an owner/admin's evidence reference. Account changes invalidate approval until the person explicitly reviews current inputs.
- `external`: pauses for an owner/admin to perform work outside Buoy, then record `succeeded` or `failed` and an evidence reference. `channel` is `email`, `slack` or `webhook`. Buoy makes no external request and does not verify the receipt, claim delivery or automatically retry the external operation. Never paste credentials, webhook URLs or customer message contents into configuration or evidence references.

Entry criteria apply at enrollment. Exit criteria are checked before every advance, including failed/waiting steps and before approval; meeting them exits without executing remaining work. Previously approved tasks and earlier receipts remain history. Manual approval and every task still require the current account revision, and task proposals retain hierarchy and aggregate-health input fences. Disabling a playbook freezes exit checks as well as work.

The run log lists version, cursor, wait deadline, attempts, compared rule inputs, task proposal IDs, results, errors and UTC timestamps. Its account timeline links every recorded step back to this section. **Retry failed step** requires a current run revision and active owner. It increases only that step's attempt; completed tasks, earlier approvals and successful receipts are not replayed. For external work it returns to **Record external-work result**; it never repeats the real external request itself. An inactive run owner can be replaced explicitly during retry.

A version's threshold counts currently unresolved failed enrollments. Crossing it creates one in-app signal per active owner/admin and queues one single-recipient internal email through their existing notification preferences/provider. Further failures in that episode add no duplicate. When the count falls below the threshold the episode closes; a later crossing creates another. Provider acceptance/refusal/unconfirmed labels retain their existing meaning. Slack threshold delivery is unavailable.

**Start run outcome tracking** attaches this enrollment to the existing PLAY-004 outcome report with a current segment ID, a healthy/new-renewed outcome and 1–365 UTC-day window. The enrolled account must have an unsatisfied baseline. Other eligible segment members form a frozen observational comparison cohort. Reports, first evidence/timing, deadline, CSV and erasure use the existing outcome engine. Multiple runs can be attached through `POST /api/buoy/outcomes` using `runIds` instead of `taskIds`; choose one enrollment per account. Account erasure removes its runs, detailed inputs/results and cohort rows. Definition publish audits survive with opaque subjects. Archives include definitions, versions, run history, attempts and outcome links; restoration gives no new authority to a former owner.

PLAY-001 remains partial: automatic email/Slack/Teams/webhook/Crank delivery, email drafts, child playbooks, onboarding/general event triggers are still required. PLAY-003 remains partial: real webhook failure/retry, Slack delivery, unified connector/journey run logging and complete connector retry/threshold integration remain required. The conservative owner/admin-only, no automatic outbound, explicit evidence/approval default is adopted pending ct approval. These limitations do not remove any contract acceptance point.

### Server-only webhook enrollment

Set `trigger` to `{"kind":"webhook"}` and publish it enabled. The owner issues `POST /api/buoy/playbooks/:id/credentials` with `{"accountIds":["an-explicit-account-id"]}`. This returns a secret once; keep it on your authenticated server, never in browser code. `GET` on that credential collection shows only IDs, allowed accounts, version, creation/revocation and last-use instants. The owner revokes one with `DELETE /api/buoy/playbooks/:id/credentials/:credentialId`.

The server sends `POST /api/buoy/playbooks/intake/:id` with `Authorization: Bearer <the-secret>` and a JSON object containing `accountId` and a stable source `operationKey` (at most 80 characters). Do not send an Origin or browser Fetch Metadata header. There is no payload-to-field mapping and no account read or approval right. Only the listed accounts and the published version for which the credential was issued can enroll. Publishing a new version, disabling the definition, revoking the credential or removing the issuing owner's active owner role stops further intake. The final enrollment transaction rechecks the grant. One credential allows 60 requests per UTC minute, including malformed and replayed requests; exceeding it returns 429 and Retry-After. A successful replay returns the original run; the re-enrollment interval still applies to another source operation key. Runs wait at sensitive-step approval as usual. Credential material and intake rate reservations are excluded from archives; restoring history never restores this delegation. The owner must review and issue a fresh grant after restore.

This adopts the conservative pending-ct default: owner-only version/account delegation, server-only relay, deny-by-default reads/approvals, immediate local revocation and no new automatic outbound capability.
