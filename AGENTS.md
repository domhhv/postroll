# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repo root unless noted; pnpm + Turborepo handles workspace fan-out and ordering.

| Command                                                               | Notes                                                                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                            | Builds `@postroll/env`, runs `prisma generate`, boots the local Neon Docker stack, then starts both apps in watch mode.                                             |
| `pnpm build`                                                          | Builds every workspace package and app.                                                                                                                             |
| `pnpm check-types`                                                    | `tsc --noEmit` across all packages. Depends on `^build` + `^db:generate` — the Prisma client and `@postroll/env`'s `dist/` must exist first, so don't bypass turbo. |
| `pnpm lint` / `pnpm lint:fix`                                         | Lint / auto-fix issues.                                                                                                                                             |
| `pnpm prettier:check` / `pnpm prettier:write`                         | Check formatting / auto-format files.                                                                                                                               |
| `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` / `pnpm db:studio` | Forwarded to `@postroll/database`. `db:start` needs `NEON_API_KEY`, `NEON_PROJECT_ID`, `PARENT_BRANCH_ID` and a running Docker daemon.                              |
| `pnpm db:migrate`                                                     | Apply migrations against the local Neon branch. Needs `DIRECT_URL`. `db:deploy` (filter-only) runs `prisma migrate deploy`.                                         |
| `pnpm ui <component>`                                                 | Adds a shadcn component to `packages/ui` via `shadcn add`.                                                                                                          |

Single-package work: `pnpm --filter <package> <script>` (e.g. `pnpm --filter @postroll/gateway dev`). There is no test runner wired up yet — `check-types` and `lint` are the only verifiers. Pre-commit (`lint-staged.config.mjs`) runs repo-wide `pnpm lint`, `pnpm prettier:check`, `pnpm check-types` and `sort-package-json` on staged `package.json`s — run `pnpm prettier:write` before committing to avoid a failed hook.

Node 24 / pnpm 12 (enforced by `engines` and `packageManager`). Commits must follow Conventional Commits — `commitlint` runs in the `commit-msg` hook with custom case rules in `commitlint.config.mjs` (lowercase types/scopes; subject may be lower/camel/kebab/pascal case).

## Architecture

Two apps, one database, three packages doing real work (`env`, `contracts`, `database`); `ui`, `configs` are shared config/UI. `@postroll/configs` centralizes the ESLint config (`@postroll/configs/eslint`), the Prettier config (`@postroll/configs/prettier`) and the `tsconfig` presets (`@postroll/configs/typescript/{base,nextjs,nestjs,prisma}`); see `packages/configs/README.md`.

### Gateway is the only thing that talks to Postgres

`apps/web` never connects to the database. All reads/writes go through `apps/gateway` over HTTP. This is enforced at the package level: `@postroll/database` (the bare import) is **types-only** — it re-exports `export type *` of the generated Prisma client. The live `PrismaClient` lives behind the `@postroll/database/prisma` subpath and is only imported by the gateway. If you find yourself importing `@postroll/database/prisma` or `@postroll/database/client` from `apps/web`, you're about to pull the Prisma engine + `pg` into the web server bundle — stop and route the call through the gateway instead.

When the web app needs a type, prefer `@postroll/contracts` (Zod schemas + inferred types for request/response DTOs, shared by both apps). Use `@postroll/database` types only when no contract type exists yet.

### Auth: JWT access + opaque rotating refresh, session JWE in the browser cookie

The gateway owns identity. Flow:

1. `POST /auth/login` → returns access JWT (`Authorization: Bearer …`) in the body and an opaque refresh token in an `httpOnly` cookie (`postroll_rt`, scoped to `/auth`).
2. `POST /auth/refresh` rotates the refresh token. The previous row is marked `revokedAt` and points to its replacement via `replacedById`. Refresh tokens belong to a `familyId`.
3. Reuse detection: presenting an already-revoked token revokes the entire family (`TokensService.revokeFamily`). To absorb benign races (concurrent requests both hitting 401 → both refreshing), there is a 10-second `ROTATION_GRACE_MS` window during which a revoked token's replacement is rotated again instead of triggering family revocation.

The web app wraps this in a **session JWE** stored in `postroll_session` (encrypted with `SESSION_SECRET`, see `apps/web/src/lib/session.ts`). The session contains `{ sid, userId, accessToken, refreshToken, refreshExpiresAt, activeWorkspaceId }`. `gatewayFetch` (in `apps/web/src/lib/api.ts`) does the access/refresh dance on 401, updates the cookie, and retries — so server components / actions just call `getMe()` and the rotation is transparent.

The proactive refresh happens ahead of render. **Cookies can only be mutated in the proxy, Server Actions, or Route Handlers — never during an RSC render.** Since `getUser()` runs while rendering the layout, a refresh triggered there can't persist the rotated cookie (Next throws "Cookies can only be modified in a Server Action or Route Handler"). And the refresh can't happen in the proxy either: **Vercel service bindings (the source of `GATEWAY_URL`) don't resolve in the proxy, only in functions.** So `apps/web/src/proxy.ts` (Next 16 proxy, Node runtime) makes no network calls — it decodes the access token `exp` and, near expiry, 307-redirects GET/HEAD requests to the `app/api/session/refresh` Route Handler, which rotates the tokens, sets the cookie on its response, and redirects back to the (same-origin-validated) `next` path. Server Actions aren't bounced; `gatewayFetch`'s 401 path persists the rotation there. `updateSession` / `deleteSession` also swallow the read-only-cookie error as a mid-render fallback. The proxy-safe primitives (`decryptSession`, `accessTokenExpiresSoon`, …) live in `lib/session-crypto.ts` (no `server-only`); `lib/session.ts` keeps the `next/headers`-bound, `server-only` wrappers.

**The proxy must never call the gateway** (directly or via `lib/refresh.ts` / `lib/api.ts`) — on Vercel it would fail because the binding isn't there. Anything that needs the gateway belongs in a function (Server Component, Server Action, Route Handler).

Server-only code lives behind `import 'server-only'` (see `lib/api.ts`, `lib/dal.ts`, `lib/session.ts`). Don't pass the decrypted `SessionPayload` to client components — `accessToken` / `refreshToken` are server-only fields.

### Workspaces: tenant scope via `X-Workspace-Id`

Every user gets a personal workspace (OWNER membership) at registration, created in the same transaction as the user. The web session carries `activeWorkspaceId`; `gatewayFetch` sends it as `x-workspace-id` on every request. Workspace-scoped gateway routes use `@UseGuards(JwtAuthGuard, WorkspaceGuard)` — the guard verifies membership and exposes `{ workspaceId, role }` via `@CurrentWorkspace()`. Scope queries by that verified `workspaceId`, never by a raw path/body id (`WorkspacesController` asserts the `:id` param matches). Switching workspaces goes through the `app/api/workspace/switch` Route Handler because it mutates the session cookie. Roles: `OWNER | ADMIN | MEMBER | COMMENTER | VIEWER`.

### Env validation is centralized via `@postroll/env`

Three contexts, one set of primitives:

- **Shell-time gating**: `postroll-check-env <module> <export>` runs before scripts that need a contract (e.g. `db:migrate` checks `migrationEnvSchema` before invoking `prisma`). Fails with formatted Zod errors before anything destructive runs.
- **Boot-time**: `apps/gateway/src/app.module.ts` passes `validateGatewayEnv` to `ConfigModule.forRoot({ validate })`. `apps/web/src/instrumentation.ts`'s `register()` does the Node-only env load (`.env.local` / `.env` + `getSessionEnv()`) by `await import('./instrumentation-node')` **inside** an `if (process.env.NEXT_RUNTIME === 'nodejs')` check (keeps `@postroll/env/load`'s `node:` builtins out of any edge bundle). It checks only `SESSION_SECRET`: `GATEWAY_URL` comes from the Vercel service binding, which doesn't exist in the proxy, so `getGatewayEnv()` validates it lazily on the first gateway call. `src/instrumentation.ts` must live under `src/` — Next discovers it at `<rootDir>`, which is `src/` when `src/app/` exists.
- **Module-load**: `packages/database/src/client.ts` validates `DATABASE_URL` on import.

`@postroll/env`'s barrel (`.`) re-exports the Node-only `load` module (`node:fs` / `node:url` / `dotenv`). `apps/web` imports `@postroll/env/format` for `formatZodEnvError` so `#env` stays importable from any runtime; `loadEnvFile` / `validateEnv` (Node-only) stay on `.` and `./load`.

When adding a new env var: define its schema in the consuming package's `env.ts`, add it to that package's `.env.example`, and — if it affects build output or runtime — add it to `globalEnv` in the root `turbo.json` so turbo's cache invalidates correctly (Turbo also warns on Vercel builds about project env vars missing from `turbo.json`). Vercel env vars are shared by both services. **Never create `GATEWAY_URL` in Vercel** — a user-defined value overrides the binding.

### Gateway database adapter selection

`DatabaseModule` picks the Prisma driver adapter from the **URL host**, not `NODE_ENV`: `*.neon.tech` → `@prisma/adapter-neon`, everything else → `@prisma/adapter-pg`. PR-preview deploys point at Neon branches under `NODE_ENV=production`; local Docker Postgres runs under `NODE_ENV=development` — both need the right adapter, so the URL host is the source of truth.

The Prisma client is registered under a `PRISMA_CLIENT` symbol token (not the `PrismaClient` class) because the generated client is a runtime factory, not a stable class reference. Inject via `@InjectPrisma()`. `DatabaseModule` is `@Global()` — import it once in `AppModule`.

### Contracts package compiles to `dist`

Unlike `@postroll/database`, `@postroll/contracts` ships compiled JS (`tsc -p tsconfig.build.json` → `dist/`). It's imported at runtime by both apps for Zod schema parsing, so `build` is required before `check-types` (handled by turbo's `dependsOn: ["^build"]`).

### Workspace import aliases

`apps/web` and `packages/ui` use pnpm `imports` field for internal aliases: `#components/*`, `#lib/*`, `#hooks/*` (plus `#env` in `apps/web`, `#styles/*` in `packages/ui`). Don't add a webpack/tsconfig `paths` alias (e.g. `@/*`) — these are the only aliases.

### Deployment: one Vercel project, two services

Both apps deploy as a single Vercel project using Vercel Services (root `vercel.json`); Neon stays the database.

- `web` (`apps/web`, `framework: nextjs`) — the only public service, on `/(.*)`. Declares a binding to `gateway` that injects `GATEWAY_URL` (deployment-aware: a preview reaches its own gateway). Build gateway URLs with `gatewayUrl(path)` from `lib/refresh.ts` (resolves against the binding's URL base).
- `gateway` (`apps/gateway`, `framework: nestjs`) — **internal only**, no public rewrite. Its build command only builds the gateway's workspace deps (`turbo run build db:generate --filter=@postroll/gateway^...`) and deletes `dist/`; Vercel's services builder (`@vercel/backends`) then bundles `src/main.ts` itself (rolldown, honoring the tsconfig's decorator settings) into one Vercel Function. **Don't add `outputDirectory: dist` or run `nest build` there**: with a prebuilt `dist/`, the builder puts `main.js` at the function root while the traced pnpm `node_modules` stay at `apps/gateway/node_modules/...` → `Cannot find module` at runtime. Production logs are plain JSON (`pino-pretty` only outside production).
- **`apps/gateway` is ESM** (`"type": "module"`), so relative imports need explicit `.js` extensions (`import { AppModule } from './app.module.js'`). NestJS 12 packages are ESM-only, and Vercel's function runtime rejects `require()` of ES modules (`ERR_REQUIRE_ESM`) even though plain Node 24 allows it. A CommonJS gateway works locally but crashes on Vercel. To reproduce Vercel's behavior locally, run Node with `--no-experimental-require-module`.
- Known builder gap: the bundler requires CommonJS deps through `apps/gateway/node_modules/<pkg>` symlinks, and it dropped those symlinks for packages whose `package.json` `main` is a directory (`passport-jwt`, `passport-local` — the reason passport was replaced with plain guards in `src/auth/guards/`). If a new gateway dependency fails with `Cannot find module` only on Vercel, check that symlink first. Reproduce locally with `vercel build` and inspect `.vercel/output/services/gateway/functions/index.func/.vc-config.json` (`filePathMap`).
- Both build through turbo (`pnpm turbo run build --filter=…`) so workspace deps and the Prisma client are built first. Functions run in `fra1`, next to Neon.
- Deploys are driven by GitHub Actions, not Vercel's Git integration (`git.deploymentEnabled: false`), because migrations run first: `preview-deploy.yml` (Neon branch → migrations → `vercel deploy --env DATABASE_URL=<branch url>` → smoke test `/api/health`), `production-deploy.yml` (migrations → `vercel deploy --prod --skip-domain` → smoke test → promote via REST, then wait until `targets.production.id` is the new deployment), `preview-cleanup.yml` (deletes the PR's deployments found by `meta-prNumber` via REST and deletes the Neon branch).
- **`VERCEL_TOKEN` is project-scoped** (least privilege). Such a token can't read user- or team-level resources, so CLI commands that resolve the user/team first fail with it — `vercel promote` ("User not found"), `vercel list` / `vercel remove` ("Could not retrieve Project Settings"). `vercel deploy` and `vercel curl` work. For anything else in CI, call the project-level REST endpoints with `curl` (see the workflows). The workflows set `defaults.run.shell: bash` so `pipefail` is on — without it a failing `vercel …` piped into `jq` passes silently.
- Secrets (`DATABASE_URL` for production, `JWT_ACCESS_SECRET`, `SESSION_SECRET`) are Vercel env vars per environment; workflows only pass the per-PR `DATABASE_URL`. The root `.vercelignore` keeps local `.env` files out of uploads.

### Important Conventions

#### Comments

Never add explanatory comments unless absolutely necessary.

Code must be clean, readable, and self-documenting.

If a comment is necessary, use the multi-line comments (block comments) format. JSDoc and TODO comments are allowed.

Never use single-line comments except for ESLint or TypeScript directives.

- **Types Inference**: Prefer inferred types over explicit annotations where possible
- **Object Shapes**: Prefer TypeScript's type aliases over interfaces for defining object shapes
