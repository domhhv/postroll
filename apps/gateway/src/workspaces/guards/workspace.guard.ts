import {
  Injectable,
  type CanActivate,
  ForbiddenException,
  BadRequestException,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { PrismaClient } from '@postroll/database/prisma';
import type { Request } from 'express';

import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { InjectPrisma } from '../../database/database.module';
import { WORKSPACE_CONTEXT_KEY, type RequestWorkspace } from '../decorators/current-workspace.decorator';

/** Header the web app sets from the session's `activeWorkspaceId`. */
const WORKSPACE_HEADER = 'x-workspace-id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tenant isolation enforcement. Runs after {@link JwtAuthGuard} (which sets
 * `req.user`), reads the `X-Workspace-Id` header, and confirms the
 * authenticated user has a membership in that workspace. On success it attaches
 * `{ workspaceId, role }` to the request for {@link CurrentWorkspace} to read,
 * so every workspace-scoped query can filter by a verified `workspaceId`.
 *
 * A user presenting a workspace id they don't belong to gets a 404-equivalent
 * (we 403 to avoid leaking existence), never another tenant's data.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser; [WORKSPACE_CONTEXT_KEY]?: RequestWorkspace }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const header = request.get(WORKSPACE_HEADER);

    if (!header || !UUID_PATTERN.test(header)) {
      throw new BadRequestException('Missing or invalid X-Workspace-Id header');
    }

    const membership = await this.prisma.membership.findUnique({
      select: { role: true },
      where: { userId_workspaceId: { userId: user.id, workspaceId: header } },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    request[WORKSPACE_CONTEXT_KEY] = { role: membership.role, workspaceId: header };

    return true;
  }
}
