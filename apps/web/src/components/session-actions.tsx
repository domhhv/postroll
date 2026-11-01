import type { SessionDto } from '@postroll/contracts';
import { Button } from '@postroll/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@postroll/ui/components/dropdown-menu';
import { IconDots } from '@tabler/icons-react';
import { useState } from 'react';

import { TerminateSessionDialog } from '#components/terminate-session-dialog';
import { formatDevice } from '#lib/utils';

export function SessionActions({ session }: { session: SessionDto }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    !session.current && (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Session actions"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 [@media(hover:none)]:opacity-100"
              />
            }
          >
            <IconDots />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                return setConfirmOpen(true);
              }}
            >
              Terminate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <TerminateSessionDialog
          open={confirmOpen}
          sessionId={session.id}
          onOpenChange={setConfirmOpen}
          device={formatDevice(session)}
        />
      </>
    )
  );
}
