export async function register() {
  const isNodeSsrRuntime = process.env['NEXT_RUNTIME'] === 'nodejs';
  const isCloudflareWorkerRuntime =
    typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !==
    'undefined';

  if (!isNodeSsrRuntime || isCloudflareWorkerRuntime) {
    return;
  }

  const { loadEnvFile } = await import('@postroll/env');
  const { getServerEnv } = await import('./env');

  loadEnvFile({
    importMetaUrl: import.meta.url,
    relativePath: '../.env',
  });

  getServerEnv();
}
