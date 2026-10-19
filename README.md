# jakub.pustay

One static personal hub: Daily Check-In, Roadmap, Workout and Measurements. Hosted by the existing `Pustay-dev/dashboard` GitHub Pages deployment. No build or dependency installation is required.

## Open

https://pustay-dev.github.io/dashboard/

Routes: `#today`, `#check-in`, `#roadmap`, `#workout`, `#measurements`, `#settings`.

The home page and full pages use the same stores. The header always shows total roadmap progress. Dates follow Europe/Prague; workouts follow the date being viewed. Friday gym replaces the Friday home session when selected. Workouts are fixed from the final 19 October 2026 conversation; loads and actual results are editable, with no AI changes.

## Existing records and cloud setup

The app reads existing browser keys `daily_checkin_v1`, `roadmap_state_cache`, `roadmap_pending_v2` and `BODY_DASH_V4`. It retains unknown record fields, measurement and performance history, archived activities and workout history. Original workout and roadmap repositories are unchanged.

The existing three JSONBin IDs remain configured. The old public source embedded a JSONBin master key. The new app does **not** include a key in source, tests, exports or logs. In Settings → Cloud connection, enter your JSONBin key once per browser/origin. Rotate the previously exposed master key in JSONBin. No credentials should be committed to this repository.

Without a key the app works on-device. On a fresh browser, connect before editing to load cloud records. If a local copy and cloud copy differ, the app keeps the local changes and reports a conflict. Export a backup before choosing “Use cloud copy”. Backups contain data, never credentials. Local edits survive offline reloads and can be retried. JSONBin supports full-record writes rather than transactions; simultaneous writes from multiple devices should be avoided. The app checks for changes before writing and serializes its own requests.

A custom domain has a different browser origin. Connect cloud there or export/import a backup. Browser-local records do not automatically move to another domain. Check-in tasks can be scheduled for a specific date. Scheduled tasks lock when their date starts; unfinished tasks lock when carried forward. Completed tasks archive the next day. Quick tasks become regular activities (15-minute default, editable at entry). The performance graph includes live current-day progress and frozen previous days. Previous activity-level history is unavailable because the old app did not store it.

## Custom domain

Target domain: `jakub.pustay.cz`.

1. At the DNS provider for `pustay.cz`, add CNAME `jakub` → `pustay-dev.github.io` (remove conflicting records for this subdomain).
2. In this repository, Settings → Pages → Custom domain, enter `jakub.pustay.cz`. GitHub creates `CNAME`.
3. After GitHub validates DNS and issues a certificate, enable Enforce HTTPS.

No CNAME is precommitted: doing that before DNS is connected would redirect the currently working GitHub Pages URL to an unavailable domain.

## Validation

Run `npm test` (Node 22+). Tests exercise all routes with a DOM event harness, check-in migration and controls, roadmap changes, measurements, workout logging, date boundaries, existing-record compatibility, offline recovery, invalid responses and cloud conflicts. These tests do not replace real-browser visual inspection on iPhone/iPad. Source syntax is checked as well. GitHub Actions runs the same checks on pushes and pull requests.

## Phone layout and daily affirmation

Workouts use stacked exercise cards with paired load/result inputs; measurements use a two-column entry form and stacked history records. There are no horizontal logging tables. An affirmation excerpt from Jakub’s own `2025 - Manifest 1.2.pdf` is selected randomly once per Prague date and stored on-device, avoiding a repeat of the previous day. It appears beside Today. Roadmap status counts unfinished tasks with due dates before today; it includes days since the earliest missed due date.
