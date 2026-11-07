'use client';

import type { WorkspaceList } from '@postroll/contracts';
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
import { IconAlertSquareRounded } from '@tabler/icons-react';
import { useState, useTransition, type FormEvent } from 'react';

import { PendingButton } from '#components/pending-button';
import { deleteAccountAction } from '#lib/actions';
import { formatRole } from '#lib/utils';

type DeleteAccountProps = {
  email: string;
  workspaces: WorkspaceList;
};

function formatMemberCount(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

export function DeleteAccount({ email, workspaces }: DeleteAccountProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const owned = workspaces.filter((workspace) => workspace.role === 'OWNER');
  const shared = workspaces.filter((workspace) => workspace.role !== 'OWNER');
  const confirmed = confirmation.trim().toLowerCase() === email.toLowerCase();

  function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!confirmed) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await deleteAccountAction();
      setError(result.message);
    });
  }

  return (
    <div className="border-destructive/40 flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="font-medium">Delete account</p>
        <p className="text-muted-foreground text-sm">
          Permanently delete your account, the workspaces you own, and your access to shared workspaces. This cannot be
          undone.
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
        <AlertDialogTrigger render={<Button className="shrink-0" variant="destructive" />}>
          Delete account
        </AlertDialogTrigger>
        <AlertDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <form noValidate onSubmit={remove} className="flex min-h-0 flex-col gap-6">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your entire account along with the workspaces you own, and remove you from
                the workspaces shared with you. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="-mx-6 min-h-0 flex-1 space-y-6 overflow-y-auto px-6">
              {owned.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-medium">
                    {owned.length === 1 ? 'This workspace' : `These ${owned.length} workspaces`} will be deleted
                  </h3>
                  <ul className="divide-border divide-y rounded-md border">
                    {owned.map((workspace) => (
                      <li key={workspace.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                        <span className="truncate font-medium">{workspace.name}</span>
                        <span className="text-muted-foreground shrink-0">
                          {formatMemberCount(workspace.memberCount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {shared.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-medium">You will lose access to</h3>
                  <ul className="divide-border divide-y rounded-md border">
                    {shared.map((workspace) => (
                      <li key={workspace.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                        <span className="truncate font-medium">{workspace.name}</span>
                        <span className="text-muted-foreground shrink-0">{formatRole(workspace.role)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
            <Field>
              <FieldLabel htmlFor="delete-account-confirmation">
                Type <strong>{email}</strong> to confirm
              </FieldLabel>
              <Input
                type="email"
                autoComplete="off"
                disabled={pending}
                value={confirmation}
                id="delete-account-confirmation"
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
            {error && (
              <Alert variant="destructive">
                <IconAlertSquareRounded />
                <AlertTitle>Failed to delete account</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <PendingButton
                pending={pending}
                variant="destructive"
                disabled={!confirmed}
                idle="Delete account"
                pendingLabel="Deleting"
              />
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
