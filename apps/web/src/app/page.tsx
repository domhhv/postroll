import { Button } from '@postroll/ui/components/button';
import Link from 'next/link';
import { getUserCount } from '@/lib/api';

export default async function Home() {
  const userCount = await getUserCount();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-foreground">
          Postroll
        </h1>
        <p className="max-w-md text-lg leading-8 text-muted-foreground">
          Coming soon to a browser near you.
        </p>
        <p className="text-accent-foreground">
          There are {userCount} users in the database.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/register">Register</Link>
      </Button>
    </div>
  );
}
