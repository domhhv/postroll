import { decodeJwt } from 'jose';
import { type NextRequest, NextResponse } from 'next/server';
import { refreshTokens } from '#lib/refresh';
import {
  cookieOptions,
  decryptSession,
  encryptSession,
  SESSION_COOKIE,
} from '#lib/session-crypto';

/**
 * Refresh the rotating session ahead of any RSC render.
 *
 * Cookie mutation is only legal in middleware, Server Actions, and Route
 * Handlers — never during an RSC render. Since getUser()/getMe() run while
 * rendering the layout and pages, a token refresh triggered there cannot
 * persist the rotated cookie. Doing it here, before render, keeps the session
 * fresh so render-time fetches succeed with a valid access token.
 *
 * This file is intentionally named `middleware.ts` (not the Next 16 `proxy.ts`):
 * middleware runs on the edge runtime, which OpenNext/Cloudflare supports,
 * whereas `proxy.ts` is nodejs-only and OpenNext rejects it. Everything
 * imported here must be edge-safe — no node: builtins, no Node-only deps.
 */

/** Refresh when the access token expires within this window (seconds). */
const REFRESH_SKEW_SECONDS = 30;

function accessTokenExpiresSoon(accessToken: string): boolean {
  try {
    const { exp } = decodeJwt(accessToken);

    if (typeof exp !== 'number') {
      return true;
    }

    return exp - REFRESH_SKEW_SECONDS <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return NextResponse.next();
  }

  const session = await decryptSession(raw);

  if (!session || !accessTokenExpiresSoon(session.accessToken)) {
    return NextResponse.next();
  }

  try {
    const next = await refreshTokens(session);
    const jwe = await encryptSession({
      ...session,
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      refreshExpiresAt: next.refreshExpiresAt,
    });

    /**
     * Update the request cookie so the downstream render in *this* request
     * already sees the rotated session, then mirror it onto the response so
     * the browser is updated too.
     */
    request.cookies.set(SESSION_COOKIE, jwe);
    const response = NextResponse.next({ request });
    response.cookies.set(SESSION_COOKIE, jwe, cookieOptions());

    return response;
  } catch {
    /**
     * Refresh failed (e.g. the refresh token was revoked). Clear the stale
     * session so downstream render treats the user as logged out.
     */
    request.cookies.delete(SESSION_COOKIE);
    const response = NextResponse.next({ request });
    response.cookies.delete(SESSION_COOKIE);

    return response;
  }
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/account/:path*'],
};
