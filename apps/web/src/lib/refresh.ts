import { refreshResponseSchema } from '@postroll/contracts';
import { parse as parseSetCookies } from 'set-cookie-parser';
import { getServerEnv } from '@/env';
import type { SessionPayload } from './session-crypto';

export const GATEWAY_REFRESH_COOKIE = 'postroll_rt';

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
): Promise<RefreshResult> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}/auth/refresh`, {
    method: 'POST',
    headers: { cookie: `${GATEWAY_REFRESH_COOKIE}=${session.refreshToken}` },
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
