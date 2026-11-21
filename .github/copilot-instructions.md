# Slate repository instructions

## Tooling and commands

- This is a pnpm workspace. Use `pnpm` rather than npm or yarn.
- Install dependencies with `pnpm install`.
- Start all app development servers with `pnpm dev`. The web app runs at `http://localhost:3000`.
- Run one app in development with `pnpm --filter @slate/web dev` or `pnpm --filter @slate/api dev`.
- Run all workspace typechecks with `pnpm typecheck`.
- Typecheck only the web app with `pnpm --filter @slate/web typecheck`; use `@slate/api` or `@slate/shared` for the other packages.
- Run the full lints with `pnpm lint`. CI uses `pnpm lint:ci`, and automatic fixes use `pnpm lint:fix`.
- Run a scoped lint/format check with `pnpm --filter @slate/web lint` or `pnpm --filter @slate/web check`.
- Build the shared package first and all apps with `pnpm build`.
- Build one package or app with `pnpm --filter @slate/shared build`, `pnpm --filter @slate/web build`, or `pnpm --filter @slate/api build`.
- Preview the built web app with `pnpm --filter @slate/web preview`.
- There is currently no test runner or test script in the workspace, so there is no single-test command to use yet.

The pre-push hook runs lint, typecheck, and build. Lefthook also runs Oxlint/Biome on staged files and commitlint on commit messages. CI runs `pnpm lint:ci`, `pnpm typecheck`, and `pnpm build`.

## Architecture

- `apps/web` is a TanStack Start/React 19 web app built by Vite 8 and Nitro. Tailwind CSS 4 is supplied through Vite, and Base UI plus Iconoir provide UI primitives and icons.
- `apps/api` is currently a minimal Express 5 TypeScript entry point. It is separate from the web app and does not yet contain application domain behavior.
- `packages/shared` is a workspace package exported through `@slate/shared`. It holds code intended to be shared by apps; currently it exports `APP_NAME`.
- Workspace package names are `@slate/web`, `@slate/api`, and `@slate/shared`. Cross-package imports use the `workspace:*` protocol.
- TanStack Router uses file-based routing under `apps/web/src/routes`. Add or move route files there rather than editing the routing graph manually; `src/routeTree.gen.ts` is generated.
- `apps/web/src/router.tsx` owns the router instance and enables scroll restoration and intent preloading.
- The root route is `apps/web/src/routes/__root.tsx`. It configures document metadata, structured SEO data, suspense/pending/error boundaries, and the root shell.
- `apps/web/src/features/board` contains the interactive board implementation. `Board` composes small hooks that separate camera state, pointer/wheel input, keyboard zoom, and canvas resolution.
- The web app's environment variables are loaded from the workspace-root `.env`/`.env.example` by Vite and validated in `apps/web/src/env.ts` with `@t3-oss/env-core` and Zod.
- Sentry initialization is centralized in `apps/web/src/lib/sentry.ts`; `apps/web/src/lib/error-reporting.ts` is the common reporting and error-normalization path used by router and window-level error handling.

## Repository conventions

- TypeScript is strict and `noExplicitAny` is enforced. Use imports from `@/*` or `#/*` for web source modules where the existing files do so; both aliases resolve to `apps/web/src`.
- The web app's route components use TanStack file-router APIs such as `createFileRoute`, `Route.useNavigate()`, and typed route parameters. Route-specific `<head>` metadata belongs on the route object.
- Put reusable UI in `apps/web/src/components/ui` or feature-level components in `apps/web/src/features`. Keep board behavior in dedicated hooks rather than expanding `Board`.
- Preserve the board's separation of responsibilities: camera transformations stay in `useBoardCamera`, input listeners stay in `useBoardPointerAndWheelControls`, and canvas drawing stays in helpers such as `paintDotGrid`.
- Board camera values that change frequently are stored in refs and explicitly trigger redraws, rather than being React state. When changing camera behavior, keep repaints and stage/canvas synchronization in the same operation.
- DOM event listeners added by hooks must be removed in the hook cleanup function.
- Tailwind theme colors are declared in `apps/web/src/styles.css` as `ink`, `paper`, `paper-raised`, `mineral`, `clay`, `citron`, `line`, and `muted`. Use those theme names instead of introducing unrelated ad hoc palette values.
- Biome sorts Tailwind classes; changes that add or reorder `className` values should remain compatible with `pnpm lint:fix`.
- Treat `routeTree.gen.ts` and build outputs such as `apps/web/.output` and `apps/web/node_modules` as generated. Do not hand-edit or format the route tree.
