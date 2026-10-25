import { gatewayUrl } from '#lib/refresh';

export const dynamic = 'force-dynamic';

/**
 * End-to-end health check: web → (service binding) → gateway. The gateway has
 * no public route on Vercel, so this is how CI smoke-tests a deployment.
 */
export async function GET(): Promise<Response> {
  try {
    const res = await fetch(gatewayUrl('/health'), {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return Response.json({ gateway: res.status, status: 'degraded' }, { status: 503 });
    }

    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ gateway: 'unreachable', status: 'degraded' }, { status: 503 });
  }
}
