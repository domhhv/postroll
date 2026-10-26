'use client';

import type { SessionDto } from '@postroll/contracts';
import { Badge } from '@postroll/ui/components/badge';
import { Button } from '@postroll/ui/components/button';
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogContent,
  DialogDescription,
} from '@postroll/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@postroll/ui/components/dropdown-menu';
import { Table, TableRow, TableBody, TableCell, TableHead, TableHeader } from '@postroll/ui/components/table';
import { toast } from '@postroll/ui/components/toast';
import { IconDots } from '@tabler/icons-react';
import { useState, useTransition, useSyncExternalStore } from 'react';

import { revokeSessionAction } from '#lib/actions';

type SessionsListProps = {
  sessions: SessionDto[];
};

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

function formatDevice(session: SessionDto): string {
  if (session.browser && session.os) {
    return `${session.browser} (${session.os})`;
  }

  return session.browser ?? session.os ?? 'Unknown device';
}

function countryName(code: string): string {
  try {
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "Berlin, BE, Germany" — whichever parts are known. */
function formatLocation(session: SessionDto): string | null {
  const parts = [session.city, session.region, session.country ? countryName(session.country) : null].filter(
    (part): part is string => {
      return Boolean(part);
    }
  );

  return parts.length > 0 ? parts.join(', ') : null;
}

const localFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
const utcFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

function noopSubscribe() {
  return () => {};
}

/**
 * Renders in UTC on the server (and during hydration), then switches to the
 * viewer's time zone — avoids a hydration mismatch from server/browser TZs.
 */
function DateTime({ iso }: { iso: string }) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => {
      return true;
    },
    () => {
      return false;
    }
  );
  const date = new Date(iso);

  return (
    <time title={iso} dateTime={iso}>
      {isClient ? localFormat.format(date) : `${utcFormat.format(date)} UTC`}
    </time>
  );
}

function TerminateSessionDialog({
  device,
  onOpenChange,
  open,
  sessionId,
}: {
  device: string;
  open: boolean;
  sessionId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function terminate() {
    setError(null);
    startTransition(async () => {
      const result = await revokeSessionAction(sessionId);

      if (result.status === 'error') {
        setError(result.message);

        return;
      }

      onOpenChange(false);
      toast.add({
        description: `${device} has been signed out.`,
        title: 'Session terminated',
        type: 'success',
      });
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) {
          return;
        }

        setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terminate session</DialogTitle>
          <DialogDescription>
            Are you sure you want to terminate this session? The device will lose access to your account.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              return onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button disabled={pending} onClick={terminate} variant="destructive">
            {pending ? 'Terminating…' : 'Terminate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionRow({ session }: { session: SessionDto }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const location = formatLocation(session);

  return (
    <TableRow className="group">
      <TableCell>
        <span className="font-medium" title={session.userAgent ?? undefined}>
          {formatDevice(session)}
        </span>
        {session.current && (
          <Badge variant="secondary" className="ml-2 align-middle">
            Current
          </Badge>
        )}
      </TableCell>
      <TableCell className={location ? undefined : 'text-muted-foreground'}>{location ?? 'Unknown'}</TableCell>
      <TableCell>
        <DateTime iso={session.createdAt} />
      </TableCell>
      <TableCell>
        <DateTime iso={session.lastActiveAt} />
      </TableCell>
      <TableCell className="w-10 text-right">
        {/* The current session ends via "Sign out", not from this list. */}
        {!session.current && (
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
        )}
      </TableCell>
    </TableRow>
  );
}

export function SessionsList({ sessions }: SessionsListProps) {
  if (sessions.length === 0) {
    return <p className="text-muted-foreground text-sm">No active sessions.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Device</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Created at</TableHead>
          <TableHead>Updated at</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => {
          return <SessionRow key={session.id} session={session} />;
        })}
      </TableBody>
    </Table>
  );
}
