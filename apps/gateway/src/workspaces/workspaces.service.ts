import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  type WorkspaceDto,
  type WorkspaceRole,
  type WorkspaceList,
  type WorkspaceMemberDto,
  type WorkspaceMemberList,
  canManageWorkspaceMember,
  type CreateWorkspaceRequest,
  type UpdateWorkspaceRequest,
  getAssignableWorkspaceRoles,
  type UpdateWorkspaceMemberRequest,
} from '@postroll/contracts';
import type { PrismaClient } from '@postroll/database/prisma';

import { InjectPrisma } from '../database/database.module.js';

import { generateWorkspaceSlug } from './slug.js';

/** Roles allowed to update workspace details and remove members, in descending privilege. */
const WORKSPACE_MANAGER_ROLES: ReadonlySet<WorkspaceRole> = new Set(['OWNER', 'ADMIN']);

@Injectable()
export class WorkspacesService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  /** Every workspace the user belongs to, annotated with their role. */
  async listForUser(userId: string): Promise<WorkspaceList> {
    const memberships = await this.prisma.membership.findMany({
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
      where: { userId },
    });

    return memberships.map((membership) => ({
      createdAt: membership.workspace.createdAt.toISOString(),
      id: membership.workspace.id,
      name: membership.workspace.name,
      role: membership.role,
      slug: membership.workspace.slug,
    }));
  }

  /** Create a workspace and make the caller its owner, atomically. */
  async create(userId: string, input: CreateWorkspaceRequest): Promise<WorkspaceDto> {
    const workspace = await this.prisma.workspace.create({
      data: {
        name: input.name,
        slug: generateWorkspaceSlug(input.name),
        members: {
          create: {
            role: 'OWNER',
            userId,
          },
        },
      },
    });

    return {
      createdAt: workspace.createdAt.toISOString(),
      id: workspace.id,
      name: workspace.name,
      role: 'OWNER',
      slug: workspace.slug,
    };
  }

  /**
   * Update a workspace's details. Admin+ only — the caller's membership is
   * already verified by {@link WorkspaceGuard}; here we additionally require OWNER or ADMIN.
   */
  async update(workspaceId: string, callerRole: WorkspaceRole, input: UpdateWorkspaceRequest): Promise<WorkspaceDto> {
    if (!WORKSPACE_MANAGER_ROLES.has(callerRole)) {
      throw new ForbiddenException('Only admins or the owner can update the workspace');
    }

    const workspace = await this.prisma.workspace.update({
      data: input,
      where: { id: workspaceId },
    });

    return {
      createdAt: workspace.createdAt.toISOString(),
      id: workspace.id,
      name: workspace.name,
      role: callerRole,
      slug: workspace.slug,
    };
  }

  /**
   * Delete a workspace. Owner only. Memberships go with it via the
   * `onDelete: Cascade` relation. The caller must keep at least one other
   * workspace, since login opens a session into an existing membership. The
   * caller's user row is locked first so concurrent deletions by the same user
   * run one after another and each sees the other's result.
   */
  async remove(workspaceId: string, callerId: string, callerRole: WorkspaceRole): Promise<void> {
    if (callerRole !== 'OWNER') {
      throw new ForbiddenException('Only the owner can delete the workspace');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${callerId}::uuid FOR UPDATE`;

      const otherMemberships = await tx.membership.count({
        where: { userId: callerId, workspaceId: { not: workspaceId } },
      });

      if (otherMemberships === 0) {
        throw new ConflictException('You cannot delete your only workspace');
      }

      await tx.workspace.delete({ where: { id: workspaceId } });
    });
  }

  /** List the members of a workspace with their user details and roles. */
  async listMembers(workspaceId: string): Promise<WorkspaceMemberList> {
    const memberships = await this.prisma.membership.findMany({
      include: { user: { omit: { password: true } } },
      orderBy: { createdAt: 'asc' },
      where: { workspaceId },
    });

    return memberships.map((membership) => ({
      createdAt: membership.createdAt.toISOString(),
      email: membership.user.email,
      id: membership.id,
      name: membership.user.name,
      role: membership.role,
      userId: membership.userId,
      username: membership.user.username,
    }));
  }

  /**
   * Change another member's role. The owner can assign any role but owner to
   * anyone else; admins can only move members below admin to roles below admin.
   */
  async updateMemberRole(
    workspaceId: string,
    callerId: string,
    callerRole: WorkspaceRole,
    targetUserId: string,
    input: UpdateWorkspaceMemberRequest
  ): Promise<WorkspaceMemberDto> {
    if (callerId === targetUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const target = await this.findMembership(workspaceId, targetUserId);

    if (!getAssignableWorkspaceRoles(callerRole, target.role).includes(input.role)) {
      throw new ForbiddenException('You do not have permission to assign this role to this member');
    }

    const membership = await this.prisma.membership.update({
      data: { role: input.role },
      include: { user: { omit: { password: true } } },
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });

    return {
      createdAt: membership.createdAt.toISOString(),
      email: membership.user.email,
      id: membership.id,
      name: membership.user.name,
      role: membership.role,
      userId: membership.userId,
      username: membership.user.username,
    };
  }

  /**
   * Remove a member from a workspace. The owner can remove anyone else; admins
   * can remove members below admin, or themselves. The owner can never be
   * removed (the workspace must keep an owner).
   */
  async removeMember(
    workspaceId: string,
    callerId: string,
    callerRole: WorkspaceRole,
    targetUserId: string
  ): Promise<void> {
    if (!WORKSPACE_MANAGER_ROLES.has(callerRole)) {
      throw new ForbiddenException('Only admins or the owner can remove members');
    }

    const target = await this.findMembership(workspaceId, targetUserId);

    if (target.role === 'OWNER') {
      throw new ForbiddenException('The workspace owner cannot be removed');
    }

    if (callerId !== targetUserId && !canManageWorkspaceMember(callerRole, target.role)) {
      throw new ForbiddenException('Admins cannot remove other admins');
    }

    await this.prisma.membership.delete({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
  }

  private async findMembership(workspaceId: string, userId: string): Promise<{ role: WorkspaceRole }> {
    const membership = await this.prisma.membership.findUnique({
      select: { role: true },
      where: { userId_workspaceId: { userId, workspaceId } },
    });

    if (!membership) {
      throw new NotFoundException('Member not found in this workspace');
    }

    return membership;
  }
}
