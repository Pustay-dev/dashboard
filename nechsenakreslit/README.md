# nechsenakreslit admin

Independent static admin at https://jakub.pustay.cz/nechsenakreslit/. Existing personal dashboard files are untouched. Browser code contains only the public Supabase key. Customer information is fetched after verified Supabase login and a server-side email allowlist lookup. No customer records, private URLs or credentials are committed here.

## Enable your administrator

An existing, verified Supabase Auth email/password user is required. Insert only the intended administrator's lowercased email into `public.nsl_admin_members` using the Supabase SQL editor or an authorized backend tool. Only explicitly approved emails belong in the allowlist. Never grant access to anonymous customer accounts. Sign in at the dashboard with that account. Authentication is held in this tab's session storage; sign-out clears the session, data and image caches. Revoking the allowlist entry takes effect at the next request.

## Connect cart observations (one live-theme edit)

Shopify's connector cannot write to the live MAIN theme. The observer is ready at the dashboard's public URL. In the live theme's `layout/theme.liquid`, immediately before `</body>`, add:

```html
<script src="https://jakub.pustay.cz/nechsenakreslit/cart-observer.js" defer></script>
```

The observer reads the existing customer's session and a same-origin cart response. It records only portrait image IDs, product titles, variant IDs, quantities and observed prices for that customer's own gallery. It never sends cart tokens, email or shipping details, replaces fetch, mutates the cart, or blocks checkout. New cart mutations and browser returns trigger a refresh; a visible-page check runs every 10 seconds. Expired visitor credentials are refreshed using the existing customer login; the observer never creates a new identity. Historical carts cannot be recovered. Cart counts mean last observed items, not authoritative Shopify live cart state. Cart observations never count as revenue.

## Metrics and daily accounts

Generation totals come directly from `public.images`, including historical tests. The displayed daily date is Europe/Prague. Per-session spending uses paid, non-test, linked portrait lines from stored Shopify paid webhooks, less their line discount allocations; it excludes shipping and does not represent all-store revenue. Missing line amounts are not invented.

Profit cards use manually confirmed daily net receipts after refunds and actual advertising, AI generation, printing and other variable costs. Include delivery and payment fees in other costs, and unsuccessful paid generations in AI costs. Confirm zero-spend days explicitly. Missing days from the first generation through today keep total profit and cost per print unavailable. These figures are contribution, not accounting net profit. Current cost per print divides all recorded period costs by paid non-test portrait units. No ad account or AI billing account is connected.

## Support and queue

Support messages are a manual log; no mailbox is connected. Open messages appear under the header and can be resolved. The error list shows failed/review jobs. Safe retry only selects failed jobs with zero provider submissions, `not_submitted` provider state, remaining attempts and no safety/credit/limit error. A click requires confirmation. Running, accepted, unknown and completed jobs are never reset. This intentionally avoids resetting the entire queue.

## Deployment and validation

`supabase/dashboard.sql` documents the additive schema and service-only RPCs. `supabase/index.ts` is deployed as `admin-dashboard` with JWT gateway verification on, plus explicit user verification and per-request admin authorization. Both public and authenticated customer roles have no admin table or RPC privileges. Existing customer RLS rules remain unchanged. Admin accounts are enabled individually through the server-side email allowlist.

UI summary refresh: every 15 seconds while visible. Authenticated data stays in memory; signed preview links are reused for up to 14 minutes with four concurrent lazy loads. Gallery pages contain 30 items; only the three latest preview files are used on each card. Original storage files are signed only when a popup opens. The UI uses existing preview derivatives rather than loading originals on cards. Summary counts are aggregated in SQL; at larger volume add server-side cursor pagination for session summaries.

Run `node --test nechsenakreslit/model.test.js` and `node --experimental-strip-types nechsenakreslit/tests/edge.test.mjs`. Manual/browser checks should cover login denial, gallery/original popups, editable labels, filters/sorts, finance missing days, support resolution, cart observation, safe retry predicates, mobile horizontal scrolling and signout. Before real customer use, complete an authenticated smoke check with the approved administrator.

Validation completed: 58 existing personal dashboard tests, 4 admin model tests, 8 backend authorization/validation checks, and a DOM harness covering rendering, gallery/original/cart panels, labels, search, settings and signout passed. A real Chromium run could not start because the browser download failed in this runtime. Visual inspection and an authenticated production smoke check remain pending.

## Session deletion and handled errors

The card’s trash icon opens one delete/cancel popup. Clicking `Delete session & data` immediately closes the popup and hides the session; there is no typing confirmation. The operation revokes session access, removes files through Storage API (never by deleting storage metadata), removes unshared anonymous logins through Auth API, then removes this session’s images, jobs, uploads, cart, contact details and orphaned customer row. After authorization and revocation the endpoint returns HTTP 202 and EdgeRuntime.waitUntil owns cleanup. A durable deletion row and a three-minute lease prevent overlapping workers. Admin refreshes resume interrupted jobs, with up to three automatic attempts; failures display a Retry deletion alert. A rejected request restores the card. Another session belonging to the same person is outside this action’s scope. Sessions with orders, active/unresolved provider jobs, or recent uploads are blocked.

Anonymous aggregate image/day and paid submission totals remain, with no user or gallery identifier. Both existing paid-generation admission checks include the retained submission count, so deletion cannot reset the spend guard. The new schema/functions are in `admin-actions.sql`; updated budget guards are in `retain-deleted-usage.sql`.

Handled errors are recorded separately from generation job status. Marking an error handled clears the alert and card counter without pretending the job succeeded. A later update to the same job can surface a new error. The initial six handled errors were acknowledged at the user’s request. A future bulk action is available in the errors panel.

Additional validation: expired customer credential refresh and cart synchronization tests passed. Deletion preview, revocation and relational cleanup were checked with a synthetic session inside a fully rolled-back database transaction. No real customer was deleted.

Cart rows show a 62 × 82 pixel preview opening the original and the selected dimensions instead of the product name. New snapshots capture the creator’s dimension metadata; existing snapshots use the three current catalogue variant mappings. Pointer clicks have no focus ring; keyboard focus uses a neutral gray outline.

## 23 October runtime fixes

Production logs identified `permission denied for table users` during deletion. The cleanup SQL no longer joins Auth internals; anonymous-account verification uses the Auth admin API. The next real-role test found missing DELETE permissions on `private.gallery_contacts` and `private.portrait_generation_submissions`. After explicit user approval, DELETE was granted to the existing server-only service_role on exactly those two tables. `backend-cleanup-permissions.sql` records the approved grant. No cascading foreign keys were introduced, and anonymous/customer roles received no additional permissions. The readiness check is now true. Cleanup was verified using the actual service_role in a fully rolled-back synthetic transaction: session, cart and orphaned customer removal all passed. Earlier postgres-role fixture tests did not establish service-role readiness.

The storefront switched back to theme `nechsenakreslit - 2`, which lacks the observer loader. Install the existing script line in that live theme; Shopify connector writes to MAIN are blocked. The new observer groups the entire Shopify cart by portrait session, including older galleries. A valid signed checkout reference can authorize observation of its exact selected image/variant when the current customer login no longer owns that gallery. References are verified using the existing checkout HMAC, expire after seven days, and are never stored in snapshots. This write-only capability exposes no private images or account data. Unverifiable groups are skipped without losing valid groups.

Regression tests cover grouped carts, old-gallery checkout references, invalid references and false empty-cart clearing. The approved permission change is applied and the existing deployed endpoint now accepts deletion requests. No real customer session was deleted during verification.
