import { TabsList, TabsTrigger } from '@postroll/ui/components/tabs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { PropsWithChildren } from 'react';

import { SettingsTabsWrapper } from '#components/settings-tabs-wrapper';
import { getUser, verifySession, redirectToSessionCheck } from '#lib/dal';

export const metadata = {
  title: 'Postroll | Settings',
};

const tabs = [
  { label: 'Profile', value: 'profile' },
  { label: 'Security', value: 'security' },
] as const;

export default async function SettingsLayout({ children }: PropsWithChildren) {
  const session = await verifySession();

  if (!session) {
    redirect('/login');
  }

  const me = await getUser();

  if (!me) {
    redirectToSessionCheck('/settings');
  }

  return (
    <div className="w-full max-w-4xl space-y-6 self-start">
      <h1 className="text-3xl leading-10 font-semibold tracking-tight">Settings</h1>
      <SettingsTabsWrapper>
        <TabsList variant="line" className="sm:w-40 sm:shrink-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              nativeButton={false}
              render={<Link href={`/settings/${tab.value}`} />}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {children}
      </SettingsTabsWrapper>
    </div>
  );
}
