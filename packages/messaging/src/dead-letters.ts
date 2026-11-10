import type { Connection } from 'rabbitmq-client';

import { eventsExchange, type WorkQueue, EVENTS_EXCHANGE } from './topology.js';
import { carriedProperties, RETRY_COUNT_HEADER } from './work-queue-consumer.js';

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

export type ReplayResult = {
  moved: number;
  /** Messages with no routable type; they stay in the dead-letter queue. */
  skipped: number;
};

/**
 * Moves up to `limit` messages from a work queue's dead-letter queue back to
 * the events exchange with a fresh retry budget. Messages without a routable
 * type are held unacked while the rest are moved, then returned to the queue,
 * so one unreadable message can't block the others.
 */
export async function replayDeadLetters(
  connection: Connection,
  queue: WorkQueue,
  limit: number
): Promise<ReplayResult> {
  const publisher = connection.createPublisher({ confirm: true, exchanges: [eventsExchange] });
  const channel = await connection.acquire();
  const skippedTags: number[] = [];
  let moved = 0;

  try {
    while (moved < limit) {
      const message = await channel.basicGet({ queue: queue.deadLetterQueue.queue });

      if (!message) {
        break;
      }

      const routingKey = routingKeyOf(message.type, message.rawBody);

      if (!routingKey) {
        skippedTags.push(message.deliveryTag);
        continue;
      }

      const { [RETRY_COUNT_HEADER]: _retries, 'x-death': _death, ...headers } = message.headers ?? {};

      await publisher.send(
        { ...carriedProperties(message), durable: true, exchange: EVENTS_EXCHANGE, headers, routingKey },
        message.rawBody
      );
      channel.basicAck({ deliveryTag: message.deliveryTag });
      moved += 1;
    }

    for (const deliveryTag of skippedTags) {
      channel.basicNack({ deliveryTag, requeue: true });
    }
  } finally {
    await channel.close();
    await publisher.close();
  }

  return { moved, skipped: skippedTags.length };
}
