import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { validateGatewayEnv } from './env.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

const isProduction = process.env['NODE_ENV'] === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateGatewayEnv,
    }),
    LoggerModule.forRoot({
      /**
       * Pretty logs locally only. In production (Vercel Functions) log plain
       * JSON: it's what Vercel's log viewer expects, and the pino-pretty
       * transport runs in a worker thread that resolves the package by name,
       * which function file tracing doesn't pick up.
       */
      pinoHttp: isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                levelFirst: true,
                translateTime: 'SYS:standard',
              },
            },
          },
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
  ],
})
export class AppModule {}
