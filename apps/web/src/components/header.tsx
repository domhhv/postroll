import { buttonVariants } from '@postroll/ui/components/button';
import { IconBrandGithub, IconMovie } from '@tabler/icons-react';
import Link from 'next/link';
import { UserMenu } from '#components/user-menu';
import { getUser } from '#lib/dal';

export async function Header() {
  const user = await getUser();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <Link
        href="/"
        className="flex items-center gap-1 text-foreground hover:opacity-80"
      >
        <IconMovie className="size-5 -mt-0.5" />
        <span className="font-semibold tracking-tight">Postroll</span>
      </Link>

      <div className="flex items-center gap-2">
        <a
          href="https://github.com/domhhv/postroll"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className={buttonVariants({
            variant: 'ghost',
            size: 'icon',
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
            <Link
              href="/register"
              className={buttonVariants({ variant: 'default' })}
            >
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
