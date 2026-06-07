# `@postroll/web`

Next.js 16 app deployed to Cloudflare Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Connected to the Cloudflare dashboard's Workers Builds — pushes to `main` deploy production, PR branches deploy previews.

## Scripts

| Script            | Purpose                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`        | `next dev` — local dev (Turbopack).                                                                                                                                 |
| `pnpm build`      | `next build --webpack` — production build. **Uses webpack, not Turbopack** — see "Build engine" below.                                                              |
| `pnpm start`      | `next start` — runs the production build locally on Node.                                                                                                           |
| `pnpm preview`    | `opennextjs-cloudflare build && opennextjs-cloudflare preview` — boots `wrangler dev` against the OpenNext bundle. Closest local equivalent to the deployed worker. |
| `pnpm deploy`     | OpenNext build + Cloudflare deploy. Normally invoked by Workers Builds, not run by hand.                                                                            |
| `pnpm upload`     | OpenNext build + `wrangler upload` — uploads a new version without promoting it.                                                                                    |
| `pnpm cf-typegen` | Regenerate `cloudflare-env.d.ts` types from `wrangler.jsonc`.                                                                                                       |

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

[`src/instrumentation.ts`](src/instrumentation.ts) is Next 16's canonical server boot hook. Its `register()` does exactly one thing:

```ts
if (process.env.NEXT_RUNTIME === 'nodejs') {
  const { registerNode } = await import('./instrumentation-node');
  registerNode();
}
```

The Node-only boot validation lives in [`src/instrumentation-node.ts`](src/instrumentation-node.ts) — it loads `.env.local` / `.env` via [`@postroll/env/load`](../../packages/env/README.md) and calls `getServerEnv()` to fail boot if anything's missing.

**Why the split matters:** `register()` runs in every runtime (Node, edge, build), and `@postroll/env/load` pulls in `node:fs` / `node:url` / `dotenv`. webpack only treats a dynamic `import()` as a per-runtime boundary — and thus keeps it out of the edge bundle — when the `import()` sits _inside_ the `NEXT_RUNTIME === 'nodejs'` check. A top-level import (or an import after an early-`return` guard) gets bundled for the edge build too, which breaks the OpenNext build with "module not found: node:fs". So the Node-only code must be a separate module imported only inside that branch. This is the same reason validation can't happen on Cloudflare via `instrumentation`: there, env values live in `getCloudflareContext().env`, not `process.env`, so call sites that have the Workers context validate instead.

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

## Auth session & token refresh

The gateway issues a short-lived access JWT and a rotating opaque refresh token. The web app wraps both in an encrypted session JWE stored in the `postroll_session` cookie (see [`src/lib/session.ts`](src/lib/session.ts) / [`src/lib/session-crypto.ts`](src/lib/session-crypto.ts)). When the access token expires, the tokens must be refreshed and the cookie rewritten.

The refresh runs in [`src/middleware.ts`](src/middleware.ts), ahead of any render. This is deliberate: **cookies can only be mutated in middleware, Server Actions, or Route Handlers — never during an RSC render.** Since `getUser()` runs while rendering the layout/pages, a refresh triggered there can't persist the rotated cookie (Next throws `Cookies can only be modified in a Server Action or Route Handler`). Middleware decodes the access token's `exp`, refreshes when it's near expiry, and writes the rotated session onto both the request (so the in-flight render sees the fresh token) and the response (so the browser is updated). `updateSession` / `deleteSession` in `session.ts` additionally swallow the read-only-cookie error as a fallback for any refresh that still fires mid-render.

### Why `middleware.ts`, not `proxy.ts`

Next 16 deprecated the `middleware.ts` filename in favour of `proxy.ts` — **you will see a build warning telling you to rename it. Do not.** `proxy` is locked to the Node.js runtime, and OpenNext/Cloudflare does not support Node.js middleware (`opennextjs-cloudflare build` fails with _"Node.js middleware is not currently supported"_). `middleware.ts` runs on the edge runtime, which OpenNext supports. Per Next's own [v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16): _"The edge runtime is NOT supported in `proxy`. If you want to continue using the edge runtime, keep using `middleware`."_ Revisit only once OpenNext ships edge support for `proxy`.

Because the middleware bundles for the edge runtime, **everything in its import graph must be edge-safe** — no `node:` builtins, no `@postroll/env` barrel (it re-exports the Node-only `load` module; import `@postroll/env/format` instead). zod and `getServerEnv()` (which reads `process.env`) are fine on edge.

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
