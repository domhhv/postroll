import type { ReactNode } from 'react';
import { Hr, Body, Head, Html, Text, Preview, Section, Tailwind, Container } from 'react-email';

import { tailwindConfig } from '../theme.js';

type EmailLayoutProps = {
  children: ReactNode;
  footer: ReactNode;
  preview: string;
};

export function EmailLayout({ children, footer, preview }: EmailLayoutProps) {
  return (
    <Html dir="ltr" lang="en">
      <Tailwind config={tailwindConfig}>
        <Head />
        <Body className="bg-muted text-foreground font-sans">
          <Preview>{preview}</Preview>
          <Container className="border-border bg-background mx-auto my-10 max-w-[560px] rounded-[8px] border border-solid px-10 py-8">
            <Text className="m-0 text-[20px] leading-[28px] font-bold tracking-tight">Postroll</Text>
            <Section className="mt-6">{children}</Section>
            <Hr className="border-border my-6 border-solid" />
            <Section>{footer}</Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
