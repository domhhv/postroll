import { Injectable, type OnModuleInit, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailMessage } from '@postroll/contracts';
import {
  type Connection,
  EVENTS_EXCHANGE,
  createConnection,
  describeBrokerUrl,
  type EventPublisher,
  createEventPublisher,
} from '@postroll/messaging';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

import type { GatewayEnv } from '../env.js';

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`No broker confirm within ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Publishes to RabbitMQ over one connection per Function instance, opened on
 * first use. After the instance has been paused, `rabbitmq-client` notices the
 * dropped connection and reconnects. Without `AMQP_URL` (previews) the bus is
 * disabled and nothing is published.
 */
@Injectable()
export class EventBus implements OnModuleInit, OnApplicationShutdown {
  private connection: Connection | undefined;

  private publisher: EventPublisher | undefined;

  private readonly url: string | undefined;

  constructor(
    config: ConfigService<GatewayEnv, true>,
    @InjectPinoLogger(EventBus.name) private readonly logger: PinoLogger
  ) {
    this.url = config.get('AMQP_URL', { infer: true });
  }

  get enabled(): boolean {
    return this.url !== undefined;
  }

  onModuleInit() {
    if (this.url) {
      this.logger.info(
        { broker: describeBrokerUrl(this.url) },
        'Messaging enabled; the RabbitMQ connection opens on the first publish'
      );
    } else {
      this.logger.info('Messaging disabled: AMQP_URL is not set, so outbox events stay pending');
    }
  }

  /** Resolves once the broker confirms and routes the message; rejects after `timeoutMs`. */
  async publish(message: EmailMessage, timeoutMs: number): Promise<void> {
    this.logger.debug(
      { eventId: message.id, exchange: EVENTS_EXCHANGE, routingKey: message.type, timeoutMs },
      'Publishing to RabbitMQ'
    );
    await withTimeout(this.getPublisher().publish(message), timeoutMs);
  }

  async onApplicationShutdown() {
    if (!this.connection) {
      return;
    }

    this.logger.info('Closing the RabbitMQ connection');
    await this.publisher?.close();
    await this.connection.close();
  }

  private getPublisher(): EventPublisher {
    if (!this.url) {
      throw new Error('Messaging is disabled: AMQP_URL is not set');
    }

    if (!this.connection || !this.publisher) {
      const broker = describeBrokerUrl(this.url);
      this.logger.info({ broker }, 'Opening the RabbitMQ connection');

      const connection = createConnection({
        connectionName: 'postroll-gateway',
        url: this.url,
        onError: (error) =>
          this.logger.error({ broker, err: error }, 'RabbitMQ connection error; reconnecting with backoff'),
      });
      connection.on('connection', () => this.logger.info({ broker }, 'Connected to RabbitMQ'));
      connection.on('connection.blocked', (reason) =>
        this.logger.warn({ broker, reason }, 'RabbitMQ is blocking publishes on this connection')
      );
      connection.on('connection.unblocked', () => this.logger.info({ broker }, 'RabbitMQ unblocked this connection'));
      this.connection = connection;
      this.publisher = createEventPublisher(connection, 'postroll-gateway');
    }

    return this.publisher;
  }
}
