# AI model routing and administration

The deployed `ai-guidance.handler` routes all generated guidance and writing refinements through `bedrock-chat.js` and `model-router.js`. Model choices are server-owned. Client payloads cannot override them. A DynamoDB strongly consistent read on each generation honors admin changes immediately, without a Lambda deployment. Missing settings use Nova Micro; failed settings reads fail closed rather than silently selecting a model.

The prompt-management table stores the active record under `PK=CONFIG#AI`, `SK=SETTINGS`, with `defaultModel`, `overrides` (`writing`, `board`), `fallbackModel`, `revision`, and `updatedAt`. Board analysis and goal alignment use the board override; other guidance and editing use writing. No fallback is enabled by default. A configured fallback applies only to transient timeout, throttle, and service errors. Access or validation failures do not switch providers. A shared 24-second request budget includes the settings read (bounded to two seconds) and all inference attempts; a configured fallback reserves half the remaining inference time. The same abort signal bounds Gemini secret retrieval and its HTTP request, and provider SDK retries are disabled. Parallel comparison calls share a 24-second deadline. Existing prompt lookups have two-second limits and consume the same public handler deadline. Responses identify requested and actual registry/model IDs, fallback use, token usage, latency, estimated cost, and truncation.

## Supported models

Updated October 3, 2026. `budget` models are candidates for everyday writing help; `premium` models for whole-board analysis. Opus-class models are intentionally excluded.

| Registry ID | Provider model ID | Tier | Input / output USD per million tokens | Notes |
|---|---|---|---|---|
| nova-micro | us.amazon.nova-micro-v1:0 | budget | 0.035 / 0.14 | Default when no settings exist |
| nova-lite | us.amazon.nova-lite-v1:0 | budget | 0.06 / 0.24 | |
| nova-2-lite | us.amazon.nova-2-lite-v1:0 | budget | ≈0.30 / 2.50 | Price not confirmed on the AWS pricing page; shown with ≈ in admin |
| qwen3-next-80b | qwen.qwen3-next-80b-a3b | budget | 0.15 / 1.20 | In-region only (no `us.` profile) |
| gpt-oss-120b | openai.gpt-oss-120b-1:0 | budget | 0.15 / 0.60 | In-region only; sends `reasoning_effort: low`; +1,500 output tokens for reasoning |
| kimi-k2.5 | moonshotai.kimi-k2.5 | budget | 0.60 / 3.00 | In-region only; +1,000 output tokens. Best grounded answer in the October 3 goals-advisor test |
| gemini-flash-lite | gemini-2.5-flash-lite | budget | 0.10 / 0.40 | Needs the Gemini SSM parameter |
| claude-haiku | us.anthropic.claude-haiku-4-5-20251001-v1:0 | premium | 1.10 / 5.50 | |
| claude-sonnet | us.anthropic.claude-sonnet-4-6 | premium | 3.30 / 16.50 | Kept so existing saved settings stay valid |

Prices are standard on-demand US rates; Claude rates include the US geographic-profile premium. Claude Sonnet 5.5 / 5 and GPT-5.6 Luna were evaluated but are not offered: this account could not obtain access to them. Kimi K3 works but rejects `temperature` and spends most of its output budget on reasoning (22 s, truncated at 3,500 tokens), so it is not listed. Reasoning tokens count as output and are billed; only visible text blocks are returned to users. Missing provider usage yields an unavailable estimate rather than zero. Sources: [AWS Bedrock model cards](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html), [AWS pricing](https://aws.amazon.com/bedrock/pricing/), [Google pricing](https://ai.google.dev/gemini-api/docs/pricing).

Per-model request differences live in each registry entry's `request` field (`omitTemperature`, `extraOutputTokens`, `fields` → Converse `additionalModelRequestFields`). If a comparison returns a validation error for one of these models, adjust that field rather than the shared adapter.

## Model visibility for site users

`showModelToUsers` (default `false`) is stored with the routing settings and toggled on the admin **AI models** tab. When it is off, `/ai-guidance` responses carry only the suggestion plus `truncated` and `fallbackUsed`; model IDs, token usage, latency and cost are returned only to the admin comparison. This is enforced server-side in `publicGeneration()`.

## Deployment configuration

The SAM template grants only the listed Bedrock inference profiles and corresponding foundation-model resources (US regions). Third-party models (Anthropic, Qwen, OpenAI) are sold through AWS Marketplace: the first invocation in an account may need someone with Marketplace subscribe permission to enable the model once in the Bedrock console. Model access and regional quotas still need to be available in the deploying account; a registry entry is not proof of access. Use the admin comparison to verify each model before activation.

Gemini requires an existing SSM SecureString parameter. Supply its absolute parameter name through the optional `GeminiApiKeyParameter` SAM parameter. The API key is read server-side and sent only in the Google request header. No API key is exposed through the admin registry or browser. The provided IAM policy supports the default SSM KMS key; a customer-managed KMS key also requires an explicitly scoped decrypt grant. An empty parameter name disables Gemini activation. A nonempty parameter name means configured, not verified; comparison detects missing secrets or provider access failures. Keep this parameter out of frontend configuration and backups.

Package `lambda-functions/ai-guidance/package.json` dependencies during the normal SAM build; the new SSM client is required. The template gives the admin Lambda permission to invoke the AI Lambda and adds the admin AI routes. Its new deployment logical ID publishes those routes on stack update.

No cloud deployment or live inference has been performed as part of local implementation. Current AWS credentials, actual model availability, and production response quality remain deployment validation tasks.

## Internal and public contracts

Only IAM-authorized direct Lambda invocation can call `internalAction` operations. API Gateway events never enter this branch, even if a caller supplies a matching body field.

- `modelRegistry` → `{models, defaults}`.
- `validateSettings`, `settings` → `{settings}` or `{error}`.
- `compareModels`, `modelIds` (one or two), `prompt` (up to 12,000 characters), `task` → `{results}`. Each model receives the same system/user prompt and output limit. Comparison never changes active settings and never falls back. Provider errors are sanitized.

The authenticated public `/ai-guidance` writing operation accepts `{type:'writing_refine', data:{text,instruction,field}}` and returns plain revised text in `guidance` plus generation metadata. Writing input is bounded; empty text is accepted only with a nonblank instruction and drafts use bracketed placeholders for missing facts; the system asks the model to preserve facts and voice and not invent achievements or commitments.

Admin endpoints handled by the existing password-protected admin Lambda:

- `GET/PUT /admin/ai/settings`
- `POST /admin/ai/compare`
- `GET /admin/ai/history`
- `POST /admin/ai/rollback`

## Local verification

Run `node --test lambda-functions/ai-guidance/*.test.cjs` for dependency-injected routing, provider adapter, and handler tests. They cover fresh task selection, exact model metadata, costs, explicit transient fallback, comparison isolation, empty/truncated results, provider request construction, secret handling, public/internal operation separation, and writing validation. Run `sam validate --lint --template-file template.yaml` for infrastructure validation. Mocked tests do not establish provider quality or deployed credentials.
