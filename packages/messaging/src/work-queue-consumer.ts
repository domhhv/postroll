import { type Envelope, ConsumerStatus, type Connection, type HeaderFields, type AsyncMessage } from 'rabbitmq-client';

import { eventsExchange, type WorkQueue, deadLetterExchange } from './topology.js';

export const RETRY_COUNT_HEADER = 'x-retry-count';

export type WorkOutcome = { type: 'done' } | { reason: string; type: 'reject' } | { reason: string; type: 'retry' };

export type WorkContext = {
  /** 1 for the first delivery, one more for every retry. */
  attempt: number;
  message: AsyncMessage;
};

export type SettledEvent = {
  action: 'ack' | 'dead-letter' | 'retry';
  attempt: number;
  messageId: string | undefined;
  outcome: WorkOutcome;
  retryQueue?: string;
};

type WorkQueueConsumerOptions = {
  concurrency: number;
  connection: Connection;
  queue: WorkQueue;
  handle: (context: WorkContext) => Promise<WorkOutcome>;
  onError: (error: unknown) => void;
  onSettled: (event: SettledEvent) => void;
};

export type WorkQueueConsumer = {
  /** Stops new deliveries and waits for in-flight handlers to settle. */
  close: () => Promise<void>;
};

function retryCountOf(message: AsyncMessage): number {
  const count = Number(message.headers?.[RETRY_COUNT_HEADER] ?? 0);

  return Number.isInteger(count) && count >= 0 ? count : 0;
}

/** Message properties a retried copy keeps, so it stays traceable to the original. */
export function carriedProperties({ appId, contentType, messageId, timestamp, type }: HeaderFields): Envelope {
  return {
    ...(appId !== undefined && { appId }),
    ...(contentType !== undefined && { contentType }),
    ...(messageId !== undefined && { messageId }),
    ...(timestamp !== undefined && { timestamp }),
    ...(type !== undefined && { type }),
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Consumes a work queue with manual acknowledgements.
 *
 * - `done`: ack.
 * - `retry`: republish a copy to the next TTL queue (it dead-letters back here
 *   once the delay passes), then ack the original. No requeue loop, and the
 *   retry count travels in a header because classic queues don't count
 *   deliveries.
 * - `reject`, or `retry` with no tiers left: nack without requeue, which
 *   routes the message to the dead-letter queue.
 *
 * A handler that throws is treated as `retry`. Retry and dead-letter queues are
 * declared on every (re)connect, so alarms can watch them, and again right
 * before use, because CloudAMQP deletes queues that sit idle.
 */
export function createWorkQueueConsumer({
  concurrency,
  connection,
  handle,
  onError,
  onSettled,
  queue,
}: WorkQueueConsumerOptions): WorkQueueConsumer {
  const retryPublisher = connection.createPublisher({
    confirm: true,
    exchanges: [deadLetterExchange],
    maxAttempts: 2,
    queueBindings: [queue.deadLetterBinding],
    queues: [queue.deadLetterQueue, ...queue.retryTiers.map((tier) => tier.declaration)],
  });

  async function declareDeadLetterQueue() {
    await connection.exchangeDeclare(deadLetterExchange);
    await connection.queueDeclare(queue.deadLetterQueue);
    await connection.queueBind(queue.deadLetterBinding);
  }

  async function declareRetryQueues() {
    await Promise.all(queue.retryTiers.map((tier) => connection.queueDeclare(tier.declaration)));
  }

  async function settle(message: AsyncMessage, attempt: number, outcome: WorkOutcome): Promise<ConsumerStatus> {
    const event = { attempt, messageId: message.messageId, outcome };

    if (outcome.type === 'done') {
      onSettled({ ...event, action: 'ack' });

      return ConsumerStatus.ACK;
    }

    const tier = outcome.type === 'retry' ? queue.retryTiers[attempt - 1] : undefined;

    if (!tier) {
      await declareDeadLetterQueue();
      onSettled({ ...event, action: 'dead-letter' });

      return ConsumerStatus.DROP;
    }

    await connection.queueDeclare(tier.declaration);
    await retryPublisher.send(
      {
        ...carriedProperties(message),
        durable: true,
        exchange: '',
        headers: { ...message.headers, [RETRY_COUNT_HEADER]: attempt },
        routingKey: tier.declaration.queue,
      },
      message.rawBody
    );
    onSettled({ ...event, action: 'retry', retryQueue: tier.declaration.queue });

    return ConsumerStatus.ACK;
  }

  const consumer = connection.createConsumer(
    {
      concurrency,
      exchanges: [eventsExchange],
      qos: { prefetchCount: concurrency },
      queue: queue.name,
      queueBindings: queue.bindings,
      queueOptions: queue.declaration,
    },
    async (message) => {
      const attempt = retryCountOf(message) + 1;
      const outcome = await handle({ attempt, message }).catch((error: unknown): WorkOutcome => ({
        reason: describe(error),
        type: 'retry',
      }));

      return settle(message, attempt, outcome);
    }
  );

  consumer.on('error', onError);
  consumer.on('ready', () => {
    void Promise.all([declareDeadLetterQueue(), declareRetryQueues()]).catch(onError);
  });

  return {
    close: async () => {
      await consumer.close();
      await retryPublisher.close();
    },
  };
}
