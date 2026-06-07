import { buttonVariants } from '@postroll/ui/components/button';
import { IconMovie, IconBrandGithub } from '@tabler/icons-react';
import Link from 'next/link';

import { UserMenu } from '#components/user-menu';
import { getUser } from '#lib/dal';

export async function Header() {
  const user = await getUser();

  return (
    <header className="border-border bg-background flex h-14 items-center justify-between border-b px-6">
      <Link href="/" className="text-foreground flex items-center gap-1 hover:opacity-80">
        <IconMovie className="-mt-0.5 size-5" />
        <span className="font-semibold tracking-tight">Postroll</span>
      </Link>

      <div className="flex items-center gap-2">
        <a
          target="_blank"
          aria-label="GitHub"
          rel="noopener noreferrer"
          href="https://github.com/domhhv/postroll"
          className={buttonVariants({
            size: 'icon',
            variant: 'ghost',
          })}
        >
          <IconBrandGithub />
        </a>

        {user ? (
          <>
            <Link href="/dashboard" className={buttonVariants()}>
              Dashboard
            </Link>
            <UserMenu email={user.email} />
          </>
        ) : (
          <>
            <Link
              href="/login"
              className={buttonVariants({
                variant: 'secondary',
              })}
            >
              Log In
            </Link>
            <Link href="/register" className={buttonVariants({ variant: 'default' })}>
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
