import 'server-only';
import type { UserDto } from '@postroll/contracts';
import { cache } from 'react';

import { getMe, GatewayError } from './api';
import { readSessionCookie, type SessionPayload } from './session';

/**
 * Returns the decrypted session. Never pass the raw payload to client
 * components — accessToken / refreshToken are server-only.
 */
export const verifySession = cache(async (): Promise<SessionPayload | null> => {
  return readSessionCookie();
});

export const getUser = cache(async (): Promise<UserDto | null> => {
  const session = await verifySession();

  if (!session) {
    return null;
  }

  try {
    return await getMe();
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) {
      return null;
    }

    throw error;
  }
});
