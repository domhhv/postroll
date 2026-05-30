# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repo root unless noted; pnpm + Turborepo handles workspace fan-out and ordering.

| Command | Notes |
|---|---|
| `pnpm dev` | Builds `@postroll/env`, runs `prisma generate`, boots the local Neon Docker stack, then starts both apps in watch mode. |
| `pnpm build` | Builds every workspace package and app. |
| `pnpm check-types` | `tsc --noEmit` across all packages. Depends on `^build` + `^db:generate` — the Prisma client and `@postroll/env`'s `dist/` must exist first, so don't bypass turbo. |
| `pnpm biome:check` / `pnpm biome:write` | Lint/format check or apply fixes. |
| `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` / `pnpm db:studio` | Forwarded to `@postroll/database`. `db:start` needs `NEON_API_KEY`, `NEON_PROJECT_ID`, `PARENT_BRANCH_ID` and a running Docker daemon. |
| `pnpm --filter @postroll/database db:migrate` | Apply migrations against the local Neon branch. Needs `DIRECT_URL`. |
| `pnpm ui <component>` | Adds a shadcn component to `packages/ui` via `shadcn add`. |
| `pnpm --filter @postroll/web preview` | Builds with OpenNext and runs `wrangler dev` — the closest local equivalent to the deployed Cloudflare Worker. |

Single-package work: `pnpm --filter <package> <script>` (e.g. `pnpm --filter @postroll/gateway dev`). There is no test runner wired up yet — `check-types` and `biome:check` are the only verifiers, and they run on pre-commit via lint-staged.

Node 24 / pnpm 11 (enforced by `engines` and `packageManager`). Commits must follow Conventional Commits — `commitlint` runs in the `commit-msg` hook with custom case rules in `commitlint.config.mjs` (lowercase types/scopes; subject may be lower/camel/kebab/pascal case).

## Architecture

Two apps, one database, two packages doing real work (`env`, `contracts`, `database`); `ui`, `configs` are shared config/UI. `@postroll/configs` centralizes the Biome config (`@postroll/configs/biome`) and the `tsconfig` presets (`@postroll/configs/typescript/{base,nextjs,nestjs,prisma}`); see `packages/configs/README.md`.

### Gateway is the only thing that talks to Postgres

`apps/web` never connects to the database. All reads/writes go through `apps/gateway` over HTTP. This is enforced at the package level: `@postroll/database` (the bare import) is **types-only** — it re-exports `export type *` of the generated Prisma client. The live `PrismaClient` lives behind the `@postroll/database/prisma` subpath and is only imported by the gateway. If you find yourself importing `@postroll/database/prisma` or `@postroll/database/client` from `apps/web`, you're about to pull the Prisma engine + `pg` into the OpenNext bundle — stop and route the call through the gateway instead.

When the web app needs a type, prefer `@postroll/contracts` (Zod schemas + inferred types for request/response DTOs, shared by both apps). Use `@postroll/database` types only when no contract type exists yet.

### Auth: JWT access + opaque rotating refresh, session JWE in the browser cookie

The gateway owns identity. Flow:

1. `POST /auth/login` → returns access JWT (`Authorization: Bearer …`) in the body and an opaque refresh token in an `httpOnly` cookie (`postroll_rt`, scoped to `/auth`).
2. `POST /auth/refresh` rotates the refresh token. The previous row is marked `revokedAt` and points to its replacement via `replacedById`. Refresh tokens belong to a `familyId`.
3. Reuse detection: presenting an already-revoked token revokes the entire family (`tokens.service.ts:98-100`). To absorb benign races (concurrent requests both hitting 401 → both refreshing), there is a 10-second `ROTATION_GRACE_MS` window during which a revoked token's replacement is rotated again instead of triggering family revocation.

The web app wraps this in a **session JWE** stored in `postroll_session` (encrypted with `SESSION_SECRET`, see `apps/web/src/lib/session.ts`). The session contains `{ sid, userId, accessToken, refreshToken, refreshExpiresAt }`. `gatewayFetch` (in `apps/web/src/lib/api.ts`) does the access/refresh dance on 401, updates the cookie, and retries — so server components / actions just call `getMe()` and the rotation is transparent.

The proactive refresh runs in `apps/web/src/middleware.ts`, ahead of render. **Cookies can only be mutated in middleware, Server Actions, or Route Handlers — never during an RSC render.** Since `getUser()` runs while rendering the layout, a refresh triggered there can't persist the rotated cookie (Next throws "Cookies can only be modified in a Server Action or Route Handler"). Middleware decodes the access token `exp`, refreshes near expiry, and writes the rotated session onto both the request (so the in-flight render sees it) and the response. `updateSession` / `deleteSession` also swallow the read-only-cookie error as a mid-render fallback. The edge-safe refresh primitives live in `lib/refresh.ts` + `lib/session-crypto.ts` (no `server-only`, so middleware can import them); `lib/session.ts` keeps the `next/headers`-bound, `server-only` wrappers.

The middleware file **must stay named `middleware.ts`, not the Next 16 `proxy.ts`** — you'll see a deprecation warning telling you to rename it; ignore it. `proxy` is nodejs-runtime-only and OpenNext rejects Node.js middleware (`opennextjs-cloudflare build` fails: "Node.js middleware is not currently supported"); `middleware` runs on edge, which OpenNext supports. Everything in the middleware import graph must be edge-safe (no `node:` builtins, no `@postroll/env` barrel — use `@postroll/env/format`).

Server-only code lives behind `import 'server-only'` (see `lib/api.ts`, `lib/dal.ts`, `lib/session.ts`). Don't pass the decrypted `SessionPayload` to client components — `accessToken` / `refreshToken` are server-only fields.

### Env validation is centralized via `@postroll/env`

Three contexts, one set of primitives:

- **Shell-time gating**: `postroll-check-env <module> <export>` runs before scripts that need a contract (e.g. `db:migrate` checks `migrationEnvSchema` before invoking `prisma`). Fails with formatted Zod errors before anything destructive runs.
- **Boot-time**: `apps/gateway/src/app.module.ts` passes `validateGatewayEnv` to `ConfigModule.forRoot({ validate })`. `apps/web/src/instrumentation.ts`'s `register()` does the Node-only env load (`.env.local` / `.env` + `getServerEnv()`) by `await import('./instrumentation-node')` **inside** an `if (process.env.NEXT_RUNTIME === 'nodejs')` check. The import must sit inside that branch (not top-level, not after an early-return guard) or webpack bundles `@postroll/env/load`'s `node:fs` for the edge build and the OpenNext build fails. On Cloudflare, env lives in `getCloudflareContext().env`, not `process.env`, so validation defers to call sites with the Workers context.
- **Module-load**: `packages/database/src/client.ts` validates `DATABASE_URL` on import.

`@postroll/env`'s barrel (`.`) re-exports the Node-only `load` module (`node:fs` / `node:url` / `dotenv`). From edge-runtime code (anything in the `apps/web` middleware graph), import `@postroll/env/format` for `formatZodEnvError`, never the barrel — the barrel drags `node:` builtins into the edge bundle. `loadEnvFile` / `validateEnv` (Node-only) stay on `.` and `./load`.

When adding a new env var: define its schema in the consuming package's `env.ts`, add it to that package's `.env.example`, and — if it affects build output or runtime — add it to `globalEnv` in the root `turbo.json` so turbo's cache invalidates correctly.

### Web build engine: webpack, not Turbopack

`apps/web` runs `next build --webpack` in production despite Next 16 defaulting to Turbopack. OpenNext's `copyTracedFiles` depends on the standalone output that webpack produces and Turbopack omits. Dev uses Turbopack. If you change the build script, you'll break Cloudflare deploys — see `apps/web/README.md` for the upstream issue link.

`src/instrumentation.ts` must live under `src/` (not the project root). Next discovers `instrumentation.ts` at `<rootDir>` where `rootDir` is `src/` when `src/app/` exists; Turbopack happens to find it at the root, webpack doesn't. Its Node-only env work lives in `src/instrumentation-node.ts`, imported only inside the `NEXT_RUNTIME === 'nodejs'` branch so it stays out of the edge bundle (see the env section).

### Gateway database adapter selection

`DatabaseModule` picks the Prisma driver adapter from the **URL host**, not `NODE_ENV`: `*.neon.tech` → `@prisma/adapter-neon`, everything else → `@prisma/adapter-pg`. PR-preview deploys point at Neon branches under `NODE_ENV=production`; local Docker Postgres runs under `NODE_ENV=development` — both need the right adapter, so the URL host is the source of truth.

The Prisma client is registered under a `PRISMA_CLIENT` symbol token (not the `PrismaClient` class) because the generated client is a runtime factory, not a stable class reference. Inject via `@InjectPrisma()`. `DatabaseModule` is `@Global()` — import it once in `AppModule`.

### Contracts package compiles to `dist`

Unlike `@postroll/database`, `@postroll/contracts` ships compiled JS (`tsc -p tsconfig.build.json` → `dist/`). It's imported at runtime by both apps for Zod schema parsing, so `build` is required before `check-types` (handled by turbo's `dependsOn: ["^build"]`).

### Workspace import aliases

`apps/web` and `packages/ui` use pnpm `imports` field for internal aliases: `#components/*`, `#lib/*`, `#hooks/*`. Don't add a webpack/tsconfig `paths` alias for the same thing — these are the canonical aliases.

### Deployment surfaces

- `apps/gateway` → Fly.io. Production deploys on push to `main` (`gateway-production-deploy.yml`); PRs get review apps backed by a Neon preview branch (`gateway-preview-deploy.yml`, cleanup in `gateway-preview-cleanup.yml`).
- `apps/web` → Cloudflare Workers via OpenNext. Deploys are driven by Cloudflare Workers Builds (configured in the Cloudflare dashboard, **not** in this repo). Runtime vars (e.g. `GATEWAY_URL`, `SESSION_SECRET`) are set in the dashboard under Settings → Variables and Secrets (the running worker), not Build → Variables (the build container).
