import type { RenderedEmail } from '@postroll/emails';

export const EMAIL_TRANSPORT = Symbol('EMAIL_TRANSPORT');

export type OutgoingEmail = RenderedEmail & {
  eventId: string;
  to: string;
};

export type SendError = {
  message: string;
  name: string;
  /** `null` when the request never got an HTTP response (network error, timeout). */
  statusCode: number | null;
};

export type SendResult = { id: string; status: 'sent' } | { error: SendError; status: 'failed' };

export type EmailTransport = {
  send: (email: OutgoingEmail) => Promise<SendResult>;
};
