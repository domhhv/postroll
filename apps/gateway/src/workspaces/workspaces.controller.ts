import {
  Get,
  Body,
  Post,
  Param,
  Patch,
  Delete,
  HttpCode,
  UseGuards,
  Controller,
  HttpStatus,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import {
  type WorkspaceDto,
  workspaceDtoSchema,
  type WorkspaceList,
  workspaceListSchema,
  type WorkspaceMemberList,
  workspaceMemberListSchema,
  createWorkspaceRequestSchema,
  updateWorkspaceRequestSchema,
} from '@postroll/contracts';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CurrentWorkspace, type RequestWorkspace } from './decorators/current-workspace.decorator';
import { WorkspaceGuard } from './guards/workspace.guard';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: RequestUser): Promise<WorkspaceList> {
    return workspaceListSchema.parse(await this.workspaces.listForUser(user.id));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: RequestUser, @Body() body: unknown): Promise<WorkspaceDto> {
    const input = createWorkspaceRequestSchema.parse(body);

    return workspaceDtoSchema.parse(await this.workspaces.create(user.id, input));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  async rename(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentWorkspace() workspace: RequestWorkspace,
    @Body() body: unknown
  ): Promise<WorkspaceDto> {
    this.assertPathMatchesContext(id, workspace);
    const input = updateWorkspaceRequestSchema.parse(body);

    return workspaceDtoSchema.parse(await this.workspaces.rename(workspace.workspaceId, workspace.role, input));
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  async listMembers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentWorkspace() workspace: RequestWorkspace
  ): Promise<WorkspaceMemberList> {
    this.assertPathMatchesContext(id, workspace);

    return workspaceMemberListSchema.parse(await this.workspaces.listMembers(workspace.workspaceId));
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() workspace: RequestWorkspace
  ): Promise<void> {
    this.assertPathMatchesContext(id, workspace);
    await this.workspaces.removeMember(workspace.workspaceId, user.id, workspace.role, userId);
  }

  /**
   * The membership-verified workspace comes from the `X-Workspace-Id` header
   * (via {@link WorkspaceGuard}); the `:id` path param is cosmetic for URL
   * readability. Reject any mismatch so a caller can't address one workspace in
   * the path while being authorized for another.
   */
  private assertPathMatchesContext(pathId: string, workspace: RequestWorkspace): void {
    if (pathId !== workspace.workspaceId) {
      throw new ForbiddenException('Workspace id mismatch between path and X-Workspace-Id header');
    }
  }
}
