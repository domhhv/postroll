import { formatZodEnvError } from '@postroll/env/format';
import { z } from 'zod';

export const envExampleHint = 'apps/web/.env.example';

/**
 * Split in two because the values come from different places on Vercel:
 * `SESSION_SECRET` is a project env var (available everywhere, including the
 * proxy), while `GATEWAY_URL` is injected by the `web` → `gateway` service
 * binding, which only resolves inside functions, never in the proxy.
 */
export const sessionEnvSchema = z.object({
  SESSION_SECRET: z.string().min(32),
});

export const gatewayEnvSchema = z.object({
  GATEWAY_URL: z.url(),
});

export type SessionEnv = z.infer<typeof sessionEnvSchema>;
export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

function parseEnv<T extends z.ZodType>(schema: T, source: Record<string, unknown>): z.infer<T> {
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new Error(
      formatZodEnvError(result.error, {
        contextLabel: '@postroll/web',
        exampleHint: envExampleHint,
      })
    );
  }

  return result.data;
}

let cachedSession: SessionEnv | undefined;
let cachedGateway: GatewayEnv | undefined;

/** Safe to call from the proxy. */
export function getSessionEnv(source: Record<string, unknown> = process.env): SessionEnv {
  cachedSession ??= parseEnv(sessionEnvSchema, source);

  return cachedSession;
}

/** Functions only (Server Components, Server Actions, Route Handlers) — never the proxy. */
export function getGatewayEnv(source: Record<string, unknown> = process.env): GatewayEnv {
  cachedGateway ??= parseEnv(gatewayEnvSchema, source);

  return cachedGateway;
}
