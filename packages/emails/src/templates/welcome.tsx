import { Text, Button, Heading } from 'react-email';

import { EmailLayout } from '../components/layout.js';

export type WelcomeEmailProps = {
  dashboardUrl: string;
  name: string | null;
  workspaceName: string;
};

export default function WelcomeEmail({ dashboardUrl, name, workspaceName }: WelcomeEmailProps) {
  return (
    <EmailLayout
      preview={`Your workspace ${workspaceName} is ready.`}
      footer={
        <Text className="text-muted-foreground m-0 text-[13px] leading-[20px]">
          You’re getting this because an account was created with this address. If that wasn’t you, you can ignore this
          email.
        </Text>
      }
    >
      <Heading as="h1" className="m-0 text-[24px] leading-[32px] font-semibold">
        Welcome to Postroll
      </Heading>
      <Text className="text-[16px] leading-[26px]">{name ? `Hi ${name},` : 'Hi there,'}</Text>
      <Text className="text-[16px] leading-[26px]">
        Your account is set up, and your workspace <strong>{workspaceName}</strong> is ready. Open your dashboard to get
        started.
      </Text>
      <Button
        href={dashboardUrl}
        className="bg-brand text-brand-foreground box-border block rounded-[6px] px-5 py-3 text-center text-[16px] font-semibold no-underline"
      >
        Open your dashboard
      </Button>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  dashboardUrl: 'https://www.postroll.video/dashboard',
  name: 'Alex',
  workspaceName: 'alex’s Workspace',
} satisfies WelcomeEmailProps;
