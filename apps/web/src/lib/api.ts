import 'server-only';
import {
  type UserDto,
  userDtoSchema,
  type SessionList,
  type LoginRequest,
  type WorkspaceDto,
  sessionListSchema,
  type WorkspaceList,
  type LoginResponse,
  workspaceDtoSchema,
  loginResponseSchema,
  workspaceListSchema,
  type RegisterRequest,
  type RegisterResponse,
  registerResponseSchema,
  type UpdateUserRequest,
  type WorkspaceMemberList,
  workspaceMemberListSchema,
  type ChangePasswordRequest,
  type CreateWorkspaceRequest,
  type UpdateWorkspaceRequest,
} from '@postroll/contracts';
import { headers } from 'next/headers';

import { getServerEnv } from '@/env';

import {
  GatewayError,
  refreshTokens,
  readRequestMeta,
  CLIENT_IP_HEADER,
  type RequestMeta,
  parseRefreshCookie,
  GATEWAY_REFRESH_COOKIE,
} from './refresh';
import { createSession, deleteSession, updateSession, readSessionCookie, type SessionPayload } from './session';
import { noop } from './utils';

export { GatewayError } from './refresh';

async function postJson(
  path: string,
  body: unknown,
  errorMap: Record<number, string>,
  meta: RequestMeta = {}
): Promise<Response> {
  const { GATEWAY_URL } = getServerEnv();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (meta.userAgent) {
    headers['user-agent'] = meta.userAgent;
  }

  if (meta.ip) {
    headers[CLIENT_IP_HEADER] = meta.ip;
  }

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    body: JSON.stringify(body),
    headers,
    method: 'POST',
  });

  if (!res.ok) {
    const message = errorMap[res.status] ?? `Request failed (${res.status}).`;

    throw new GatewayError(res.status, message);
  }

  return res;
}

export async function registerUser(input: RegisterRequest): Promise<RegisterResponse> {
  const res = await postJson('/auth/register', input, {
    409: 'An account with this email already exists.',
  });

  return registerResponseSchema.parse(await res.json());
}

export async function loginUser(
  input: LoginRequest,
  meta: RequestMeta = {}
): Promise<LoginResponse & { refreshExpiresAt: string; refreshToken: string }> {
  const res = await postJson('/auth/login', input, { 401: 'Invalid email or password.' }, meta);
  const body = loginResponseSchema.parse(await res.json());
  const cookie = parseRefreshCookie(res.headers.getSetCookie());

  return {
    ...body,
    refreshExpiresAt: cookie.expiresAt,
    refreshToken: cookie.value,
  };
}

export async function logoutGateway(session: SessionPayload): Promise<void> {
  const { GATEWAY_URL } = getServerEnv();

  await fetch(`${GATEWAY_URL}/auth/logout`, {
    headers: { cookie: `${GATEWAY_REFRESH_COOKIE}=${session.refreshToken}` },
    method: 'POST',
  }).catch(noop);
}

async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { GATEWAY_URL } = getServerEnv();
  const session = await readSessionCookie();

  if (!session) {
    throw new GatewayError(401, 'No active session.');
  }

  const { activeWorkspaceId } = session;

  function doFetch(accessToken: string) {
    return fetch(`${GATEWAY_URL}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        ...(init.headers ?? {}),
        authorization: `Bearer ${accessToken}`,
        // Tenant scope: the gateway's WorkspaceGuard verifies membership.
        'x-workspace-id': activeWorkspaceId,
      },
    });
  }

  const first = await doFetch(session.accessToken);

  if (first.status !== 401) {
    return first;
  }

  /**
   * Concurrent 401s may all hit /auth/refresh; the gateway absorbs the race
   * via a short rotation grace window (see apps/gateway/src/auth/tokens.service.ts)
   */
  try {
    const meta = readRequestMeta(await headers());
    const next = await refreshTokens(session, meta);
    await updateSession({
      accessToken: next.accessToken,
      refreshExpiresAt: next.refreshExpiresAt,
      refreshToken: next.refreshToken,
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
    body: JSON.stringify(input),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH',
  });

  if (!res.ok) {
    const message =
      res.status === 409 ? 'An account with this email already exists.' : `Request failed (${res.status}).`;

    throw new GatewayError(res.status, message);
  }

  return userDtoSchema.parse(await res.json());
}

export async function updatePassword(input: ChangePasswordRequest): Promise<void> {
  const session = await readSessionCookie();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (input.revokeOtherSessions && session) {
    headers['x-postroll-refresh-token'] = session.refreshToken;
  }

  const res = await gatewayFetch('/users/me/password', {
    body: JSON.stringify(input),
    headers,
    method: 'PATCH',
  });

  if (!res.ok) {
    const message = res.status === 401 ? 'Current password is incorrect.' : `Request failed (${res.status}).`;

    throw new GatewayError(res.status, message);
  }
}

export async function listSessions(): Promise<SessionList> {
  const session = await readSessionCookie();
  const headers: Record<string, string> = {};

  if (session) {
    headers['x-postroll-refresh-token'] = session.refreshToken;
  }

  const res = await gatewayFetch('/users/me/sessions', { headers });

  if (!res.ok) {
    throw new GatewayError(res.status, `sessions ${res.status}`);
  }

  return sessionListSchema.parse(await res.json());
}

export async function revokeSession(id: string): Promise<void> {
  const res = await gatewayFetch(`/users/me/sessions/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const message = res.status === 404 ? 'Session not found.' : `Request failed (${res.status}).`;

    throw new GatewayError(res.status, message);
  }
}

export async function getWorkspaces(): Promise<WorkspaceList> {
  const res = await gatewayFetch('/workspaces');

  if (!res.ok) {
    throw new GatewayError(res.status, `workspaces ${res.status}`);
  }

  return workspaceListSchema.parse(await res.json());
}

export async function createWorkspace(input: CreateWorkspaceRequest): Promise<WorkspaceDto> {
  const res = await gatewayFetch('/workspaces', {
    body: JSON.stringify(input),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  if (!res.ok) {
    throw new GatewayError(res.status, `Request failed (${res.status}).`);
  }

  return workspaceDtoSchema.parse(await res.json());
}

export async function renameWorkspace(id: string, input: UpdateWorkspaceRequest): Promise<WorkspaceDto> {
  const res = await gatewayFetch(`/workspaces/${id}`, {
    body: JSON.stringify(input),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH',
  });

  if (!res.ok) {
    const message = res.status === 403 ? 'Only the workspace owner can rename it.' : `Request failed (${res.status}).`;

    throw new GatewayError(res.status, message);
  }

  return workspaceDtoSchema.parse(await res.json());
}

export async function getWorkspaceMembers(id: string): Promise<WorkspaceMemberList> {
  const res = await gatewayFetch(`/workspaces/${id}/members`);

  if (!res.ok) {
    throw new GatewayError(res.status, `members ${res.status}`);
  }

  return workspaceMemberListSchema.parse(await res.json());
}

export async function removeWorkspaceMember(id: string, userId: string): Promise<void> {
  const res = await gatewayFetch(`/workspaces/${id}/members/${userId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const message =
      res.status === 403
        ? 'You do not have permission to remove this member.'
        : res.status === 404
          ? 'Member not found.'
          : `Request failed (${res.status}).`;

    throw new GatewayError(res.status, message);
  }
}

/**
 * Switch the session's active workspace. Verifies the user is a member of the
 * target (the source of truth is the gateway's membership table, surfaced via
 * GET /workspaces) before persisting, so a forged id can't scope the session to
 * a workspace the user doesn't belong to.
 */
export async function switchWorkspace(workspaceId: string): Promise<WorkspaceDto> {
  const workspaces = await getWorkspaces();
  const target = workspaces.find((workspace) => {
    return workspace.id === workspaceId;
  });

  if (!target) {
    throw new GatewayError(403, 'You do not have access to this workspace.');
  }

  await updateSession({ activeWorkspaceId: target.id });

  return target;
}

export async function loginAndCreateSession(input: LoginRequest, meta: RequestMeta = {}): Promise<UserDto> {
  const result = await loginUser(input, meta);
  await createSession({
    accessToken: result.accessToken,
    activeWorkspaceId: result.activeWorkspaceId,
    refreshExpiresAt: result.refreshExpiresAt,
    refreshToken: result.refreshToken,
    userId: result.user.id,
  });

  return result.user;
}
