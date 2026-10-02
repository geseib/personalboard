# Personal Board review — September 30, 2026

## Recommendation

Keep the existing React/AWS foundation and modernize incrementally. First establish a reproducible production baseline and repair AI context/model configuration. Then build a shorter guided setup and a board home focused on the user's next action. The user confirmed that the updated experience should serve both workshop participants and ongoing personal use; design these as complementary entry points into the same board data.

This is an initial review and proposed direction, not an approved implementation specification. No application source or deployment was changed during this review.

## What was verified

- Inspected the public production Intro, You, and Board screens, plus production JavaScript.
- Production HTML returned HTTP 200 and Last-Modified `2026-03-19 02:50:07 GMT`. This is the object's timestamp, not proof of the deployment date or source commit.
- Production references `perform.864fb6fe.js` and `perform.ddafe05a.js`; the primary bundle is 636,736 bytes before transfer compression. The local dist directory instead contains numerous older `personalboard.*` bundles.
- Current checkout: `feature/multienv`, HEAD `1dd1e1e`; remote branch has the same HEAD. Remote default/main is `830b163`. The checkout contains substantial pre-existing tracked and untracked work.
- A separate `.claude/worktrees/image-optimization` checkout has HEAD `1362a4a`, dated February 26, 2026. It may help reconstruct deployment history, but production provenance is not established.
- Read-only AWS stack/Lambda inspection failed because the `adminaccess` SSO token has expired. Deployed backend code, active DynamoDB prompts, IAM permissions, model availability, and production AI responses remain unverified.
- `npm test -- --runInBand` passed two tests, but one is a duplicate from the nested worktree. The actual test only checks that an array includes a string. Jest also reports package-name collisions with SAM outputs and the nested worktree. This does not validate product or AI behavior.
- Navigation from Intro to You worked. Subsequent Goals/Mentors clicks did not change the observed page during automation, although buttons were enabled and no captured browser error explained it. The supported `?section=board` URL worked. Reproduce manually before classifying this as a product defect.

## Priority findings

| Priority | Finding and evidence | Proposed change |
| --- | --- | --- |
| P1 | AI context mismatch: `app.js:130` loads `boardData`, with skills under `you.superpowers`; `ai-client.js:476` reads separate `superpowers`, `goals`, and relationship storage keys. Confirmed in the live bundle. Individual requests also carry data directly, so this does not mean every AI call has empty context; the enhanced context/insights path is affected. | One versioned board schema and a single context builder shared by all AI entry points. Test a populated board reaching the request intact. |
| P1 | `lambda-functions/ai-guidance/bedrock-chat.js` hard-codes account-specific inference ARNs for Claude 3.5 Sonnet and 3.5 Haiku; `template.yaml:201` restricts IAM to those models. | Configure model IDs by environment, update IAM together, verify account access, and evaluate current models before rollout. |
| P1 | AI Markdown is transformed with regular expressions and inserted as raw HTML (`app.js:54`, `2511`, `5193`). No escaping or sanitization appears in those rendering paths. | Render validated structured data as React elements; use a maintained safe Markdown pipeline when rich text is needed. Test hostile output without contacting production. |
| P1 | Backup export includes the session bearer token (`app.js:740`). | Export user data without credentials; preserve legacy import compatibility without restoring auth from backups. |
| P1 | Unknown hosts, including localhost and the newly scripted boardtest host, default to the production AI API (`ai-client.js:53`). | Explicit environment configuration; fail closed for unknown hosts. Cover admin and feedback routing as part of the environment audit. |
| P1 | Admin authentication has a hard-coded fallback password (`lambda-functions/admin-data/admin-data.js:8`). Production exposure is unverified. | Fail closed when configuration is missing and move toward authenticated admin identities. Verify production configuration without testing default credentials against the service. |
| P2 | The client retries 401 responses recursively with no retry bound (`ai-client.js:443`). | Retry authentication once, then show a recoverable error. Add request cancellation and timeouts. |
| P2 | Backend logging includes request/prompt previews (`lambda-functions/ai-guidance/ai-guidance.js:222`, `454`). | Log request IDs, model, prompt version, latency, token usage and error categories without personal board text. |
| P2 | AI output is parsed by headings/regular expressions; requests have fixed output limits. | Version a response contract containing observations, evidence, questions and proposed actions; validate it server-side and handle malformed output. |
| P2 | Build outputs, multiple environments and duplicate test discovery complicate repeatable releases. | Establish one source baseline, exclude generated outputs from tests, add build/commit metadata and focused regression coverage. Preserve existing local work. |

## Experience direction

The existing educational material, five relationship roles, workshop access codes and export capability are useful assets. Preserve them.

The first screen currently gives prominence to learning, video, podcast, Upload and Start New. The next screen presents skills and mentees, while goals and relationships live behind separate navigation items. The Board screen emphasizes meeting cadence and a recap, even when the board is empty. These observations suggest a shorter path to useful output:

1. **First visit:** “What are you working toward?” → identify one goal → add one person → choose a concrete next step. Offer examples and optional AI help inline. Keep educational content nearby and optional.
2. **Returning visit:** show the current goal, people to reconnect with, saved next actions and progress since the last visit. Make this the home screen once setup has started.
3. **People:** retain mentor/coach/sponsor/connector/peer categories as roles and filters, but let the user manage relationships from a unified view. Support one person serving more than one role if user feedback confirms the need.
4. **AI help:** place “Refine this goal,” “Prepare for a meeting,” “Draft an outreach message” and “Find gaps in my board” beside the relevant information. Offer editable previews before saving changes.
5. **Visual design:** use readable, solid surfaces for working content and reserve dramatic imagery for onboarding or learning. Simplify the nine-item navigation for smaller screens; add clear save status and explain local-only storage.
6. **Workshop mode:** retain a facilitator-friendly sequence and access-code flow without forcing returning users through instructional steps.

## AI and model proposal

Updated October 1: prioritize inexpensive models for routine editing. Evaluate **Amazon Nova Micro** first within Bedrock and **Gemini Flash-Lite** as a separate-provider comparison. Retain stronger Claude models as optional candidates for whole-board analysis. These are candidates, not a claim that they are universally best or verified in this account.

AWS currently lists Sonnet 4.6 as active and documents both models on Bedrock:

- https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-lifecycle-legacy.html

Use an admin-managed, environment-scoped model configuration for primary/task-specific/fallback choices, backed by a server-side supported-model registry. Deployment parameters supply initial defaults and permitted resources, rather than requiring a deployment for every model switch. Confirm supported regional inference profiles and required destination-region IAM resources; do not silently expand to global routing. Keep errors such as authorization failures distinct from transient failures; falling back on every error obscures configuration problems.

### Admin model selection and comparison requirement — October 1

The user requires model switching through admin settings to test inexpensive alternatives. Inspection of this checkout's admin UI and API did not find a model selector or persisted model configuration. The inference helper still uses hard-coded Claude model IDs. This finding does not establish whether a different deployed revision contains such a setting.

Proposed admin workflow:

- Choose an environment and a default provider/model. Optionally override the default for writing assistance or board analysis; every AI feature otherwise inherits the default.
- Show configured, available models with readiness status; unavailable credentials, IAM access or unsupported capabilities should have a clear reason. Never imply that listing a model proves it can be invoked.
- Run a sample against two selected models using identical input, prompt version and output budget. Display editable responses, requested and actual model IDs, latency, input/output usage, and estimated cost from dated pricing metadata. Show unavailable cost as unknown rather than zero.
- Keep test selection separate from the active application setting. Changing a test model must not affect workshop participants. Activating a model is an explicit admin action with a revision history and rollback.
- Disable fallback for comparison tests so the requested model is actually measured. In normal use, allow only a configured fallback and disclose when it was used.

Backend design:

- One application-level generation interface serves writing, suggestions, refinement and board analysis. A shared response contract returns text or validated suggestion data plus model and usage metadata.
- Use a Bedrock Converse adapter for compatible models such as Nova and Claude. Use a separate Gemini adapter for Gemini requests. Additional providers plug into the same interface without frontend changes.
- The registry records provider/model identifiers, supported features, output limits, parameter restrictions and secret references. Only send parameters the selected model supports; structured-output validation remains mandatory even when native schema support is unavailable.
- Keep credentials in server-side secret storage. The browser selects registry entries, not arbitrary service URLs or secret values. Ordinary users cannot override the active model through request parameters.
- Store configuration separately from prompts in the environment's DynamoDB table. Validate configuration updates, track revision and actor, and bound any cache so activation has predictable effect.
- Switching among provisioned models needs no code deployment. Adding a new provider, secret, model permission or unsupported capability may require setup or deployment. Supporting multiple providers does not mean every model is interchangeable or already enabled.

Acceptance checks: every AI entry point honors selection; unknown/unsupported models fail clearly; provider responses normalize correctly; tests do not activate configuration; fallback cannot contaminate comparisons; settings remain isolated between environments; external provider credentials never reach the client; existing editing/apply/undo behavior is independent of model choice.

References:
- https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html
- https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
- https://ai.google.dev/gemini-api/docs/openai

The first AI improvement should be reliable use of existing board data. A larger model cannot compensate for missing context. Follow that with structured, editable actions: goal refinements, relationship gaps linked to a specific goal, a meeting agenda, and an outreach draft. The assistant should distinguish facts supplied by the user from suggestions and should never invent contacts or send messages automatically.

Evaluate using reviewed synthetic examples from the existing sample profiles, plus empty/incomplete boards and adversarial inputs. Compare usefulness, specificity, unsupported claims, schema validity, latency and cost per task. Avoid claiming a quality improvement based only on a newer model version.

## Proposed delivery sequence

1. **Establish baseline:** reconcile source/worktrees with production; refresh AWS access to inspect deployed functions and prompts; capture current behavior and rollback artifacts.
2. **AI reliability release:** repair context assembly, explicit environment routing, safe output rendering, credential-free backups, bounded retries and configurable models/IAM. Add focused tests for these behaviors and a small model evaluation set.
3. **Experience release:** guided setup, unified board home, contextual AI actions, readable responsive layouts and accessible dialogs/navigation.
4. **Retention release:** saved action tracking and meeting notes. Decide whether accounts and cross-device sync are warranted before building that subsystem.

A model-only patch is narrower but leaves the context and workflow issues. A full rewrite introduces migration risk before the desired experience is validated. The incremental approach offers the clearest path to a useful, reviewable first release.

## Validation needed before release

- Existing backups import without loss, and new backups contain no credentials.
- Populated and empty boards produce correct AI context; proposed actions remain drafts until accepted.
- Local/dev/test calls cannot reach production accidentally.
- Both configured model paths are permitted by IAM and available to the account.
- AI output is safely rendered; malformed output, cancellation, timeouts, 401/403/429 and provider failures have clear recovery paths.
- Core editing, keyboard navigation, small-screen layouts, workshop activation and PDF/export flows work.
- Production provenance and rollback steps are documented. Repository deployment policy in `CLAUDE.md` requires the user to execute deployment commands manually.
