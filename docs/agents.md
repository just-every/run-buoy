# Agents

Give an assistant a credential to list renewals and prepare proposals. People approve the work and renewal decisions in Buoy. No model provider is required by the app.

## Create a credential

Credential management uses the installation’s HTTP API. There is no credential-management form in the account screen. As a signed-in owner, send a JSON request to `POST /api/buoy/agent-tokens`:

```json
{"label":"Renewal assistant"}
```

Person requests use a current native session cookie. Writes also need an `Origin` header matching the installation origin and `Content-Type: application/json`.

Save the returned `id`, `token` and `expiresAt` privately. Buoy stores only the token hash; the token expires after seven days and stops working if the issuing owner loses authority. Credentials are excluded from backups. Give the token only to the assistant that needs the scope.

## Use the command endpoint

Send agent requests to the installed app’s origin, with `Authorization: Bearer <credential>`. Send JSON with `Content-Type: application/json`. Never put a credential in a URL or a log.

`GET /api/buoy/commands` lists the supported commands. Send the following bodies with `POST /api/buoy/commands`.

### List renewal accounts

```json
{"command":"renewals.list"}
```

The response contains the installation’s accounts, including dates, current health, evidence and revisions, ordered by renewal date. This credential can read the team’s account evidence; scope access accordingly.

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

An owner or admin opens the account, checks the proposal’s retained evidence, then approves in the app. A changed account revision refuses stale approval. Review and prepare again from current evidence when needed.

The agent credential can access only `/api/buoy/commands`. It cannot approve, complete tasks, edit accounts, import records, erase accounts or manage credentials, even when its issuing owner could do those things.

## Revoke access

The owner sends `DELETE /api/buoy/agent-tokens/:id` with a native person session and the matching Origin header. Use the credential ID saved when it was created. Revocation ends its access immediately; obtain a new credential deliberately when needed.

See the repository’s [command reference](https://github.com/just-every/run-buoy/blob/main/COMMANDS.md) for the person-only API operations and approval rules.
