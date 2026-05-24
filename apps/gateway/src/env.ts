import { formatZodEnvError } from '@postroll/env';
import { z } from 'zod';

export const envExampleHint = 'apps/gateway/.env.example';

export const gatewayEnvSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z.stringbool().default(true),
});

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

export function validateGatewayEnv(raw: Record<string, unknown>): GatewayEnv {
  const result = gatewayEnvSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      formatZodEnvError(result.error, {
        contextLabel: '@postroll/gateway',
        exampleHint: envExampleHint,
      }),
    );
  }

  return result.data;
}
