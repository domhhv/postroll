import { z, validateEnv } from '@postroll/env';
import { emailsWorkQueue, createConnection, replayDeadLetters } from '@postroll/messaging';

import { envExampleHint } from '../env.js';

/**
 * Moves messages from `emails.send.dlq` back to the events exchange with a
 * fresh retry budget, once the cause of the failures is fixed.
 * Usage: `pnpm --filter @postroll/emails-worker dlq:replay [limit]` (default 100).
 */
const { AMQP_URL } = validateEnv(z.object({ AMQP_URL: z.url() }), {
  contextLabel: '@postroll/emails-worker (dlq:replay)',
  envFileRelativePath: '../../.env',
  exampleHint: envExampleHint,
  importMetaUrl: import.meta.url,
});

const limit = Number(process.argv[2] ?? 100);
const connection = createConnection({
  connectionName: 'postroll-dlq-replay',
  url: AMQP_URL,
  onError: (error) => console.error('RabbitMQ connection error', error),
});

try {
  const { moved, skipped } = await replayDeadLetters(connection, emailsWorkQueue, limit);

  for (const message of moved) {
    console.info(`Moved ${message.messageId ?? '(no message id)'} back with routing key ${message.routingKey}`);
  }

  for (const message of skipped) {
    console.warn(`Kept ${message.messageId ?? '(no message id)'} in the dead-letter queue: ${message.reason}`);
  }

  console.info(
    `Moved ${moved.length} message(s) back to the events exchange; ${skipped.length} stay in ${emailsWorkQueue.deadLetterQueue.queue}.`
  );
} finally {
  await connection.close();
}
