import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Connection, createConnection, describeBrokerUrl } from '@postroll/messaging';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

import type { WorkerEnv } from '../env.js';

export const AMQP_CONNECTION = Symbol('AMQP_CONNECTION');

export function InjectConnection() {
  return Inject(AMQP_CONNECTION);
}

@Global()
@Module({
  exports: [AMQP_CONNECTION],
  providers: [
    {
      inject: [ConfigService, PinoLogger],
      provide: AMQP_CONNECTION,
      useFactory: (config: ConfigService<WorkerEnv, true>, logger: PinoLogger) => {
        logger.setContext('Messaging');
        const url = config.get('AMQP_URL', { infer: true });
        const broker = describeBrokerUrl(url);
        logger.info({ broker }, 'Connecting to RabbitMQ');

        const connection = createConnection({
          connectionName: 'postroll-emails-worker',
          url,
          onError: (error) =>
            logger.error({ broker, err: error }, 'RabbitMQ connection error; reconnecting with backoff'),
        });
        connection.on('connection', () => logger.info({ broker }, 'Connected to RabbitMQ'));
        connection.on('connection.blocked', (reason) =>
          logger.warn({ broker, reason }, 'RabbitMQ is blocking publishes on this connection; retries wait for it')
        );
        connection.on('connection.unblocked', () => logger.info({ broker }, 'RabbitMQ unblocked this connection'));

        return connection;
      },
    },
  ],
})
export class MessagingModule implements OnApplicationShutdown {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectPinoLogger(MessagingModule.name) private readonly logger: PinoLogger
  ) {}

  /** Runs after every consumer has drained in `beforeApplicationShutdown`. */
  async onApplicationShutdown(signal?: string) {
    this.logger.info({ signal }, 'Closing the RabbitMQ connection');
    await this.connection.close();
    this.logger.info('RabbitMQ connection closed');
  }
}
