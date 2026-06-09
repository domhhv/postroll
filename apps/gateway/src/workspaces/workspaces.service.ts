import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type {
  WorkspaceDto,
  WorkspaceRole,
  WorkspaceList,
  WorkspaceMemberList,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
} from '@postroll/contracts';
import type { PrismaClient } from '@postroll/database/prisma';

import { InjectPrisma } from '../database/database.module';

import { generateWorkspaceSlug } from './slug';

/** Roles allowed to remove members, in descending privilege. */
const MEMBER_MANAGEMENT_ROLES: ReadonlySet<WorkspaceRole> = new Set(['OWNER', 'ADMIN']);

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

    return memberships.map((membership) => {
      return {
        createdAt: membership.workspace.createdAt.toISOString(),
        id: membership.workspace.id,
        name: membership.workspace.name,
        role: membership.role,
        slug: membership.workspace.slug,
      };
    });
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
   * Rename a workspace. Owner-only — the caller's role is already verified as a
   * member by {@link WorkspaceGuard}; here we additionally require OWNER.
   */
  async rename(workspaceId: string, callerRole: WorkspaceRole, input: UpdateWorkspaceRequest): Promise<WorkspaceDto> {
    if (callerRole !== 'OWNER') {
      throw new ForbiddenException('Only the workspace owner can rename it');
    }

    const workspace = await this.prisma.workspace.update({
      data: { name: input.name },
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

  /** List the members of a workspace with their user details and roles. */
  async listMembers(workspaceId: string): Promise<WorkspaceMemberList> {
    const memberships = await this.prisma.membership.findMany({
      include: { user: { omit: { password: true } } },
      orderBy: { createdAt: 'asc' },
      where: { workspaceId },
    });

    return memberships.map((membership) => {
      return {
        createdAt: membership.createdAt.toISOString(),
        email: membership.user.email,
        id: membership.id,
        name: membership.user.name,
        role: membership.role,
        userId: membership.userId,
        username: membership.user.username,
      };
    });
  }

  /**
   * Remove a member from a workspace. Admin+ only. An owner can never be
   * removed (the workspace must keep an owner), and admins cannot remove other
   * admins or themselves through this path.
   */
  async removeMember(
    workspaceId: string,
    callerId: string,
    callerRole: WorkspaceRole,
    targetUserId: string
  ): Promise<void> {
    if (!MEMBER_MANAGEMENT_ROLES.has(callerRole)) {
      throw new ForbiddenException('Only admins or the owner can remove members');
    }

    const target = await this.prisma.membership.findUnique({
      select: { role: true },
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });

    if (!target) {
      throw new NotFoundException('Member not found in this workspace');
    }

    if (target.role === 'OWNER') {
      throw new ForbiddenException('The workspace owner cannot be removed');
    }

    if (callerRole === 'ADMIN' && target.role === 'ADMIN' && callerId !== targetUserId) {
      throw new ForbiddenException('Admins cannot remove other admins');
    }

    await this.prisma.membership.delete({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
  }
}
