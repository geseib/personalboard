# Continue development on another machine

The UX and AI update is on `feature/multienv` in `geseib/personalboard`.

```sh
git clone --branch feature/multienv https://github.com/geseib/personalboard.git
cd personalboard
npm ci
npm test
npm run build
node scripts/preview-review.cjs
```

Open http://127.0.0.1:8898/ for a local review using sample AI responses. The local admin password is `preview`, and the local AI access code is `123456`. These are fixture credentials only. Saved boards live in browser storage and do not transfer with Git; use the app's backup export/import to move a board.

Use Node 22 and AWS SAM CLI for backend packaging. AWS credentials and Gemini secrets must be configured separately; none are included in this commit. Production deployment is manual per `CLAUDE.md`.

Read `2026-10-01-integration-verification.md` for build results and remaining verification limits, and `2026-10-01-ai-model-operations.md` for provider configuration. Cloud model calls and browser PDF download handoff still require verification. The current preview is not a production deployment.

The remote source includes the application, backend, tests, build/deployment scripts, design notes, screenshots, and sample PDF. Generated SAM artifacts, local backups, nested worktrees, raw media/editor projects, and older unrelated untracked maintenance scripts remain local and are not needed to build this version.
