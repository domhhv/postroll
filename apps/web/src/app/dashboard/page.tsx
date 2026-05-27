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
    <div className="w-full mx-auto max-w-md self-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-10 tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Signed in as <span className="text-foreground">{me.email}</span>.
        </p>
      </div>
      <form action={logoutAction}>
        <Button type="submit" size="lg" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
