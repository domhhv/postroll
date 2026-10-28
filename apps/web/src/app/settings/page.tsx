import { redirect } from 'next/navigation';

import { SettingsDetails } from '#components/settings-details';
import { GatewayError, listSessions } from '#lib/api';
import { getUser, verifySession, redirectToSessionCheck } from '#lib/dal';

export const metadata = {
  title: 'Postroll | Settings',
};

export default async function SettingsPage() {
  const session = await verifySession();

  if (!session) {
    redirect('/login');
  }

  const me = await getUser();

  if (!me) {
    redirectToSessionCheck('/settings');
  }

  const sessions = await listSessions().catch((error: unknown) => {
    if (error instanceof GatewayError && error.status === 401) {
      redirectToSessionCheck('/settings');
    }

    throw error;
  });

  return (
    <div className="w-full max-w-3xl space-y-6 self-start">
      <h1 className="text-3xl leading-10 font-semibold tracking-tight">Settings</h1>
      <SettingsDetails user={me} sessions={sessions} />
    </div>
  );
}
