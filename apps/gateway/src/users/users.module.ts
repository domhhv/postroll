import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  exports: [UsersService],
  imports: [forwardRef(() => AuthModule)],
  providers: [UsersService],
})
export class UsersModule {}
