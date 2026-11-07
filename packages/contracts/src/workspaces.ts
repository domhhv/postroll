import { z } from 'zod';

/** Mirrors the Prisma `WorkspaceRole` enum. */
export const workspaceRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'COMMENTER', 'VIEWER']);

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceDtoSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  name: z.string(),
  /** The caller's role in this workspace. */
  role: workspaceRoleSchema,
  slug: z.string(),
});

export type WorkspaceDto = z.infer<typeof workspaceDtoSchema>;

export const workspaceListItemSchema = workspaceDtoSchema.extend({
  memberCount: z.number().int().nonnegative(),
});

export type WorkspaceListItem = z.infer<typeof workspaceListItemSchema>;

export const workspaceListSchema = z.array(workspaceListItemSchema);

export type WorkspaceList = z.infer<typeof workspaceListSchema>;

export const createWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required.').max(120),
});

export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;

export const updateWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required.').max(120),
});

export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceRequestSchema>;

export const workspaceMemberDtoSchema = z.object({
  /** When the user joined the workspace. */
  createdAt: z.iso.datetime(),
  email: z.email(),
  /** Membership id (not the user id). */
  id: z.uuid(),
  name: z.string().nullable(),
  role: workspaceRoleSchema,
  userId: z.uuid(),
  username: z.string().nullable(),
});

export type WorkspaceMemberDto = z.infer<typeof workspaceMemberDtoSchema>;

export const workspaceMemberListSchema = z.array(workspaceMemberDtoSchema);

export type WorkspaceMemberList = z.infer<typeof workspaceMemberListSchema>;

export const updateWorkspaceMemberRequestSchema = z.object({
  role: workspaceRoleSchema,
});

export type UpdateWorkspaceMemberRequest = z.infer<typeof updateWorkspaceMemberRequestSchema>;

/** Every role, in descending privilege. */
export const WORKSPACE_ROLES = workspaceRoleSchema.options;

/** Positive when `a` is more privileged than `b`. */
export function compareWorkspaceRoles(a: WorkspaceRole, b: WorkspaceRole): number {
  return WORKSPACE_ROLES.indexOf(b) - WORKSPACE_ROLES.indexOf(a);
}

/**
 * Whether `callerRole` may manage (change the role of, or remove) another
 * member holding `targetRole`. The owner manages everyone else; admins manage
 * members below admin; nobody manages the owner.
 */
export function canManageWorkspaceMember(callerRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (targetRole === 'OWNER') {
    return false;
  }

  if (callerRole === 'OWNER') {
    return true;
  }

  return callerRole === 'ADMIN' && compareWorkspaceRoles('ADMIN', targetRole) > 0;
}

/**
 * Roles `callerRole` may move a `targetRole` member to, excluding the current
 * one. Ownership can't be granted here, and admins can only assign roles below
 * admin.
 */
export function getAssignableWorkspaceRoles(callerRole: WorkspaceRole, targetRole: WorkspaceRole): WorkspaceRole[] {
  if (!canManageWorkspaceMember(callerRole, targetRole)) {
    return [];
  }

  return WORKSPACE_ROLES.filter(
    (role) =>
      role !== 'OWNER' && role !== targetRole && (callerRole === 'OWNER' || compareWorkspaceRoles('ADMIN', role) > 0)
  );
}
