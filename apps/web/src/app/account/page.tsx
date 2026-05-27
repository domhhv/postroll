import { redirect } from 'next/navigation';
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

  return (
    <div className="w-full mx-auto max-w-md self-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-10 tracking-tight">
          Account
        </h1>
        <p className="text-muted-foreground">
          Signed in as <span className="text-foreground">{me.email}</span>.
        </p>
      </div>
    </div>
  );
}
