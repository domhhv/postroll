'use client';

import { Button } from '@postroll/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@postroll/ui/components/popover';
import { Separator } from '@postroll/ui/components/separator';
import { IconUserCircle } from '@tabler/icons-react';
import Link from 'next/link';

import { LogoutForm } from '#components/logout-form';

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
        <LogoutForm />
      </PopoverContent>
    </Popover>
  );
}
