import { loadEnvFile, validateEnv } from '@postroll/env';
import { PrismaNeon } from '@prisma/adapter-neon';
import { envExampleHint, runtimeEnvSchema } from './env';
import { PrismaClient } from './generated/prisma';

loadEnvFile({ importMetaUrl: import.meta.url, relativePath: '../.env' });

const env = validateEnv(runtimeEnvSchema, {
  contextLabel: '@postroll/database (runtime)',
  exampleHint: envExampleHint,
});

const adapter = new PrismaNeon({
  connectionString: env.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });
