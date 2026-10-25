# `@postroll/web`

Next.js 16 app. Deployed to Vercel as the public `web` service of the monorepo's Vercel project (see the [root README](../../README.md#deployment)), alongside the internal `gateway` service.

## Scripts

| Script       | Purpose                                                   |
| ------------ | --------------------------------------------------------- |
| `pnpm dev`   | `next dev` — local dev (Turbopack).                       |
| `pnpm build` | `next build` — production build (Turbopack).              |
| `pnpm start` | `next start` — runs the production build locally on Node. |

## Environment variables

Source of truth: [`src/env.ts`](src/env.ts). Local values: [`.env.example`](.env.example).

### `GATEWAY_URL`

**Required at runtime on the server.** Base URL of the `@postroll/gateway` HTTP API. The web app does not talk to Postgres directly — all DB access goes through the gateway (see "Data access" below). Server-only — never exposed to the browser.

- **Local dev / `next start`**: read from `process.env` (loaded from `.env` / `.env.local` by [`src/instrumentation.ts`](src/instrumentation.ts)). Defaults to `http://localhost:8080` in `.env.example`.
- **Vercel**: injected at runtime by the `web` → `gateway` [service binding](https://vercel.com/docs/services/bindings) declared in the root [`vercel.json`](../../vercel.json). It's deployment-aware (a preview reaches its own gateway). **Don't create it as a Vercel env var** — a user-defined value overrides the binding.
- **Only available in functions** (Server Components, Server Actions, Route Handlers). Bindings don't resolve during builds or in the proxy, which is why it's validated lazily by `getGatewayEnv()` instead of at boot, and why the proxy never calls the gateway (see "Auth session & token refresh").
- Build gateway URLs with `gatewayUrl(path)` from [`src/lib/refresh.ts`](src/lib/refresh.ts): it resolves `path` against the binding's URL base instead of concatenating strings.

### `SESSION_SECRET`

**Required at runtime.** 32+ characters; encrypts the `postroll_session` cookie. Set as a sensitive Vercel env var (different values for Production and Preview). Read through `getSessionEnv()`, which is safe to call from the proxy.

## How validation is wired

See [`@postroll/env`](../../packages/env/README.md) for the model. [`src/env.ts`](src/env.ts) exports two memoized validators that read `process.env` by default:

- `getSessionEnv()` — `SESSION_SECRET`. Safe everywhere, including the proxy.
- `getGatewayEnv()` — `GATEWAY_URL`. Functions only; on Vercel the value comes from the service binding.

[`src/instrumentation.ts`](src/instrumentation.ts) is Next 16's canonical server boot hook. Its `register()` does exactly one thing:

```ts
if (process.env.NEXT_RUNTIME === 'nodejs') {
  const { registerNode } = await import('./instrumentation-node');
  registerNode();
}
```

The Node-only boot validation lives in [`src/instrumentation-node.ts`](src/instrumentation-node.ts) — it loads `.env.local` / `.env` via [`@postroll/env/load`](../../packages/env/README.md) and calls `getSessionEnv()` to fail boot if `SESSION_SECRET` is missing. It deliberately doesn't check `GATEWAY_URL`: `register()` can also run for the proxy, where the Vercel binding doesn't resolve.

**Why the split:** `@postroll/env/load` pulls in `node:fs` / `node:url` / `dotenv`. Keeping it in a separate module that's dynamically imported _inside_ the `NEXT_RUNTIME === 'nodejs'` check is Next's documented pattern for keeping Node-only code out of any edge bundle.

The file lives at `src/instrumentation.ts`, not the project root, because Next.js only discovers it at `<rootDir>/instrumentation.{ts,tsx,...}` where `rootDir` is `src/` when `src/app/` exists.

## Data access

The web app does not connect to Postgres. All reads/writes go through the NestJS gateway over HTTP, fetched from server components (or route handlers / server actions, eventually). The data layer lives in [`src/lib/api.ts`](src/lib/api.ts):

```ts
import type { User } from '@postroll/database';
import { gatewayUrl } from '#lib/refresh';

export async function getUsers(): Promise<User[]> {
  const res = await fetch(gatewayUrl('/users'), { cache: 'no-store' });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  return res.json();
}
```

`@postroll/database` is depended on **only for its types** — `import type { User }` is erased at compile time, so no Prisma runtime, engine, or `pg` driver ends up in the web server bundle. The package's main entrypoint is intentionally a type-only re-export to make this safe; the live `PrismaClient` lives behind the `@postroll/database/prisma` subpath and is only imported by the gateway.

If gateway response shapes diverge from raw Prisma models (e.g. via `select` / `include`), define the shape on the gateway with `Prisma.UserGetPayload<{...}>` and import that type instead of `User`.

## Auth session & token refresh

The gateway issues a short-lived access JWT and a rotating opaque refresh token. The web app wraps both in an encrypted session JWE stored in the `postroll_session` cookie (see [`src/lib/session.ts`](src/lib/session.ts) / [`src/lib/session-crypto.ts`](src/lib/session-crypto.ts)). When the access token expires, the tokens must be refreshed and the cookie rewritten.

**Cookies can only be mutated in the proxy, Server Actions, or Route Handlers — never during an RSC render.** Since `getUser()` runs while rendering the layout/pages, a refresh triggered there can't persist the rotated cookie (Next throws `Cookies can only be modified in a Server Action or Route Handler`). So the refresh has to happen _before_ render.

It can't happen in the proxy itself, though: on Vercel the gateway is only reachable through the `GATEWAY_URL` service binding, and **bindings don't resolve in the proxy** (only in functions). The flow is therefore:

1. [`src/proxy.ts`](src/proxy.ts) (runs before render, no network calls) decodes the access token's `exp`. If it expires within 30 s and the request is a GET/HEAD, it 307-redirects to `/api/session/refresh?next=<original path + query>`.
2. [`src/app/api/session/refresh/route.ts`](src/app/api/session/refresh/route.ts) (a function, so the binding works) rotates the tokens via the gateway, writes the new session cookie on its response, and 307-redirects back to `next`. If the cookie is already fresh (another request refreshed first) it just redirects. If the refresh fails it deletes the cookie, so the page renders logged out. `next` is restricted to same-origin paths.
3. Server Actions (POST) aren't bounced: they can write cookies themselves, so `gatewayFetch`'s 401 → refresh → retry path persists the rotation there.

`updateSession` / `deleteSession` in `session.ts` additionally swallow the read-only-cookie error as a fallback for any refresh that still fires mid-render. Concurrent refreshes with the same token are absorbed by the gateway's 10-second rotation grace window.

**Rule: the proxy must never call the gateway.** Keep its import graph to `#lib/session-crypto` (and other code that doesn't need `GATEWAY_URL`).

## Running locally

1. Make sure the database is up: `pnpm --filter @postroll/database db:start` (see the [database README](../../packages/database/README.md)).
2. Make sure the gateway is running so the web app has somewhere to fetch from. From the repo root, `pnpm dev` boots both apps together; alternatively run the gateway by itself with `pnpm --filter @postroll/gateway dev`.
3. Copy `.env.example` to `.env` in this directory.
4. `pnpm dev`.

## Deployment

Deployed by GitHub Actions together with the gateway as one Vercel deployment — see the [root README](../../README.md#deployment). The `web` service config (framework, build command, `GATEWAY_URL` binding) lives in the root [`vercel.json`](../../vercel.json).

[`src/app/api/health/route.ts`](src/app/api/health/route.ts) checks web → gateway → database end to end; the deploy workflows smoke-test it with `vercel curl /api/health`.
