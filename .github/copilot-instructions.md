# Slate repository instructions

## Workspace and commands

- Package manager/runtime: pnpm 12.21.0 and Node.js 26.13.1. pnpm is pinned in `package.json`; use pnpm workspace filters rather than invoking package managers inside apps.
- Install dependencies with `pnpm install`.
- Copy `.env.example` to `.env` for local development. The API and web dev processes both load the repository-root `.env`; keep private API secrets out of `VITE_*` variables.
- Start both apps: `pnpm dev` (web at `http://localhost:3000`, API at `http://localhost:3001`).
- Start one app: `pnpm --filter @slate/web dev` or `pnpm --filter @slate/api dev`.

Common verification:

- Full lint: `pnpm lint`
- CI-equivalent lint: `pnpm lint:ci`
- Fix lint and formatting: `pnpm lint:fix`
- Workspace typecheck: `pnpm typecheck`
- Single package typecheck: `pnpm --filter @slate/web typecheck`, `pnpm --filter @slate/api typecheck`, or `pnpm --filter @slate/shared typecheck`
- Full build: `pnpm build` (builds shared first, then both apps)
- Single app build: `pnpm --filter @slate/web build` or `pnpm --filter @slate/api build`
- Check one or more files with `pnpm exec oxlint <file>` and `pnpm exec biome check <file>`
- Format or fix one file with `pnpm exec biome check --write <file>`

There is currently no automated test runner or test script. Do not invent a test command; use typecheck, lint, build, and targeted runtime checks until tests are added.

## Architecture

This is a pnpm monorepo with three workspace packages:

- `apps/web`: TanStack Start + React 19 + Vite/Nitro web app. It uses TanStack Router, TanStack Query, React Hook Form, Zod, Tailwind CSS 4, Base UI, and Sentry.
- `apps/api`: Express 5 API with Mongoose/MongoDB, jose JWT handling, Pino logging, and Nodemailer. It waits for MongoDB before listening and exposes `/health` plus `/api/auth`.
- `packages/shared`: source package for contracts shared by both apps. Import its public entry point from `@slate/shared`, not from a package-internal path.

The web app proxies `/api` to the API in development and under Nitro. Browser auth calls use Axios with `withCredentials: true`; the API issues HTTP-only access/refresh cookies, and the Axios interceptor performs one shared refresh retry on 401 responses.

Server rendering and browser rendering share the TanStack Query auth cache. `apps/web/src/integrations/tanstack-query.tsx` creates a per-request/per-router `QueryClient`; `apps/web/src/features/auth/current-user.ts` forwards the incoming cookie to `/api/auth/me` for SSR.

The API is organized into `routes`, `services`, `middleware`, `models`, and `lib`. Routes parse/dispatch HTTP input; services perform account/session operations; middleware handles auth, authorization, logging, and errors; Mongoose models own persistence shapes. `apps/api/src/app.ts` is the composition root and centralizes middleware, CORS, health, and route mounting.

Board data is modeled around slates, nodes, and edges. Shared Zod schemas and constants in `packages/shared/src` define the cross-app canvas contracts. Mongoose equivalents in `apps/api/src/models` add persistence and timestamps. The web board currently lives under `apps/web/src/features/board`.

The Slates REST vertical slice uses shared `CreateSlateInput`, `UpdateSlateInput`, `SlateDetail`, and `SlateSummary` contracts. API routes in `apps/api/src/routes/slates.ts` require authentication and centralized slate access roles, and deleting a slate also deletes its nodes and edges. The web uses `apps/web/src/lib/slates.ts` for query options and mutations: list/detail keys stay under `["slates"]`, create prepends the new record, and starred-state mutations update the cache optimistically with rollback and settlement invalidation.

CI runs `pnpm lint:ci`, `pnpm typecheck`, and `pnpm build`. Deployment builds and deploys the web and API as separate Fly.io apps after successful CI on `dev` or `staging`.

## Code conventions

- Keep cross-app types, limits, enum values, API schemas, and auth payload shapes in `packages/shared/src`. The package exports them through `src/index.ts`.
- Use Zod and shared schemas at boundaries. API routes use `safeParse`; untrusted request fields are also narrowed explicitly where a route does not use a shared schema.
- Use `#/...` imports for source-local modules in all workspaces; `#/*` aliases are declared in each package's `tsconfig.json`.
- API JSON errors use the shared `ApiErrorResponse` contract. Field validation should use the field-error shape; expected application failures should use `HttpError` and the central `errorHandler`, not ad hoc response bodies.
- Authentication uses HTTP-only cookies. The access cookie covers normal API requests; the refresh cookie is scoped to `/api/auth`. Do not move session secrets or tokens into browser storage.
- Protected API routes use `requireAuth`; slate authorization is centralized in `requireSlateAccess(minRole)`, with owner and collaborator role checks enforced server-side.
- Mongoose schemas use `baseSchemaOptions` from `apps/api/src/models/__base.ts` for timestamps and string `id` serialization. Index and preserve access fields such as `ownerId`, `slateId`, and `updatedAt` deliberately.
- TanStack routes belong in `apps/web/src/routes`. `_is_in` and `_is_out` are layout route groups for authenticated and unauthenticated flows. Route search parameters use Zod validation; protected route redirects preserve the original location.
- `apps/web/src/routeTree.gen.ts` is generated by TanStack Router and must not be edited. Route changes are made in `src/routes`, and the generated tree is refreshed through the web build/dev tooling.
- Environment validation is centralized with `createEnv` in `apps/api/src/env.ts` and `apps/web/src/env.ts`. Add variables to the env module and `.env.example`, and keep deployed/public variables distinct from API secrets.
- React UI follows the existing composition: reusable primitives in `components/ui`, feature hooks/components in `features`, route-specific code in `routes`, and API/auth integration in `lib`.
- The board keeps responsibilities separate: `useBoardCamera` owns transforms and redraw coordination, `useBoardPointerAndWheelControls` owns interaction listeners, and helpers such as `paintDotGrid` own canvas drawing. Remove DOM listeners in hook cleanup and keep camera refs synchronized with stage/canvas redraw operations.
- Sentry initialization is in `apps/web/src/lib/sentry.ts`; route and window error reporting is centralized through `apps/web/src/lib/error-reporting.ts`.
- The Tailwind theme colors in `apps/web/src/styles.css` include `ink`, `paper`, `paper-raised`, `mineral`, `clay`, `citron`, `line`, and `muted`. Reuse these names rather than introducing unrelated ad hoc palette values.
- Biome is the formatter and part of linting, while Oxlint handles additional correctness/import/React checks. Respect Tailwind class sorting and the repository rules that prohibit explicit `any` and unused imports/locals.
- Lefthook runs commitlint on commit messages and Oxlint/Biome on staged files; pre-push runs lint, typecheck, and build. Use conventional commit messages.
