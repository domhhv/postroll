import { Module } from '@nestjs/common';

import { WorkspaceGuard } from './guards/workspace.guard';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  controllers: [WorkspacesController],
  exports: [WorkspacesService],
  providers: [WorkspacesService, WorkspaceGuard],
})
export class WorkspacesModule {}
