import { buttonVariants } from '@postroll/ui/components/button';
import { IconMovie, IconBrandGithub, IconLayoutDashboard } from '@tabler/icons-react';
import Link from 'next/link';

import { ThemeSwitcher } from '#components/theme-switcher';
import { UserMenu } from '#components/user-menu';
import { WorkspaceSwitcher } from '#components/workspace-switcher';
import { getUser, getWorkspaces, verifySession } from '#lib/dal';

export async function Header() {
  const user = await getUser();
  const [workspaces, session] = user ? await Promise.all([getWorkspaces(), verifySession()]) : [[], null];

  return (
    <header className="border-border bg-background flex h-14 items-center justify-between border-b px-6">
      <Link href="/" className="text-foreground flex items-center gap-1 hover:opacity-80 max-sm:hidden">
        <IconMovie className="-mt-0.5 size-5" />
        <span className="font-semibold tracking-tight">Postroll</span>
      </Link>

      <div className="flex items-center gap-2">
        <Link
          target="_blank"
          aria-label="GitHub"
          rel="noopener noreferrer"
          href="https://github.com/domhhv/postroll"
          className={buttonVariants({
            className: 'max-sm:hidden',
            size: 'lg',
            variant: 'ghost',
          })}
        >
          <IconBrandGithub />
        </Link>
        <ThemeSwitcher />

        {user ? (
          <>
            <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={session?.activeWorkspaceId ?? null} />
            <Link href="/dashboard" className={buttonVariants()}>
              <span className="max-sm:hidden">Dashboard</span>
              <IconLayoutDashboard className="sm:hidden" />
            </Link>
            <UserMenu email={user.email} />
          </>
        ) : (
          <>
            <Link
              href="/login"
              className={buttonVariants({
                size: 'lg',
                variant: 'secondary',
              })}
            >
              Sign In
            </Link>
            <Link href="/register" className={buttonVariants({ size: 'lg', variant: 'default' })}>
              Join
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
