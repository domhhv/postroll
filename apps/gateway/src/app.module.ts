import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { type GatewayEnv, validateGatewayEnv } from './env.js';
import { HealthModule } from './health/health.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { UsersModule } from './users/users.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

/**
 * pino-http logs every request and response header. These carry the access
 * token, the refresh token and the rotated refresh cookie.
 */
const REDACTED_LOG_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-postroll-refresh-token"]',
  'res.headers["set-cookie"]',
];

/** Vercel's request id when there is one, so a log line leads back to its request in Vercel's logs. */
function requestIdOf(req: IncomingMessage): string {
  const vercelId = req.headers['x-vercel-id'];

  return typeof vercelId === 'string' && vercelId !== '' ? vercelId : randomUUID();
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      /**
       * Serve only validated values. Otherwise `get()` falls back to
       * process.env for a variable that validated as unset, and an empty
       * `KEY=` would come back as ''.
       */
      skipProcessEnv: true,
      validate: validateGatewayEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<GatewayEnv, true>) => ({
        pinoHttp: {
          genReqId: requestIdOf,
          level: config.get('LOG_LEVEL', { infer: true }),
          /**
           * Logs written while handling a request carry only its `reqId`; the
           * full request, headers included, is logged once on completion.
           */
          quietReqLogger: true,
          redact: { censor: '[redacted]', paths: REDACTED_LOG_PATHS },
          /**
           * Pretty logs locally only. In production (Vercel Functions) log plain
           * JSON: it's what Vercel's log viewer expects, and the pino-pretty
           * transport runs in a worker thread that resolves the package by name,
           * which function file tracing doesn't pick up.
           */
          ...(config.get('NODE_ENV', { infer: true }) !== 'production' && {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                levelFirst: true,
                translateTime: 'SYS:standard',
              },
            },
          }),
        },
      }),
    }),
    DatabaseModule,
    MessagingModule,
    OutboxModule,
    HealthModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
  ],
})
export class AppModule {}
