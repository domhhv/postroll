import { z } from 'zod';

export const envExampleHint = 'packages/database/.env.example';

export const dockerEnvSchema = z.object({
  NEON_API_KEY: z.string().min(1),
  NEON_PROJECT_ID: z.string().min(1),
  PARENT_BRANCH_ID: z.string().min(1),
});

export const migrationEnvSchema = z.object({
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),
  SHADOW_DATABASE_URL: z.url().optional(),
});

export const runtimeEnvSchema = z.object({
  DATABASE_URL: z.url(),
});
