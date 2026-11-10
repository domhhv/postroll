import { Inject, Injectable, type OnApplicationBootstrap, type BeforeApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EmailMessage, emailMessageSchema } from '@postroll/contracts';
import { renderEmail } from '@postroll/emails';
import {
  type Connection,
  emailsWorkQueue,
  type WorkOutcome,
  type WorkContext,
  type SettledEvent,
  type WorkQueueConsumer,
  createWorkQueueConsumer,
} from '@postroll/messaging';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

import { InjectConnection } from '../messaging/messaging.module.js';

import { classifySendError } from './classify-send-error.js';
import { EMAIL_TRANSPORT, type EmailTransport } from './transports/email-transport.js';

function parseEmailMessage(rawBody: Buffer): EmailMessage | undefined {
  try {
    const result = emailMessageSchema.safeParse(JSON.parse(rawBody.toString('utf8')));

    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Consumes `emails.send`: validates each message against the contract, renders
 * it and sends it. Logs carry ids and outcomes, never the recipient address.
 */
@Injectable()
export class EmailsConsumer implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private consumer: WorkQueueConsumer | undefined;

  constructor(
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
    @InjectPinoLogger(EmailsConsumer.name) private readonly logger: PinoLogger
  ) {}

  onApplicationBootstrap() {
    this.consumer = createWorkQueueConsumer({
      concurrency: this.config.getOrThrow<number>('EMAIL_CONCURRENCY'),
      connection: this.connection,
      queue: emailsWorkQueue,
      handle: (context) => this.handle(context),
      onError: (error) => this.logger.error({ err: error }, 'Email consumer error'),
      onSettled: (event) => this.logSettled(event),
    });
  }

  /** Stops taking messages and waits for in-flight sends before the connection closes. */
  async beforeApplicationShutdown() {
    await this.consumer?.close();
  }

  private async handle({ attempt, message }: WorkContext): Promise<WorkOutcome> {
    const email = parseEmailMessage(message.rawBody);

    if (!email) {
      return { reason: 'Message does not match the email contract', type: 'reject' };
    }

    const rendered = await renderEmail(email, { appUrl: this.config.getOrThrow<string>('APP_URL') });
    const result = await this.transport.send({ ...rendered, eventId: email.id, to: email.data.to });
    const context = { attempt, eventId: email.id, type: email.type };

    if (result.status === 'sent') {
      this.logger.info({ ...context, providerId: result.id }, 'Email sent');

      return { type: 'done' };
    }

    const reason = `${result.error.name} (${result.error.statusCode ?? 'no response'}): ${result.error.message}`;

    switch (classifySendError(result.error)) {
      case 'already-sent':
        this.logger.warn({ ...context, reason }, 'Email was already accepted under this idempotency key');

        return { type: 'done' };

      case 'retry':
        return { reason, type: 'retry' };

      case 'reject':
        return { reason, type: 'reject' };
    }
  }

  private logSettled({ action, attempt, messageId, outcome, retryQueue }: SettledEvent) {
    const reason = outcome.type === 'done' ? undefined : outcome.reason;

    if (action === 'retry') {
      this.logger.warn({ attempt, eventId: messageId, reason, retryQueue }, 'Email send failed; scheduled a retry');
    }

    if (action === 'dead-letter') {
      this.logger.error({ attempt, eventId: messageId, reason }, 'Email moved to the dead-letter queue');
    }
  }
}
