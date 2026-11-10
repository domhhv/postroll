import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Connection, createConnection } from '@postroll/messaging';
import { PinoLogger } from 'nestjs-pino';

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
      useFactory: (config: ConfigService, logger: PinoLogger) => {
        logger.setContext('Messaging');
        const connection = createConnection({
          connectionName: 'postroll-emails-worker',
          url: config.getOrThrow<string>('AMQP_URL'),
          onError: (error) => logger.error({ err: error }, 'RabbitMQ connection error'),
        });
        connection.on('connection', () => logger.info('Connected to RabbitMQ'));

        return connection;
      },
    },
  ],
})
export class MessagingModule implements OnApplicationShutdown {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /** Runs after every consumer has drained in `beforeApplicationShutdown`. */
  async onApplicationShutdown() {
    await this.connection.close();
  }
}
