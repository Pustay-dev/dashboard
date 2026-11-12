# Style workspace — 11 November 2026

The existing approved-admin endpoint now serves Users, Styles, Analytics and Error handling. The public storefront flow and existing customer portraits are unchanged.

The style gallery groups recipient variants by their existing family. Category labels, category artwork and availability are editable. A variant editor manages its name, theme, placements, preview URL and adaptation prompt. Shared family prompts and private JPEG artwork references have separate controls. Saves use the production revision plus updated_at to reject stale edits. Audit entries record actor, operation and target.

Removing a variant disables it; removing a placement hides that placement. Example removal uses admin_hidden and keeps paid assets. The public example feed respects that flag. Existing paid orders and selected artwork are retained.

New variants and replacement artwork use the existing style_factory_enqueue_chat worker. An isolated disabled generation family creates one preview plus six fictional examples. The admin request stores the target family/style/category. On the next Styles refresh after the worker reaches ready, a variant is attached to its original family and kept disabled, or ready replacement artwork is copied to the requested style. No automatic retry of ambiguous paid submissions is added. A request can cost up to seven image calls plus planning. No paid generation was run during implementation; Synthetic rollback tests cover both completed variant import and replacement preview/example import; paid worker execution is not yet validated end to end.

Analytics reports 30 days of generation requests, completion/errors, request-to-completion duration including queue wait, and retained new sessions as a lead proxy. Ad cost per session is unavailable until all 30 calendar days have recorded daily accounts. This is not attributed CAC.

Validation: production service_role reads, rollback tests for prompt saves/stale writes and queue submission, visitor permission checks, Node edge regression checks and DOM interaction tests. A real browser/mobile visual check remains outstanding. Run `npm ci && npm test` in this directory. No new provider keys or n8n workflow are needed.

## 12 November 2026 — Dark control room

Rebuilt the admin interface with a dark shell, lime/cyan accents, desktop sidebar, mobile bottom navigation, CSS motion and reduced-motion support. Uses system fonts with no font download or animation package. Navigation, catalogue search and category filters update locally. Search preserves the open editor and unsaved fields. Details/references are cached in memory per login and invalidated after changes. In-flight responses cannot restore an editor after sign-out.

Styles shows individual variants. Families shows grouped variant artwork with enabled counts and direct access to the shared prompt/reference editor. Fixed a production PL/pgSQL alias collision that previously returned no family rows. Family prompts remain shared; variant prompts remain category adaptations.

Suggested styles are ordered family IDs saved per variant in `portrait_styles.suggested_style_ids`; an empty list preserves automatic recommendations. Saves require both revision and updated_at, reject unknown/self/duplicate targets and retain the existing server-only access boundary. The existing style version trigger preserves the generation revision when only recommendations change; updated_at guards those edits. No default suggestions were changed during testing.

The optional `storefront-suggestions.js` bridge uses the existing public catalogue service and creator's original compatibility checks. It promotes configured families only from already eligible results. It neither creates jobs nor changes photos, cart state or payment. In the published Shopify theme, add before `</body>`:

```html
<script src="https://jakub.pustay.cz/nechsenakreslit/storefront-suggestions.js" defer></script>
```

Shopify's connector cannot edit MAIN. Until this line is installed, the admin saves suggestions but the published storefront retains its automatic choices. The editor includes the same one-time instructions.

Validation: 13 admin/model/edge/DOM suites and 98 existing personal-dashboard checks passed. Production service_role recommendation saves and stale-write checks passed in a rolled-back transaction; anon/customer execution remains denied. Real production catalogue data returned 118 styles and 53 families. Browser rendering could not run: local Chromium was denied a Unix socket, and Cloud Browser could not access localhost. Physical device layout and the installed bridge remain unverified. No paid generation or customer-data deletion was run.

## 12 November 2026 — Exact suggestions and family membership

Suggestions now store exact style variant IDs, with category and ID labels in the picker. The storefront bridge can select two distinct variants from the same family, instead of substituting a family representative. It still excludes disabled/unavailable styles, incompatible species, excessive subject counts and couple-only variants for single subjects. Existing empty lists keep automatic recommendations. No saved family suggestions existed at migration time.

Families can be created and edited, including empty families. Edit family & members adds existing styles, moves them from another family or detaches mismatched styles. The individual editor also offers Change family. Membership writes validate each style's prior family and timestamp, lock the target family and affected styles, record the operation and increment the style's production revision. Active portrait jobs block reassignment. Moving changes the shared prompt/reference for future portraits; detaching uses the standalone variant prompt. No existing portrait, upload or order is deleted.

Repaired 12 obsolete Shopify asset URLs affecting 14 styles and 10 placement records, using verified matching assets from the currently published theme. Restored approved existing royal/lumberjack preview files where their primary URLs were null. The admin also tries placement artwork and up to three existing example thumbnails before displaying Preview unavailable. Ungenerated concepts display No artwork yet; no paid images are requested. Six transient Storage timeouts succeeded on retry.

Validation: 14 admin/model/edge/DOM suites pass. Actual service_role rollback tests cover exact suggestion persistence, invalid target rejection, family creation, adding/removing existing members, revision updates and empty-family discovery. Anonymous and customer roles still cannot execute admin functions. No real family memberships or saved suggestions were changed by verification. Physical-device visual checks remain unverified. The existing one-time storefront script installation is still required if it has not already been added; its URL is unchanged.
