import { randomUUID } from 'node:crypto';

import type { Envelope, Connection, MessageBody, PublisherProps } from 'rabbitmq-client';

export const PUBLISH_ID_HEADER = 'x-publish-id';

/** The broker accepted the message, but no queue was bound to receive it, so it was dropped. */
export class UnroutableMessageError extends Error {
  constructor(
    readonly exchange: string,
    readonly routingKey: string
  ) {
    super(
      `No queue is bound to ${exchange === '' ? 'the default exchange' : `"${exchange}"`} for routing key "${routingKey}"`
    );
    this.name = 'UnroutableMessageError';
  }
}

export type RoutedPublisher = {
  close: () => Promise<void>;
  /** Resolves once the broker has confirmed the message and routed it to at least one queue. */
  send: (envelope: Envelope, body: MessageBody) => Promise<void>;
};

/**
 * A confirming publisher that also catches unroutable messages. A confirm on
 * its own also succeeds for a message no queue receives, so every publish is
 * `mandatory`: the broker sends an unroutable message back (`basic.return`)
 * before confirming it, and `send` rejects with `UnroutableMessageError`.
 * Returns are matched to their publish through the `x-publish-id` header.
 */
export function createRoutedPublisher(
  connection: Connection,
  props: Omit<PublisherProps, 'confirm'> = {}
): RoutedPublisher {
  const publisher = connection.createPublisher({ ...props, confirm: true });
  const returned = new Map<string, boolean>();

  publisher.on('basic.return', (message) => {
    const publishId = message.headers?.[PUBLISH_ID_HEADER];

    if (typeof publishId === 'string' && returned.has(publishId)) {
      returned.set(publishId, true);
    }
  });

  return {
    close: () => publisher.close(),
    send: async (envelope, body) => {
      const publishId = randomUUID();
      returned.set(publishId, false);

      try {
        await publisher.send(
          { ...envelope, headers: { ...envelope.headers, [PUBLISH_ID_HEADER]: publishId }, mandatory: true },
          body
        );
        /** `rabbitmq-client` emits returns with `setImmediate`, after the confirm has already resolved. */
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        if (returned.get(publishId)) {
          throw new UnroutableMessageError(envelope.exchange ?? '', envelope.routingKey ?? '');
        }
      } finally {
        returned.delete(publishId);
      }
    },
  };
}
