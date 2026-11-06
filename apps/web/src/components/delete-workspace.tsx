'use client';

import type { WorkspaceDto } from '@postroll/contracts';
import { Alert, AlertTitle, AlertDescription } from '@postroll/ui/components/alert';
import {
  AlertDialog,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogTrigger,
  AlertDialogDescription,
} from '@postroll/ui/components/alert-dialog';
import { Button } from '@postroll/ui/components/button';
import { Field, FieldLabel } from '@postroll/ui/components/field';
import { Input } from '@postroll/ui/components/input';
import { toast } from '@postroll/ui/components/toast';
import { IconAlertSquareRounded } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';

import { PendingButton } from '#components/pending-button';
import { deleteWorkspaceAction } from '#lib/actions';

type DeleteWorkspaceProps = {
  isOnlyWorkspace: boolean;
  workspace: WorkspaceDto;
};

export function DeleteWorkspace({ isOnlyWorkspace, workspace }: DeleteWorkspaceProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirmed = confirmation === workspace.name;

  function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!confirmed) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await deleteWorkspaceAction(workspace.id);

      if (result.status === 'error') {
        setError(result.message);

        return;
      }

      setOpen(false);
      toast.add({
        description: `${workspace.name} has been deleted.`,
        title: 'Workspace deleted',
        type: 'success',
      });
      router.replace('/dashboard');
    });
  }

  return (
    <div className="border-destructive/40 flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="font-medium">Delete this workspace</p>
        <p className="text-muted-foreground text-sm">
          {isOnlyWorkspace
            ? 'You cannot delete your only workspace. Create or join another workspace first.'
            : 'Permanently delete the workspace and remove all of its members. This cannot be undone.'}
        </p>
      </div>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) {
            return;
          }

          setError(null);
          setConfirmation('');
          setOpen(next);
        }}
      >
        <AlertDialogTrigger render={<Button className="shrink-0" variant="destructive" disabled={isOnlyWorkspace} />}>
          Delete workspace
        </AlertDialogTrigger>
        <AlertDialogContent>
          <form noValidate onSubmit={remove} className="grid gap-6">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete workspace</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong className="text-foreground">{workspace.name}</strong> and remove
                all of its members. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field>
              <FieldLabel htmlFor="delete-workspace-confirmation">
                Type <strong>{workspace.name}</strong> to confirm
              </FieldLabel>
              <Input
                autoComplete="off"
                disabled={pending}
                value={confirmation}
                id="delete-workspace-confirmation"
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
            {error && (
              <Alert variant="destructive">
                <IconAlertSquareRounded />
                <AlertTitle>Failed to delete workspace</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <PendingButton
                pending={pending}
                variant="destructive"
                disabled={!confirmed}
                idle="Delete workspace"
                pendingLabel="Deleting"
              />
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
