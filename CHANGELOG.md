# Changelog

## 2026-10-19

- Tasks have an owner, priority and type. An owner or admin sets each account's owner (reassigning moves the previous owner's open tasks), each person's manager, away periods with a named cover, the reminder and escalation delays and the time zone for task days. An hourly Cron Trigger records a reminder before and on each due date and one escalation of an overdue task to the owner's manager, in the app under Your reminders and by email through the owner's mail provider, with the provider's reported outcome. Completing a task records an outcome reason with its evidence (PLAY-002).
- The app takes the owner-picked look: Renewals is the renewal runway, with accounts as lanes on one time axis, each lane a ribbon in the band of its health today, solid to today and dashed at the same weight ahead, with a marker (its reason on hover, focus and for screen readers) on each day its evidence turns stale or a judgment expires, notice ticks at each account's own term, renewal flags, the gradient today rule, and one account opened in place with its dated evidence, the finding, the approval and its open work. The account page, Imports, Backups, sign-in and setup share the top bar, Inter type, hairline cards and quiet fields; the left rail, Spectral and Red Hat Text are gone.
- The state API returns each account's health outlook (today's band and each later day its evidence turns stale or a judgment expires), from the same rules as the health-on-a-date read.
- The demo is Tidewell Software's eleven-account runway, with Cascade Freight at risk and an approval its agent prepared, on the homepage's own 2026–27 dates (Cascade Freight renews Thu Dec 31, 2026, notice Mon Nov 30).
- Buoy writes US dates in its own text: CSM sentiment counts through "Wed Nov 18, 2026", not an ISO date. Title facts keep their "·" separators off the start and end of a line.

## 2026-10-16

- Moved the hosted demo to RER 0.2.30's native Worker Loader host: each visitor gets their own isolate and SQLite copy instead of a container. Refreshed every vendored Base copy from `rer-v0.2.30`, adopted Base's `run-demo.yml`, removed the container-era observer and `instanceType`, and stopped marking the header name twice now that Base's theme frame marks it.
- Built the picked still-water Buoy homepage, with Run Buoy leading to the local-run instructions.
- Added eight owner documentation pages compiled from repository Markdown and a disabled run-site deployment workflow for run-buoy.com.
- Carried the shared paper, ink, Spectral and Red Hat Text theme through sign-in, setup, the installed Lobby and all product screens. Replaced the previous fonts, green palette and brand art.
- Preserved the complete first-use checklist, source fields, approvals, import custody, native sign-in and archive flows.
- Updated the published rer dependency to 0.2.19 and added one HTTP journey for public site navigation, linked assets, guide fragments and 404 handling.
