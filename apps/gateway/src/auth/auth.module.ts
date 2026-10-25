import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';

type ExpiresIn = NonNullable<NonNullable<JwtModuleOptions['signOptions']>['expiresIn']>;

@Module({
  controllers: [AuthController],
  exports: [TokensService],
  providers: [AuthService, TokensService],
  imports: [
    forwardRef(() => {
      return UsersModule;
    }),
    JwtModule.registerAsync({
      // Global so JwtAuthGuard can inject JwtService in any controller's module.
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        return {
          secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          signOptions: {
            expiresIn: config.getOrThrow<string>('JWT_ACCESS_TTL') as ExpiresIn,
          },
        };
      },
    }),
  ],
})
export class AuthModule {}
