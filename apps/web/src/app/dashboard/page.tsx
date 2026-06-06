import { Button } from '@postroll/ui/components/button';
import { redirect } from 'next/navigation';

import { logoutAction } from '#lib/actions';
import { getUser, verifySession } from '#lib/dal';

export const metadata = {
  title: 'Postroll | Dashboard',
};

export default async function DashboardPage() {
  const session = await verifySession();

  if (!session) {
    redirect('/login');
  }

  const me = await getUser();

  if (!me) {
    redirect('/login');
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 self-center">
      <div className="space-y-2">
        <h1 className="text-3xl leading-10 font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Signed in as <span className="text-foreground">{me.email}</span>.
        </p>
      </div>
      <form action={logoutAction}>
        <Button size="lg" type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
