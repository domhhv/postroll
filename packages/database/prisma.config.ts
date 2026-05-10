import { loadEnvFile, validateEnv } from '@postroll/env';
import { defineConfig } from 'prisma/config';
import { envExampleHint, migrationEnvSchema } from './src/env';

loadEnvFile({ importMetaUrl: import.meta.url });

const env = validateEnv(migrationEnvSchema, {
  contextLabel: '@postroll/database (migrations)',
  exampleHint: envExampleHint,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env.DIRECT_URL,
    ...(env.SHADOW_DATABASE_URL && {
      shadowDatabaseUrl: env.SHADOW_DATABASE_URL,
    }),
  },
});
