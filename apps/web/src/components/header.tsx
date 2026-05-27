import { Button } from '@postroll/ui/components/button';
import { IconBrandGithub, IconMovie } from '@tabler/icons-react';
import Link from 'next/link';
import { UserMenu } from '#components/user-menu';
import { getUser } from '#lib/dal';

const GITHUB_URL = 'https://github.com/domhhv/postroll';

export async function Header() {
  const user = await getUser();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <Link
        href="/"
        className="flex items-center gap-2 text-foreground hover:opacity-80"
      >
        <IconMovie className="size-5" />
        <span className="font-semibold tracking-tight">Postroll</span>
      </Link>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="GitHub">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            <IconBrandGithub />
          </a>
        </Button>

        {user ? (
          <>
            <Button asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserMenu email={user.email} />
          </>
        ) : (
          <>
            <Button variant="ghost" asChild>
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Register</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
