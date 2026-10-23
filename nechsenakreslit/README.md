# nechsenakreslit admin

Independent static admin at https://jakub.pustay.cz/nechsenakreslit/. Existing personal dashboard files are untouched. Browser code contains only the public Supabase key. Customer information is fetched after verified Supabase login and a server-side email allowlist lookup. No customer records, private URLs or credentials are committed here.

## Enable your administrator

An existing, verified Supabase Auth email/password user is required. Insert only the intended administrator's lowercased email into `public.nsl_admin_members` using the Supabase SQL editor or an authorized backend tool. The allowlist starts empty. Never grant access to anonymous customer accounts. Sign in at the dashboard with that account. Authentication is held in this tab's session storage; sign-out clears the session, data and image caches. Revoking the allowlist entry takes effect at the next request.

## Connect cart observations (one live-theme edit)

Shopify's connector cannot write to the live MAIN theme. The observer is ready at the dashboard's public URL. In the live theme's `layout/theme.liquid`, immediately before `</body>`, add:

```html
<script src="https://jakub.pustay.cz/nechsenakreslit/cart-observer.js" defer></script>
```

The observer reads the existing customer's session and a same-origin cart response. It records only portrait image IDs, product titles, variant IDs, quantities and observed prices for that customer's own gallery. It never sends cart tokens, email or shipping details, replaces fetch, mutates the cart, or blocks checkout. New cart mutations and browser returns trigger a refresh; a visible-page check runs every 30 seconds. Expired visitor credentials are skipped until the existing creator refreshes them. Historical carts cannot be recovered. Cart counts mean last observed items, not authoritative Shopify live cart state. Cart observations never count as revenue.

## Metrics and daily accounts

Generation totals come directly from `public.images`, including historical tests. The displayed daily date is Europe/Prague. Per-session spending uses paid, non-test, linked portrait lines from stored Shopify paid webhooks, less their line discount allocations; it excludes shipping and does not represent all-store revenue. Missing line amounts are not invented.

Profit cards use manually confirmed daily net receipts after refunds and actual advertising, AI generation, printing and other variable costs. Include delivery and payment fees in other costs, and unsuccessful paid generations in AI costs. Confirm zero-spend days explicitly. Missing days from the first generation through today keep total profit and cost per print unavailable. These figures are contribution, not accounting net profit. Current cost per print divides all recorded period costs by paid non-test portrait units. No ad account or AI billing account is connected.

## Support and queue

Support messages are a manual log; no mailbox is connected. Open messages appear under the header and can be resolved. The error list shows failed/review jobs. Safe retry only selects failed jobs with zero provider submissions, `not_submitted` provider state, remaining attempts and no safety/credit/limit error. A click requires confirmation. Running, accepted, unknown and completed jobs are never reset. This intentionally avoids resetting the entire queue.

## Deployment and validation

`supabase/dashboard.sql` documents the additive schema and service-only RPCs. `supabase/index.ts` is deployed as `admin-dashboard` with JWT gateway verification on, plus explicit user verification and per-request admin authorization. Both public and authenticated customer roles have no admin table or RPC privileges. Existing customer RLS rules remain unchanged. No administrator has been provisioned in this change.

UI summary refresh: every 15 seconds while visible. Authenticated data stays in memory; signed preview links are reused for up to 14 minutes with four concurrent lazy loads. Gallery pages contain 30 items; only the three latest preview files are used on each card. Original storage files are signed only when a popup opens. The UI uses existing preview derivatives rather than loading originals on cards. Summary counts are aggregated in SQL; at larger volume add server-side cursor pagination for session summaries.

Run `node --test nechsenakreslit/model.test.js` and `node --experimental-strip-types nechsenakreslit/tests/edge.test.mjs`. Manual/browser checks should cover login denial, gallery/original popups, editable labels, filters/sorts, finance missing days, support resolution, cart observation, safe retry predicates, mobile horizontal scrolling and signout. Before real customer use, complete an authenticated smoke check with the approved administrator.

Validation completed: 58 existing personal dashboard tests, 4 admin model tests, 8 backend authorization/validation checks, and a DOM harness covering rendering, gallery/original/cart panels, labels, search, settings and signout passed. A real Chromium run could not start because the browser download failed in this runtime. Visual inspection and an authenticated production smoke check remain pending.
