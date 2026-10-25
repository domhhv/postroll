import { NextResponse, type NextRequest } from 'next/server';

import { decryptSession, SESSION_COOKIE, SESSION_REFRESH_PATH, accessTokenExpiresSoon } from '#lib/session-crypto';

/**
 * Keep the rotating session fresh ahead of any RSC render.
 *
 * Cookie mutation is only legal in the proxy, Server Actions, and Route
 * Handlers — never during an RSC render. Since getUser()/getMe() run while
 * rendering the layout and pages, a token refresh triggered there cannot
 * persist the rotated cookie, so it has to happen before render.
 *
 * The refresh itself can't happen here: on Vercel the gateway is reachable only
 * through the `GATEWAY_URL` service binding, and bindings don't resolve in the
 * proxy (only in functions). So when the access token is about to expire, the
 * proxy bounces the request through the refresh Route Handler, which rotates
 * the tokens, sets the cookie, and redirects back to the original URL.
 *
 * Only GET/HEAD requests are bounced. Server Actions (POST) can write cookies
 * themselves, so gatewayFetch's 401 → refresh path persists the rotation there.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return NextResponse.next();
  }

  const raw = request.cookies.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return NextResponse.next();
  }

  const session = await decryptSession(raw);

  if (!session || !accessTokenExpiresSoon(session.accessToken)) {
    return NextResponse.next();
  }

  const refreshUrl = new URL(SESSION_REFRESH_PATH, request.url);
  refreshUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(refreshUrl, 307);
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/account/:path*'],
};
