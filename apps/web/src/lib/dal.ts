import 'server-only';
import type { UserDto, WorkspaceDto, WorkspaceList } from '@postroll/contracts';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { getMe, GatewayError, getWorkspaces as fetchWorkspaces } from './api';
import { readSessionCookie, type SessionPayload } from './session';
import { SESSION_REFRESH_PATH } from './session-crypto';

/**
 * Returns the decrypted session. Never pass the raw payload to client
 * components — accessToken / refreshToken are server-only.
 */
export const verifySession = cache(async (): Promise<SessionPayload | null> => readSessionCookie());

/**
 * For pages whose session cookie exists but the gateway rejected it (e.g. the
 * session was terminated elsewhere). Renders can't clear cookies, so hand off
 * to the refresh Route Handler: it either rotates a still-valid session or
 * clears the dead cookie, then returns to `next` (which sends a logged-out
 * user to /login without looping).
 */
export function redirectToSessionCheck(next: string): never {
  const params = new URLSearchParams({ force: '1', next });

  redirect(`${SESSION_REFRESH_PATH}?${params.toString()}`);
}

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

/** The workspaces the signed-in user belongs to (empty when logged out). */
export const getWorkspaces = cache(async (): Promise<WorkspaceList> => {
  const session = await verifySession();

  if (!session) {
    return [];
  }

  try {
    return await fetchWorkspaces();
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) {
      return [];
    }

    throw error;
  }
});

/**
 * The workspace the session is scoped to right now — resolved by matching the
 * session's `activeWorkspaceId` against the user's memberships. Falls back to
 * the first workspace if the active id is stale (e.g. the workspace was deleted).
 */
export const getActiveWorkspace = cache(async (): Promise<WorkspaceDto | null> => {
  const session = await verifySession();

  if (!session) {
    return null;
  }

  const workspaces = await getWorkspaces();

  return workspaces.find((workspace) => workspace.id === session.activeWorkspaceId) ?? workspaces[0] ?? null;
});

/**
 * The active workspace for pages that make workspace-scoped gateway calls.
 * Those calls send the session's `activeWorkspaceId`, so a stale id (the
 * workspace was deleted or the user was removed from it) would fail them.
 * A render can't fix the cookie, so hand off to the refresh Route Handler,
 * which moves the session onto a remaining workspace and returns to `next`.
 */
export async function requireActiveWorkspace(next: string): Promise<WorkspaceDto> {
  const [session, workspace] = await Promise.all([verifySession(), getActiveWorkspace()]);

  if (!session || !workspace || workspace.id !== session.activeWorkspaceId) {
    redirectToSessionCheck(next);
  }

  return workspace;
}
