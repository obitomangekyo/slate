# Slate

[![CI](https://github.com/obitomangekyo/slate/actions/workflows/ci.yml/badge.svg)](https://github.com/obitomangekyo/slate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-d2d27a.svg)](LICENSE)

**An online sticky-note board for teams to map ideas and review their work together.**

Slate brings spatial thinking to retrospectives and story mapping. The workspace uses a calm, tactile paper-and-ink interface, while the board supports camera movement, pan, pinch, scroll, and zoom controls as it grows into a collaborative canvas.

> The project is under active development. The workspace, authentication flows, shared contracts, and interactive board foundation are available; live collaboration and persistent board editing are still evolving.

## Built with

- **Web:** TanStack Start, React 19, TanStack Router/Query, TypeScript, Vite, Tailwind CSS 4, Base UI
- **API:** Express 5, Mongoose/MongoDB, jose, Zod, Pino, Nodemailer
- **Workspace:** pnpm workspaces, shared contracts, Oxlint, Biome, Lefthook
- **Operations:** GitHub Actions CI, Fly.io deployment, Sentry/GlitchTip browser reporting
- **Collaborative stack:** REST credentials, HTTP-only sessions, Google OAuth, and shared canvas schemas

## Current capabilities

- **Account access:** password registration and login, email verification, Google OAuth, session refresh, logout, and current-user lookup
- **Spatial workspace:** a responsive slate library and an interactive dot-grid board
- **Natural board navigation:** drag/pan, trackpad scrolling, pinch gestures, wheel zoom, keyboard zoom, and camera reset
- **Sharp rendering:** canvas resolution tracking and redraw coordination across desktop and high-density displays
- **Shared data contracts:** Zod schemas for authentication, users, canvas nodes, edges, points, dimensions, and slate metadata
- **Protected rendering:** server and browser auth state share a TanStack Query cache
- **Production readiness:** health checks, structured request logging, centralized JSON errors, CI, and separate web/API deployment

## Monorepo

```text
slate/
├── apps/
│   ├── web/       # TanStack Start application
│   └── api/       # Express API and MongoDB persistence
├── packages/
│   └── shared/    # Shared Zod schemas, types, limits, and constants
├── .github/       # CI and Fly.io deployment workflows
├── pnpm-workspace.yaml
└── package.json
```

| Package         | Responsibility                                                                         |
| --------------- | -------------------------------------------------------------------------------------- |
| `@slate/web`    | Routes, authentication UI, board interactions, SSR, and public assets                  |
| `@slate/api`    | Authentication, sessions, account verification, MongoDB models, middleware, and health |
| `@slate/shared` | Stable cross-app data contracts and canvas constants                                   |

## Requirements

- Node.js 26.13.1
- pnpm 12.21.0
- MongoDB, local or hosted
- Gmail or another configured Nodemailer account for verification email
- Google OAuth credentials for Google sign-in

The versions above are pinned in `package.json` and `.node-version`.

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Set the required values in `.env`, including MongoDB and signing secrets.

   Use separate random secrets of at least 32 characters for access, refresh, and email-verification signing. Keep private credentials out of `VITE_*` variables.

4. Start MongoDB, then run both applications:

   ```bash
   pnpm dev
   ```

The web app is available at `http://localhost:3000` and the API at `http://localhost:3001`. The API health endpoint is `GET /health`.

Run one app independently when needed:

```bash
pnpm --filter @slate/web dev
pnpm --filter @slate/api dev
```

See [`.env.example`](.env.example) for every local and deployment setting.

## Verification

There is currently no automated test runner or test script. Use the workspace checks:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

CI-equivalent linting can be run with:

```bash
pnpm lint:ci
```

To fix lint and formatting issues:

```bash
pnpm lint:fix
```

Lefthook also runs commit-message checks, staged-file formatting/linting, and pre-push verification.

## Environment notes

- Browser variables begin with `VITE_*` and are intentionally public.
- API secrets belong in `.env` locally or GitHub Environment secrets during deployment.
- `VITE_API_URL`, `WEB_APP_URL`, `CORS_ORIGINS`, and `GOOGLE_REDIRECT_URI` must agree with the deployed origins.
- GitHub Actions deploys tested revisions from `dev` and `staging` to separate Fly.io web and API apps.
- Production deployment is manually triggered from Actions and promotes the latest successful staging commit after CI passes and the commit is merged into `main`.
- The complete GitHub Variables and Secrets setup is documented in [`.env.example`](.env.example).

### Production deployment

The `Deploy production to Fly.io` workflow is manual-only. Run it from the `main` branch
in GitHub Actions. Before it can access the `production` Environment, it verifies that the
latest staging push and current `main` commit passed CI, both staging Fly deployment jobs
succeeded for that exact staging commit, and the staged commit is included in `main`. It
then imports the production API settings into Fly and deploys the API followed by the web
app from that same commit.

Configure the `production` GitHub Environment with its own `FLY_WEB_APP`, `FLY_API_APP`,
`VITE_API_URL`, `WEB_APP_URL`, and `GOOGLE_REDIRECT_URI` variables, plus the Fly deploy
tokens and API runtime secrets listed in [`.env.example`](.env.example). Optional Sentry
variables can be omitted. Add required reviewers to the GitHub Environment if production
deployments should require approval after the staging checks pass.

## Product direction

Slate is progressing toward:

- persistent slates, notes, edges, and board metadata
- live cursors and collaborative editing
- retrospectives with structured board templates
- story and flow mapping
- team workspaces and access controls
- share links and presence indicators
- search, history, export, and board templates

The live implementation is intentionally transparent about this boundary: the workspace and board camera exist today, while collaboration and persistence are next-stage features.

## Keeping the README current

Keep this document in step with the project:

- update it in the same commit as public features, scripts, environment variables, architecture, or deployment changes;
- use the README status section to distinguish implemented behavior from future work;
- prefer links to source files and configuration instead of duplicating values that may drift;
- review it in pull requests when `package.json`, `.env.example`, CI, deployment, routes, or auth behavior changes.

The CI badge reflects the `main`, `dev`, and `staging` workflows. Avoid adding a bot that rewrites README content automatically: it would create commit loops and can conflict with signed or reviewed workflow policies.

## Contributing

1. Create a conventional commit branch.
2. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
3. Update `.env.example`, shared contracts, or the README when your change affects public setup or behavior.
4. Open a pull request targeting `main`, `dev`, or `staging`.

Commit messages are checked with Commitlint and should follow conventional-commit format, such as `feat(web): add board templates`.

## License

Slate is available under the [MIT License](LICENSE).
