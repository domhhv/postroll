'use client';

import type { SessionDto } from '@postroll/contracts';
import { Badge } from '@postroll/ui/components/badge';
import { Table, TableRow, TableBody, TableHead, TableCell, TableHeader } from '@postroll/ui/components/table';
import { cn } from '@postroll/ui/lib/utils';

import { DateTime } from '#components/date-time';
import { SessionActions } from '#components/session-actions';
import { formatDevice, formatLocation } from '#lib/utils';

type SessionsListProps = {
  sessions: SessionDto[];
};

export function Sessions({ sessions }: SessionsListProps) {
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
          const location = formatLocation(session);

          return (
            <TableRow key={session.id} className="group">
              <TableCell className="whitespace-normal">
                <span className="font-medium" title={session.userAgent ?? undefined}>
                  {formatDevice(session)}
                </span>
                {session.current && (
                  <Badge variant="secondary" className="ml-2 align-middle">
                    Current
                  </Badge>
                )}
              </TableCell>
              <TableCell className={cn('whitespace-normal', !location && 'text-muted-foreground')}>
                {location ?? 'Unknown'}
              </TableCell>
              <TableCell className="whitespace-normal">
                <DateTime iso={session.createdAt} />
              </TableCell>
              <TableCell className="whitespace-normal">
                <DateTime iso={session.lastActiveAt} />
              </TableCell>
              <TableCell className="w-10 text-right">
                <SessionActions session={session} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
