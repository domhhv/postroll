'use client';

import { Button } from '@postroll/ui/components/button';
import { Field, FieldError, FieldLabel } from '@postroll/ui/components/field';
import { PasswordInput } from '@postroll/ui/components/password-input';
import { useState, useEffect, useActionState } from 'react';

import { PendingButton } from '#components/pending-button';
import { changePasswordAction, type PasswordFormState } from '#lib/actions';
const passwordInitialState: PasswordFormState = { status: 'idle' };

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, passwordInitialState);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (state.status === 'success') {
      setEditing(false);
    }
  }, [state]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  if (!editing) {
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          onClick={() => {
            return setEditing(true);
          }}
        >
          Change password
        </Button>
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Password</p>
          <p className="text-foreground tracking-widest">{'•'.repeat(8)}</p>
        </div>
      </div>
    );
  }

  const currentPasswordError = fieldErrors?.['currentPassword'];
  const newPasswordError = fieldErrors?.['newPassword'];
  const confirmPasswordError = fieldErrors?.['confirmPassword'];

  return (
    <form noValidate action={formAction} className="space-y-6">
      <div className="flex gap-2">
        <PendingButton idle="Save" pendingLabel="Saving…" />
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            return setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
      <div className="space-y-4">
        <Field data-invalid={currentPasswordError ? true : undefined}>
          <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
          <PasswordInput
            id="currentPassword"
            name="currentPassword"
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={currentPasswordError ? true : undefined}
          />
          {currentPasswordError && <FieldError errors={[{ message: currentPasswordError }]} />}
        </Field>
        <Field data-invalid={newPasswordError ? true : undefined}>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <PasswordInput
            id="newPassword"
            name="newPassword"
            placeholder="••••••••"
            autoComplete="new-password"
            aria-invalid={newPasswordError ? true : undefined}
          />
          {newPasswordError && <FieldError errors={[{ message: newPasswordError }]} />}
        </Field>
        <Field data-invalid={confirmPasswordError ? true : undefined}>
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            placeholder="••••••••"
            autoComplete="new-password"
            aria-invalid={confirmPasswordError ? true : undefined}
          />
          {confirmPasswordError && <FieldError errors={[{ message: confirmPasswordError }]} />}
        </Field>
        <label htmlFor="revokeOtherSessions" className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            id="revokeOtherSessions"
            name="revokeOtherSessions"
            className="border-input accent-primary size-4 rounded"
          />
          Sign out of other devices
        </label>
      </div>
      {state.status === 'error' && !fieldErrors && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
