import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { PinoLogger } from 'nestjs-pino';

import type { SendError, SendResult, OutgoingEmail, EmailTransport } from './email-transport.js';

export type SimulatedFailure = 'permanent' | 'retryable';

const SIMULATED_ERRORS: Record<SimulatedFailure, SendError> = {
  permanent: { message: 'Simulated permanent failure', name: 'validation_error', statusCode: 422 },
  retryable: { message: 'Simulated transient failure', name: 'internal_server_error', statusCode: 500 },
};

/**
 * Local transport: writes the rendered HTML to the OS temp folder instead of
 * sending it. A simulated failure makes every send fail, to exercise the
 * retry queues and the dead-letter queue.
 */
export class LogTransport implements EmailTransport {
  constructor(
    private readonly logger: PinoLogger,
    private readonly simulate: SimulatedFailure | undefined
  ) {}

  async send(email: OutgoingEmail): Promise<SendResult> {
    if (this.simulate) {
      this.logger.info(
        { eventId: email.eventId, simulate: this.simulate },
        'Log transport is simulating a send failure'
      );

      return { error: SIMULATED_ERRORS[this.simulate], status: 'failed' };
    }

    const file = join(tmpdir(), `postroll-email-${email.eventId}.html`);
    await writeFile(file, email.html);
    this.logger.info(
      { category: email.category, eventId: email.eventId, file, subject: email.subject },
      'Email written to a file by the log transport'
    );

    return { id: `log-${email.eventId}`, status: 'sent' };
  }
}
