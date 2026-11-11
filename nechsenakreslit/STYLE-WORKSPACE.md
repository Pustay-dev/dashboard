# Style workspace — 11 November 2026

The existing approved-admin endpoint now serves Users, Styles, Analytics and Error handling. The public storefront flow and existing customer portraits are unchanged.

The style gallery groups recipient variants by their existing family. Category labels, category artwork and availability are editable. A variant editor manages its name, theme, placements, preview URL and adaptation prompt. Shared family prompts and private JPEG artwork references have separate controls. Saves use the production revision plus updated_at to reject stale edits. Audit entries record actor, operation and target.

Removing a variant disables it; removing a placement hides that placement. Example removal uses admin_hidden and keeps paid assets. The public example feed respects that flag. Existing paid orders and selected artwork are retained.

New variants and replacement artwork use the existing style_factory_enqueue_chat worker. An isolated disabled generation family creates one preview plus six fictional examples. The admin request stores the target family/style/category. On the next Styles refresh after the worker reaches ready, a variant is attached to its original family and kept disabled, or ready replacement artwork is copied to the requested style. No automatic retry of ambiguous paid submissions is added. A request can cost up to seven image calls plus planning. No paid generation was run during implementation; worker completion/import is not yet validated by a paid end-to-end test.

Analytics reports 30 days of generation requests, completion/errors, request-to-completion duration including queue wait, and retained new sessions as a lead proxy. Ad cost per session is unavailable until all 30 calendar days have recorded daily accounts. This is not attributed CAC.

Validation: production service_role reads, rollback tests for prompt saves/stale writes and queue submission, visitor permission checks, Node edge regression checks and DOM interaction tests. A real browser/mobile visual check remains outstanding. Run `npm ci && npm test` in this directory. No new provider keys or n8n workflow are needed.
