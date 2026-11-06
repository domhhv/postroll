'use client';

import { Alert, AlertTitle, AlertDescription } from '@postroll/ui/components/alert';
import { Button } from '@postroll/ui/components/button';
import { Checkbox } from '@postroll/ui/components/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel, FieldContent } from '@postroll/ui/components/field';
import { PasswordInput } from '@postroll/ui/components/password-input';
import { IconAlertSquareRounded } from '@tabler/icons-react';
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
        <Button variant="outline" onClick={() => setEditing(true)}>
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
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      <div className="space-y-4">
        <FieldGroup>
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
          <Field orientation="horizontal">
            <Checkbox id="revokeOtherSessions" name="revokeOtherSessions" />
            <FieldContent>
              <FieldLabel htmlFor="revokeOtherSessions">Sign out of other devices</FieldLabel>
            </FieldContent>
          </Field>
        </FieldGroup>
      </div>
      {state.status === 'error' && !fieldErrors && (
        <Alert variant="destructive">
          <IconAlertSquareRounded />
          <AlertTitle>Failed to changed password</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
