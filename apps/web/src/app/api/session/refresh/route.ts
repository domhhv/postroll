import { NextResponse, type NextRequest } from 'next/server';

import { refreshTokens, readRequestMeta } from '#lib/refresh';
import {
  cookieOptions,
  SESSION_COOKIE,
  decryptSession,
  encryptSession,
  SESSION_REFRESH_PATH,
  accessTokenExpiresSoon,
} from '#lib/session-crypto';

export const runtime = 'nodejs';

/**
 * Resolve the `next` param to a same-origin path, so this route can't be used
 * as an open redirect. Anything else (absolute URLs, `//host`, this route
 * itself) falls back to `/`.
 */
function resolveNext(request: NextRequest): URL {
  const fallback = new URL('/', request.url);
  const next = request.nextUrl.searchParams.get('next');

  if (!next?.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback;
  }

  const target = new URL(next, request.url);

  if (target.origin !== request.nextUrl.origin || target.pathname === SESSION_REFRESH_PATH) {
    return fallback;
  }

  return target;
}

/**
 * Rotate the session tokens and redirect back to `next`.
 *
 * The proxy redirects here when the access token is about to expire, because
 * the gateway is only reachable through the `GATEWAY_URL` service binding, which
 * resolves in functions (like this one) but not in the proxy.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.redirect(resolveNext(request), 307);
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = raw ? await decryptSession(raw) : null;

  // Nothing to refresh, or a parallel request already rotated the cookie.
  if (!session || !accessTokenExpiresSoon(session.accessToken)) {
    return response;
  }

  try {
    const next = await refreshTokens(session, readRequestMeta(request.headers));
    const jwe = await encryptSession({
      ...session,
      accessToken: next.accessToken,
      refreshExpiresAt: next.refreshExpiresAt,
      refreshToken: next.refreshToken,
    });
    response.cookies.set(SESSION_COOKIE, jwe, cookieOptions());
  } catch {
    // Refresh failed (e.g. the refresh token was revoked): drop the stale
    // session so the target page renders as logged out.
    response.cookies.delete(SESSION_COOKIE);
  }

  return response;
}
