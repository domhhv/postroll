# `@postroll/web`

Next.js 16 app deployed to Cloudflare Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Connected to the Cloudflare dashboard's Workers Builds — pushes to `main` deploy production, PR branches deploy previews.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | `next dev` — local dev (Turbopack). |
| `pnpm build` | `next build --webpack` — production build. **Uses webpack, not Turbopack** — see "Build engine" below. |
| `pnpm start` | `next start` — runs the production build locally on Node. |
| `pnpm preview` | `opennextjs-cloudflare build && opennextjs-cloudflare preview` — boots `wrangler dev` against the OpenNext bundle. Closest local equivalent to the deployed worker. |
| `pnpm deploy` | OpenNext build + Cloudflare deploy. Normally invoked by Workers Builds, not run by hand. |
| `pnpm upload` | OpenNext build + `wrangler upload` — uploads a new version without promoting it. |
| `pnpm cf-typegen` | Regenerate `cloudflare-env.d.ts` types from `wrangler.jsonc`. |

## Build engine

Production builds run with `next build --webpack` rather than the Next 16 default of Turbopack. [OpenNext doesn't yet support Turbopack's `standalone` output](https://github.com/opennextjs/opennextjs-cloudflare/issues/569) — `copyTracedFiles` looks for files webpack produces that Turbopack omits. Dev (`next dev`) still uses Turbopack.

## Environment variables

Source of truth: [`src/env.ts`](src/env.ts). Local values: [`.env.example`](.env.example).

### `GATEWAY_URL`

**Required at runtime on the server.** Base URL of the `@postroll/gateway` HTTP API. The web app does not talk to Postgres directly — all DB access goes through the gateway (see "Data access" below). Server-only — never exposed to the browser.

- **Local dev / `next start`**: read from `process.env` (loaded from `.env` / `.env.local` by [`src/instrumentation.ts`](src/instrumentation.ts)). Defaults to `http://localhost:8080` in `.env.example`.
- **Cloudflare Workers**: provided as a runtime variable on the worker. Configure it in the Cloudflare dashboard under Workers & Pages → `postroll` → **Settings → Variables and Secrets** (not the Build → Variables and secrets section — those are scoped to the build container, not the running worker). Or via `pnpm exec wrangler secret put GATEWAY_URL`. Point it at the Fly URL of the matching gateway deployment (production → production gateway; PR preview → that PR's Fly review app).

## How validation is wired

See [`@postroll/env`](../../packages/env/README.md) for the model. [`src/env.ts`](src/env.ts) exports `getServerEnv(source?)` — a memoized validator that parses against `webServerEnvSchema`. Defaults `source` to `process.env`; pass `getCloudflareContext().env` from code that runs inside the Workers runtime.

[`src/instrumentation.ts`](src/instrumentation.ts) is Next 16's canonical server boot hook. It:

1. Returns early if `NEXT_RUNTIME` isn't `nodejs` (skips edge / build phases).
2. Returns early if running inside the Cloudflare Workers runtime (`globalThis.WebSocketPair` is the runtime tell). On Cloudflare, env values aren't in `process.env` — they're in `getCloudflareContext().env` — so validation defers to call sites that have access to that.
3. Otherwise (Node SSR / `next start`), loads `.env.local` then `.env` relative to the project root, then calls `getServerEnv()` to fail boot if anything's missing.

The file lives at `src/instrumentation.ts`, not the project root, because Next.js only discovers it at `<rootDir>/instrumentation.{ts,tsx,...}` where `rootDir` is `src/` when `src/app/` exists. Putting it at the project root works with Turbopack (by accident) but is silently ignored by webpack.

## Data access

The web app does not connect to Postgres. All reads/writes go through the NestJS gateway over HTTP, fetched from server components (or route handlers / server actions, eventually). The data layer lives in [`src/lib/api.ts`](src/lib/api.ts):

```ts
import type { User } from '@postroll/database';
import { getServerEnv } from '@/env';

export async function getUsers(): Promise<User[]> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}/users`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  return res.json();
}
```

`@postroll/database` is depended on **only for its types** — `import type { User }` is erased at compile time, so no Prisma runtime, engine, or `pg` driver ends up in the OpenNext bundle. The package's main entrypoint is intentionally a type-only re-export to make this safe; the live `PrismaClient` lives behind the `@postroll/database/prisma` subpath and is only imported by the gateway.

If gateway response shapes diverge from raw Prisma models (e.g. via `select` / `include`), define the shape on the gateway with `Prisma.UserGetPayload<{...}>` and import that type instead of `User`.

## Running locally

1. Make sure the database is up: `pnpm --filter @postroll/database db:start` (see the [database README](../../packages/database/README.md)).
2. Make sure the gateway is running so the web app has somewhere to fetch from. From the repo root, `pnpm dev` boots both apps together; alternatively run the gateway by itself with `pnpm --filter @postroll/gateway dev`.
3. Copy `.env.example` to `.env` in this directory.
4. `pnpm dev`.

To test the Cloudflare deployment path locally without pushing: `pnpm preview` (runs `wrangler dev` against the OpenNext bundle).

## Deployment

Connected to Cloudflare Workers Builds (configured in the Cloudflare dashboard):

- Build command: `npx turbo run build`
- Deploy command: `pnpm run deploy` (for `main`)
- Version command: `pnpm run upload` (for non-`main` branches → preview URLs)
- Root directory: `/apps/web`

Runtime variables (set in dashboard → Settings → Variables and Secrets, or via `wrangler secret put`):

- `GATEWAY_URL` — required, as documented above.

R2 / bindings live in [`wrangler.jsonc`](wrangler.jsonc).
