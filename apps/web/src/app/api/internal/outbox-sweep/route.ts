import { timingSafeEqual } from 'node:crypto';

import { getCronEnv } from '#env';
import { log } from '#lib/log';
import { gatewayUrl } from '#lib/refresh';

export const dynamic = 'force-dynamic';

function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? '');

  return received.length === expected.length && timingSafeEqual(received, expected);
}

function parseBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return body.slice(0, 500);
  }
}

/**
 * Hourly Vercel Schedule (see vercel.json): asks the gateway to re-publish
 * outbox messages that a failed dispatch left behind. This route only checks
 * the scheduler's `CRON_SECRET` and forwards the call through the service
 * binding. Previews have no RabbitMQ, so it does nothing there, before even
 * checking the secret: previews don't set `CRON_SECRET`, and the sweep would
 * only wake their database branches. Logs carry the schedule's execution id.
 */
export async function POST(request: Request): Promise<Response> {
  const run = {
    executionId: request.headers.get('ce-id'),
    schedule: request.headers.get('ce-vssschedulename'),
    scheduledAt: request.headers.get('ce-vssscheduledat'),
  };

  if (process.env['VERCEL_ENV'] === 'preview') {
    log.info('Outbox sweep skipped on a preview deployment', run);

    return new Response(null, { status: 204 });
  }

  if (!isAuthorized(request.headers.get('authorization'), getCronEnv().CRON_SECRET)) {
    log.warn('Outbox sweep rejected: missing or wrong CRON_SECRET', {
      ...run,
      hasAuthorization: request.headers.has('authorization'),
    });

    return new Response('Unauthorized', { status: 401 });
  }

  const started = Date.now();
  log.info('Outbox sweep requested', run);

  try {
    const res = await fetch(gatewayUrl('/internal/outbox/sweep'), {
      cache: 'no-store',
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
    });
    const body = await res.text();
    const fields = { ...run, durationMs: Date.now() - started, gatewayStatus: res.status, result: parseBody(body) };

    if (res.ok) {
      log.info('Outbox sweep finished', fields);
    } else {
      log.error('Outbox sweep failed in the gateway', fields);
    }

    return new Response(body, {
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
      status: res.status,
    });
  } catch (error) {
    log.error('Outbox sweep could not reach the gateway', { ...run, durationMs: Date.now() - started, err: error });

    return Response.json({ message: 'Gateway unreachable', statusCode: 502 }, { status: 502 });
  }
}
