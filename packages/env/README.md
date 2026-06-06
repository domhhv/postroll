# `@postroll/env`

Shared env-variable validation utilities for the monorepo. Wraps [Zod](https://zod.dev/) and [dotenv](https://github.com/motdotla/dotenv) to give every app and package a consistent way to load `.env` files and fail fast with friendly errors when required variables are missing or malformed.

## Why this exists

Env variables surface in three different contexts across this repo:

1. **Shell-time gating** — scripts like `pnpm db:start` need to fail before invoking external processes (Docker, Prisma) when their env contract isn't met.
2. **Node runtime boot** — the NestJS gateway and Next.js server need validation to happen at boot, before any request handler runs.
3. **Library code** — `packages/database` reads `DATABASE_URL` at module load when consumers import the Prisma client.

Each context needs the same primitives (load a `.env` file, parse a Zod schema, format Zod errors), so they live here.

## API

### `validateEnv(schema, options?)`

Parses `process.env` (or a custom source) against a Zod schema. On failure, prints a formatted message to stderr and `process.exit(1)`. On success, returns the parsed object.

```ts
import { validateEnv, z } from '@postroll/env';

const env = validateEnv(z.object({ DATABASE_URL: z.url() }), {
  contextLabel: '@postroll/database (runtime)',
  exampleHint: 'packages/database/.env.example',
  importMetaUrl: import.meta.url,
  envFileRelativePath: '../.env',
});
```

Options:

- `source` — defaults to `process.env`. Pass `getCloudflareContext().env` for Cloudflare Workers code.
- `contextLabel` — prefix in error header, e.g. `Invalid environment for <contextLabel>:`.
- `exampleHint` — printed in the error footer; should be a repo-relative path to the package's `.env.example`.
- `importMetaUrl` — if set, calls `loadEnvFile` before parsing so the file gets loaded relative to the package.
- `envFileRelativePath` — relative path from `importMetaUrl` to the `.env` file. Defaults to `.env`.

### `loadEnvFile({ importMetaUrl, relativePath? })`

Resolves a `.env` file relative to a module via `import.meta.url` (not `cwd`), then loads it with `dotenv.config({ override: false })`. Silently no-ops if the file doesn't exist — important for production runtimes (Cloudflare Workers, Fly containers) where `.env` files aren't shipped.

```ts
import { loadEnvFile } from '@postroll/env';

loadEnvFile({ importMetaUrl: import.meta.url });
loadEnvFile({ importMetaUrl: import.meta.url, relativePath: '../.env.local' });
```

`override: false` means values already set in `process.env` (e.g. by CI, Cloudflare secrets, Fly env) take precedence over the `.env` file.

### `formatZodEnvError(error, options?)`

Turns a `ZodError` into a multi-line string with a header, one bullet per issue (`VAR — message`), and an optional footer pointing at the `.env.example`. Used internally by `validateEnv`; exported for consumers that need to throw instead of exit (e.g. the gateway's `validateGatewayEnv` lets NestJS surface the error itself).

### `postroll-check-env` CLI

A bin script for shell-time gating. Invoked from `pre*` script chains in `package.json`. Self-contained (doesn't depend on the package's built `dist/`), so it can run during CI before any workspace build step.

```bash
postroll-check-env <module-spec> <export-name>
```

The module is dynamic-imported relative to `process.cwd()`. The named export must be a Zod schema. The script also reads optional named exports for context:

- `envExampleHint` — repo-relative path to the example file
- `envContextLabel` — label for the error header
- `envFileRelativePath` — `.env` path relative to the schema module (default `../.env`)

Example, from `packages/database/package.json:9`:

```json
"db:migrate": "postroll-check-env ./src/env.ts migrationEnvSchema && prisma migrate dev"
```

## Integration patterns used in this monorepo

| Pattern                                                              | Where                                                                      | Why                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI guard in script chain (`postroll-check-env … && actual-command`) | [`packages/database/package.json`](../database/package.json)               | Per-script gating: `db:start` needs Neon vars, `db:migrate` needs `DIRECT_URL` — same package, different env contract per script. pnpm v7+ disables `pre*` hooks by default, so inline `&&` is more explicit. |
| `ConfigModule.forRoot({ validate })`                                 | [`apps/gateway/src/app.module.ts`](../../apps/gateway/src/app.module.ts)   | NestJS calls the `validate` hook once at boot, before any provider is instantiated. The gateway never starts with a bad config.                                                                               |
| Next.js `instrumentation.ts` hook                                    | [`apps/web/src/instrumentation.ts`](../../apps/web/src/instrumentation.ts) | Runs once per server boot in the Node runtime. Skipped on Cloudflare Workers — there the env source is `getCloudflareContext().env`, not `process.env`, so validation defers to call sites.                   |
| Module-load validation                                               | [`packages/database/src/client.ts`](../database/src/client.ts)             | Validates `DATABASE_URL` when the Prisma client is first imported.                                                                                                                                            |

## How `.env` resolution works

`loadEnvFile` resolves paths via `import.meta.url`, not `cwd`. This fixes a class of bugs where a script run from the repo root vs. the package directory would look at different `.env` files (or none at all). The `postroll-check-env` CLI uses the same primitive: env-file paths are anchored to the schema module, so `pnpm --filter @postroll/database db:start` works identically whether invoked from anywhere in the repo.

For Cloudflare Workers and Fly containers, no `.env` file ships with the deployment — `loadEnvFile` no-ops, and the validator reads from `process.env` (Fly) or the explicitly-passed source (Cloudflare bindings via `getCloudflareContext().env`).

## When to add a new schema

When you find yourself reaching for `process.env.X` in a new package or app:

1. Add an `env.ts` next to the consumer code that exports a Zod schema (plus `envExampleHint` and optionally `envContextLabel`).
2. Pick the right integration pattern from the table above.
3. Add the variable to the package's `.env.example` with a one-line comment if its purpose isn't obvious.
4. If the variable affects build output or runtime behavior, add it to `globalEnv` in the root [`turbo.json`](../../turbo.json) so Turbo's cache hash invalidates when its value changes.
