import type { SendError } from './transports/email-transport.js';

export type SendFailureAction = 'already-sent' | 'reject' | 'retry';

const RETRYABLE = new Set([
  'application_error',
  'concurrent_idempotent_requests',
  'internal_server_error',
  'rate_limit_exceeded',
]);

/**
 * Decides what a failed send means for the message.
 *
 * - `retry`: transient. Rate limits (a 4xx, but temporary), server errors,
 *   network errors and timeouts, and a concurrent request with the same key.
 * - `already-sent`: the idempotency key was already used with a different
 *   payload, so Resend accepted this email before (e.g. the template changed
 *   between attempts). Retrying can't succeed and isn't needed.
 * - `reject`: permanent. Validation errors, bad or restricted API keys,
 *   unverified domains and exhausted quotas go to the dead-letter queue to be
 *   replayed once the cause is fixed.
 */
export function classifySendError(error: SendError): SendFailureAction {
  if (error.name === 'invalid_idempotent_request') {
    return 'already-sent';
  }

  if (RETRYABLE.has(error.name) || error.statusCode === null || error.statusCode >= 500) {
    return 'retry';
  }

  return 'reject';
}
