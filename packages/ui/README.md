# `@postroll/ui`

Shared UI package for the Postroll monorepo. Houses [shadcn/ui](https://ui.shadcn.com) components, Tailwind CSS v4 styles, and the utilities consumed by apps in this workspace.

## Stack

- React 19
- Tailwind CSS v4 (via `@tailwindcss/postcss`)
- shadcn/ui (`base-vega` style, `neutral` base color)
- Radix UI / Base UI primitives
- Tabler icons

## Usage

Add as a workspace dependency:

```jsonc
{
  "dependencies": {
    "@postroll/ui": "workspace:*",
  },
}
```

Import the global stylesheet once at the app root (e.g. `app/layout.tsx`):

```ts
import "@postroll/ui/globals.css";
```

Import components, hooks, and utilities via subpath exports:

```tsx
import { Button } from "@postroll/ui/components/button";
import { cn } from "@postroll/ui/lib/utils";
```

Reuse the PostCSS config in consuming apps:

```js
// postcss.config.mjs
export { default } from "@postroll/ui/postcss.config";
```

## Adding components

shadcn is configured via [`components.json`](./components.json). To add a new component from the monorepo or package root:

```bash
pnpm ui <component> # same as `pnpm --filter @postroll/ui ui <component>`
```

Components are written to `src/components/`, utilities to `src/lib/`, and hooks to `src/hooks/`. Internal references use the `#components/*`, `#lib/*`, and `#hooks/*` import aliases.

## Scripts

- `pnpm --filter @postroll/ui check-types` — type-check with `tsc --noEmit`
- `pnpm --filter @postroll/ui biome:check` — lint/format check
- `pnpm --filter @postroll/ui biome:write` — apply lint/format fixes
