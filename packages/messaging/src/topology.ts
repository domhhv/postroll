import type { PublisherProps } from 'rabbitmq-client';

type ExchangeDeclaration = NonNullable<PublisherProps['exchanges']>[number];
type QueueDeclaration = NonNullable<PublisherProps['queues']>[number] & { queue: string };
type QueueBinding = NonNullable<PublisherProps['queueBindings']>[number];

export const EVENTS_EXCHANGE = 'postroll.events';

export const DEAD_LETTER_EXCHANGE = 'postroll.dlx';

export const eventsExchange = {
  durable: true,
  exchange: EVENTS_EXCHANGE,
  type: 'topic',
} satisfies ExchangeDeclaration;

export const deadLetterExchange = {
  durable: true,
  exchange: DEAD_LETTER_EXCHANGE,
  type: 'direct',
} satisfies ExchangeDeclaration;

export type RetryTier = {
  declaration: QueueDeclaration;
  delayMs: number;
};

export type WorkQueue = {
  bindings: QueueBinding[];
  deadLetterBinding: QueueBinding;
  deadLetterQueue: QueueDeclaration;
  declaration: QueueDeclaration;
  name: string;
  retryTiers: RetryTier[];
};

type WorkQueueOptions = {
  name: string;
  retryDelaysMs: number[];
  routingKeys: string[];
};

const DELAY_UNITS = [
  { ms: 3_600_000, suffix: 'h' },
  { ms: 60_000, suffix: 'm' },
  { ms: 1_000, suffix: 's' },
];

function formatDelay(delayMs: number): string {
  const unit = DELAY_UNITS.find(({ ms }) => delayMs % ms === 0);

  return unit ? `${delayMs / unit.ms}${unit.suffix}` : `${delayMs}ms`;
}

/**
 * A durable work queue bound to the events exchange, plus one TTL queue per
 * retry delay and a dead-letter queue. Per-delay queues avoid head-of-line
 * blocking: classic queues only expire messages at the head. Retry queues
 * dead-letter back to the work queue through the default exchange, so a
 * retried message never reaches other queues bound to the same routing key.
 */
export function defineWorkQueue({ name, retryDelaysMs, routingKeys }: WorkQueueOptions): WorkQueue {
  const deadLetterQueue = `${name}.dlq`;

  return {
    bindings: routingKeys.map((routingKey) => ({ exchange: EVENTS_EXCHANGE, queue: name, routingKey })),
    deadLetterBinding: { exchange: DEAD_LETTER_EXCHANGE, queue: deadLetterQueue, routingKey: name },
    name,
    deadLetterQueue: {
      arguments: { 'x-max-length': 1000, 'x-overflow': 'drop-head', 'x-queue-type': 'classic' },
      durable: true,
      queue: deadLetterQueue,
    },
    declaration: {
      durable: true,
      queue: name,
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-dead-letter-routing-key': name,
        'x-queue-type': 'classic',
      },
    },
    retryTiers: retryDelaysMs.map((delayMs) => ({
      delayMs,
      declaration: {
        durable: true,
        queue: `${name}.retry.${formatDelay(delayMs)}`,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': name,
          'x-message-ttl': delayMs,
          'x-queue-type': 'classic',
        },
      },
    })),
  };
}

/** Four retries spread over about 71 minutes, well inside Resend's 24-hour idempotency window. */
export const emailsWorkQueue = defineWorkQueue({
  name: 'emails.send',
  retryDelaysMs: [10_000, 60_000, 600_000, 3_600_000],
  routingKeys: ['email.*'],
});
