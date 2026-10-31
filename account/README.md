# Account setup sync

The dashboard uses the existing Supabase Auth email/password account used by the portrait admin. The public publishable key is the only API key in source. Passwords are sent directly to Supabase Auth and are never persisted by the dashboard.

`jp_dashboard_accounts` contains one provisioned owner row. The browser may select/update its own row only; no browser may insert accounts, delete them or change ownership. RLS also rejects anonymous Auth users. Existing admin/customer tables and permissions are unchanged. Setup includes the existing JSONBin key, reports decryption key and optional morning workflow URL; it is private account data and never part of public GitHub files or ordinary record backups.

First sign in on an already configured browser. Its nonempty local connection values fill missing account fields. After that the saved account fields win on a new browser, including intentional empty values from disconnecting. Explicit changes are written per field, with revision checks to preserve concurrent edits on another device. Offline setup edits remain pending until restored or reconnected.

Sessions persist in browser storage, refresh before expiration, and coordinate refreshes across tabs with Web Locks where available. Sign out revokes only this session, clears cached connection credentials and hides all dashboard views. Local records and unsent edits remain intact for recovery after signing in again. No sign-up or new email is sent.

Check-ins, workouts, measurements and roadmap still use the existing JSONBin records and conflict safeguards. Signing in restores the connection and loads those records rather than creating separate per-device datasets. Existing offline use without an account continues to work until account sign-in has been enabled on that browser.

Validation: account unit tests cover migration between browsers, empty/explicit disconnect semantics, concurrent edits, refresh, access rejection, offline edits and logout races. App integration covers actual sign-in/setup migration and sign-out gating. Live database role tests verify owner access and deny other/anonymous access, with all test updates rolled back. Real password sign-in must be performed by the user; no account password is requested by the implementation workflow.
