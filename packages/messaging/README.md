# `@postroll/messaging`

RabbitMQ topology, publisher and work-queue consumer shared by the gateway (publisher) and [`@postroll/emails-worker`](../../apps/emails-worker/README.md) (consumer), built on [`rabbitmq-client`](https://github.com/cody-greene/node-rabbitmq-client). The client handles reconnects, re-declares topology and resubscribes after a reconnect, and supports publisher confirms. This package owns the queue layout and the retry policy. It also runs the local RabbitMQ for `pnpm dev`.

## Topology

Defined once in [`src/topology.ts`](src/topology.ts). `defineWorkQueue()` builds the same shape for any future queue, e.g. video processing.

| Name                                | Kind                    | Arguments / binding                                                                                    | Declared by        |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------ |
| `postroll.events`                   | topic exchange, durable |                                                                                                        | gateway and worker |
| `emails.send`                       | classic queue, durable  | bound with `email.*`; `x-dead-letter-exchange: postroll.dlx`, `x-dead-letter-routing-key: emails.send` | worker             |
| `emails.send.retry.{10s,1m,10m,1h}` | classic queues          | `x-message-ttl`; dead-letter through the default exchange back to `emails.send`                        | worker             |
| `postroll.dlx`                      | direct exchange         |                                                                                                        | worker             |
| `emails.send.dlq`                   | classic queue           | bound with `emails.send`; `x-max-length: 1000`, oldest dropped first                                   | worker             |

Producers declare exchanges; consumers declare their queues and bindings. A message published before its consumer has ever declared the queue is dropped as unroutable, which is why the worker always deploys first.

## Retries and dead letters

[`createWorkQueueConsumer()`](src/work-queue-consumer.ts) consumes with manual acks. The handler returns one of three outcomes:

- **`done`**: ack.
- **`retry`**: republish a copy to the next retry queue with `x-retry-count + 1` (with a publisher confirm), then ack the original. When the queue's TTL expires, RabbitMQ dead-letters the copy back to the work queue. A handler that throws counts as `retry`.
- **`reject`**, or `retry` after the last tier: nack without requeue. The queue's dead-letter exchange routes the message to the DLQ and RabbitMQ records `x-death`.

Why it's built this way:

- **No nack-with-requeue.** It redelivers instantly with no backoff and hot-loops while a dependency is down.
- **Retry count in a header.** Classic queues don't count deliveries; `x-delivery-count` is quorum-only, and quorum queues aren't on CloudAMQP's shared plans.
- **One queue per delay, not per-message TTL.** Classic queues only expire messages at the head, so a long delay would hold up a short one behind it.
- **Retries go back through the default exchange,** so a retried message never reaches other queues bound to the same routing key.
- **Retry and DLQ queues are declared on every (re)connect and again right before use.** CloudAMQP's free plan deletes queues idle for 28 days, and the DLQ must exist for alarms to watch it.

The four retries span about 71 minutes, well inside Resend's 24-hour idempotency window.

[`replayDeadLetters()`](src/dead-letters.ts) moves DLQ messages back to `postroll.events` with a fresh retry budget. It holds messages it can't route (no `type`) unacked while it moves the rest, then returns them to the DLQ, so one unreadable message can't block the others.

## Publishing

```ts
const connection = createConnection({ connectionName: 'postroll-gateway', onError, url });
const publisher = createEventPublisher(connection, 'postroll-gateway');
await publisher.publish(message);
```

`publish` resolves once the broker confirms the message. It's persistent, and its `messageId`, `type` and routing key come from the message. `createConnection` requires `onError`, because an unhandled `error` event would crash the process.

## Local RabbitMQ

| Script     | What it does                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `mq:start` | Checks Docker, then `docker compose up -d --wait`: RabbitMQ with the management UI at http://localhost:15672 (guest / guest). |
| `mq:stop`  | `docker compose down --volumes`. Queues and messages are discarded, like the local Neon branch.                               |
| `dev`      | Idles during `pnpm dev`; on Ctrl+C it runs `mq:stop`.                                                                         |

`pnpm dev` runs `mq:start` before the gateway and worker start (`^mq:start` in the root `turbo.json`). Root shortcuts: `pnpm mq:start` and `pnpm mq:stop`. Keep the image tag in [`docker-compose.yml`](docker-compose.yml) on the same RabbitMQ version as the CloudAMQP instance. `rabbitmq-client` needs 5.0.3 or later for RabbitMQ 4.1+.
