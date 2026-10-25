import { loadEnvFile } from '@postroll/env/load';

import { getSessionEnv } from './env';

/**
 * Node-only boot env validation. Imported exclusively from the
 * `NEXT_RUNTIME === 'nodejs'` branch in instrumentation.ts.
 *
 * Only `SESSION_SECRET` is checked here. `register()` can also run for the
 * proxy, where the Vercel service binding that provides `GATEWAY_URL` does not
 * resolve, so `GATEWAY_URL` is validated on the first gateway call instead
 * (see `getGatewayEnv()`).
 */
export function registerNode(): void {
  loadEnvFile({
    importMetaUrl: import.meta.url,
    relativePath: '../.env',
  });

  getSessionEnv();
}
