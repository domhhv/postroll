export async function register() {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    const { loadEnvFile } = await import('@postroll/env');
    const { getServerEnv } = await import('./env');

    loadEnvFile({
      importMetaUrl: import.meta.url,
      relativePath: '../.env.local',
    });
    loadEnvFile({
      importMetaUrl: import.meta.url,
      relativePath: '../.env',
    });

    getServerEnv();
  }
}
