# `@postroll/gateway`

NestJS HTTP gateway. Deployed to Vercel as the **internal** `gateway` service of the monorepo's Vercel project (see the [root README](../../README.md#deployment)): it has no public route and is only reachable from the `web` service through the `GATEWAY_URL` service binding. Production deploys via [`production-deploy.yml`](../../.github/workflows/production-deploy.yml) on push to `main`; PR previews via [`preview-deploy.yml`](../../.github/workflows/preview-deploy.yml).

## Scripts

| Script                                           | Purpose                                           |
| ------------------------------------------------ | ------------------------------------------------- |
| `pnpm dev`                                       | `nest start --watch` — local dev with hot reload. |
| `pnpm build`                                     | `nest build` — compiles to `dist/`.               |
| `pnpm start`                                     | Runs the compiled output via `nest start`.        |
| `pnpm start:prod`                                | `node dist/main` — runs the production build.     |
| `pnpm check-types`                               | `tsc --noEmit`.                                   |
| `pnpm --filter @postroll/gateway lint`           | lint check                                        |
| `pnpm --filter @postroll/gateway lint:fix`       | lint check with auto-fix                          |
| `pnpm --filter @postroll/gateway prettier:check` | check formatting                                  |
| `pnpm --filter @postroll/gateway prettier:write` | apply formatting fixes                            |

## Environment variables

Source of truth: [`src/env.ts`](src/env.ts). Local values: [`.env.example`](.env.example).

Validation runs at NestJS boot via `ConfigModule.forRoot({ validate: validateGatewayEnv })` in [`src/app.module.ts`](src/app.module.ts). If a required var is missing or malformed, the process exits with a friendly Zod error before binding the HTTP listener.

### `DATABASE_URL`

**Required at runtime.** Postgres connection string. Used by [`src/database/database.module.ts`](src/database/database.module.ts) to construct a `PrismaClient` with the appropriate driver adapter: [`@prisma/adapter-neon`](https://www.npmjs.com/package/@prisma/adapter-neon) for Neon URLs (`*.neon.tech`), [`@prisma/adapter-pg`](https://www.npmjs.com/package/@prisma/adapter-pg) for everything else. The check is on the URL host, not `NODE_ENV` — preview deploys point at Neon branches but run under `NODE_ENV=production`, and local Docker Postgres runs under `NODE_ENV=development`. In production it's a sensitive Vercel env var (Production environment); for PR previews the workflow passes the PR's Neon branch URL with `vercel deploy --env DATABASE_URL=…`.

### `PORT`

**Optional, defaults to `8080`.** Coerced to a positive integer. Only matters locally (override via `.env`); on Vercel the NestJS app runs as a Vercel Function and `listen()` is handled by the runtime. Read in [`src/main.ts`](src/main.ts) via `ConfigService`.

### `NODE_ENV`

**Optional, defaults to `development`.** Constrained to `development | production | test`. Vercel sets it to `production` at runtime. In production the logger writes plain JSON instead of using the `pino-pretty` transport (see [`src/app.module.ts`](src/app.module.ts)).

## How validation is wired

See [`@postroll/env`](../../packages/env/README.md) for the model. The schema in [`src/env.ts`](src/env.ts) defines `gatewayEnvSchema` and a `validateGatewayEnv` function that throws a formatted `Error` on parse failure. NestJS's `ConfigModule` calls this function once at boot and surfaces the error itself.

After validation, env values are accessed via NestJS's `ConfigService`:

```ts
const port = app.get(ConfigService).get<number>('PORT', 8080);
```

`config.getOrThrow<string>('DATABASE_URL')` in `DatabaseModule` is safe because `validateGatewayEnv` already guaranteed presence.

## Database access

The gateway is the only process in the monorepo that talks to Postgres directly. The Prisma client is provided by [`@postroll/database`](../../packages/database/README.md) (via the `@postroll/database/prisma` subpath, which exposes the generated client without the package-level `prisma` singleton — Nest owns the lifecycle here). [`DatabaseModule`](src/database/database.module.ts) registers the client under a `PRISMA_CLIENT` symbol token and exports an `InjectPrisma()` decorator for consumers:

```ts
import { InjectPrisma } from '../database/database.module';
import type { PrismaClient } from '@postroll/database/prisma';

@Injectable()
export class UsersService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}
}
```

A symbol token (rather than the `PrismaClient` class as token) decouples DI from Prisma's generated export shape, which is a runtime factory rather than a stable class reference. `DatabaseModule` is `@Global()`, so importing it once in [`AppModule`](src/app.module.ts) makes `InjectPrisma()` available everywhere.

## Running locally

1. Make sure the database is up: `pnpm --filter @postroll/database db:start` (see the [database README](../../packages/database/README.md)).
2. Copy `.env.example` to `.env` in this directory.
3. `pnpm dev`.

## Deployment

The `gateway` service is defined in the root [`vercel.json`](../../vercel.json) with `framework: "nestjs"`. Its build command only builds the gateway's workspace dependencies (`@postroll/env`, `@postroll/contracts`, and the Prisma client via `db:generate`) and removes any `dist/`; Vercel then bundles [`src/main.ts`](src/main.ts) itself into a single Vercel Function, using this package's `tsconfig.json` (including `emitDecoratorMetadata`). `pnpm build` / `dist/` are for local use only — a prebuilt `dist/` breaks module resolution in Vercel's monorepo function layout (see CLAUDE.md, "Deployment").

Auth guards are plain Nest guards in [`src/auth/guards/`](src/auth/guards): `JwtAuthGuard` verifies the bearer access token with `@nestjs/jwt` (registered globally in `AuthModule`), and `LocalAuthGuard` checks email/password via `AuthService.validateUser`. Both set `req.user`.

- **Production**: pushing to `main` triggers [`production-deploy.yml`](../../.github/workflows/production-deploy.yml), which runs `prisma migrate deploy` against the production Neon branch, deploys web + gateway to Vercel without assigning domains, smoke-tests `/api/health` (web → gateway → database), then promotes the deployment.
- **PR preview**: opening or updating a PR triggers [`preview-deploy.yml`](../../.github/workflows/preview-deploy.yml), which creates a Neon branch named `preview/<branch-name>`, runs migrations against it, and deploys web + gateway to Vercel with that branch's pooled `DATABASE_URL`. The preview URL is posted as a PR comment.

Because the gateway is internal, Vercel's Firewall and Deployment Protection don't apply to it, and `x-postroll-client-ip` can only come from the web app.

Configuration outside the repo:

- Vercel env vars: `DATABASE_URL` (Production only), `JWT_ACCESS_SECRET` (Production and Preview, different values). `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS` and `COOKIE_SECURE` fall back to their defaults.
- GitHub Actions secrets: `DATABASE_URL` (production migrations), `DIRECT_URL`, `NEON_API_KEY`, `VERCEL_TOKEN`.
- GitHub Actions variables: `NEON_PROJECT_ID`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
