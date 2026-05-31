import { refreshResponseSchema } from '@postroll/contracts';
import { parse as parseSetCookies } from 'set-cookie-parser';
import { getServerEnv } from '@/env';
import type { SessionPayload } from './session-crypto';

export const GATEWAY_REFRESH_COOKIE = 'postroll_rt';

/** Header the gateway reads to recover the real client IP behind our proxy. */
export const CLIENT_IP_HEADER = 'x-postroll-client-ip';

/** Per-request client metadata forwarded to the gateway on auth calls. */
export type RequestMeta = {
  userAgent?: string | undefined;
  ip?: string | undefined;
};

/**
 * Extract the originating client's user-agent and IP from an incoming request's
 * headers. On Cloudflare the true client IP is in `cf-connecting-ip`; we fall
 * back to the first hop of `x-forwarded-for` otherwise.
 */
export function readRequestMeta(headers: Headers): RequestMeta {
  const ip =
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    undefined;

  return {
    userAgent: headers.get('user-agent') ?? undefined,
    ip: ip || undefined,
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
    message: string,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

type RefreshCookie = { value: string; expiresAt: string };

export type RefreshResult = {
  refreshToken: string;
  accessToken: string;
  refreshExpiresAt: string;
};

export function parseRefreshCookie(setCookies: string[]): RefreshCookie {
  const cookie = parseSetCookies(setCookies).find(
    (c) => c.name === GATEWAY_REFRESH_COOKIE,
  );

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

  return { value: cookie.value, expiresAt };
}

export async function refreshTokens(
  session: SessionPayload,
  meta: RequestMeta = {},
): Promise<RefreshResult> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}/auth/refresh`, {
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
    refreshToken: cookie.value,
    refreshExpiresAt: cookie.expiresAt,
  };
}
