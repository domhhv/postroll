# `@postroll/gateway`

NestJS HTTP gateway. Deployed to Fly.io. Production deploys via [`gateway-production-deploy.yml`](../../.github/workflows/gateway-production-deploy.yml) on push to `main`; PR previews via [`gateway-preview-deploy.yml`](../../.github/workflows/gateway-preview-deploy.yml).

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | `nest start --watch` — local dev with hot reload. |
| `pnpm build` | `nest build` — compiles to `dist/`. |
| `pnpm start` | Runs the compiled output via `nest start`. |
| `pnpm start:prod` | `node dist/main` — used inside the Fly container. |
| `pnpm check-types` | `tsc --noEmit`. |
| `pnpm biome:check` / `pnpm biome:write` | Lint / lint-fix. |

## Environment variables

Source of truth: [`src/env.ts`](src/env.ts). Local values: [`.env.example`](.env.example).

Validation runs at NestJS boot via `ConfigModule.forRoot({ validate: validateGatewayEnv })` in [`src/app.module.ts`](src/app.module.ts). If a required var is missing or malformed, the process exits with a friendly Zod error before binding the HTTP listener.

### `DATABASE_URL`

**Required at runtime.** Postgres connection string (Neon, pooled). Used by [`src/database/database.module.ts`](src/database/database.module.ts) to construct a `pg` `Pool`. In production this is set as a Fly secret; in CI previews it's set dynamically from the Neon branch URL created earlier in the workflow.

### `PORT`

**Optional, defaults to `8080`.** Coerced to a positive integer. The Fly container reads it from `fly.toml`'s `internal_port`; locally you can override via `.env`. Read in [`src/main.ts`](src/main.ts) via `ConfigService`.

### `NODE_ENV`

**Optional, defaults to `development`.** Constrained to `development | production | test`. Set to `production` in the Dockerfile. Currently informational — no code paths fork on it yet, but the schema validates it so future use is type-safe.

## How validation is wired

See [`@postroll/env`](../../packages/env/README.md) for the model. The schema in [`src/env.ts`](src/env.ts) defines `gatewayEnvSchema` and a `validateGatewayEnv` function that throws a formatted `Error` on parse failure. NestJS's `ConfigModule` calls this function once at boot and surfaces the error itself.

After validation, env values are accessed via NestJS's `ConfigService`:

```ts
const port = app.get(ConfigService).get<number>('PORT', 8080);
```

`config.getOrThrow<string>('DATABASE_URL')` in `DatabaseModule` is safe because `validateGatewayEnv` already guaranteed presence.

## Running locally

1. Make sure the database is up: `pnpm --filter @postroll/database db:start` (see the [database README](../../packages/database/README.md)).
2. Copy `.env.example` to `.env` in this directory.
3. `pnpm dev`.

## Deployment

- **Production**: pushing to `main` triggers [`gateway-production-deploy.yml`](../../.github/workflows/gateway-production-deploy.yml) which runs `prisma migrate deploy` against the production Neon branch and then `flyctl deploy`.
- **PR preview**: opening or updating a PR triggers [`gateway-preview-deploy.yml`](../../.github/workflows/gateway-preview-deploy.yml) which creates a Neon branch named `preview/<branch-name>`, runs migrations against it, and deploys a Fly review app. The Fly URL is posted as a PR comment.

Secrets configured outside the repo:

- Fly: `DATABASE_URL` (set via `superfly/fly-pr-review-apps` action for previews; via Fly dashboard for production).
- GitHub Actions: `DATABASE_URL`, `DIRECT_URL`, `NEON_API_KEY`, `NEON_PROJECT_ID`, `FLY_API_TOKEN`.
