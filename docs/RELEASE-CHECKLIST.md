# Release checklist

Deployments are run by hand (see `CLAUDE.md`). Work through this list for each environment, starting with board.dev.

## Before deploying

- [ ] `npm ci && npm test` passes (frontend Jest and backend `node --test`).
- [ ] `npm run build` succeeds on a clean clone. The lockfile must list native packages for every platform (`@parcel/rust-*`, `lightningcss-*`); if a build fails with `Cannot find module '@parcel/rust-…'`, regenerate the lockfile from a clean install.
- [ ] `sam validate --lint --template-file template.yaml` (or `cfn-lint template.yaml`) is clean.
- [ ] `node scripts/preview-review.cjs` → check http://127.0.0.1:8898/ at desktop and phone widths: the bottom tab bar shows full labels (scrolls sideways on narrow screens), and the admin **AI models** tab loads (password `preview`).
- [ ] `aws sso login` and `export AWS_PROFILE=adminaccess`. The deploy scripts fill in the hosted zone and reuse the GitHub token and admin password already deployed to that stack; export `GITHUB_TOKEN` / `ADMIN_PASSWORD` only for a first deploy or to change them.

## Deploy to dev

- [ ] `npm run deploy:boarddev` (backend), then `npm run deploy:boarddevfront`.
- [ ] Enable any third-party models not yet used in this account (Bedrock console → Model catalog). The first call to an Anthropic, Qwen or OpenAI model can need a one-time Marketplace subscription.
- [ ] `ADMIN_PASSWORD=… npm run smoke:models -- --host board.dev.seibtribe.us` — every model you plan to use must PASS. A FAIL for a model you do not intend to activate is fine.
- [ ] Install the grounded prompts: `npm run prompts:install -- --stack <stack> --dry-run` to preview, then without `--dry-run` to apply (previous prompts stay available in admin → Prompts).
- [ ] In admin → **AI models**, compare the candidate models on two or three realistic (fictional) prompts for both *Writing assistance* and *Board analysis*. Note quality, latency and estimated cost.
- [ ] Activate the chosen routing on dev. Leave **Show the model name to site users** off unless you are deliberately testing.
- [ ] On the dev site, run one writing refinement and one board analysis end to end; confirm no model name appears in the advice panel.
- [ ] `aws logs tail /aws/lambda/<stack>-ai-guidance --since 10m` shows no errors.

## Promote to production

- [ ] Repeat the deploy steps for production (`npm run deploy:board`, `npm run deploy:boardfront`).
- [ ] `ADMIN_PASSWORD=… npm run smoke:models -- --host board.seibtribe.us --models <models you will activate>`.
- [ ] Activate the same routing as dev. Note the revision number so you can roll back from **Settings history & restore**.
- [ ] Spot-check https://board.seibtribe.us on a phone and a laptop.

## Rollback

- Model choice: admin → **AI models** → *Settings history & restore* → Restore the previous revision (takes effect on the next request, no deploy).
- Code: redeploy the previous commit with the same deploy commands.
