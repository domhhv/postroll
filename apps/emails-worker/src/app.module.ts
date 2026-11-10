import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { EmailsModule } from './emails/emails.module.js';
import { validateWorkerEnv } from './env.js';
import { MessagingModule } from './messaging/messaging.module.js';

const isProduction = process.env['NODE_ENV'] === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateWorkerEnv,
    }),
    LoggerModule.forRoot({
      /** Same setup as the gateway: plain JSON in production, pretty logs locally. */
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
    MessagingModule,
    EmailsModule,
  ],
})
export class AppModule {}
