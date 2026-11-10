import { Resend } from 'resend';

import type { SendResult, OutgoingEmail, EmailTransport } from './email-transport.js';

const SEND_TIMEOUT_MS = 10_000;

type ResendTransportOptions = {
  apiKey: string;
  from: string;
  replyTo: string | undefined;
};

/**
 * Sends through Resend with an idempotency key, so a redelivered or retried
 * message within 24 hours returns the original result instead of a second email.
 */
export class ResendTransport implements EmailTransport {
  private readonly resend: Resend;

  constructor(private readonly options: ResendTransportOptions) {
    this.resend = new Resend(options.apiKey);
  }

  async send(email: OutgoingEmail): Promise<SendResult> {
    const { from, replyTo } = this.options;

    try {
      const { data, error } = await this.resend.emails.send(
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

      return error ? { error, status: 'failed' } : { id: data.id, status: 'sent' };
    } catch (error) {
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
