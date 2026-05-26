import 'server-only';

import { EncryptJWT, jwtDecrypt } from 'jose';
import { cookies } from 'next/headers';
import { getServerEnv } from '@/env';

export const SESSION_COOKIE = 'postroll_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type SessionPayload = {
  sid: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
};

let cachedKey: Uint8Array | null = null;

async function getKey(): Promise<Uint8Array> {
  if (cachedKey) return cachedKey;
  const { SESSION_SECRET } = getServerEnv();
  const ikm = new TextEncoder().encode(SESSION_SECRET);
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('postroll-session-v1'),
    },
    baseKey,
    256,
  );
  cachedKey = new Uint8Array(bits);
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

export async function decryptSession(
  jwe: string,
): Promise<SessionPayload | null> {
  try {
    const key = await getKey();
    const { payload } = await jwtDecrypt(jwe, key);
    if (
      typeof payload['sid'] !== 'string' ||
      typeof payload['userId'] !== 'string' ||
      typeof payload['accessToken'] !== 'string' ||
      typeof payload['refreshToken'] !== 'string' ||
      typeof payload['refreshExpiresAt'] !== 'string'
    ) {
      return null;
    }
    return {
      sid: payload['sid'],
      userId: payload['userId'],
      accessToken: payload['accessToken'],
      refreshToken: payload['refreshToken'],
      refreshExpiresAt: payload['refreshExpiresAt'],
    };
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
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
  if (!current) return;
  const next: SessionPayload = { ...current, ...patch };
  const jwe = await encryptSession(next);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, jwe, cookieOptions());
}

export async function deleteSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
