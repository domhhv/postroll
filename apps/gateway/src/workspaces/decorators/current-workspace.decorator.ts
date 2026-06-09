import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { WorkspaceRole } from '@postroll/contracts';
import type { Request } from 'express';

/**
 * The workspace context attached by {@link WorkspaceGuard} after it confirms
 * the authenticated user is a member of the `X-Workspace-Id` workspace.
 */
export type RequestWorkspace = {
  role: WorkspaceRole;
  workspaceId: string;
};

/** Key under which {@link WorkspaceGuard} stashes the context on the request. */
export const WORKSPACE_CONTEXT_KEY = 'workspaceContext';

export const CurrentWorkspace = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestWorkspace => {
  const request = ctx.switchToHttp().getRequest<Request & { [WORKSPACE_CONTEXT_KEY]?: RequestWorkspace }>();
  const workspace = request[WORKSPACE_CONTEXT_KEY];

  if (!workspace) {
    throw new Error('WorkspaceGuard must run before @CurrentWorkspace() can be used');
  }

  return workspace;
});
