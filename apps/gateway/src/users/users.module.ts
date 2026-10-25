import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  exports: [UsersService],
  providers: [UsersService],
  imports: [
    forwardRef(() => {
      return AuthModule;
    }),
  ],
})
export class UsersModule {}
