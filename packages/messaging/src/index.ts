export { type ConnectionConfig, createConnection } from './connection.js';
export { type ReplayResult, replayDeadLetters } from './dead-letters.js';
export { type EventPublisher, createEventPublisher } from './publisher.js';
export {
  defineWorkQueue,
  EVENTS_EXCHANGE,
  eventsExchange,
  type RetryTier,
  type WorkQueue,
  emailsWorkQueue,
  deadLetterExchange,
  DEAD_LETTER_EXCHANGE,
} from './topology.js';
export {
  type WorkOutcome,
  type WorkContext,
  type SettledEvent,
  RETRY_COUNT_HEADER,
  type WorkQueueConsumer,
  createWorkQueueConsumer,
} from './work-queue-consumer.js';
export type { AsyncMessage, Connection } from 'rabbitmq-client';
