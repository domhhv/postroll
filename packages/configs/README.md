# `@postroll/configs`

Centralized shared configuration for Postroll. Houses the Biome config and the TypeScript `tsconfig` presets.

## Biome

`biome/biome.json` — the base Biome config. Extend it from a package's local `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.15/schema.json",
  "root": false,
  "extends": ["@postroll/configs/biome"]
}
```

## TypeScript

`typescript/` holds the `tsconfig` presets: `base.json` (strict defaults), `nextjs.json`, `nestjs.json`, `prisma.json`. Extend the matching preset from a package's `tsconfig.json`:

```json
{
  "extends": "@postroll/configs/typescript/base"
}
```

Available presets: `@postroll/configs/typescript/base`, `@postroll/configs/typescript/nextjs`, `@postroll/configs/typescript/nestjs`, `@postroll/configs/typescript/prisma`.
