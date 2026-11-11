# `@postroll/emails`

Email templates built with [React Email](https://react.email), plus the function that turns a message into a ready-to-send email. Only [`@postroll/emails-worker`](../../apps/emails-worker/README.md) uses it at runtime: the gateway publishes a small typed message and never renders, which keeps React out of its Vercel Function and means template fixes also apply to messages already queued or being retried.

## API

```ts
import { renderEmail } from '@postroll/emails';

const { category, html, idempotencyKey, subject, text } = await renderEmail(message, {
  appUrl: 'https://www.postroll.video',
});
```

`message` is an `EmailMessage` from [`@postroll/contracts`](../contracts/src/emails.ts). [`src/render.tsx`](src/render.tsx) has one `case` per message type, returning the template, subject, Resend tag (`category`) and idempotency key (`welcome-email/<userId>` for the welcome email). A message type without a case fails to compile, so the worker can't accept a message it can't render. Plain text is generated from the same template.

## Templates

| Template                                                 | Message         | Subject             |
| -------------------------------------------------------- | --------------- | ------------------- |
| [`src/templates/welcome.tsx`](src/templates/welcome.tsx) | `email.welcome` | Welcome to Postroll |

Templates share [`src/components/layout.tsx`](src/components/layout.tsx) (wordmark, card, footer) and the colors in [`src/theme.ts`](src/theme.ts). Email clients don't support `oklch`, so the theme holds hex versions of the UI's tokens (brand `#fdc700` is the UI's `--primary`; button text `#733e0a` keeps 5.5:1 contrast).

Conventions, following the React Email and email best-practice skills:

- Tailwind with `pixelBasedPreset`, and explicit pixel values where Tailwind would emit `rem` (border radii), since Outlook ignores `rem`.
- No flexbox, grid, media queries or images.
- `Html lang="en"`, one `h1`, `Preview` first in `Body`, `box-border` on buttons, button text that names the destination.
- Transactional and not promotional. Until email verification exists, the footer tells recipients what to do if they didn't create the account.

## Previewing

```bash
pnpm emails:preview
```

Starts the React Email preview server at http://localhost:3030 with each template's `PreviewProps`. Its Compatibility tab checks Gmail, Apple Mail, Outlook and Yahoo support. The script is called `preview` rather than `dev`, so `pnpm dev` doesn't start it.

## Adding an email

1. Add the message schema to [`packages/contracts/src/emails.ts`](../contracts/src/emails.ts) and to `emailMessageSchema`'s union. Its `type` is also the RabbitMQ routing key, e.g. `email.verification`.
2. Add a template under `src/templates/` with a default export and `PreviewProps`.
3. Add the `case` in `src/render.tsx`. The build fails until you do.
4. Deploy the worker before anything publishes the new type. The production workflow already deploys the worker before promoting the gateway.
