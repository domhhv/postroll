import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { TokensService } from './tokens.service';

type ExpiresIn = NonNullable<NonNullable<JwtModuleOptions['signOptions']>['expiresIn']>;

@Module({
  controllers: [AuthController],
  exports: [TokensService],
  providers: [AuthService, TokensService, LocalStrategy, JwtStrategy],
  imports: [
    PassportModule,
    forwardRef(() => {
      return UsersModule;
    }),
    JwtModule.registerAsync({
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
