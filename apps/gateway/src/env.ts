import { formatZodEnvError } from '@postroll/env';
import { z } from 'zod';

export const envExampleHint = 'apps/gateway/.env.example';

export const gatewayEnvSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
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
