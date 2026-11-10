import { z } from 'zod';

/**
 * Fields every email message carries. `id` is the gateway's outbox row id and
 * doubles as the AMQP `messageId`; `type` doubles as the routing key.
 */
const emailMessageEnvelope = {
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  version: z.literal(1),
};

export const welcomeEmailMessageSchema = z.object({
  ...emailMessageEnvelope,
  type: z.literal('email.welcome'),
  data: z.object({
    name: z.string().nullable(),
    to: z.email(),
    userId: z.uuid(),
    workspaceName: z.string().min(1),
  }),
});

export type WelcomeEmailMessage = z.infer<typeof welcomeEmailMessageSchema>;

export const emailMessageSchema = z.discriminatedUnion('type', [welcomeEmailMessageSchema]);

export type EmailMessage = z.infer<typeof emailMessageSchema>;

export type EmailMessageType = EmailMessage['type'];
