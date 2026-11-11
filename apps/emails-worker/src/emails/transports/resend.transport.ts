import type { PinoLogger } from 'nestjs-pino';
import { Resend } from 'resend';

import { SendPacer } from '../send-pacer.js';

import type { SendResult, OutgoingEmail, EmailTransport } from './email-transport.js';

const SEND_TIMEOUT_MS = 10_000;

type ResendTransportOptions = {
  apiKey: string;
  from: string;
  replyTo: string | undefined;
  sendsPerSecond: number;
};

/**
 * Sends through Resend with an idempotency key, so a redelivered or retried
 * message within 24 hours returns the original result instead of a second
 * email. Sends are paced to stay under Resend's rate limit.
 */
export class ResendTransport implements EmailTransport {
  private readonly resend: Resend;

  private readonly pacer: SendPacer;

  constructor(
    private readonly options: ResendTransportOptions,
    private readonly logger: PinoLogger
  ) {
    this.resend = new Resend(options.apiKey);
    this.pacer = new SendPacer(options.sendsPerSecond);
  }

  async send(email: OutgoingEmail): Promise<SendResult> {
    const { from, replyTo } = this.options;
    const waitedMs = await this.pacer.wait();

    if (waitedMs > 0) {
      this.logger.debug({ eventId: email.eventId, waitedMs }, 'Waited for a slot under the Resend rate limit');
    }

    const started = Date.now();

    try {
      const { data, error, headers } = await this.resend.emails.send(
        {
          from,
          html: email.html,
          subject: email.subject,
          text: email.text,
          to: [email.to],
          ...(replyTo !== undefined && { replyTo }),
          tags: [
            { name: 'category', value: email.category },
            { name: 'event_id', value: email.eventId },
          ],
        },
        { idempotencyKey: email.idempotencyKey, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) }
      );
      this.logger.debug(
        {
          durationMs: Date.now() - started,
          eventId: email.eventId,
          rateLimitRemaining: headers?.['ratelimit-remaining'],
          retryAfter: headers?.['retry-after'],
          statusCode: error ? error.statusCode : 200,
        },
        'Resend responded'
      );

      return error ? { error, status: 'failed' } : { id: data.id, status: 'sent' };
    } catch (error) {
      this.logger.debug(
        { durationMs: Date.now() - started, err: error, eventId: email.eventId },
        'Resend request failed'
      );

      return {
        status: 'failed',
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: 'request_failed',
          statusCode: null,
        },
      };
    }
  }
}
