# Agents

Give an assistant a credential to list renewals and prepare proposals. People approve the work and renewal decisions in Buoy. These reads and preparations require no model provider.

## Connect through MCP

Use the installation's `/mcp` endpoint. It serves the five existing native agent
operations and a read-only preparation-state snapshot. Business credentials
identify a sponsoring native person and an agent; existing local credentials
retain their issuing-owner, command and data-class limits. Neither credential
grants more native authority than the sponsor currently holds.

- `buoy.renewals.list` uses scope `renewals.list`. Class: standard. Clauses: AGENT-003, RENEW-001, SURFACE-001.
- `buoy.playbook.prepare` uses scope `playbook.prepare`. Class: standard. Clauses: PLAY-001, AGENT-001, SURFACE-002.
- `buoy.renewal.prepare` uses scope `renewal.prepare`. Class: standard. Clauses: RENEW-001, AGENT-003, SURFACE-003.
- `buoy.experiment.prepare` uses scope `experiment.prepare`. Class: standard. Clauses: AGENT-002, SURFACE-001, SURFACE-002.
- `buoy.experiment.report` uses scope `experiment.report`. Class: standard. Clauses: AGENT-002, SURFACE-001.
- `buoy.workspace.snapshot` uses scope `workspace.snapshot`. Class: standard. Clauses: AUDIT-001, GOVERN-001, SURFACE-001.

Each call computes `standard`. Renewal listing measures the visible account
count; other operations use `{"measure":1}` for one internal operation.
The reads expose retained evidence; preparations save inert drafts. They create
no approved task, confirmed renewal or measured outcome, and grant no provider
execution. Commercial facts in these records do not make them regulated
identity or bank data. Agent-supplied class or confirmation flags cannot widen
the operation.

The owner opens `/agents` to answer the company policy before using any tool.
When Business manages the installation, it supplies that policy through the
signed Business door. A fresh unanswered policy exposes no tools and refuses
calls with `policy_unset`. One company policy governs both MCP and the existing
command endpoint below; issuing a local credential does not bypass it.

If the policy permits autonomous standard work, these operations run. If it
requires standard review, they run and appear in the review feed. Native
proposal approval remains a separate person action in either case. Local or
Business Pause stops agent calls. Review supplies no native undo for these
tools.

For mutating MCP calls, supply a unique `idempotency_key` and reuse it only for
the same request. Replay returns the saved result. Playbook and renewal
preparations can bind the account's exact opaque string `expected_revision`;
changed evidence refuses a stale call. Experiment preparation additionally
requires its native `operationKey`.

The declared capabilities are tools, policy, pause, audit and idempotency.
Resources, prompts, events and subscriptions are undeclared and return
`capability_not_declared` when called. This is a preparation subset of the
contracted customer-success surface. The repository’s `docs/agent-door.md` guide
describes transport limits, source versions and the remaining contract gaps.

## Create a credential

The owner opens **Audit → Issue an agent credential** to choose commands, data classes, expiry, rate and budget. The same owner-only door is `POST /api/buoy/agent-tokens`:

```json
{"label":"Renewal reader","scopes":["renewals.list"],"dataClasses":["account"],"expiresDays":7,"requestsPerMinute":60,"budgetMinor":0}
```

Person requests use a current native session cookie. Writes also need an `Origin` header matching the installation origin and `Content-Type: application/json`.

Save the returned `id`, `token` and `expiresAt` privately. Buoy stores only the token hash; expiry is the issue instant plus 1–365 whole 24-hour days (7 by default), and the grant stops working if the issuing owner loses authority. Omitting the new policy fields retains all three current commands, all four data classes, a 60-request minute cap and a USD0 budget. Empty or unknown command/data-class lists are refused. Credentials are excluded from backups. Give the token only to the assistant that needs the scope.

## Use the command endpoint

Send agent requests to the installed app’s origin, with `Authorization: Bearer <credential>`. Send JSON with `Content-Type: application/json`. Never put a credential in a URL or a log.

`GET /api/buoy/commands` lists only the grant’s commands. The default names are `renewals.list`, `playbook.prepare` and `renewal.prepare`. Explicit API grants can also select `experiment.prepare` and `experiment.report`; see [matched retention experiments](https://github.com/just-every/run-buoy/blob/main/docs/experiments.md). These new commands require all four current data classes and never grant approval. Existing credentials and default grants retain their original commands. Data classes are `account`, `billing`, `support` and `sentiment`. This compatibility endpoint dispatches through the same registry and company policy as MCP. Send the following bodies with `POST /api/buoy/commands`.

### List renewal accounts

```json
{"command":"renewals.list"}
```

With all four classes, the response retains the full existing account representation, ordered by renewal date. A partial grant returns account ID/revision plus only the selected class fields; derived health, reasons, segments and outlook are omitted so excluded sources cannot leak. Preparation requires all four classes because the reviewed snapshot contains them. This is a data-class grant over the current team portfolio, not a new record-scope role.

The full representation can include stored normalized Stripe test-mode evidence
and its freshness/confidence. Reading it makes no request to Stripe and grants no
connector, customer-binding or webhook authority. API and webhook-signing secrets,
raw provider bodies, customer names/emails from Stripe and card details are not
part of that stored source projection. A restored snapshot is retained evidence;
it does not restore credentials or establish a fresh source read.

### Prepare a playbook

Use an account ID returned by the list command. This example uses `harbor` as an illustrative ID; replace it with your account’s actual ID and choose a real action and date.

```json
{
  "command": "playbook.prepare",
  "input": {
    "accountId": "harbor",
    "payload": {
      "title": "Review unresolved incident with the customer",
      "dueDate": "2027-01-15"
    }
  }
}
```

The account must have a defined at-risk signal. Preparation returns the proposal ID and creates no task.

### Prepare a renewal decision

```json
{
  "command": "renewal.prepare",
  "input": {
    "accountId": "harbor",
    "payload": {
      "outcome": "renewed",
      "reason": "Customer accepted another year",
      "evidence": "Signed order R-17, section 2"
    }
  }
}
```

Replace the illustrative account and evidence with confirmed records. Outcomes are `renewed`, `churned` or `deferred`. Retain each returned proposal ID: repeating preparation creates separate drafts.

## Review with a person

A native owner or admin opens the account, checks the proposal’s retained evidence, then approves in the app. Assigned CS managers can review current team renewal outcomes, and explicitly granted CSMs can review their own book through the scoped renewal review page; scoped custom profiles follow their declared renewal and commercial rules. A changed account revision refuses stale approval. Review and prepare again from current evidence when needed.

The local agent credential can use its granted native operations through
`/api/buoy/commands` or `/mcp`. It cannot approve, complete tasks, edit accounts,
import records, erase accounts or manage credentials, even when its issuing
owner could do those things. It cannot change commercial terms either: a
preparation carries only the fields shown above, so a price, discount, credit or
term change is refused.

Every refused agent request (another route, an unknown command or an extra preparation field) returns its reason and is recorded. An owner or admin reads the record with `GET /api/buoy/audit`: each `agent.refused` entry names the credential, the time, the subject (an account ID, command or route) and the reason.

## Revoke access

The owner sends `DELETE /api/buoy/agent-tokens/:id` with a native person session and the matching Origin header. Use the credential ID saved when it was created. Revocation ends its access immediately; obtain a new credential deliberately when needed.

See the repository’s [command reference](https://github.com/just-every/run-buoy/blob/main/COMMANDS.md) for the person-only API operations and approval rules.

## Rate limits, ledger and pause

Every authenticated local command request consumes one atomic reservation in
its UTC epoch minute, including malformed or forbidden requests. The owner
chooses 1–10,000 requests per minute (60 by default); excess requests return 429
and `Retry-After` seconds to the next minute. Requests do not carry over. MCP
also applies its declared transport limit, native local-credential limits and
the company policy; one limit cannot override another.

The Audit screen shows current grants and the latest 100 durable attempt/outcome/refusal entries. The ledger stores enum commands, token IDs, time, result and actual metered USD cost, without a credential or request payload. The existing audit retains its subject/reason semantics. `GET /api/buoy/agents` returns the same owner-only policy and ledger.

**Pause all agents** stops every current token before dispatch and is rechecked atomically before a preparation can commit. Resume keeps the original scopes and expiry; it revives neither a revoked token nor an old issuing-owner version. The API is `PUT /api/buoy/agents/settings` with `{"disabled":true}` or `{"disabled":false}`. Only a current owner session and exact Origin can manage these settings.

## Metered USD budget

No metered agent charge; internal notification mail may use your provider. Today's native tools and local commands incur USD0 in metered agent operations, including with a zero budget. These tools expose no paid provider action, and the shared door does not enforce provider-spend caps. Automatic NOTIFY-001/PLAY-002 internal team notices retain the owner's provider and recipient preferences; provider fees are not measured or included in this budget. This budget does not authorize a customer send, model call or field/commercial change. Every future paid, send or update scope inherits GOVERN-001 reservation-before-effect USD budget, data-class, rate and kill-switch acceptance before shipping (EMAIL-001/002/003, JOURNEY-001 and AI-001/002/003).

Existing internal mail also enforces the human recipient's current ROLE-001
profile. An assigned recipient gets only an in-scope account name, generic update
and account link, with task/source/free text and exact commercial values omitted.
Outside-scope or invalidated assignments receive no account notice or reminder.
Aggregate digests remain excluded for assigned profiles until ported. This mail
projection does not give an agent a send scope or change its command/data-class
grant. See [providers and data flows](/docs/providers) and [staff profiles](https://github.com/just-every/run-buoy/blob/main/docs/roles.md).


## Data trust review

An owner or administrator opens **Audit**, then **Data trust review**. Preparing
findings checks exact normalized company names, current confirmed and reviewed
Stripe ARR, and stale health evidence. Preparation changes no account or mapping.
The evidence distinguishes a possible duplicate from a confirmed identity.

A stored Segment group observation may carry a `buoyAccountId` trait containing
the proposed native company ID. A review scan compares the newest group claim
with its existing mapping and proposes a correction when they disagree and the
target and any reviewed user membership exist. The source claim remains labelled
unverified. It never links an identity or changes attribution by itself.

To propose a correction without that hint, enter the exact source, group and optional user,
the reviewed customer person for a user claim, the correct account, and the
source owner's reference and explanation. Review the old and proposed account
and observation count before approving. Approval applies only that exact mapping;
changed evidence requires a new proposal. Both accounts recalculate health and
show the correction receipt. Private review explanations stay in the admin review.

Approving a duplicate, ARR or stale-source finding creates an owned fix task with
the due date the reviewer chooses. It preserves both companies and both revenue
values. Complete an actual source correction through its existing reviewed door;
a task approval does not merge records or select a revenue authority. Rejecting
requires a reason and creates no task. Repeating a decision creates no extra work.

These are explicit native reviews. Agent credentials grant no access to them.
There is no scheduled watch or model request, and no customer message is sent.
Merge, source-authority and general autonomous-diagnosis work remains unimplemented.
