import { redirect } from 'next/navigation';

import { AccountDetails } from '#components/account-details';
import { GatewayError, listSessions } from '#lib/api';
import { getUser, verifySession, redirectToSessionCheck } from '#lib/dal';

export const metadata = {
  title: 'Postroll | Account',
};

export default async function AccountPage() {
  const session = await verifySession();

  if (!session) {
    redirect('/login');
  }

  const me = await getUser();

  if (!me) {
    redirectToSessionCheck('/account');
  }

  const sessions = await listSessions().catch((error: unknown) => {
    if (error instanceof GatewayError && error.status === 401) {
      redirectToSessionCheck('/account');
    }

    throw error;
  });

  return (
    <div className="w-full max-w-3xl space-y-6 self-start">
      <h1 className="text-3xl leading-10 font-semibold tracking-tight">Account</h1>
      <AccountDetails user={me} sessions={sessions} />
    </div>
  );
}
