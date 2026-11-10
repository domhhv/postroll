import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailMessage } from '@postroll/contracts';
import { type Connection, createConnection, type EventPublisher, createEventPublisher } from '@postroll/messaging';
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
export class EventBus implements OnApplicationShutdown {
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

  /** Resolves once the broker confirms the message; rejects after `timeoutMs`. */
  async publish(message: EmailMessage, timeoutMs: number): Promise<void> {
    await withTimeout(this.getPublisher().publish(message), timeoutMs);
  }

  async onApplicationShutdown() {
    await this.publisher?.close();
    await this.connection?.close();
  }

  private getPublisher(): EventPublisher {
    if (!this.url) {
      throw new Error('Messaging is disabled: AMQP_URL is not set');
    }

    if (!this.connection || !this.publisher) {
      this.connection = createConnection({
        connectionName: 'postroll-gateway',
        url: this.url,
        onError: (error) => this.logger.error({ err: error }, 'RabbitMQ connection error'),
      });
      this.publisher = createEventPublisher(this.connection, 'postroll-gateway');
    }

    return this.publisher;
  }
}
