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

export const workspaceListSchema = z.array(workspaceDtoSchema);

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
