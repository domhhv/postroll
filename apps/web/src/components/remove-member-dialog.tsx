import type { WorkspaceMemberDto } from '@postroll/contracts';
import { Alert, AlertTitle, AlertDescription } from '@postroll/ui/components/alert';
import { Button } from '@postroll/ui/components/button';
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogContent,
  DialogDescription,
} from '@postroll/ui/components/dialog';
import { toast } from '@postroll/ui/components/toast';
import { IconAlertSquareRounded } from '@tabler/icons-react';
import { useState, useTransition } from 'react';

import { PendingButton } from '#components/pending-button';
import { removeMemberAction } from '#lib/actions';
import { getMemberDisplayName } from '#lib/utils';

type RemoveMemberDialogProps = {
  member: WorkspaceMemberDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RemoveMemberDialog({ member, onOpenChange, open }: RemoveMemberDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const displayName = getMemberDisplayName(member);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(member.userId);

      if (result.status === 'error') {
        setError(result.message);

        return;
      }

      onOpenChange(false);
      toast.add({
        description: `${displayName} has been removed from the workspace.`,
        title: 'Member removed',
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
          <DialogTitle>Remove member</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove {displayName} from the workspace? They will lose access to it immediately.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <IconAlertSquareRounded />
            <AlertTitle>Failed to remove member</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <PendingButton
            idle="Remove"
            onClick={remove}
            pending={pending}
            variant="destructive"
            pendingLabel="Removing"
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
