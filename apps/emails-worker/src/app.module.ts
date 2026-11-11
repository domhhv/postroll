import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { EmailsModule } from './emails/emails.module.js';
import { type WorkerEnv, validateWorkerEnv } from './env.js';
import { MessagingModule } from './messaging/messaging.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      /**
       * Serve only validated values. Otherwise `get()` falls back to
       * process.env for a variable that validated as unset, and an empty
       * `EMAIL_REPLY_TO=` would reach Resend as ''.
       */
      skipProcessEnv: true,
      validate: validateWorkerEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<WorkerEnv, true>) => ({
        /** Same setup as the gateway: plain JSON in production, pretty logs locally. */
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
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
    MessagingModule,
    EmailsModule,
  ],
})
export class AppModule {}
