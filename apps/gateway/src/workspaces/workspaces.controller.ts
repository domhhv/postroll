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
  type WorkspaceMemberDto,
  type WorkspaceMemberList,
  workspaceMemberDtoSchema,
  workspaceMemberListSchema,
  createWorkspaceRequestSchema,
  updateWorkspaceRequestSchema,
  updateWorkspaceMemberRequestSchema,
} from '@postroll/contracts';

import { CurrentUser, type RequestUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

import { CurrentWorkspace, type RequestWorkspace } from './decorators/current-workspace.decorator.js';
import { WorkspaceGuard } from './guards/workspace.guard.js';
import { WorkspacesService } from './workspaces.service.js';

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
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentWorkspace() workspace: RequestWorkspace,
    @Body() body: unknown
  ): Promise<WorkspaceDto> {
    this.assertPathMatchesContext(id, workspace);
    const input = updateWorkspaceRequestSchema.parse(body);

    return workspaceDtoSchema.parse(await this.workspaces.update(workspace.workspaceId, workspace.role, input));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() workspace: RequestWorkspace
  ): Promise<void> {
    this.assertPathMatchesContext(id, workspace);
    await this.workspaces.remove(workspace.workspaceId, user.id, workspace.role);
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

  @Patch(':id/members/:userId')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  async updateMemberRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() workspace: RequestWorkspace,
    @Body() body: unknown
  ): Promise<WorkspaceMemberDto> {
    this.assertPathMatchesContext(id, workspace);
    const input = updateWorkspaceMemberRequestSchema.parse(body);

    return workspaceMemberDtoSchema.parse(
      await this.workspaces.updateMemberRole(workspace.workspaceId, user.id, workspace.role, userId, input)
    );
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
