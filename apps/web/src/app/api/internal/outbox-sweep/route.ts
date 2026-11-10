import { timingSafeEqual } from 'node:crypto';

import { getCronEnv } from '#env';
import { gatewayUrl } from '#lib/refresh';

export const dynamic = 'force-dynamic';

function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? '');

  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Hourly Vercel Schedule (see vercel.json): asks the gateway to re-publish
 * outbox messages that a failed dispatch left behind. This route only checks
 * the scheduler's `CRON_SECRET` and forwards the call through the service
 * binding. Previews have no RabbitMQ, so it does nothing there, before even
 * checking the secret: previews don't set `CRON_SECRET`, and the sweep would
 * only wake their database branches.
 */
export async function POST(request: Request): Promise<Response> {
  if (process.env['VERCEL_ENV'] === 'preview') {
    return new Response(null, { status: 204 });
  }

  if (!isAuthorized(request.headers.get('authorization'), getCronEnv().CRON_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const res = await fetch(gatewayUrl('/internal/outbox/sweep'), {
    cache: 'no-store',
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
  });

  return new Response(res.body, {
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    status: res.status,
  });
}
