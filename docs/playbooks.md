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
