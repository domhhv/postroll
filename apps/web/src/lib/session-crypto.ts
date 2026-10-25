import { decodeJwt, EncryptJWT, jwtDecrypt } from 'jose';
import { z } from 'zod';

import { getSessionEnv } from '#env';

export const SESSION_COOKIE = 'postroll_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Route Handler the proxy bounces through to rotate tokens (app/api/session/refresh). */
export const SESSION_REFRESH_PATH = '/api/session/refresh';

/** Refresh when the access token expires within this window (seconds). */
export const REFRESH_SKEW_SECONDS = 30;

const sessionPayloadSchema = z.object({
  accessToken: z.string(),
  /** The workspace this session is currently scoped to (X-Workspace-Id source). */
  activeWorkspaceId: z.string(),
  refreshExpiresAt: z.string(),
  refreshToken: z.string(),
  sid: z.string(),
  userId: z.string(),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

let cachedKey: Uint8Array | null = null;

async function getKey(): Promise<Uint8Array> {
  if (cachedKey) {
    return cachedKey;
  }

  const { SESSION_SECRET } = getSessionEnv();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SESSION_SECRET));
  cachedKey = new Uint8Array(digest);

  return cachedKey;
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  const key = await getKey();

  return await new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .encrypt(key);
}

export async function decryptSession(jwe: string): Promise<SessionPayload | null> {
  try {
    const key = await getKey();
    const { payload } = await jwtDecrypt(jwe, key);

    return sessionPayloadSchema.parse(payload);
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env['NODE_ENV'] === 'production',
  };
}

/**
 * True when the access token is missing an `exp`, can't be decoded, or expires
 * within `REFRESH_SKEW_SECONDS`. Decoding only — the gateway verifies the
 * signature on every request.
 */
export function accessTokenExpiresSoon(accessToken: string): boolean {
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
