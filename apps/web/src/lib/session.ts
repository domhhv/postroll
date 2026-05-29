import 'server-only';

import { cookies } from 'next/headers';
import {
  cookieOptions,
  decryptSession,
  encryptSession,
  SESSION_COOKIE,
  type SessionPayload,
} from './session-crypto';

export {
  decryptSession,
  encryptSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type SessionPayload,
} from './session-crypto';

/**
 * Cookie mutation is only legal in Server Actions and Route Handlers. When a
 * write is attempted during an RSC render (e.g. a token refresh triggered by
 * gatewayFetch while rendering the layout), Next throws. Middleware refreshes
 * the session ahead of render, so swallowing that specific failure here is a
 * safe fallback — the rotated tokens are still used for the current request and
 * persisted on the next mutating request or middleware pass.
 */
function isReadonlyCookieError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('can only be modified in a Server Action')
  );
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  return decryptSession(raw);
}

export async function createSession(
  payload: Omit<SessionPayload, 'sid'>,
): Promise<void> {
  const sid = crypto.randomUUID();
  const jwe = await encryptSession({ sid, ...payload });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, jwe, cookieOptions());
}

export async function updateSession(
  patch: Partial<
    Pick<SessionPayload, 'accessToken' | 'refreshToken' | 'refreshExpiresAt'>
  >,
): Promise<void> {
  const current = await readSessionCookie();

  if (!current) {
    return;
  }

  const next: SessionPayload = { ...current, ...patch };
  const jwe = await encryptSession(next);

  try {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, jwe, cookieOptions());
  } catch (error) {
    if (!isReadonlyCookieError(error)) {
      throw error;
    }
  }
}

export async function deleteSession(): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
  } catch (error) {
    if (!isReadonlyCookieError(error)) {
      throw error;
    }
  }
}
