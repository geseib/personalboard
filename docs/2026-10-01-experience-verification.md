# Experience update verification — October 1, 2026

Implemented locally while preserving the scenic backgrounds, board navigation and existing color palette. No deployment or commit was performed. Pre-existing workspace changes were preserved.

## Verified

- `npm test`: 19 Jest tests and 20 Node backend tests, all passing.
- `npm run build`: production app, admin and supporting assets built successfully. A clean Parcel rebuild resolved a stale cached stylesheet discovered during visual review; the final built CSS includes the writing workspace.
- `sam validate --lint --template-file template.yaml`: valid SAM template.
- Browser on built assets: recovered an unfinished draft; generated two field suggestions with a single access dialog; refined and directly edited a suggestion; applied only the selected field; changed another field manually; undid the AI apply while preserving the new manual note; saved and verified the board contents.
- Browser: empty-field drafting from explicit instructions produced an editable suggestion with placeholders.
- Browser admin: compared two models without activating settings; selected and activated a different default; restored revision zero into a new revision. Local state only.
- Responsive review at 390×844: original and suggestion stack, dialog stays within viewport and apply actions remain visible. Form inputs and action wrapping adjusted for narrow screens.
- Application error log was empty after the final writing flow.
- Independent review findings corrected: shared authentication, bounded provider/fallback deadline, empty-field drafting, draft identity/reset handling, field-aware undo.

## Try it locally

After `npm run build`, run `node scripts/preview-review.cjs` and open http://127.0.0.1:8898/. Admin: http://127.0.0.1:8898/admin/ with password `preview`. AI access code: `123456`. These are local fixture credentials, not deployed credentials.

The preview is prominently labeled and uses sample responses only. It invokes no cloud providers. Model settings and history are in memory and reset when the preview server restarts. Comparison latency, response quality and costs are not representative of actual models.

## Deployment validation still required

The repository requires manual deployment. Current AWS SSO credentials were unavailable for live inference. Deploy the updated backend and frontend together into the chosen test environment, verify Bedrock access for each model using admin comparison, and configure the optional Gemini SSM parameter before testing Gemini. Compare real answer quality before activating a model for participants. Supported providers share a response contract; additional model families require a registry entry and compatible adapter, not an arbitrary client-entered model name.

See [AI operations](2026-10-01-ai-model-operations.md) for model IDs, rate snapshots, environment routing, IAM and secret setup.
