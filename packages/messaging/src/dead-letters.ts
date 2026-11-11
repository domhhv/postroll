import type { Connection } from 'rabbitmq-client';

import { createRoutedPublisher, UnroutableMessageError } from './routed-publisher.js';
import { eventsExchange, type WorkQueue, EVENTS_EXCHANGE } from './topology.js';
import { carriedProperties, RETRY_COUNT_HEADER } from './work-queue-consumer.js';

export type ReplayedMessage = {
  messageId: string | undefined;
  routingKey: string;
};

export type SkippedMessage = {
  messageId: string | undefined;
  reason: string;
};

export type ReplayResult = {
  moved: ReplayedMessage[];
  /** Messages that stay in the dead-letter queue. */
  skipped: SkippedMessage[];
};

function routingKeyOf(type: string | undefined, rawBody: Buffer): string | undefined {
  if (type) {
    return type;
  }

  try {
    const body: unknown = JSON.parse(rawBody.toString('utf8'));

    return typeof body === 'object' && body !== null && 'type' in body && typeof body.type === 'string'
      ? body.type
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Moves up to `limit` messages from a work queue's dead-letter queue back to
 * the events exchange with a fresh retry budget. A message is acked only once
 * its copy is routed to a queue. Messages that can't be moved (no type to
 * route by, or nothing bound for that type) are held unacked while the rest
 * are moved, then returned to the queue, so one bad message can't block the
 * others.
 */
export async function replayDeadLetters(
  connection: Connection,
  queue: WorkQueue,
  limit: number
): Promise<ReplayResult> {
  const publisher = createRoutedPublisher(connection, { exchanges: [eventsExchange] });
  const channel = await connection.acquire();
  const held: number[] = [];
  const result: ReplayResult = { moved: [], skipped: [] };

  try {
    while (result.moved.length < limit) {
      const message = await channel.basicGet({ queue: queue.deadLetterQueue.queue });

      if (!message) {
        break;
      }

      const routingKey = routingKeyOf(message.type, message.rawBody);

      if (!routingKey) {
        held.push(message.deliveryTag);
        result.skipped.push({ messageId: message.messageId, reason: 'no type to route by' });
        continue;
      }

      const { [RETRY_COUNT_HEADER]: _retries, 'x-death': _death, ...headers } = message.headers ?? {};

      try {
        await publisher.send(
          { ...carriedProperties(message), durable: true, exchange: EVENTS_EXCHANGE, headers, routingKey },
          message.rawBody
        );
      } catch (error) {
        if (!(error instanceof UnroutableMessageError)) {
          throw error;
        }

        held.push(message.deliveryTag);
        result.skipped.push({ messageId: message.messageId, reason: error.message });
        continue;
      }

      channel.basicAck({ deliveryTag: message.deliveryTag });
      result.moved.push({ messageId: message.messageId, routingKey });
    }

    for (const deliveryTag of held) {
      channel.basicNack({ deliveryTag, requeue: true });
    }
  } finally {
    await channel.close();
    await publisher.close();
  }

  return result;
}
