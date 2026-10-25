# Postroll

A system designed to manage and process media files with an efficient and structured approach, ensuring that they are executed in an organized manner.

## Structure

Monorepo managed by [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/repo).

| Path                                     | What                                                                                         | Docs                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------- |
| [`apps/web`](apps/web)                   | Next.js 16 frontend — the public `web` service of the Vercel project.                        | [README](apps/web/README.md)          |
| [`apps/gateway`](apps/gateway)           | NestJS HTTP gateway — the internal `gateway` service of the Vercel project.                  | [README](apps/gateway/README.md)      |
| [`packages/database`](packages/database) | Prisma schema, generated client, and local Neon dev stack.                                   | [README](packages/database/README.md) |
| [`packages/env`](packages/env)           | Shared Zod-backed env-variable validator.                                                    | [README](packages/env/README.md)      |
| [`packages/configs`](packages/configs)   | Shared ESLINT and Prettier configs and `tsconfig` presets (base / nestjs / nextjs / prisma). | [README](packages/configs/README.md)  |

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

| Variable                                              | Where it's required                                                                                 | Details                                                                                                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                        | `apps/gateway` runtime; `packages/database` (only if the in-package `prisma` singleton is imported) | Postgres connection string. The gateway picks its driver adapter based on the URL host: Neon URLs → `@prisma/adapter-neon`, everything else → `@prisma/adapter-pg`. |
| `GATEWAY_URL`                                         | `apps/web` runtime                                                                                  | Base URL of the gateway. Locally from `.env`; on Vercel injected by the `web` → `gateway` service binding (never set it in Vercel).                                 |
| `DIRECT_URL`                                          | `packages/database` migrations                                                                      | Non-pooled Neon connection for `prisma migrate`.                                                                                                                    |
| `SHADOW_DATABASE_URL`                                 | `packages/database` migrations (optional)                                                           | Drift-detection DB for `prisma migrate dev`.                                                                                                                        |
| `NEON_API_KEY`, `NEON_PROJECT_ID`, `PARENT_BRANCH_ID` | `packages/database` local `db:start`                                                                | Passed to the `neondatabase/neon_local` Docker container.                                                                                                           |
| `PORT`                                                | `apps/gateway` (optional, defaults to `8080`)                                                       | HTTP listener port.                                                                                                                                                 |
| `NODE_ENV`                                            | `apps/gateway` (optional, defaults to `development`)                                                | Standard Node env.                                                                                                                                                  |

Every variable that affects build output or runtime is declared in `globalEnv` in [`turbo.json`](turbo.json) so Turbo's cache invalidates when their values change. See individual package READMEs for full descriptions and which scripts/runtimes use which variables.

## Code quality

### Formatting and linting — [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/)

These commands can be run from the monorepo root across all apps and packages via Turbo, leveraging its caching:

- `pnpm lint` — checks lint rules across all packages.
- `pnpm lint:fix` — auto-fixes lint issues.
- `pnpm prettier:check` - checks formatting.
- `pnpm prettier:write` - auto-formats files.

The shared config lives in [`packages/configs`](packages/configs) (`eslint/eslint.config.mjs` and `prettier/prettier.config.mjs`, exported as `@postroll/configs/eslint` and `@postroll/configs/prettier`) and is exported by every package's local `eslint.config.mjs` and `prettier.config.mjs`.

### Type checking — TypeScript

- `pnpm check-types` — runs `tsc --noEmit` in every package via Turbo. Depends on `^build` (so `@postroll/env`'s `dist/` is available) and `^db:generate` (so the Prisma client types exist).

The shared `tsconfig` presets live in [`packages/configs`](packages/configs) under `typescript/`, exported as `@postroll/configs/typescript/<preset>`: `base` (strict defaults), `nextjs`, `nestjs`, `prisma`.

### Pre-commit hook — [husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged)

On every commit, [`lint-staged.config.mjs`](lint-staged.config.mjs) runs:

- `pnpm check-types` if any `.ts` / `.tsx` changed
- `pnpm lint` and `pnpm prettier:check` if any `.md` / `.js` / `.jsx` / `.ts` / `.tsx` changed

The hook is installed by `pnpm install` (via the `prepare` script).

### CI

GitHub Actions in [`.github/workflows/`](.github/workflows):

- [`code-health.yml`](.github/workflows/code-health.yml) — runs `check-types`, `pnpm lint`, and `pnpm prettier:check` on every PR.
- [`preview-deploy.yml`](.github/workflows/preview-deploy.yml) — per PR: creates a Neon branch, runs migrations on it, deploys web + gateway to Vercel with that branch's `DATABASE_URL`, and smoke-tests `/api/health`.
- [`preview-cleanup.yml`](.github/workflows/preview-cleanup.yml) — on PR close: removes the PR's Vercel preview deployments and deletes its Neon branch.
- [`production-deploy.yml`](.github/workflows/production-deploy.yml) — on push to `main`: runs migrations on the production Neon branch, deploys to Vercel without assigning domains, smoke-tests it, then promotes it.

See [Deployment](#deployment) for how the Vercel project is set up.

## Deployment

Both apps deploy together as **one Vercel project** using [Vercel Services](https://vercel.com/docs/services), configured in [`vercel.json`](vercel.json). The database stays on Neon.

| Service   | Root           | Public?                     | Notes                                                                                        |
| --------- | -------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| `web`     | `apps/web`     | Yes — every path (`/(.*)`). | Calls `gateway` through a service binding that injects its URL as `GATEWAY_URL`.             |
| `gateway` | `apps/gateway` | No — internal only.         | Only reachable from `web` via the binding. Firewall/Deployment Protection don't apply to it. |

Things to know:

- **One deployment, both services.** The binding URL is deployment-aware: a preview's `web` always talks to that same preview's `gateway`, so there's no gateway URL to pass around.
- **Bindings only resolve inside functions** (Server Components, Server Actions, Route Handlers) — not during builds and not in the proxy. See the web README for how token refresh works around this.
- **Deploys are driven by GitHub Actions**, not Vercel's Git integration (`git.deploymentEnabled: false`), because migrations have to run before each deploy.
- **Env vars are shared by both services.** Never create `GATEWAY_URL` in Vercel — a user-defined variable overrides the binding.

### One-time setup

1. **Vercel project** (root directory = repo root): create and link it with `vercel link`, then in project settings set Node.js to 24.x and Function Region to `fra1` (next to the Neon database).
2. **Vercel env vars** (mark secrets as sensitive):
   - Production: `DATABASE_URL` (Neon production branch, pooled), `JWT_ACCESS_SECRET`, `SESSION_SECRET`.
   - Preview: `JWT_ACCESS_SECRET`, `SESSION_SECRET` (different values from production). `DATABASE_URL` is passed per PR by the workflow.
   - Production + Preview: `ENABLE_EXPERIMENTAL_COREPACK=1`, so Vercel uses the `pnpm` version from `packageManager`.
3. **GitHub**: secret `VERCEL_TOKEN` — create it scoped to just the `postroll` project (Account Tokens → Scope → team → `postroll`); the workflows only use project-level operations; variables `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (from `.vercel/project.json` after linking). Neon keeps using `NEON_API_KEY` / `NEON_PROJECT_ID`, and `DATABASE_URL` for production migrations.
4. **First deploy**: run the _Production Deployment_ workflow manually (`workflow_dispatch`) before opening a PR — a new Vercel project's first deployment always becomes production.

## Common commands

| Command                                       | What it does                                    |
| --------------------------------------------- | ----------------------------------------------- |
| `pnpm dev`                                    | Generate Prisma client, boot DB, run both apps. |
| `pnpm build`                                  | Build all packages and apps.                    |
| `pnpm check-types`                            | Type-check all packages.                        |
| `pnpm lint` / `pnpm lint:fix`                 | Lint / auto-fix issues.                         |
| `pnpm prettier:check` / `pnpm prettier:write` | Check formatting / auto-format files.           |
| `pnpm --filter @postroll/database db:migrate` | Apply migrations to the local DB.               |
| `pnpm --filter @postroll/database db:reset`   | Wipe and re-apply all migrations.               |
| `pnpm --filter @postroll/database studio`     | Open Prisma Studio.                             |
| `pnpm --filter @postroll/database db:stop`    | Stop the local DB containers.                   |

See the [database README](packages/database/README.md) for the full script reference.
