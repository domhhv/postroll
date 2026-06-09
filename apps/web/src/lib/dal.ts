import 'server-only';
import type { UserDto, WorkspaceDto, WorkspaceList } from '@postroll/contracts';
import { cache } from 'react';

import { getMe, GatewayError, getWorkspaces as fetchWorkspaces } from './api';
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

  return (
    workspaces.find((workspace) => {
      return workspace.id === session.activeWorkspaceId;
    }) ??
    workspaces[0] ??
    null
  );
});
