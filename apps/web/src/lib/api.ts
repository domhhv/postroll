import 'server-only';

import {
  type LoginRequest,
  type LoginResponse,
  loginResponseSchema,
  type RegisterRequest,
  type RegisterResponse,
  refreshResponseSchema,
  registerResponseSchema,
  type UserDto,
  userDtoSchema,
  usersCountResponseSchema,
  usersListResponseSchema,
} from '@postroll/contracts';
import { getServerEnv } from '@/env';
import {
  createSession,
  deleteSession,
  readSessionCookie,
  type SessionPayload,
  updateSession,
} from './session';

const GATEWAY_REFRESH_COOKIE = 'postroll_rt';

export class GatewayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

type RefreshResult = {
  refreshToken: string;
  accessToken: string;
  refreshExpiresAt: string;
};

const refreshLocks = new Map<string, Promise<RefreshResult>>();

function parseRefreshCookie(
  setCookies: string[],
): { value: string; expiresAt: string } | null {
  for (const line of setCookies) {
    const parts = line.split(';').map((p) => p.trim());
    const first = parts[0];
    if (!first) continue;
    const eq = first.indexOf('=');
    if (eq === -1) continue;
    const name = first.slice(0, eq);
    if (name !== GATEWAY_REFRESH_COOKIE) continue;
    const value = first.slice(eq + 1);
    let expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    for (const attr of parts.slice(1)) {
      const [rawKey, ...rest] = attr.split('=');
      const key = rawKey?.toLowerCase();
      const rawValue = rest.join('=');
      if (key === 'max-age') {
        const seconds = Number.parseInt(rawValue, 10);
        if (!Number.isNaN(seconds)) {
          expiresAt = new Date(Date.now() + seconds * 1000).toISOString();
        }
      } else if (key === 'expires' && rawValue) {
        const d = new Date(rawValue);
        if (!Number.isNaN(d.getTime())) {
          expiresAt = d.toISOString();
        }
      }
    }
    return { value, expiresAt };
  }
  return null;
}

export async function getUsers(): Promise<UserDto[]> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}/users`, { cache: 'no-store' });
  if (!res.ok) throw new GatewayError(res.status, `gateway ${res.status}`);
  return usersListResponseSchema.parse(await res.json());
}

export async function getUserCount(): Promise<number> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}/users/count`, { cache: 'no-store' });
  if (!res.ok) throw new GatewayError(res.status, `gateway ${res.status}`);
  const { count } = usersCountResponseSchema.parse(await res.json());
  return count;
}

export async function registerUser(
  input: RegisterRequest,
): Promise<RegisterResponse> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const message =
      res.status === 409
        ? 'An account with this email already exists.'
        : `Registration failed (${res.status}).`;
    throw new GatewayError(res.status, message);
  }
  return registerResponseSchema.parse(await res.json());
}

export async function loginUser(
  input: LoginRequest,
): Promise<LoginResponse & { refreshToken: string; refreshExpiresAt: string }> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const message =
      res.status === 401
        ? 'Invalid email or password.'
        : `Login failed (${res.status}).`;
    throw new GatewayError(res.status, message);
  }
  const body = loginResponseSchema.parse(await res.json());
  const cookie = parseRefreshCookie(res.headers.getSetCookie());
  if (!cookie) {
    throw new GatewayError(502, 'Gateway did not return a refresh cookie.');
  }
  return {
    ...body,
    refreshToken: cookie.value,
    refreshExpiresAt: cookie.expiresAt,
  };
}

async function refreshTokens(session: SessionPayload): Promise<RefreshResult> {
  const existing = refreshLocks.get(session.sid);
  if (existing) return existing;

  const { GATEWAY_URL } = getServerEnv();
  const promise = (async (): Promise<RefreshResult> => {
    try {
      const res = await fetch(`${GATEWAY_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          cookie: `${GATEWAY_REFRESH_COOKIE}=${session.refreshToken}`,
        },
      });
      if (!res.ok) {
        throw new GatewayError(res.status, `refresh failed (${res.status})`);
      }
      const body = refreshResponseSchema.parse(await res.json());
      const cookie = parseRefreshCookie(res.headers.getSetCookie());
      if (!cookie) {
        throw new GatewayError(502, 'Gateway did not return a refresh cookie.');
      }
      return {
        accessToken: body.accessToken,
        refreshToken: cookie.value,
        refreshExpiresAt: cookie.expiresAt,
      };
    } finally {
      refreshLocks.delete(session.sid);
    }
  })();

  refreshLocks.set(session.sid, promise);
  return promise;
}

export async function logoutGateway(session: SessionPayload): Promise<void> {
  const { GATEWAY_URL } = getServerEnv();
  try {
    await fetch(`${GATEWAY_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: `${GATEWAY_REFRESH_COOKIE}=${session.refreshToken}`,
      },
    });
  } catch {
    // best effort; we'll still clear the local session
  }
}

async function gatewayFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { GATEWAY_URL } = getServerEnv();
  const session = await readSessionCookie();
  if (!session) {
    throw new GatewayError(401, 'No active session.');
  }

  const doFetch = (accessToken: string) =>
    fetch(`${GATEWAY_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

  const first = await doFetch(session.accessToken);
  if (first.status !== 401) return first;

  try {
    const next = await refreshTokens(session);
    await updateSession({
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      refreshExpiresAt: next.refreshExpiresAt,
    });
    return await doFetch(next.accessToken);
  } catch {
    await deleteSession();
    throw new GatewayError(401, 'Session expired.');
  }
}

export async function getMe(): Promise<UserDto> {
  const res = await gatewayFetch('/users/me');
  if (!res.ok) {
    throw new GatewayError(res.status, `me ${res.status}`);
  }
  return userDtoSchema.parse(await res.json());
}

export async function loginAndCreateSession(
  input: LoginRequest,
): Promise<UserDto> {
  const result = await loginUser(input);
  await createSession({
    userId: result.user.id,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    refreshExpiresAt: result.refreshExpiresAt,
  });
  return result.user;
}
