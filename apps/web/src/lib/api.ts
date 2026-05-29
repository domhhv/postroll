import 'server-only';

import {
  type ChangePasswordRequest,
  type LoginRequest,
  type LoginResponse,
  loginResponseSchema,
  type RegisterRequest,
  type RegisterResponse,
  refreshResponseSchema,
  registerResponseSchema,
  type UpdateUserRequest,
  type UserDto,
  userDtoSchema,
} from '@postroll/contracts';
import { parse as parseSetCookies } from 'set-cookie-parser';
import { getServerEnv } from '@/env';
import {
  createSession,
  deleteSession,
  readSessionCookie,
  type SessionPayload,
  updateSession,
} from './session';
import { noop } from './utils';

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

type RefreshCookie = { value: string; expiresAt: string };

type RefreshResult = {
  refreshToken: string;
  accessToken: string;
  refreshExpiresAt: string;
};

function parseRefreshCookie(setCookies: string[]): RefreshCookie {
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

async function postJson(
  path: string,
  body: unknown,
  errorMap: Record<number, string>,
): Promise<Response> {
  const { GATEWAY_URL } = getServerEnv();
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const message = errorMap[res.status] ?? `Request failed (${res.status}).`;

    throw new GatewayError(res.status, message);
  }

  return res;
}

export async function registerUser(
  input: RegisterRequest,
): Promise<RegisterResponse> {
  const res = await postJson('/auth/register', input, {
    409: 'An account with this email already exists.',
  });

  return registerResponseSchema.parse(await res.json());
}

export async function loginUser(
  input: LoginRequest,
): Promise<LoginResponse & { refreshToken: string; refreshExpiresAt: string }> {
  const res = await postJson('/auth/login', input, {
    401: 'Invalid email or password.',
  });
  const body = loginResponseSchema.parse(await res.json());
  const cookie = parseRefreshCookie(res.headers.getSetCookie());

  return {
    ...body,
    refreshToken: cookie.value,
    refreshExpiresAt: cookie.expiresAt,
  };
}

async function refreshTokens(session: SessionPayload): Promise<RefreshResult> {
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

export async function logoutGateway(session: SessionPayload): Promise<void> {
  const { GATEWAY_URL } = getServerEnv();

  await fetch(`${GATEWAY_URL}/auth/logout`, {
    method: 'POST',
    headers: { cookie: `${GATEWAY_REFRESH_COOKIE}=${session.refreshToken}` },
  }).catch(noop);
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

  if (first.status !== 401) {
    return first;
  }

  /**
   * Concurrent 401s may all hit /auth/refresh; the gateway absorbs the race
   * via a short rotation grace window (see apps/gateway/src/auth/tokens.service.ts)
   */
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

export async function updateMe(input: UpdateUserRequest): Promise<UserDto> {
  const res = await gatewayFetch('/users/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const message =
      res.status === 409
        ? 'An account with this email already exists.'
        : `Request failed (${res.status}).`;

    throw new GatewayError(res.status, message);
  }

  return userDtoSchema.parse(await res.json());
}

export async function updatePassword(
  input: ChangePasswordRequest,
): Promise<void> {
  const session = await readSessionCookie();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (input.revokeOtherSessions && session) {
    headers['x-postroll-refresh-token'] = session.refreshToken;
  }

  const res = await gatewayFetch('/users/me/password', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const message =
      res.status === 401
        ? 'Current password is incorrect.'
        : `Request failed (${res.status}).`;

    throw new GatewayError(res.status, message);
  }
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
