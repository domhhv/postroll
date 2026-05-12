# Postroll

A system designed to manage and process media files with an efficient and structured approach, ensuring that they are executed in an organized manner.

## Structure

Monorepo managed by [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/repo).

| Path | What | Docs |
|---|---|---|
| [`apps/web`](apps/web) | Next.js 16 frontend, deployed to Cloudflare Workers via OpenNext. | [README](apps/web/README.md) |
| [`apps/gateway`](apps/gateway) | NestJS HTTP gateway, deployed to Fly.io. | [README](apps/gateway/README.md) |
| [`packages/database`](packages/database) | Prisma schema, generated client, and local Neon dev stack. | [README](packages/database/README.md) |
| [`packages/env`](packages/env) | Shared Zod-backed env-variable validator. | [README](packages/env/README.md) |
| [`packages/biome-config`](packages/biome-config) | Shared Biome config. | — |
| [`packages/typescript-config`](packages/typescript-config) | Shared `tsconfig` presets (base / nestjs / nextjs / prisma). | — |

## Quickstart

Prerequisites: Node 24, pnpm 11, a Docker-compatible runtime (Docker Desktop, OrbStack, Colima, Rancher Desktop).

```bash
pnpm install
```

Copy each `.env.example` to a sibling `.env` and fill it in:

- [`packages/database/.env.example`](packages/database/.env.example) — Neon credentials for the local DB
- [`apps/web/.env.example`](apps/web/.env.example) — `GATEWAY_URL`
- [`apps/gateway/.env.example`](apps/gateway/.env.example) — `DATABASE_URL`

Then:

```bash
pnpm dev
```

That one command:

1. Builds the `@postroll/env` package (needed by every other package's scripts).
2. Runs `prisma generate` to produce the typed client.
3. Boots the local Neon-compatible Postgres stack via Docker Compose.
4. Starts the Next.js web app on `localhost:3000` and the NestJS gateway on `localhost:8080`, both in watch mode.

The orchestration lives in [`turbo.json`](turbo.json) — `dev` depends on `^build`, `^db:generate`, and `^db:start`, so anything an app needs is wired up before its dev server boots.

To stop the database: `pnpm --filter @postroll/database db:stop`.

## Environment variables

Validation across the monorepo is centralized in [`@postroll/env`](packages/env/README.md). Each package defines its own Zod schema; validation runs at script-time, app boot, or module load depending on context.

| Variable | Where it's required | Details |
|---|---|---|
| `DATABASE_URL` | `apps/gateway` runtime; `packages/database` (only if the in-package `prisma` singleton is imported) | Postgres connection string. The gateway picks its driver adapter based on the URL host: Neon URLs → `@prisma/adapter-neon`, everything else → `@prisma/adapter-pg`. |
| `GATEWAY_URL` | `apps/web` runtime | Base URL of the gateway. The web app fetches all data through it — it does not connect to Postgres directly. |
| `DIRECT_URL` | `packages/database` migrations | Non-pooled Neon connection for `prisma migrate`. |
| `SHADOW_DATABASE_URL` | `packages/database` migrations (optional) | Drift-detection DB for `prisma migrate dev`. |
| `NEON_API_KEY`, `NEON_PROJECT_ID`, `PARENT_BRANCH_ID` | `packages/database` local `db:start` | Passed to the `neondatabase/neon_local` Docker container. |
| `PORT` | `apps/gateway` (optional, defaults to `8080`) | HTTP listener port. |
| `NODE_ENV` | `apps/gateway` (optional, defaults to `development`) | Standard Node env. |

Every variable that affects build output or runtime is declared in `globalEnv` in [`turbo.json`](turbo.json) so Turbo's cache invalidates when their values change. See individual package READMEs for full descriptions and which scripts/runtimes use which variables.

## Code quality

### Formatting and linting — [Biome](https://biomejs.dev/)

- `pnpm biome:check` — checks formatting and lint rules across all packages (via Turbo).
- `pnpm biome:write` — applies safe fixes.

The shared config lives in [`packages/biome-config`](packages/biome-config) and is extended by every package's local `biome.json`.

### Type checking — TypeScript

- `pnpm check-types` — runs `tsc --noEmit` in every package via Turbo. Depends on `^build` (so `@postroll/env`'s `dist/` is available) and `^db:generate` (so the Prisma client types exist).

The shared `tsconfig` presets live in [`packages/typescript-config`](packages/typescript-config): `base.json` (strict defaults), `nextjs.json`, `nestjs.json`, `prisma.json`.

### Pre-commit hook — [husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged)

On every commit, [`lint-staged.config.mjs`](lint-staged.config.mjs) runs:

- `pnpm check-types` if any `.ts` / `.tsx` changed
- `pnpm biome:check` if any `.md` / `.js` / `.jsx` / `.ts` / `.tsx` changed

The hook is installed by `pnpm install` (via the `prepare` script).

### CI

GitHub Actions in [`.github/workflows/`](.github/workflows):

- [`code-health.yml`](.github/workflows/code-health.yml) — runs `check-types` and `biome:check` on every PR.
- [`gateway-preview-deploy.yml`](.github/workflows/gateway-preview-deploy.yml) — creates a Neon preview branch, deploys a Fly review app per PR.
- [`gateway-preview-cleanup.yml`](.github/workflows/gateway-preview-cleanup.yml) — tears down preview infra on PR close.
- [`gateway-production-deploy.yml`](.github/workflows/gateway-production-deploy.yml) — runs migrations and deploys to Fly on push to `main`.

The Cloudflare Workers Builds integration handles `apps/web` deploys (configured in the Cloudflare dashboard, not in this repo).

## Common commands

| Command | What it does |
|---|---|
| `pnpm dev` | Generate Prisma client, boot DB, run both apps. |
| `pnpm build` | Build all packages and apps. |
| `pnpm check-types` | Type-check all packages. |
| `pnpm biome:check` / `pnpm biome:write` | Lint / lint-fix. |
| `pnpm --filter @postroll/database db:migrate` | Apply migrations to the local DB. |
| `pnpm --filter @postroll/database db:reset` | Wipe and re-apply all migrations. |
| `pnpm --filter @postroll/database studio` | Open Prisma Studio. |
| `pnpm --filter @postroll/database db:stop` | Stop the local DB containers. |

See the [database README](packages/database/README.md) for the full script reference.
