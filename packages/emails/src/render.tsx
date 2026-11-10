import type { EmailMessage } from '@postroll/contracts';
import type { ReactElement } from 'react';
import { render } from 'react-email';

import WelcomeEmail from './templates/welcome.js';

export type RenderContext = {
  /** Public base URL of the web app, e.g. `https://www.postroll.video`. */
  appUrl: string;
};

export type RenderedEmail = {
  /** Short, stable label sent to Resend as a tag. */
  category: string;
  html: string;
  /** Resend idempotency key: the same logical email always gets the same key. */
  idempotencyKey: string;
  subject: string;
  text: string;
};

type EmailDefinition = Omit<RenderedEmail, 'html' | 'text'> & {
  element: ReactElement;
};

/**
 * One case per message type. A new type without a case here fails to compile
 * (`noImplicitReturns`), so every message the worker accepts has a template.
 */
function defineEmail(message: EmailMessage, { appUrl }: RenderContext): EmailDefinition {
  switch (message.type) {
    /**
     * TODO: Link to the workspace itself (e.g. `/w/<slug>`, which the
     * workspace `slug` column is meant for) once workspace-scoped routes
     * exist, and keep that path through sign-in with a `next` parameter
     * (`loginAction` always lands on /dashboard today). For a new user,
     * /dashboard already opens the right workspace: it's their only one.
     * Don't add a sign-in token to this link. A welcome email is long-lived
     * and gets forwarded, and until email verification exists it can reach
     * someone who didn't create the account.
     */
    case 'email.welcome':
      return {
        category: 'welcome',
        idempotencyKey: `welcome-email/${message.data.userId}`,
        subject: 'Welcome to Postroll',
        element: (
          <WelcomeEmail
            name={message.data.name}
            workspaceName={message.data.workspaceName}
            dashboardUrl={new URL('/dashboard', appUrl).toString()}
          />
        ),
      };
  }
}

export async function renderEmail(message: EmailMessage, context: RenderContext): Promise<RenderedEmail> {
  const { element, ...definition } = defineEmail(message, context);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);

  return { ...definition, html, text };
}
