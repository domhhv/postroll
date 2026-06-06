import { loadEnvFile } from '@postroll/env/load';

import { getServerEnv } from './env';

/**
 * Node-only boot env validation. Imported exclusively from the
 * `NEXT_RUNTIME === 'nodejs'` branch in instrumentation.ts so the edge /
 * Cloudflare build never bundles `@postroll/env/load` and its node: builtins.
 */
export function registerNode(): void {
  loadEnvFile({
    importMetaUrl: import.meta.url,
    relativePath: '../.env',
  });

  getServerEnv();
}
