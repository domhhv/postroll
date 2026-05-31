'use client';

import type { SessionDto } from '@postroll/contracts';
import { Button } from '@postroll/ui/components/button';
import { useState, useTransition } from 'react';
import { revokeSessionAction } from '#lib/actions';

type SessionsListProps = {
  sessions: SessionDto[];
};

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatLastActive(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (Math.abs(diffMinutes) < 1) {
    return 'just now';
  }
  if (Math.abs(diffMinutes) < 60) {
    return relativeTime.format(diffMinutes, 'minute');
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return relativeTime.format(diffHours, 'hour');
  }
  return relativeTime.format(Math.round(diffHours / 24), 'day');
}

function SessionRow({ session }: { session: SessionDto }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const revoke = () => {
    setError(null);
    startTransition(async () => {
      const result = await revokeSessionAction(session.id);
      if (result.status === 'error') {
        setError(result.message);
        setConfirming(false);
      }
    });
  };

  const meta = [
    session.ip,
    session.current ? 'This device' : formatLastActive(session.lastActiveAt),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0 space-y-1">
        <p
          className="truncate font-medium text-foreground"
          title={session.userAgent ?? undefined}
        >
          {session.label}
          {session.current && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary align-middle">
              Current
            </span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">{meta}</p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      {!session.current &&
        (confirming ? (
          <div className="flex shrink-0 gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={revoke}
              disabled={pending}
            >
              {pending ? 'Revoking…' : 'Confirm'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setConfirming(true)}
          >
            Revoke
          </Button>
        ))}
    </li>
  );
}

export function SessionsList({ sessions }: SessionsListProps) {
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">No active sessions.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {sessions.map((session) => (
        <SessionRow key={session.id} session={session} />
      ))}
    </ul>
  );
}
