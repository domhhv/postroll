import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import type { WorkerEnv } from '../env.js';

import { EmailsConsumer } from './emails.consumer.js';
import { EMAIL_TRANSPORT, type EmailTransport } from './transports/email-transport.js';
import { LogTransport } from './transports/log.transport.js';
import { ResendTransport } from './transports/resend.transport.js';

@Module({
  providers: [
    EmailsConsumer,
    {
      inject: [ConfigService, PinoLogger],
      provide: EMAIL_TRANSPORT,
      useFactory: (config: ConfigService<WorkerEnv, true>, logger: PinoLogger): EmailTransport => {
        if (config.get('EMAIL_TRANSPORT', { infer: true }) === 'log') {
          logger.setContext(LogTransport.name);

          return new LogTransport(logger, config.get('EMAIL_LOG_SIMULATE', { infer: true }));
        }

        return new ResendTransport({
          apiKey: config.getOrThrow('RESEND_API_KEY', { infer: true }),
          from: config.get('EMAIL_FROM', { infer: true }),
          replyTo: config.get('EMAIL_REPLY_TO', { infer: true }),
        });
      },
    },
  ],
})
export class EmailsModule {}
