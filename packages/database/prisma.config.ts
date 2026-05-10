import { loadEnvFile } from '@postroll/env';
import { defineConfig, env } from 'prisma/config';

loadEnvFile({ importMetaUrl: import.meta.url });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DIRECT_URL'),
    ...(process.env['SHADOW_DATABASE_URL'] && {
      shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
    }),
  },
});
