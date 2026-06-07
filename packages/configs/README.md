# `@postroll/configs`

Centralized shared configuration for Postroll. Houses the ESLint and Prettier configs and the TypeScript `tsconfig` presets.

## ESLint

`eslint/eslint.config.mjs` — the universal ESLint config. Export it from a package's local `eslint.config.mjs`:

```js
import eslintConfig from '@postroll/configs/eslint';

/** @type {import("eslint").Linter.Config} */
export default eslintConfig;
```

## Prettier

`prettier/prettier.config.mjs` — the universal Prettier config. Export it from a package's local `prettier.config.mjs`:

```js
import config from '@postroll/configs/prettier';

/** @type {import("prettier").Config} */
export default config;
```

## TypeScript

`typescript/` holds the `tsconfig` presets: `base.json` (strict defaults), `nextjs.json`, `nestjs.json`, `prisma.json`. Extend the matching preset from a package's `tsconfig.json`:

```json
{
  "extends": "@postroll/configs/typescript/base"
}
```

Available presets: `@postroll/configs/typescript/base`, `@postroll/configs/typescript/nextjs`, `@postroll/configs/typescript/nestjs`, `@postroll/configs/typescript/prisma`.
