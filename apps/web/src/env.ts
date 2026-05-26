import { formatZodEnvError } from '@postroll/env';
import { z } from 'zod';

export const envExampleHint = 'apps/web/.env.example';

export const webServerEnvSchema = z.object({
  GATEWAY_URL: z.url(),
  SESSION_SECRET: z.string().min(32),
});

export type WebServerEnv = z.infer<typeof webServerEnvSchema>;

let cached: WebServerEnv | undefined;

export function getServerEnv(
  source: Record<string, unknown> = process.env,
): WebServerEnv {
  if (cached) {
    return cached;
  }

  const result = webServerEnvSchema.safeParse(source);

  if (!result.success) {
    throw new Error(
      formatZodEnvError(result.error, {
        contextLabel: '@postroll/web',
        exampleHint: envExampleHint,
      }),
    );
  }

  cached = result.data;
  return cached;
}
