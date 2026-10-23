# Renewal decisions

Record the outcome, the reason and the evidence behind a renewal decision. Preparation saves a draft; a person’s approval records the decision.

## Prepare a decision

Open the account and review its **Recorded evidence** and current renewal terms. In **Prepare a renewal decision**, choose an **Outcome**:

- **Renewed** — the customer accepted the renewal.
- **Churned** — the customer will not renew.
- **Deferred** — the decision is deferred.

Enter **Decision reason** and **Decision evidence reference**, then select **Prepare decision**. Use a reference your team can check, such as the signed order or the customer’s confirmed response. Buoy retains the reference; it does not copy the external document.

Owners, admins and members can prepare a decision. A scoped [agent](/docs/agents) can prepare one too. Preparation alone changes no renewal outcome.

## Approve the decision

An owner or admin reviews the proposal in **Proposals awaiting review and approval history**. Check the outcome, reason, evidence reference and retained snapshot in **Proposal audit**, then select **Approve renewal decision**.

The approved record appears under **Renewal decisions**, with the outcome, reason, evidence, renewal date, person who recorded it and date of recording. Repeating approval of the same proposal preserves the original approval and does not duplicate the decision.

## Keep the original terms

A decision stays attached to the renewal date and source snapshot it approved. Refreshing an account’s terms later does not rewrite earlier decisions. Recording an outcome does not automatically advance the account’s renewal date; use **Refresh account sources** when you have confirmed new terms.

Pending proposals are bound to the account revision. A source refresh, another approval or task completion changes it. If Buoy marks a proposal stale, review the current account and prepare a new proposal before approval.

For follow-up actions before a decision is ready, use a [playbook](/docs/playbooks).

## Confirmed-term renewal pipeline

Open **Renewal pipeline** from Accounts. An owner/admin first records a confirmed
recurring contract on the account. **Configure renewal generation** sets 0–730
whole UTC lead days and the stage names. The hourly job and successful native
source writes use the same once-per-contract-period generation rule. Changing a
source within a period refreshes that opportunity; changing the period creates
another and keeps the earlier history.

The board and list show quarter, stage, owner, forecast, risk reasons, expected ARR
in the contract’s native minor units and the notice deadline from matching
confirmed account terms. Missing notice terms remain unknown. Stages in use cannot
be removed until their opportunities are moved.

**Define or preview a renewal field** accepts the same typed definition JSON as
account fields. **Edit renewal custom fields** records values and a source. Formula
previews evaluate all current opportunities and display ten real renewals and ten
associated accounts without saving. Formula explanations and actor/time/source
old–new history stay beside the selected opportunity. Typed segment paths begin
`records.renewal.`; all conditions for that related kind bind to one opportunity.

From a selected opportunity prepare renewed, renewed-with-expansion,
renewed-with-contraction, churned or deferred. Supply expected outcome ARR in native
minor units, a reason code and evidence. A separate owner/admin approval checks
the current account and opportunity revisions. Churn requires zero ARR; expansion
must exceed the prior expected ARR and contraction must be lower. Replays do not
create another outcome. Approved outcomes retain their source snapshot.

Confirmed native terms and reviewed Stripe subscription bindings both generate opportunities.
Stripe opportunities retain their exact subscription period and source observation.
A successful connected source inside its freshness threshold can refresh an open
opportunity; failed, stale or disconnected sources cannot generate or reconcile.
A subscription absent from a later response is unknown, not a verified cancellation.

Approval never updates billing. For a Stripe opportunity, the next successful
provider sync separately compares subscription ARR with the approved expectation.
The record shows matched or mismatched, provider actual ARR, the signed difference,
time and source reference. Its history keeps earlier differences, and its original
approved source is unchanged. Native confirmed terms without a provider link keep
a pending reconciliation label. Archives retain these facts and source history,
while fresh provider credentials are required to read the source after restore.
