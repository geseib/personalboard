# Personal Board experience and model testing implementation plan

**Goal:** Ship reviewable local code for model selection/comparison and an excellent editing experience while preserving the existing scenic theme.
**Spec:** docs/2026-09-30-product-ai-review.md and the user's October 1 approval.
**Architecture:** Existing React/Parcel app and SAM Lambdas. One model registry/router normalizes Bedrock/Gemini calls; admin owns environment-scoped settings. Editing components operate on drafts independently of model choice.

## Constraints
- Preserve all pre-existing local changes, scenic backgrounds and general colors/style.
- No commits or deployment without user instruction; repository requires manual deployments.
- Keep model comparisons separate from active settings and disable fallback in comparisons.
- Existing backups remain importable but must not restore/export credentials.

## Tasks
- [x] Backend: model registry, Converse/Gemini adapters, validated configuration, task routing, comparison metadata, IAM and endpoint integration. Test unknown models, provider failures, unsupported parameters, settings fallback and no fallback during comparisons.
- [x] Admin: model selector, task overrides, comparison panel, revisions/rollback, authenticated settings endpoints. Test authorization, invalid configuration, concurrency and isolated test selection.
- [x] Editing: editable suggestions, refinement, per-field apply/append, original comparison, undo/history, accessible responsive dialogs, safe AI rendering and backup credentials removal. Test draft merge, editing preservation, empty values and malicious markup.
- [x] Client: shared explicit environment routing, canonical board context, bounded authentication recovery, cancellation and useful errors. Test populated board, corrupt storage, unknown hosts, rejected credentials and request timeout.
- [x] Integration: run full focused suite/build, SAM validation, browser exercise main flows and admin, independent review then fix important findings.

## Ownership
model_backend: lambda-functions/ai-guidance and template.yaml.
admin_ui: admin UI and lambda-functions/admin-data.
editing_ux: app.js/style.css and new editing modules.
root: client/config/test setup, documentation, integration and review.

## Review focus
- A delayed suggestion cannot overwrite later user edits silently.
- Missing credentials or unknown hosts never route to production automatically.
- Test model choices cannot affect live users or silently invoke a fallback.
- Small-screen dialogs keep actions reachable and keyboard focus contained.
- Provider errors never leak secrets or user prompt text in logs.

## Verification outcome
See `docs/2026-10-01-experience-verification.md` for exact local checks and remaining deployment validation. Live model quality and AWS access are not established by these checks.
