'use client';

import type { WorkspaceDto } from '@postroll/contracts';
import { Alert, AlertTitle, AlertDescription } from '@postroll/ui/components/alert';
import { Button } from '@postroll/ui/components/button';
import { Field, FieldError, FieldLabel } from '@postroll/ui/components/field';
import { Input } from '@postroll/ui/components/input';
import { IconAlertSquareRounded } from '@tabler/icons-react';
import { useState, useEffect, useActionState } from 'react';

import { PendingButton } from '#components/pending-button';
import { updateWorkspaceAction, type WorkspaceFormState } from '#lib/actions';

const initialState: WorkspaceFormState = { status: 'idle' };

export function WorkspaceForm({ workspace }: { workspace: WorkspaceDto }) {
  const [state, formAction] = useActionState(updateWorkspaceAction, initialState);
  const [editing, setEditing] = useState(false);

  const values = state.status === 'idle' ? { name: workspace.name } : state.values;
  const canEdit = ['OWNER', 'ADMIN'].includes(workspace.role);

  useEffect(() => {
    if (state.status === 'success') {
      setEditing(false);
    }
  }, [state]);

  const nameError = state.status === 'error' ? state.fieldErrors?.['name'] : undefined;
  const formError = state.status === 'error' && !state.fieldErrors ? state.message : undefined;

  if (!editing) {
    return (
      <div className="space-y-6">
        {canEdit && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit workspace
          </Button>
        )}
        <dl className="space-y-4">
          <div className="space-y-1">
            <dt className="text-muted-foreground text-sm">Name</dt>
            <dd>{values.name}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form noValidate action={formAction} className="space-y-6">
      <input type="hidden" name="workspaceId" value={workspace.id} />
      <div className="flex gap-2">
        <PendingButton idle="Save" pendingLabel="Saving" />
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      <Field data-invalid={nameError ? true : undefined}>
        <FieldLabel htmlFor="workspace-name">Name</FieldLabel>
        <Input
          required
          name="name"
          id="workspace-name"
          placeholder="Acme Hiring"
          defaultValue={values.name}
          aria-invalid={nameError ? true : undefined}
        />
        {nameError && <FieldError errors={[{ message: nameError }]} />}
      </Field>
      {formError && (
        <Alert variant="destructive">
          <IconAlertSquareRounded />
          <AlertTitle>Failed to update workspace</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
