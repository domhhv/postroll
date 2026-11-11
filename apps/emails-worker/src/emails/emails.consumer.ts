import { Inject, Injectable, type OnApplicationBootstrap, type BeforeApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EmailMessage, emailMessageSchema } from '@postroll/contracts';
import { renderEmail, type RenderedEmail } from '@postroll/emails';
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

import type { WorkerEnv } from '../env.js';
import { InjectConnection } from '../messaging/messaging.module.js';

import { classifySendError } from './classify-send-error.js';
import { EMAIL_TRANSPORT, type EmailTransport } from './transports/email-transport.js';

type ParseResult = { email: EmailMessage; ok: true } | { issues: string[]; ok: false };

/** Validation issues name the field and the problem, never the received value. */
function parseEmailMessage(rawBody: Buffer): ParseResult {
  let json: unknown;

  try {
    json = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return { issues: ['body is not valid JSON'], ok: false };
  }

  const result = emailMessageSchema.safeParse(json);

  if (result.success) {
    return { email: result.data, ok: true };
  }

  return {
    issues: result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.code}`),
    ok: false,
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Consumes `emails.send`: validates each message against the contract, renders
 * it and sends it. Every step logs the event id, which is also the gateway's
 * outbox id and the `event_id` tag on the email in Resend, so one id traces a
 * message end to end. Logs never contain the recipient address.
 */
@Injectable()
export class EmailsConsumer implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private consumer: WorkQueueConsumer | undefined;

  constructor(
    private readonly config: ConfigService<WorkerEnv, true>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
    @InjectPinoLogger(EmailsConsumer.name) private readonly logger: PinoLogger
  ) {}

  onApplicationBootstrap() {
    const concurrency = this.config.get('EMAIL_CONCURRENCY', { infer: true });
    this.logger.info(
      {
        appUrl: this.config.get('APP_URL', { infer: true }),
        concurrency,
        from: this.config.get('EMAIL_FROM', { infer: true }),
        replyTo: this.config.get('EMAIL_REPLY_TO', { infer: true }) ?? null,
        sendsPerSecond: this.config.get('EMAIL_SENDS_PER_SECOND', { infer: true }),
        transport: this.config.get('EMAIL_TRANSPORT', { infer: true }),
      },
      'Emails worker starting'
    );
    this.consumer = createWorkQueueConsumer({
      concurrency,
      connection: this.connection,
      queue: emailsWorkQueue,
      handle: (context) => this.handle(context),
      onError: (error) => this.logger.error({ err: error }, 'Email consumer error'),
      onReady: (event) => this.logger.info(event, 'Consuming messages; retry and dead-letter queues are in place'),
      onSettled: (event) => this.logSettled(event),
      onSettleFailed: ({ attempt, error, messageId, outcome, pauseMs }) =>
        this.logger.error(
          { attempt, err: error, eventId: messageId, outcome: outcome.type, pauseMs },
          'Could not ack, retry or dead-letter the message; requeueing it after a pause'
        ),
    });
  }

  /** Stops taking messages and waits for in-flight sends before the connection closes. */
  async beforeApplicationShutdown(signal?: string) {
    const started = Date.now();
    this.logger.info({ signal }, 'Shutting down: no new messages, waiting for in-flight sends');
    await this.consumer?.close();
    this.logger.info({ durationMs: Date.now() - started }, 'Consumer stopped; in-flight messages settled');
  }

  private async handle({ attempt, message }: WorkContext): Promise<WorkOutcome> {
    const started = Date.now();
    const parsed = parseEmailMessage(message.rawBody);
    this.logger.info(
      {
        attempt,
        deliveryTag: message.deliveryTag,
        eventId: message.messageId,
        redelivered: message.redelivered,
        routingKey: message.routingKey,
        sinceOccurredMs: parsed.ok ? started - Date.parse(parsed.email.occurredAt) : undefined,
        type: message.type,
      },
      'Message received'
    );

    if (!parsed.ok) {
      this.logger.warn(
        { attempt, eventId: message.messageId, issues: parsed.issues },
        'Message does not match the email contract'
      );

      return { reason: `Message does not match the email contract: ${parsed.issues.join('; ')}`, type: 'reject' };
    }

    const { email } = parsed;
    const context = { attempt, eventId: email.id, type: email.type, userId: email.data.userId };
    let rendered: RenderedEmail;

    try {
      rendered = await renderEmail(email, { appUrl: this.config.get('APP_URL', { infer: true }) });
    } catch (error) {
      this.logger.error({ ...context, err: error }, 'Email rendering failed');

      return { reason: `Rendering failed: ${describe(error)}`, type: 'retry' };
    }

    this.logger.info(
      {
        ...context,
        htmlBytes: Buffer.byteLength(rendered.html),
        renderMs: Date.now() - started,
        subject: rendered.subject,
        textBytes: Buffer.byteLength(rendered.text),
      },
      'Email rendered'
    );

    const sendStarted = Date.now();
    this.logger.info(
      { ...context, idempotencyKey: rendered.idempotencyKey, recipientDomain: email.data.to.split('@')[1] },
      'Sending email'
    );
    const result = await this.transport.send({ ...rendered, eventId: email.id, to: email.data.to });
    const timing = { sendMs: Date.now() - sendStarted, totalMs: Date.now() - started };

    if (result.status === 'sent') {
      this.logger.info({ ...context, ...timing, providerId: result.id }, 'Email sent');

      return { type: 'done' };
    }

    const { message: detail, name, statusCode } = result.error;
    const action = classifySendError(result.error);
    const reason = `${name} (${statusCode ?? 'no response'}): ${detail}`;
    this.logger.warn(
      { ...context, ...timing, action, errorMessage: detail, errorName: name, statusCode },
      'Email send failed'
    );

    switch (action) {
      case 'already-sent':
        this.logger.warn(context, 'Email was already accepted under this idempotency key; treating it as sent');

        return { type: 'done' };

      case 'retry':
        return { reason, type: 'retry' };

      case 'reject':
        return { reason, type: 'reject' };
    }
  }

  private logSettled({ action, attempt, messageId, outcome, retry }: SettledEvent) {
    const fields = { attempt, eventId: messageId, ...(outcome.type !== 'done' && { reason: outcome.reason }) };

    switch (action) {
      case 'ack':
        this.logger.info(fields, 'Message acknowledged');
        break;

      case 'retry':
        this.logger.warn(
          { ...fields, nextAttempt: attempt + 1, retryInMs: retry?.delayMs, retryQueue: retry?.queue },
          'Scheduled a retry'
        );
        break;

      case 'dead-letter':
        this.logger.error(fields, 'Message moved to the dead-letter queue; replay it once the cause is fixed');
        break;
    }
  }
}
