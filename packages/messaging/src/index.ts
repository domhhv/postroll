export { type ConnectionConfig, createConnection, describeBrokerUrl } from './connection.js';
export { type ReplayResult, type ReplayedMessage, type SkippedMessage, replayDeadLetters } from './dead-letters.js';
export { type EventPublisher, createEventPublisher } from './publisher.js';
export {
  type RoutedPublisher,
  PUBLISH_ID_HEADER,
  createRoutedPublisher,
  UnroutableMessageError,
} from './routed-publisher.js';
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
  type ReadyEvent,
  type WorkOutcome,
  type WorkContext,
  type SettledEvent,
  RETRY_COUNT_HEADER,
  type SettleFailedEvent,
  type WorkQueueConsumer,
  createWorkQueueConsumer,
} from './work-queue-consumer.js';
export type { AsyncMessage, Connection } from 'rabbitmq-client';
