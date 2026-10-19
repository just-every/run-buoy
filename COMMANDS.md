# Buoy agent commands

All requests use the installation origin and JSON. People use a current native session cookie and the exact Origin header for writes. Agent callers use `Authorization: Bearer <credential>` and can only access `/api/buoy/commands`; a preparation carries only the fields below, and any other route, command or field is refused with its reason and recorded for owners and admins at `GET /api/buoy/audit`. Never put credentials in URLs or logs.

An owner creates a credential with `POST /api/buoy/agent-tokens` and `{"label":"Renewal assistant"}`. Save the returned token privately: only its hash is stored. It expires in seven days, stops if its issuing owner loses authority, and can be revoked with `DELETE /api/buoy/agent-tokens/:id`. Credentials are not exported.

`GET /api/buoy/commands` lists the supported commands. A signed-in person can read every product API route with `GET /api/buoy/routes`; none moves money. POST examples:

```json
{"command":"renewals.list"}
```

```json
{"command":"playbook.prepare","input":{"accountId":"harbor","payload":{"title":"Review unresolved incident with the customer","dueDate":"2027-01-15"}}}
```

```json
{"command":"renewal.prepare","input":{"accountId":"harbor","payload":{"outcome":"renewed","reason":"Customer accepted another year","evidence":"Signed order R-17, section 2"}}}
```

Preparation returns a proposal ID and changes no outcome or task. An owner/admin opens the account, reviews the exact evidence and approves. Direct `POST /api/buoy/proposals/:id/approve` also requires a person session and same-origin protection. The agent credential cannot call it, even when its issuing owner could. Approval is idempotent; a changed account revision refuses a stale proposal. Duplicate preparation creates separate drafts; clients should retain the returned proposal ID.

Owner/admin record creation and source refresh use `POST /api/buoy/accounts` and `PUT /api/buoy/accounts/:id`. The documented move-in account object is the input; update also needs the last `revision` from `GET /api/buoy/state`. Work completion uses `POST /api/buoy/tasks/:id/complete` with `{"evidence":"Meeting notes CS-18"}`. All handlers check current server-side authority.
