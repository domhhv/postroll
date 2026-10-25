import { refreshResponseSchema } from '@postroll/contracts';
import { parse as parseSetCookies } from 'set-cookie-parser';

import { getGatewayEnv } from '#env';

import type { SessionPayload } from './session-crypto';

export const GATEWAY_REFRESH_COOKIE = 'postroll_rt';

/** Header the gateway reads to recover the real client IP behind our proxy. */
export const CLIENT_IP_HEADER = 'x-postroll-client-ip';

/** Per-request client metadata forwarded to the gateway on auth calls. */
export type RequestMeta = {
  ip?: string | undefined;
  userAgent?: string | undefined;
};

/**
 * Build an absolute gateway URL for `path`.
 *
 * On Vercel, `GATEWAY_URL` is injected by the `web` → `gateway` service binding
 * as a URL base, so resolve paths relative to it (with a guaranteed trailing
 * slash) instead of concatenating strings. Locally it's `http://localhost:8080`.
 */
export function gatewayUrl(path: string): URL {
  const { GATEWAY_URL } = getGatewayEnv();
  const base = GATEWAY_URL.endsWith('/') ? GATEWAY_URL : `${GATEWAY_URL}/`;

  return new URL(path.replace(/^\/+/, ''), base);
}

/**
 * Extract the originating client's user-agent and IP from an incoming request's
 * headers. Vercel sets `x-real-ip` to the client IP; fall back to the first hop
 * of `x-forwarded-for` elsewhere (e.g. local dev behind a proxy).
 */
export function readRequestMeta(headers: Headers): RequestMeta {
  const ip = headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;

  return {
    ip: ip || undefined,
    userAgent: headers.get('user-agent') ?? undefined,
  };
}

/** Build the forwarding headers for a given request meta. */
function metaHeaders(meta: RequestMeta = {}): Record<string, string> {
  const headers: Record<string, string> = {};

  if (meta.userAgent) {
    headers['user-agent'] = meta.userAgent;
  }

  if (meta.ip) {
    headers[CLIENT_IP_HEADER] = meta.ip;
  }

  return headers;
}

export class GatewayError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

type RefreshCookie = { expiresAt: string; value: string };

export type RefreshResult = {
  accessToken: string;
  refreshExpiresAt: string;
  refreshToken: string;
};

export function parseRefreshCookie(setCookies: string[]): RefreshCookie {
  const cookie = parseSetCookies(setCookies).find((c) => {
    return c.name === GATEWAY_REFRESH_COOKIE;
  });

  if (!cookie) {
    throw new GatewayError(502, 'Gateway did not return a refresh cookie.');
  }

  const expiresAt =
    cookie.maxAge !== undefined
      ? new Date(Date.now() + cookie.maxAge * 1000).toISOString()
      : cookie.expires?.toISOString();

  if (!expiresAt) {
    throw new GatewayError(502, 'Gateway refresh cookie is missing an expiry.');
  }

  return { expiresAt, value: cookie.value };
}

export async function refreshTokens(session: SessionPayload, meta: RequestMeta = {}): Promise<RefreshResult> {
  const res = await fetch(gatewayUrl('/auth/refresh'), {
    method: 'POST',
    headers: {
      cookie: `${GATEWAY_REFRESH_COOKIE}=${session.refreshToken}`,
      ...metaHeaders(meta),
    },
  });

  if (!res.ok) {
    throw new GatewayError(res.status, `refresh failed (${res.status})`);
  }

  const body = refreshResponseSchema.parse(await res.json());
  const cookie = parseRefreshCookie(res.headers.getSetCookie());

  return {
    accessToken: body.accessToken,
    refreshExpiresAt: cookie.expiresAt,
    refreshToken: cookie.value,
  };
}
