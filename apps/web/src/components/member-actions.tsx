import {
  type WorkspaceRole,
  compareWorkspaceRoles,
  type WorkspaceMemberDto,
  canManageWorkspaceMember,
  getAssignableWorkspaceRoles,
} from '@postroll/contracts';
import { Button } from '@postroll/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuSub,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@postroll/ui/components/dropdown-menu';
import { toast } from '@postroll/ui/components/toast';
import { IconDots, IconUserMinus, IconUserShield, IconArrowUpDashed, IconArrowDownDashed } from '@tabler/icons-react';
import { useState, useTransition } from 'react';

import { RemoveMemberDialog } from '#components/remove-member-dialog';
import { updateMemberRoleAction } from '#lib/actions';
import { formatRole, getMemberDisplayName } from '#lib/utils';

type MemberActionsProps = {
  currentRole: WorkspaceRole;
  member: WorkspaceMemberDto;
};

export function MemberActions({ currentRole, member }: MemberActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const assignableRoles = getAssignableWorkspaceRoles(currentRole, member.role);
  const canRemove = canManageWorkspaceMember(currentRole, member.role);

  if (!canRemove && assignableRoles.length === 0) {
    return null;
  }

  function changeRole(role: WorkspaceRole) {
    startTransition(async () => {
      const result = await updateMemberRoleAction(member.userId, role);

      if (result.status === 'error') {
        toast.add({ description: result.message, title: 'Failed to change role', type: 'error' });

        return;
      }

      toast.add({
        description: `${getMemberDisplayName(member)} is now ${formatRole(role)}.`,
        title: 'Role updated',
        type: 'success',
      });
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={pending}
              aria-label="Member actions"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 [@media(hover:none)]:opacity-100"
            />
          }
        >
          <IconDots />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          {assignableRoles.length > 0 && (
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <IconUserShield />
                  Change role
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {assignableRoles.map((role) => (
                    <DropdownMenuItem key={role} onClick={() => changeRole(role)}>
                      {compareWorkspaceRoles(role, member.role) > 0 ? <IconArrowUpDashed /> : <IconArrowDownDashed />}
                      {formatRole(role)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          )}
          {assignableRoles.length > 0 && canRemove && <DropdownMenuSeparator />}
          {canRemove && (
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
                <IconUserMinus />
                Remove from workspace
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <RemoveMemberDialog member={member} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </>
  );
}
