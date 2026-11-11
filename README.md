# Postroll

A system designed to manage and process media files with an efficient and structured approach, ensuring that they are executed in an organized manner.

## Structure

Monorepo managed by [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/repo).

| Path                                       | What                                                                                         | Docs                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| [`apps/web`](apps/web)                     | Next.js 16 frontend — the public `web` service of the Vercel project.                        | [README](apps/web/README.md)           |
| [`apps/gateway`](apps/gateway)             | NestJS HTTP gateway — the internal `gateway` service of the Vercel project.                  | [README](apps/gateway/README.md)       |
| [`apps/emails-worker`](apps/emails-worker) | NestJS worker that consumes RabbitMQ and sends email with Resend. Runs on Render.            | [README](apps/emails-worker/README.md) |
| [`packages/database`](packages/database)   | Prisma schema, generated client, and local Neon dev stack.                                   | [README](packages/database/README.md)  |
| [`packages/env`](packages/env)             | Shared Zod-backed env-variable validator.                                                    | [README](packages/env/README.md)       |
| [`packages/emails`](packages/emails)       | React Email templates and the renderer the worker uses.                                      | [README](packages/emails/README.md)    |
| [`packages/messaging`](packages/messaging) | RabbitMQ topology, publisher, retrying consumer, and the local RabbitMQ for `pnpm dev`.      | [README](packages/messaging/README.md) |
| [`packages/configs`](packages/configs)     | Shared ESLINT and Prettier configs and `tsconfig` presets (base / nestjs / nextjs / prisma). | [README](packages/configs/README.md)   |

## Quickstart

Prerequisites: Node 24, pnpm 11, a Docker-compatible runtime (Docker Desktop, OrbStack, Colima, Rancher Desktop).

```bash
pnpm install
```

Copy each `.env.example` to a sibling `.env` and fill it in:

- [`packages/database/.env.example`](packages/database/.env.example) — Neon credentials for the local DB
- [`apps/web/.env.example`](apps/web/.env.example) — `GATEWAY_URL`
- [`apps/gateway/.env.example`](apps/gateway/.env.example) — `DATABASE_URL`, `AMQP_URL`
- [`apps/emails-worker/.env.example`](apps/emails-worker/.env.example) — the local broker and the `log` email transport, so no Resend key is needed

Then:

```bash
pnpm dev
```

That one command:

1. Builds the `@postroll/env` package (needed by every other package's scripts).
2. Runs `prisma generate` to produce the typed client.
3. Boots the local Neon-compatible Postgres stack and RabbitMQ (management UI at `localhost:15672`, guest / guest) via Docker Compose.
4. Starts the Next.js web app on `localhost:3000`, the NestJS gateway on `localhost:8080` and the emails worker, all in watch mode.

The orchestration lives in [`turbo.json`](turbo.json) — `dev` depends on `^build`, `^db:generate`, `^db:start` and `^mq:start`, so anything an app needs is wired up before its dev server boots.

To stop the database: `pnpm --filter @postroll/database db:stop`. To stop RabbitMQ: `pnpm mq:stop`. To preview email templates: `pnpm emails:preview` (http://localhost:3030).

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
| `AMQP_URL`                                            | `apps/gateway` (optional), `apps/emails-worker`                                                     | RabbitMQ URL: CloudAMQP in production (Vercel Production and Render), Docker locally. Unset on previews, so the gateway doesn't publish there.                      |
| `CRON_SECRET`                                         | `apps/web` (`/api/internal/outbox-sweep` only)                                                      | Bearer token the hourly `outbox-sweep` Vercel Schedule sends.                                                                                                       |
| `LOG_LEVEL`                                           | `apps/gateway`, `apps/emails-worker` (optional, defaults to `info`)                                 | pino log level. `debug` adds each RabbitMQ publish and each Resend response. See [Tracing an email](apps/emails-worker/README.md#tracing-an-email).                 |
| `RESEND_API_KEY`, `EMAIL_*`, `APP_URL`                | `apps/emails-worker`                                                                                | Resend key, sender and transport settings, public URL for links. See the [worker README](apps/emails-worker/README.md#environment-variables).                       |

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

- [`code-health.yml`](.github/workflows/code-health.yml) — runs `check-types`, `pnpm lint`, and `pnpm prettier:check` on every PR, and builds the emails worker's Docker image.
- [`preview-deploy.yml`](.github/workflows/preview-deploy.yml) — per PR: creates a Neon branch, runs migrations on it, deploys web + gateway to Vercel with that branch's `DATABASE_URL`, and smoke-tests `/api/health`.
- [`preview-cleanup.yml`](.github/workflows/preview-cleanup.yml) — on PR close: removes the PR's Vercel preview deployments and deletes its Neon branch.
- [`production-deploy.yml`](.github/workflows/production-deploy.yml) — on push to `main`: deploys the emails worker to Render and, in parallel, runs migrations on the production Neon branch, deploys to Vercel without assigning domains and smoke-tests it. Promotion waits for both, so the worker is always live before the gateway that publishes to it.

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
- **The emails worker runs on Render**, not Vercel: a 24/7 RabbitMQ consumer doesn't fit the Hobby plan (Vercel Daemons are beta, production-only, and Hobby's memory quota lasts about 17 days). It's defined in [`render.yaml`](render.yaml) and deployed by the production workflow. RabbitMQ is CloudAMQP's free plan; email goes through Resend from `postroll.video`.
- **An hourly Vercel Schedule** (`schedules` in `vercel.json`) calls web's `/api/internal/outbox-sweep`, which has the gateway re-publish outbox messages that a failed dispatch left behind.

### One-time setup

1. **Vercel project** (root directory = repo root): create and link it with `vercel link`, then in project settings set Node.js to 24.x and Function Region to `fra1` (next to the Neon database).
2. **Vercel env vars** (mark secrets as sensitive):
   - Production: `DATABASE_URL` (Neon production branch, pooled), `JWT_ACCESS_SECRET`, `SESSION_SECRET`.
   - Preview: `JWT_ACCESS_SECRET`, `SESSION_SECRET` (different values from production). `DATABASE_URL` is passed per PR by the workflow.
   - Production + Preview: `ENABLE_EXPERIMENTAL_COREPACK=1`, so Vercel uses the `pnpm` version from `packageManager`.
3. **GitHub**: secret `VERCEL_TOKEN` — create it scoped to just the `postroll` project (Account Tokens → Scope → team → `postroll`); the workflows only use project-level operations; variables `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (from `.vercel/project.json` after linking). Neon keeps using `NEON_API_KEY` / `NEON_PROJECT_ID`, and `DATABASE_URL` for production migrations.
4. **First deploy**: run the _Production Deployment_ workflow manually (`workflow_dispatch`) before opening a PR — a new Vercel project's first deployment always becomes production.
5. **Email pipeline**, in this order. The worker must be running before the gateway publishes: it declares the queues on first start, and a message published before `emails.send` exists is dropped as unroutable.
   1. **Resend**: verify `postroll.video` (SPF, DKIM, and a DMARC record, starting at `p=none`). Create a sending-only API key restricted to that domain, and keep open and click tracking off for transactional mail.
   2. **CloudAMQP**: a RabbitMQ (Little Lemur) instance in an EU region, ideally AWS `eu-central-1`. Copy its `amqps://` URL.
   3. **Render**: connect the GitHub repo and create a Blueprint from `main`, since a Blueprint keeps syncing from the branch it was created on. Enter `AMQP_URL`, `RESEND_API_KEY` and `EMAIL_REPLY_TO`; Render then builds and starts the worker. Create an API key.
   4. **CloudAMQP alarms**, once the worker has created the queues: see the [worker README](apps/emails-worker/README.md#alarms).
   5. **Vercel**: `CRON_SECRET` and `AMQP_URL` as sensitive Production variables, then redeploy production so the gateway picks them up. Nothing messaging-related in Preview.
   6. **GitHub**: secret `RENDER_API_KEY` and variable `RENDER_EMAILS_WORKER_SERVICE_ID` (the worker's `srv-…` id). The production workflow won't promote a deployment until the worker deploy succeeds.

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
| `pnpm mq:start` / `pnpm mq:stop`              | Start / stop the local RabbitMQ container.      |
| `pnpm emails:preview`                         | Preview email templates on `localhost:3030`.    |

See the [database README](packages/database/README.md) for the full script reference.
