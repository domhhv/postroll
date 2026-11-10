import type { EmailMessage } from '@postroll/contracts';
import type { Connection } from 'rabbitmq-client';

import { eventsExchange, EVENTS_EXCHANGE } from './topology.js';

export type EventPublisher = {
  close: () => Promise<void>;
  publish: (message: EmailMessage) => Promise<void>;
};

/**
 * Publishes to the events exchange with publisher confirms, so `publish`
 * resolves only once the broker has taken responsibility for the message.
 * Producers declare only the exchange; queues and bindings belong to their
 * consumers, which deploy first.
 */
export function createEventPublisher(connection: Connection, appId: string): EventPublisher {
  const publisher = connection.createPublisher({ confirm: true, exchanges: [eventsExchange], maxAttempts: 2 });

  return {
    close: () => publisher.close(),
    publish: (message) =>
      publisher.send(
        {
          appId,
          durable: true,
          exchange: EVENTS_EXCHANGE,
          messageId: message.id,
          routingKey: message.type,
          timestamp: Math.floor(Date.parse(message.occurredAt) / 1000),
          type: message.type,
        },
        message
      ),
  };
}
