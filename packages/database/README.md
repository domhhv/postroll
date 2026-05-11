# `@postroll/database`

Prisma schema, generated client, and Neon-backed local development stack for the monorepo.

## Entrypoints

The package exposes three subpaths so consumers can pick exactly what they need without dragging in the Prisma engine where it doesn't belong:

| Import | What you get | Who uses it |
|---|---|---|
| `@postroll/database` | **Types only.** `export type *` of the generated client + the `Prisma` namespace (enums, input types). No runtime DB connection, no engine. | `apps/web` — needs `User` etc. for typing gateway responses, but must not bundle the Prisma runtime. |
| `@postroll/database/prisma` | The raw `PrismaClient` class from the generated client. No singleton, no env loading. | `apps/gateway` — constructs its own client inside NestJS DI so it can own the lifecycle and pick its driver adapter. |
| `@postroll/database/client` | A pre-built `prisma` singleton wired to [`@prisma/adapter-neon`](https://www.npmjs.com/package/@prisma/adapter-neon), with env loading from `packages/database/.env`. | Currently unused. Kept for one-off scripts that want a ready-to-use client outside an app context. |

The split matters because `@postroll/database/client` has top-level side effects (calls `loadEnvFile`, constructs `PrismaNeon`). If the web app barrel-imported that, every server-side render would pull the Prisma engine into the OpenNext bundle even when only types are used.

## Scripts

| Script | What it does | Env vars validated |
|---|---|---|
| `db:generate` | `prisma generate` — produces the Prisma client to `src/generated/`. | None (no env access needed). |
| `db:start` | Starts the local Neon-compatible Postgres stack via Docker Compose. | `NEON_API_KEY`, `NEON_PROJECT_ID`, `PARENT_BRANCH_ID`. Also checks that the Docker daemon is reachable. |
| `db:stop` | `docker compose down`. | None. |
| `db:migrate` | `prisma migrate dev` — apply migrations against the local dev branch. | `DIRECT_URL` (+ optional `SHADOW_DATABASE_URL`). |
| `db:deploy` | `prisma migrate deploy` — apply migrations against a production/preview branch. Used by CI. | `DIRECT_URL`. |
| `db:reset` | `prisma migrate reset` — wipe and re-apply all migrations. | `DIRECT_URL`. |
| `studio` | Opens Prisma Studio against the configured DB. | `DIRECT_URL`. |

Each script that needs env vars is gated by [`postroll-check-env`](../env/README.md#postroll-check-env-cli), which fails fast with a friendly Zod error before invoking Prisma or Docker.

## Environment variables

Source of truth: [`src/env.ts`](src/env.ts). Local values: [`.env.example`](.env.example).

### `DATABASE_URL`

**Required only if `@postroll/database/client` is imported.** Pooled Postgres connection string. Used by [`src/client.ts`](src/client.ts) to construct a Neon-adapter Prisma client. Not needed for migrations, local dev startup, or by `apps/gateway` (which constructs its own client from its own validated env). Apps that talk to the DB own their `DATABASE_URL` — this entry is here for completeness of the in-package runtime path.

### `DIRECT_URL`

**Required for migrations.** Non-pooled connection string. Prisma migrations need a direct connection because pooled connections (PgBouncer-style) don't support session-level operations like advisory locks. Read by [`prisma.config.ts`](prisma.config.ts) via Prisma's `env()` helper.

In CI, both the gateway-preview and gateway-production deploy workflows set `DIRECT_URL` from the `DATABASE_URL` secret (they point at the same Neon branch).

### `SHADOW_DATABASE_URL`

**Optional.** Used by `prisma migrate dev` to detect schema drift. Should point at a separate empty database that Prisma can wipe between migrations. The local Docker Compose stack provides one (`shadow-db` service) at `postgres://shadow:shadow@localhost:5433/shadow`. CI doesn't set this — migrations run against a fresh Neon branch where drift detection isn't needed.

### `NEON_API_KEY`, `NEON_PROJECT_ID`, `PARENT_BRANCH_ID`

**Required for local `db:start` only.** Passed to the `neondatabase/neon_local` container, which proxies queries to an ephemeral Neon branch forked from `PARENT_BRANCH_ID`. Get the API key from the Neon console; the project ID and parent branch ID are visible in the project's branches page.

The `docker-compose.yml` also uses Compose's `${VAR:?msg}` syntax as a second line of defense for direct `docker compose up` invocations (in case someone bypasses `pnpm db:start`).

## Getting started locally

1. Copy `.env.example` to `.env` and fill in the Neon-related vars.
2. `pnpm db:start` — boots the Neon local proxy + shadow Postgres.
3. `pnpm db:migrate` — applies migrations to your local branch.
4. `pnpm studio` (optional) — opens Prisma Studio.

To stop: `pnpm db:stop`.

## How validation is wired

See the [`@postroll/env` README](../env/README.md) for the validation model. Three schemas in [`src/env.ts`](src/env.ts) cover the three contexts:

- `dockerEnvSchema` — for `db:start`
- `migrationEnvSchema` — for `db:migrate` / `db:deploy` / `db:reset` / `studio`
- `runtimeEnvSchema` — used by [`src/client.ts`](src/client.ts) when the in-package `prisma` singleton is imported
