import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { type EmailMessage, emailMessageSchema } from '@postroll/contracts';
import type { Prisma, PrismaClient } from '@postroll/database/prisma';
import { waitUntil } from '@vercel/functions';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

import { InjectPrisma } from '../database/database.module.js';
import { EventBus } from '../messaging/event-bus.service.js';

const DISPATCH_TIMEOUT_MS = 5_000;
const SWEEP_MIN_AGE_MS = 2 * 60_000;
const SWEEP_BATCH_SIZE = 100;
const RETENTION_MS = 7 * 24 * 60 * 60_000;

type WithoutEnvelope<M> = M extends unknown ? Omit<M, 'id' | 'occurredAt' | 'version'> : never;

/** A message before the outbox assigns its envelope fields. */
export type EmailMessageDraft = WithoutEnvelope<EmailMessage>;

export type DispatchResult = {
  failed: number;
  published: number;
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
 * the worker's idempotency keys absorb the rare duplicate.
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

    return id;
  }

  /** Call only after the enqueuing transaction has committed. Never throws. */
  dispatchAfterCommit(ids: string[]): void {
    waitUntil(
      this.dispatch(ids).catch((error: unknown) => {
        this.logger.error({ err: error, ids }, 'Outbox dispatch failed; the sweep will retry it');
      })
    );
  }

  /**
   * Publishes pending rows one by one, oldest first, and stops at the first
   * failure: when the broker is unreachable, the rest would fail too.
   */
  async dispatch(ids: string[]): Promise<DispatchResult> {
    if (ids.length === 0) {
      return { failed: 0, published: 0 };
    }

    if (!this.eventBus.enabled) {
      this.logger.info({ ids }, 'Messaging is disabled (no AMQP_URL); leaving outbox rows pending');

      return { failed: 0, published: 0 };
    }

    const rows = await this.prisma.outboxEvent.findMany({
      orderBy: { createdAt: 'asc' },
      where: { id: { in: ids }, publishedAt: null },
    });
    let published = 0;

    for (const row of rows) {
      try {
        await this.eventBus.publish(emailMessageSchema.parse(row.payload), DISPATCH_TIMEOUT_MS);
        await this.prisma.outboxEvent.update({
          data: { attempts: { increment: 1 }, lastError: null, publishedAt: new Date() },
          where: { id: row.id },
        });
        published += 1;
      } catch (error) {
        await this.prisma.outboxEvent.update({
          data: { attempts: { increment: 1 }, lastError: describe(error) },
          where: { id: row.id },
        });
        this.logger.warn({ err: error, eventId: row.id, type: row.type }, 'Outbox publish failed');

        return { failed: 1, published };
      }
    }

    return { failed: 0, published };
  }

  /** Re-publishes rows left pending by a failed dispatch, then prunes old published rows. */
  async sweep(): Promise<SweepResult> {
    const pending = await this.prisma.outboxEvent.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      take: SWEEP_BATCH_SIZE,
      where: { createdAt: { lt: new Date(Date.now() - SWEEP_MIN_AGE_MS) }, publishedAt: null },
    });
    const result = await this.dispatch(pending.map((row) => row.id));
    const { count: pruned } = await this.prisma.outboxEvent.deleteMany({
      where: { publishedAt: { lt: new Date(Date.now() - RETENTION_MS) } },
    });

    return { ...result, pending: pending.length, pruned };
  }
}
