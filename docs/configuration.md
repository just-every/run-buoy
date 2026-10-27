# Describe and review a configuration

Open **AI assistance**, then **Describe and back-test a configuration**. An owner
or admin can request a scorecard, signal, segment, playbook or account report.
The owner must first enable AI and configure the provider, model, terms and cost
controls. Each description requires consent for that request. Only the description
and an example configuration schema go to that provider. Customer observations
and the historical calculation stay in this installation. Treat descriptions as
information you explicitly choose to send.

Review the exact returned configuration and any historical test before choosing
**Approve and publish configuration**. The draft is inert. Reloading, generating
another draft or running the hourly schedule does not approve it. Publishing uses
the same validators and atomic writes as the native configuration tools. A
changed model policy or historical evidence requires fresh preparation or review.
Repeated approval returns the existing publication. Discard removes an unpublished
draft; account erasure removes drafts whose reviewed population included that
account. Archives preserve approved definitions and historical inputs, and exclude
pending drafts and their approval authority.

Signals currently combine a percentage drop in weekly active people with a
positive minimum number of open urgent tickets. Both predicates must match.
Published signals notify the current account owner through the existing internal
inbox and email preferences, once for each observed day and recipient. They never
run a model or contact a customer. **Pause signal** stops later alerts and records
one audit entry. Pausing does not withdraw an already accepted email.

The historical test ends at the current UTC date, excluding that date, and starts
one calendar year earlier. A signal compares successive seven-day windows, using
distinct people with currently reviewed source mappings and account memberships.
It uses the latest dated support observation before each window ends, applying
the configured support staleness threshold. Zero prior activity, missing support
or stale support is unknown rather than a match. Imported or backdated
observations describe their supplied observation date; they do not prove what an
operator knew at that time. Source completeness and historical identity changes
remain unknown.

Scorecards replay retained native calculation inputs, selecting the latest
calculation in each account week. Weeks end at the test end minus a whole
number of seven-day periods; each starts at UTC midnight, inclusive, and ends
at the next boundary, exclusive. A durable sequence resolves equal timestamps
and survives restoration. Weeks without retained calculations are counted as
missing, never reconstructed from current values. Fire counts mean matching
account weeks, not delivered alerts. Churn capture counts distinct accounts with
an approved churn outcome after a match within the test period; it shows the
numerator, denominator and rate, or an unavailable rate when no churn is recorded.
Neither a match nor churn capture establishes a prediction or causation.

Segments, playbooks and reports show their exact native definition for review.
A playbook belongs to the person preparing it; its enabled state and trigger are
part of the reviewed configuration. A paused playbook creates no operational
work. Other native permission, sharing, dependency and source validation still
applies at publication. Historical incumbent score inputs remain the work of
MIGRATE-007; this feature does not invent an incumbent importer.
