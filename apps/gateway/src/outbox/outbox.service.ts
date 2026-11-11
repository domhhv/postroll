import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { type EmailMessage, emailMessageSchema } from '@postroll/contracts';
import type { Prisma, PrismaClient } from '@postroll/database/prisma';
import { UnroutableMessageError } from '@postroll/messaging';
import { waitUntil } from '@vercel/functions';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

import { InjectPrisma } from '../database/database.module.js';
import { EventBus } from '../messaging/event-bus.service.js';

const DISPATCH_TIMEOUT_MS = 5_000;
const SWEEP_MIN_AGE_MS = 2 * 60_000;
const SWEEP_BATCH_SIZE = 100;
const STALE_PENDING_MS = 60 * 60_000;
const RETENTION_MS = 7 * 24 * 60 * 60_000;

type WithoutEnvelope<M> = M extends unknown ? Omit<M, 'id' | 'occurredAt' | 'version'> : never;

/** A message before the outbox assigns its envelope fields. */
export type EmailMessageDraft = WithoutEnvelope<EmailMessage>;

/** What started a dispatch: the request that enqueued the events, or the hourly sweep. */
export type DispatchTrigger = 'after-commit' | 'sweep';

export type DispatchResult = {
  failed: number;
  published: number;
  /** Events not attempted: already published, deleted, behind a failure, or messaging is off. */
  skipped: number;
};

export type SweepResult = DispatchResult & {
  pending: number;
  pruned: number;
};

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Transactional outbox. `enqueue` writes a message in the same transaction as
 * the change that caused it, so the two commit or roll back together.
 * `dispatchAfterCommit` publishes it right away; `sweep` re-publishes anything
 * a failed or interrupted dispatch left behind. Delivery is at-least-once, and
 * the worker's idempotency keys absorb the rare duplicate. Every log line
 * carries the event id, which is also the RabbitMQ message id, the id in the
 * worker's logs, and the `event_id` tag on the email in Resend.
 */
@Injectable()
export class OutboxService {
  constructor(
    private readonly eventBus: EventBus,
    @InjectPrisma() private readonly prisma: PrismaClient,
    @InjectPinoLogger(OutboxService.name) private readonly logger: PinoLogger
  ) {}

  async enqueue(tx: Prisma.TransactionClient, draft: EmailMessageDraft): Promise<string> {
    const id = randomUUID();
    const occurredAt = new Date();
    const message = emailMessageSchema.parse({ ...draft, id, occurredAt: occurredAt.toISOString(), version: 1 });

    await tx.outboxEvent.create({
      data: { createdAt: occurredAt, id, payload: message, type: message.type },
    });
    this.logger.debug({ eventId: id, type: message.type }, 'Outbox event written; it is published after commit');

    return id;
  }

  /** Call only after the enqueuing transaction has committed. Never throws. */
  dispatchAfterCommit(ids: string[]): void {
    this.logger.info({ eventIds: ids }, 'Dispatching outbox events after commit');
    waitUntil(
      this.dispatch(ids, 'after-commit').catch((error: unknown) => {
        this.logger.error({ err: error, eventIds: ids }, 'Outbox dispatch crashed; the sweep will retry these events');
      })
    );
  }

  /**
   * Publishes pending rows one by one, oldest first, and stops at the first
   * failure: when the broker is unreachable, the rest would fail too.
   */
  async dispatch(ids: string[], trigger: DispatchTrigger): Promise<DispatchResult> {
    if (ids.length === 0) {
      return { failed: 0, published: 0, skipped: 0 };
    }

    if (!this.eventBus.enabled) {
      this.logger.info(
        { eventIds: ids, trigger },
        'Messaging is disabled (no AMQP_URL); leaving outbox events pending'
      );

      return { failed: 0, published: 0, skipped: ids.length };
    }

    const started = Date.now();
    const rows = await this.prisma.outboxEvent.findMany({
      orderBy: { createdAt: 'asc' },
      where: { id: { in: ids }, publishedAt: null },
    });
    const notPending = ids.filter((id) => !rows.some((row) => row.id === id));

    if (notPending.length > 0) {
      this.logger.info(
        { eventIds: notPending, trigger },
        'Skipping outbox events that are already published or no longer exist'
      );
    }

    let published = 0;
    let failed = 0;

    for (const row of rows) {
      const context = { attempt: row.attempts + 1, eventId: row.id, trigger, type: row.type };
      const publishStarted = Date.now();

      try {
        await this.eventBus.publish(emailMessageSchema.parse(row.payload), DISPATCH_TIMEOUT_MS);
        await this.prisma.outboxEvent.update({
          data: { attempts: { increment: 1 }, lastError: null, publishedAt: new Date() },
          where: { id: row.id },
        });
        published += 1;
        this.logger.info(
          { ...context, ageMs: Date.now() - row.createdAt.getTime(), publishMs: Date.now() - publishStarted },
          'Outbox event published to RabbitMQ'
        );
      } catch (error) {
        await this.prisma.outboxEvent.update({
          data: { attempts: { increment: 1 }, lastError: describe(error) },
          where: { id: row.id },
        });
        failed = 1;
        this.logger.warn(
          {
            ...context,
            err: error,
            publishMs: Date.now() - publishStarted,
            unroutable: error instanceof UnroutableMessageError,
          },
          error instanceof UnroutableMessageError
            ? 'Outbox event not published: no queue is bound for it yet (is the worker running?); the sweep will retry'
            : 'Outbox event not published; the sweep will retry it'
        );
        break;
      }
    }

    const result = { failed, published, skipped: ids.length - published - failed };
    this.logger.info({ ...result, durationMs: Date.now() - started, trigger }, 'Outbox dispatch finished');

    return result;
  }

  /** Re-publishes rows left pending by a failed dispatch, then prunes old published rows. */
  async sweep(): Promise<SweepResult> {
    const started = Date.now();
    const pending = await this.prisma.outboxEvent.findMany({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, id: true },
      take: SWEEP_BATCH_SIZE,
      where: { createdAt: { lt: new Date(Date.now() - SWEEP_MIN_AGE_MS) }, publishedAt: null },
    });
    const oldest = pending[0];
    this.logger.info({ pending: pending.length }, 'Outbox sweep started');

    if (oldest && Date.now() - oldest.createdAt.getTime() > STALE_PENDING_MS) {
      this.logger.warn(
        { oldestAgeMs: Date.now() - oldest.createdAt.getTime(), oldestEventId: oldest.id, pending: pending.length },
        'Outbox events have been pending for over an hour; check AMQP_URL, the broker and the worker'
      );
    }

    const result = await this.dispatch(
      pending.map((row) => row.id),
      'sweep'
    );
    const { count: pruned } = await this.prisma.outboxEvent.deleteMany({
      where: { publishedAt: { lt: new Date(Date.now() - RETENTION_MS) } },
    });
    const summary = { ...result, pending: pending.length, pruned };
    this.logger.info({ ...summary, durationMs: Date.now() - started }, 'Outbox sweep finished');

    return summary;
  }
}
