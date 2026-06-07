import { redirect } from 'next/navigation';

import { AccountDetails } from '#components/account-details';
import { listSessions } from '#lib/api';
import { getUser, verifySession } from '#lib/dal';

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
    redirect('/login');
  }

  const sessions = await listSessions();

  return (
    <div className="w-full max-w-md space-y-6 self-start">
      <h1 className="text-3xl leading-10 font-semibold tracking-tight">Account</h1>
      <AccountDetails user={me} sessions={sessions} />
    </div>
  );
}
