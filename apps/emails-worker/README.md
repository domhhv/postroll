# `@postroll/emails-worker`

NestJS background worker that consumes the `emails.send` queue, renders each message with [`@postroll/emails`](../../packages/emails/README.md) and sends it with [Resend](https://resend.com). It has no HTTP server and never touches Postgres: messages carry everything needed to render. It runs on [Render](https://render.com) as a Docker background worker, because a 24/7 consumer can't run on Vercel's Hobby plan.

## How a message is handled

[`src/emails/emails.consumer.ts`](src/emails/emails.consumer.ts) does the work, on top of the retry and dead-letter flow in [`@postroll/messaging`](../../packages/messaging/README.md):

1. Parse the raw body and validate it against `emailMessageSchema` from `@postroll/contracts`. A message that doesn't match goes straight to the dead-letter queue.
2. Render it, then send it with Resend's idempotency key (`welcome-email/<userId>`), so a redelivered or retried message within 24 hours returns the original result instead of sending twice.
3. Turn the result into an outcome with [`classifySendError()`](src/emails/classify-send-error.ts):

| Resend result                                                                                  | Outcome                                        |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Sent                                                                                           | ack                                            |
| 429 `rate_limit_exceeded`, 5xx, network error or timeout, 409 `concurrent_idempotent_requests` | retry after 10 s, 1 min, 10 min, 1 h; then DLQ |
| 409 `invalid_idempotent_request` (key already used with a different payload)                   | ack and warn: Resend already accepted it       |
| 400/422 validation, 401/403 key or domain problems, daily or monthly quota exceeded            | DLQ: fix the cause, then replay                |

Logs carry the event id, type, attempt, Resend id and outcome, never the recipient address. On SIGTERM, Nest's shutdown hooks stop new deliveries, wait for in-flight sends and then close the connection.

## Environment variables

Source of truth: [`src/env.ts`](src/env.ts), validated at boot. Local values: [`.env.example`](.env.example). Empty values count as unset.

| Variable             | Required                    | Notes                                                                                                      |
| -------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `AMQP_URL`           | Yes                         | CloudAMQP `amqps://` URL in production, `amqp://guest:guest@localhost:5672` locally.                       |
| `APP_URL`            | Yes                         | Public web URL for links in emails, `https://www.postroll.video` in production.                            |
| `EMAIL_FROM`         | Yes                         | `Postroll <hello@postroll.video>`. The domain must match the domain verified in Resend exactly.            |
| `EMAIL_TRANSPORT`    | No, defaults to `resend`    | `log` writes each email's HTML to the OS temp folder instead of sending it.                                |
| `RESEND_API_KEY`     | With the `resend` transport | A sending-only key restricted to `postroll.video`.                                                         |
| `EMAIL_REPLY_TO`     | No                          | A monitored inbox. Avoid `noreply@`; people reply to transactional email.                                  |
| `EMAIL_CONCURRENCY`  | No, defaults to 2           | Messages handled at once (also the prefetch). 2 fits Resend's default rate limit of 2 requests per second. |
| `EMAIL_LOG_SIMULATE` | No                          | `log` transport only: `retryable` or `permanent` makes every send fail, to exercise retries and the DLQ.   |

## Scripts

| Script       | What it does                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `dev`        | `nest start --watch`. `pnpm dev` starts it after RabbitMQ is up.                                                |
| `build`      | `nest build` to `dist/`.                                                                                        |
| `start:prod` | `node dist/main.js`, which is what the Docker image runs.                                                       |
| `dlq:replay` | `node dist/scripts/replay-dlq.js [limit]`: moves up to `limit` (default 100) dead letters back for another try. |

To try it locally, run `pnpm dev`, register at http://localhost:3000/register and look for "Email written to a file by the log transport" in the worker's output. Messages wait in RabbitMQ while the worker is stopped.

## Deployment

The worker is a Render background worker defined in the root [`render.yaml`](../../render.yaml) Blueprint: Docker runtime, `frankfurt` region, 0.5 CPU / 512 MB, one instance, auto-deploy off, 60 s shutdown grace period.

- [`Dockerfile`](Dockerfile) builds with the repo root as context (`docker build -f apps/emails-worker/Dockerfile .`). It installs only the worker's workspace graph, builds it, and copies a `pnpm deploy --prod` bundle into a slim runtime image that runs as `node`. `CMD` uses the exec form, so SIGTERM reaches Node.
- [`production-deploy.yml`](../../.github/workflows/production-deploy.yml) deploys this commit to Render through the REST API and waits until it's `live`, in parallel with the Vercel build. Promotion waits for both, so a new gateway never publishes a message the running worker can't read. [`code-health.yml`](../../.github/workflows/code-health.yml) builds the image on every PR.
- Render starts the new instance before stopping the old one, and gives the old one 60 seconds after SIGTERM. Overlapping consumers are safe because sends are idempotent.
- Previews have no worker. The gateway leaves `AMQP_URL` unset there and doesn't publish.

To replay dead letters in production, open a shell on the service in the Render dashboard and run `node dist/scripts/replay-dlq.js`.

Configuration outside the repo:

- Render: a Blueprint created from `main` (the service is pinned to `main` in `render.yaml`), with secrets `AMQP_URL`, `RESEND_API_KEY`, `EMAIL_REPLY_TO`.
- GitHub Actions: secret `RENDER_API_KEY`, variable `RENDER_EMAILS_WORKER_SERVICE_ID`. Both must be set: the production workflow won't promote a deployment until the worker deploy succeeds.
- CloudAMQP alarms: see below.

### Alarms

Set these up in CloudAMQP under the instance's **Alarms** page, once the worker has started and created its queues. All four work on the free plan. Leave **Vhost regexp** empty and pick the default email recipient.

| Type       | Value threshold | Time threshold (s) | Queue regexp          | Message type | Catches                                                                                  |
| ---------- | --------------- | ------------------ | --------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| Queue      | 0               | 0                  | `^emails\.send\.dlq$` | Total        | Any dead letter: a permanent failure or exhausted retries. Fix the cause, then replay.   |
| Consumer   | 0               | 120                | `^emails\.send$`      | n/a          | The worker is down: no consumer on the queue for 2 minutes.                              |
| Queue      | 50              | 300                | `^emails\.send$`      | Ready        | A backlog: the worker is connected but stuck, or can't keep up.                          |
| Connection | 15              | 300                | n/a                   | n/a          | Nearing the free plan's 20 connections (one per warm gateway instance, plus the worker). |

- Anchor the regexps with `^…$`: an unanchored `emails\.send` also matches the retry and dead-letter queues.
- A Queue alarm fires when a queue holds more messages than the value threshold, so 0 means "any". **Total** counts every message in the queue; the dead-letter queue has no consumer, so all of them are waiting. The rate types (such as Publish rate) measure messages per second and suit throughput monitoring, not "is anything stuck".
- A Consumer alarm fires when a queue has that many consumers or fewer. Render starts the new worker before stopping the old one, so deploys don't trip it; the 2 minutes absorb a broker restart.
- Leave the reminder interval empty, or set 86400 for a daily reminder while an alarm stays unresolved.
