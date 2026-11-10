import { optionalEnv, formatZodEnvError } from '@postroll/env';
import { z } from 'zod';

export const envExampleHint = 'apps/emails-worker/.env.example';

export const workerEnvSchema = z
  .object({
    AMQP_URL: z.url(),
    APP_URL: z.url(),
    EMAIL_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
    EMAIL_FROM: z.string().min(1),
    EMAIL_LOG_SIMULATE: optionalEnv(z.enum(['permanent', 'retryable'])),
    EMAIL_REPLY_TO: optionalEnv(z.email()),
    EMAIL_TRANSPORT: z.enum(['log', 'resend']).default('resend'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    RESEND_API_KEY: optionalEnv(z.string().min(1)),
  })
  .refine((env) => env.EMAIL_TRANSPORT !== 'resend' || env.RESEND_API_KEY !== undefined, {
    message: 'Required when EMAIL_TRANSPORT is "resend"',
    path: ['RESEND_API_KEY'],
  });

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function validateWorkerEnv(raw: Record<string, unknown>): WorkerEnv {
  const result = workerEnvSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(
      formatZodEnvError(result.error, {
        contextLabel: '@postroll/emails-worker',
        exampleHint: envExampleHint,
      })
    );
  }

  return result.data;
}
