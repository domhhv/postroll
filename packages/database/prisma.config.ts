import { loadEnvFile } from '@postroll/env';
import { env, defineConfig } from 'prisma/config';

loadEnvFile({ importMetaUrl: import.meta.url });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    ...(process.env['DIRECT_URL'] && { url: env('DIRECT_URL') }),
    ...(process.env['SHADOW_DATABASE_URL'] && {
      shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
    }),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
