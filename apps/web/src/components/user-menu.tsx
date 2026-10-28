'use client';

import { Button } from '@postroll/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@postroll/ui/components/popover';
import { Separator } from '@postroll/ui/components/separator';
import { cn } from '@postroll/ui/lib/utils';
import { IconUserCircle } from '@tabler/icons-react';
import Form from 'next/form';
import Link from 'next/link';

import { logoutAction } from '#lib/actions';

import { PendingButton } from './pending-button';

type UserMenuProps = {
  email: string;
};

export function UserMenu({ email }: UserMenuProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={(props) => {
          return (
            <Button {...props} size="icon" variant="ghost" aria-label="Settings menu" className="max-sm:border-border">
              <IconUserCircle />
            </Button>
          );
        }}
      />
      <PopoverContent align="end" className="w-56 gap-1 p-2">
        <div className="text-muted-foreground truncate px-2 py-1.5 text-sm">{email}</div>
        <Separator className="my-1 h-px" />
        <Link
          href="/settings"
          className="hover:bg-muted hover:text-foreground focus-visible:bg-muted flex w-full items-center rounded-sm px-2 py-1.5 text-sm focus-visible:outline-none"
        >
          Settings
        </Link>
        <Form action={logoutAction}>
          <PendingButton
            type="submit"
            idle="Log Out"
            variant="ghost"
            pendingLabel="Logging Out"
            className={cn(
              'hover:bg-muted hover:text-foreground focus-visible:bg-muted text-destructive hover:text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10',
              'flex w-full items-center justify-start rounded-sm px-2 py-1.5 text-sm focus-visible:outline-none'
            )}
          />
        </Form>
      </PopoverContent>
    </Popover>
  );
}
