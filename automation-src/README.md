# Weekly MWM planning

The website keeps ratings in the existing body record as `workoutFeedback[date:type]` and optional weekly notes as `weeklyFeedback[Monday]`. Both follow the existing local save, JSONBin sync, conflict handling and backup behavior. Rating a session never logs it as completed.

The n8n workflow reads this record, selects only workout results, difficulty ratings and weekly notes, and sends that subset to OpenAI. It never sends measurements or the roadmap/check-in record. Existing workout logs keep their prescription snapshot so later AI changes cannot relabel their results.

## Build and import

Run `node automation-src/build-workflow.mjs /private/path/This_Morning_AI_n8n.json`. It generates an importable workflow with a random webhook path; do not commit that generated file. Import it in n8n and select these two credentials:

- **Read synced workout feedback:** Header Auth with `X-Master-Key` and the existing JSONBin key; a read-only access key with `X-Access-Key` also works.
- **Generate weekly MWM with OpenAI:** OpenAI API credential.

Publish/activate. The production webhook URL goes in the iPad shortcut and the website's Settings → Workout plan. Existing iPad Save File actions remain unchanged. The original PDF-only workflow can be deactivated.

At 05:00 Prague time every day, n8n checks whether the current Monday-start week already has a plan. Only missing weeks call AI: normally once on Monday, plus the initial setup day or a retry after failure. Plan your iPad download after 05:00. The first scheduled production run initializes the plan; manual editor runs do not persist n8n static data. Until then, the fixed plan is served.

The workflow validates dates, workout ids, durations, row/text bounds and warm-ups before replacing state. Four weeks are retained in n8n's backed-up database. Invalid, refused or failed generations leave the previous plan intact. If no current-week plan exists, the last valid week is mapped to the new dates; otherwise the exact website baseline is used. PDF and website read the same plan. Friday's optional gym replacement remains a website override.

This is a lightweight single-user implementation. Keep its opaque production URL private. No API keys or webhook URLs are published in source. The workflow includes no external packages or additional PDF service. Tests cover node code behavior with simulated n8n inputs; an authenticated n8n import and paid API call still require live verification.
