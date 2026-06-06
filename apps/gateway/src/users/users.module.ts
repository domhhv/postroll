import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

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
