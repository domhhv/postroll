'use client';

import { Alert, AlertTitle, AlertDescription } from '@postroll/ui/components/alert';
import { Button } from '@postroll/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogContent,
  DialogDescription,
} from '@postroll/ui/components/dialog';
import { Field, FieldError, FieldLabel } from '@postroll/ui/components/field';
import { Input } from '@postroll/ui/components/input';
import { IconAlertSquareRounded } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useActionState } from 'react';

import { createWorkspaceAction, type CreateWorkspaceFormState } from '#lib/actions';

import { PendingButton } from './pending-button';

type CreateWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const initialState: CreateWorkspaceFormState = { status: 'idle' };

export function CreateWorkspaceDialog({ onOpenChange, open }: CreateWorkspaceDialogProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(createWorkspaceAction, initialState);

  useEffect(() => {
    if (state.status === 'success') {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  const nameError = state.status === 'error' ? state.fieldErrors?.['name'] : undefined;
  const nameValue = state.status === 'error' ? state.values.name : undefined;
  const formError = state.status === 'error' && !state.fieldErrors ? state.message : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>Workspaces keep videos, teammates, and reviews separate.</DialogDescription>
        </DialogHeader>
        <form noValidate action={formAction} className="flex flex-col gap-4">
          <Field data-invalid={nameError ? true : undefined}>
            <FieldLabel htmlFor="workspace-name">Name</FieldLabel>
            <Input
              required
              autoFocus
              name="name"
              id="workspace-name"
              defaultValue={nameValue}
              placeholder="Acme Hiring"
              aria-invalid={nameError ? true : undefined}
            />
            {nameError && <FieldError errors={[{ message: nameError }]} />}
          </Field>
          {formError && (
            <Alert variant="destructive">
              <IconAlertSquareRounded />
              <AlertTitle>Failed to sign create workspace</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <DialogClose
              render={(props) => (
                <Button {...props} type="button" variant="outline">
                  Cancel
                </Button>
              )}
            />
            <PendingButton idle="Create" pendingLabel="Creating" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
