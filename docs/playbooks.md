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

## Complete the task

Do the follow-up work outside Buoy. Under the open task, enter **Completion evidence**, such as a reference to meeting notes, and select **Record completion**. An owner or admin records completion; members can read it.

Approval and completion are separate records. Approval does not imply a customer was contacted, and marking a task complete does not record a renewal outcome. Use [Renewal decisions](/docs/renewals) to record that outcome.

## When a proposal becomes stale

A proposal belongs to the account revision at preparation. A source refresh, another approval or task completion changes that revision. Buoy refuses approval of a stale proposal and asks you to prepare from the current evidence. Playbook approval also requires the account still to have an at-risk signal.

Review the current account and prepare a new proposal. Earlier approved work and its audit record remain visible.
