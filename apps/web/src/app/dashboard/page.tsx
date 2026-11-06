import { buttonVariants } from '@postroll/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@postroll/ui/components/tooltip';
import { cn } from '@postroll/ui/lib/utils';
import { IconUpload, IconSettings, IconUsersPlus } from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getUser, verifySession, getActiveWorkspace, redirectToSessionCheck } from '#lib/dal';

export const metadata: Metadata = {
  title: 'Postroll | Dashboard',
};

export default async function DashboardPage() {
  const session = await verifySession();

  if (!session) {
    redirect('/login');
  }

  const me = await getUser();

  if (!me) {
    redirectToSessionCheck('/dashboard');
  }

  const workspace = await getActiveWorkspace();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 self-start">
      <div className="space-y-2">
        <div className="group flex w-fit items-center gap-4">
          <h1 className="text-3xl leading-10 font-semibold tracking-tight">{workspace?.name ?? 'Dashboard'}</h1>
          {workspace && (
            <Tooltip>
              <TooltipTrigger>
                <Link
                  href="/settings/workspace"
                  aria-label="Workspace settings"
                  className={cn(
                    buttonVariants({ size: 'icon', variant: 'ghost' }),
                    'text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'
                  )}
                >
                  <IconSettings size={16} />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Go to workspace settings</TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-muted-foreground">
          Signed in as <span className="text-foreground">{me.email}</span>
          {workspace ? (
            <>
              {' · '}
              <span className="text-foreground">{workspace.role.toLowerCase()}</span>
            </>
          ) : null}
          .
        </p>
      </div>

      <div className="border-border flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-16 text-center">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Your workspace is ready</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Upload a video to start collecting feedback, or invite a teammate to review together.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className={`${buttonVariants()} pointer-events-none gap-2 opacity-60`}>
            <IconUpload className="size-4" />
            Upload your first video
          </span>
          <span className={`${buttonVariants({ variant: 'outline' })} pointer-events-none gap-2 opacity-60`}>
            <IconUsersPlus className="size-4" />
            Invite a teammate
          </span>
        </div>
        <p className="text-muted-foreground text-xs">Coming soon.</p>
      </div>
    </div>
  );
}
