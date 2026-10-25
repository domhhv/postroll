import { Module } from '@nestjs/common';

import { WorkspaceGuard } from './guards/workspace.guard.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Module({
  controllers: [WorkspacesController],
  exports: [WorkspacesService],
  providers: [WorkspacesService, WorkspaceGuard],
})
export class WorkspacesModule {}
