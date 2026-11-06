'use client';

import type { WorkspaceRole, WorkspaceMemberList } from '@postroll/contracts';
import { Badge } from '@postroll/ui/components/badge';
import { Table, TableRow, TableBody, TableHead, TableCell, TableHeader } from '@postroll/ui/components/table';

import { DateTime } from '#components/date-time';
import { MemberActions } from '#components/member-actions';

type WorkspaceMembersProps = {
  currentRole: WorkspaceRole;
  currentUserId: string;
  members: WorkspaceMemberList;
};

export function WorkspaceMembers({ currentRole, currentUserId, members }: WorkspaceMembersProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const displayName = member.name ?? member.username;

          return (
            <TableRow key={member.id} className="group">
              <TableCell className="whitespace-normal">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{displayName ?? member.email}</span>
                  {member.userId === currentUserId && <Badge variant="secondary">You</Badge>}
                </div>
                {displayName && <div className="text-muted-foreground text-sm">{member.email}</div>}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {member.role.toLowerCase()}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-normal">
                <DateTime iso={member.createdAt} />
              </TableCell>
              <TableCell className="w-10 text-right">
                {member.userId !== currentUserId && <MemberActions member={member} currentRole={currentRole} />}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
