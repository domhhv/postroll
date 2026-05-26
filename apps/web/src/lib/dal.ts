import 'server-only';

import type { UserDto } from '@postroll/contracts';
import { cache } from 'react';
import { GatewayError, getMe } from './api';
import { readSessionCookie, type SessionPayload } from './session';

/**
 * Returns the decrypted session payload, or null if absent or invalid.
 * Do NOT expose the accessToken or refreshToken to client components — they
 * belong server-side only. Callers should pluck the user-facing fields out.
 */
export const verifySession = cache(
  async (): Promise<SessionPayload | null> => readSessionCookie(),
);

export const getUser = cache(async (): Promise<UserDto | null> => {
  const session = await verifySession();
  if (!session) return null;
  try {
    return await getMe();
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) {
      return null;
    }
    throw error;
  }
});
